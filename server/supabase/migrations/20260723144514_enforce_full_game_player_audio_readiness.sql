-- A preloaded game is ready only when every active player has acknowledged
-- every round. Legacy games continue to gate on the active round alone.
create or replace function private.advance_room_locked(p_room_id uuid)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_game public.games;
  v_round public.rounds;
  v_preparation private.round_preparations;
  v_anchor timestamptz;
  v_start timestamptz;
  v_next_round integer;
  v_active_count integer;
  v_ready_count integer;
  v_iterations integer := 0;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then return; end if;

  perform private.transfer_host_if_needed(p_room_id, false);
  select * into v_room from public.rooms where id = p_room_id for update;

  loop
    exit when v_room.phase in ('lobby', 'finished') or v_iterations >= 20;
    v_iterations := v_iterations + 1;

    select * into v_round
    from public.rounds
    where game_id = v_room.current_game_id
      and round_number = v_room.current_round
    for update;
    select * into v_game
    from public.games
    where id = v_room.current_game_id;

    if v_room.phase = 'preparing' then
      select * into v_preparation
      from private.round_preparations
      where round_id = v_round.id
      for update;

      select count(*) into v_active_count
      from public.players
      where room_id = p_room_id
        and left_at is null
        and last_seen_at > clock_timestamp() - interval '30 seconds';

      select count(*) into v_ready_count
      from public.players p
      where p.room_id = p_room_id
        and p.left_at is null
        and p.last_seen_at > clock_timestamp() - interval '30 seconds'
        and (
          (
            not v_game.full_game_audio_preload
            and exists (
              select 1
              from private.round_audio_ready ar
              where ar.round_id = v_round.id and ar.player_id = p.id
            )
          )
          or (
            v_game.full_game_audio_preload
            and not exists (
              select 1
              from public.rounds game_round
              where game_round.game_id = v_room.current_game_id
                and not exists (
                  select 1
                  from private.round_audio_ready ar
                  where ar.round_id = game_round.id
                    and ar.player_id = p.id
                )
            )
          )
        );

      if (
        v_game.full_game_audio_preload
        and exists (
          select 1
          from public.rounds game_round
          join private.round_preparations game_prep
            on game_prep.round_id = game_round.id
          where game_round.game_id = v_room.current_game_id
            and game_prep.status <> 'ready'
        )
      ) or (
        not v_game.full_game_audio_preload
        and v_preparation.status <> 'ready'
      )
         or v_active_count = 0
         or v_ready_count < v_active_count then
        exit;
      end if;

      v_start := clock_timestamp() + interval '4 seconds';
      update public.rounds set
        starts_at = v_start,
        deadline_at = v_start
          + make_interval(secs => v_room.round_duration_seconds),
        reveal_ends_at = v_start + make_interval(
          secs => v_room.round_duration_seconds
            + v_room.reveal_duration_seconds
        )
      where id = v_round.id;
      update public.rooms set
        phase = 'countdown',
        phase_ends_at = v_start
      where id = p_room_id;
      perform private.emit_event(p_room_id, 'countdown_started');

    elsif v_room.phase_ends_at is null
       or v_room.phase_ends_at > clock_timestamp() then
      exit;

    elsif v_room.phase = 'countdown' then
      update public.rounds set status = 'active' where id = v_round.id;
      update public.rooms set
        phase = 'playing',
        phase_ends_at = v_round.deadline_at
      where id = p_room_id;
      perform private.emit_event(p_room_id, 'round_started');

    elsif v_room.phase = 'playing' then
      perform private.score_round(v_round.id);
      update public.rooms set
        phase = 'reveal',
        phase_ends_at = v_round.reveal_ends_at
      where id = p_room_id;
      perform private.emit_event(p_room_id, 'round_revealed');

    elsif v_room.phase = 'reveal' then
      v_anchor := v_room.phase_ends_at;
      if v_room.current_round >= v_room.round_count then
        update public.rooms set
          phase = 'finished',
          phase_ends_at = null,
          expires_at = clock_timestamp() + interval '2 hours'
        where id = p_room_id;
        update public.games set
          status = 'finished',
          finished_at = clock_timestamp()
        where id = v_room.current_game_id;
        perform private.emit_event(p_room_id, 'game_finished');
      else
        update public.rooms set
          phase = 'intermission',
          phase_ends_at = v_anchor + interval '4 seconds'
        where id = p_room_id;
        perform private.emit_event(p_room_id, 'leaderboard');
      end if;

    elsif v_room.phase = 'intermission' then
      v_next_round := v_room.current_round + 1;
      update public.rooms set
        current_round = v_next_round,
        phase = 'preparing',
        phase_ends_at = null
      where id = p_room_id;
      perform private.emit_event(p_room_id, 'round_preparation_requested');
    end if;

    select * into v_room
    from public.rooms
    where id = p_room_id
    for update;
  end loop;
end;
$$;
