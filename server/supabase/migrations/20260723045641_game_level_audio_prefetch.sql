-- Opt-in game-level audio preloading. Existing and older clients continue to
-- use the legacy per-round preparation flow.
alter table public.games
  add column full_game_audio_preload boolean not null default false,
  add column audio_preload_deadline timestamptz;

alter function private.service_claim_round_preparation(text, uuid, boolean)
  rename to service_claim_legacy_round_preparation;

create function private.game_preparation_status(p_game_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_total integer := 0;
  v_ready integer := 0;
  v_failed integer := 0;
  v_preparing integer := 0;
  v_error_code text;
  v_status text;
begin
  select
    count(*)::integer,
    count(*) filter (where rp.status = 'ready')::integer,
    count(*) filter (where rp.status = 'failed')::integer,
    count(*) filter (
      where rp.status = 'preparing' and rp.lease_until > clock_timestamp()
    )::integer
  into v_total, v_ready, v_failed, v_preparing
  from public.rounds r
  join private.round_preparations rp on rp.round_id = r.id
  where r.game_id = p_game_id;

  select rp.last_error_code
  into v_error_code
  from public.rounds r
  join private.round_preparations rp on rp.round_id = r.id
  where r.game_id = p_game_id and rp.status = 'failed'
  order by r.round_number
  limit 1;

  v_status := case
    when v_failed > 0 then 'failed'
    when v_total > 0 and v_ready = v_total then 'ready'
    when v_preparing > 0 then 'preparing'
    else 'progress'
  end;

  return jsonb_build_object(
    'status', v_status,
    'total_count', v_total,
    'ready_count', v_ready,
    'failed_count', v_failed,
    'error_code', v_error_code
  );
end;
$$;

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
    where game_id = v_room.current_game_id and round_number = v_room.current_round
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
      where room_id = p_room_id and left_at is null
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
        deadline_at = v_start + make_interval(secs => v_room.round_duration_seconds),
        reveal_ends_at = v_start + make_interval(
          secs => v_room.round_duration_seconds + v_room.reveal_duration_seconds
        )
      where id = v_round.id;
      update public.rooms set
        phase = 'countdown',
        phase_ends_at = v_start
      where id = p_room_id;
      perform private.emit_event(p_room_id, 'countdown_started');

    elsif v_room.phase_ends_at is null or v_room.phase_ends_at > clock_timestamp() then
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

    select * into v_room from public.rooms where id = p_room_id for update;
  end loop;
end;
$$;

create function private.start_preloaded_game(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_user();
  v_room_id uuid;
  v_game_id uuid;
begin
  -- Reuse the legacy start path so validation, planning, and event behavior
  -- remain identical for both client generations.
  perform private.start_game(p_code);

  select r.id, r.current_game_id
  into v_room_id, v_game_id
  from public.rooms r
  where r.code = private.clean_room_code(p_code)
    and r.host_user_id = v_user_id
  for update;

  if v_game_id is null then
    raise exception using errcode = 'P0001', message = 'GAME_NOT_STARTED';
  end if;

  update public.games
  set
    full_game_audio_preload = true,
    audio_preload_deadline = clock_timestamp() + interval '60 seconds'
  where id = v_game_id;

  perform private.emit_event(v_room_id, 'game_audio_preload_requested');
  return private.room_state(v_room_id, v_user_id);
end;
$$;

create or replace function private.service_claim_round_preparation(
  p_code text,
  p_user_id uuid,
  p_force_retry boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_round public.rounds;
  v_plan private.round_plans;
  v_preparation private.round_preparations;
  v_track private.tracks;
  v_claim_round_id uuid;
  v_active_round_id uuid;
  v_used_ids jsonb := '[]'::jsonb;
  v_full_game_audio_preload boolean := false;
begin
  select * into v_room
  from public.rooms
  where code = private.clean_room_code(p_code)
  for update;
  if not found then raise exception using errcode = 'P0001', message = 'ROOM_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.players
    where room_id = v_room.id and user_id = p_user_id and left_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'NOT_IN_ROOM';
  end if;
  if p_force_retry and v_room.host_user_id <> p_user_id then
    raise exception using errcode = 'P0001', message = 'HOST_ONLY';
  end if;

  perform private.advance_room_locked(v_room.id);
  select * into v_room from public.rooms where id = v_room.id for update;
  if v_room.phase <> 'preparing' then
    return private.game_preparation_status(v_room.current_game_id)
      || jsonb_build_object('status', v_room.phase);
  end if;

  select g.full_game_audio_preload
  into v_full_game_audio_preload
  from public.games g
  where g.id = v_room.current_game_id;

  if not v_full_game_audio_preload then
    return private.service_claim_legacy_round_preparation(
      p_code,
      p_user_id,
      p_force_retry
    );
  end if;

  if p_force_retry then
    update private.round_preparations rp
    set
      status = 'pending',
      lease_until = null,
      last_error_code = null,
      ready_at = null
    from public.rounds r
    where rp.round_id = r.id
      and r.game_id = v_room.current_game_id
      and rp.status = 'failed';
  end if;

  select r.id into v_active_round_id
  from public.rounds r
  join private.round_preparations rp on rp.round_id = r.id
  where r.game_id = v_room.current_game_id
    and rp.status = 'preparing'
    and rp.lease_until > clock_timestamp()
  order by r.round_number
  limit 1;
  if v_active_round_id is not null then
    return private.game_preparation_status(v_room.current_game_id)
      || jsonb_build_object(
        'status', 'preparing',
        'round_id', v_active_round_id
      );
  end if;

  if exists (
    select 1
    from public.rounds r
    join private.round_preparations rp on rp.round_id = r.id
    where r.game_id = v_room.current_game_id and rp.status = 'failed'
  ) then
    return private.game_preparation_status(v_room.current_game_id);
  end if;

  select r.id into v_claim_round_id
  from public.rounds r
  join private.round_preparations rp on rp.round_id = r.id
  where r.game_id = v_room.current_game_id
    and (
      rp.status = 'pending'
      or (rp.status = 'preparing' and rp.lease_until <= clock_timestamp())
    )
  order by r.round_number
  limit 1
  for update of rp skip locked;

  if v_claim_round_id is null then
    return private.game_preparation_status(v_room.current_game_id);
  end if;

  select * into v_round from public.rounds where id = v_claim_round_id;
  select * into v_plan from private.round_plans where round_id = v_round.id;
  select * into v_preparation
  from private.round_preparations where round_id = v_round.id for update;

  if v_room.song_pack = 'demo' then
    select t.* into v_track
    from private.tracks t
    where t.provider = 'project' and t.pack = 'demo' and t.enabled
      and t.correct_answer = v_plan.planned_answer
      and not exists (
        select 1
        from public.rounds used_round
        join private.round_preparations used_prep on used_prep.round_id = used_round.id
        where used_round.game_id = v_room.current_game_id
          and used_prep.track_id = t.id
      )
    order by gen_random_uuid()
    limit 1;
    if not found then
      select t.* into v_track
      from private.tracks t
      where t.provider = 'project' and t.pack = 'demo' and t.enabled
        and t.correct_answer = v_plan.planned_answer
      order by gen_random_uuid()
      limit 1;
    end if;
  elsif v_plan.planned_answer = 'ai' then
    select t.* into v_track
    from private.tracks t
    where t.provider = 'suno' and t.pack = 'dynamic' and t.enabled
      and not exists (
        select 1
        from public.rounds used_round
        join private.round_preparations used_prep on used_prep.round_id = used_round.id
        where used_round.game_id = v_room.current_game_id
          and used_prep.track_id = t.id
      )
    order by gen_random_uuid()
    limit 1;
    if not found then
      select t.* into v_track
      from private.tracks t
      where t.provider = 'suno' and t.pack = 'dynamic' and t.enabled
      order by t.last_used_at nulls first, gen_random_uuid()
      limit 1;
    end if;
  end if;

  if v_track.id is not null then
    update private.round_preparations set
      status = 'ready',
      attempts = attempts + 1,
      lease_until = null,
      last_error_code = null,
      track_id = v_track.id,
      ready_at = clock_timestamp()
    where round_id = v_round.id;
    insert into private.round_secrets (round_id, track_id)
    values (v_round.id, v_track.id)
    on conflict (round_id) do update set track_id = excluded.track_id;
    update private.tracks set last_used_at = clock_timestamp() where id = v_track.id;
    perform private.emit_event(v_room.id, 'round_audio_prepared');
    return private.game_preparation_status(v_room.current_game_id);
  end if;

  if v_plan.planned_answer <> 'real' then
    update private.round_preparations set
      status = 'failed',
      lease_until = null,
      last_error_code = 'NOT_ENOUGH_AI_TRACKS'
    where round_id = v_round.id;
    perform private.emit_event(v_room.id, 'round_preparation_failed');
    return private.game_preparation_status(v_room.current_game_id);
  end if;

  update private.round_preparations set
    status = 'preparing',
    attempts = attempts + 1,
    lease_until = clock_timestamp() + interval '45 seconds',
    last_error_code = null,
    track_id = null,
    ready_at = null
  where round_id = v_round.id;

  select coalesce(jsonb_agg(t.provider_track_id), '[]'::jsonb)
  into v_used_ids
  from public.rounds used_round
  join private.round_preparations used_prep on used_prep.round_id = used_round.id
  join private.tracks t on t.id = used_prep.track_id
  where used_round.game_id = v_room.current_game_id and t.provider = 'jamendo';

  return private.game_preparation_status(v_room.current_game_id)
    || jsonb_build_object(
      'status', 'claimed',
      'round_id', v_round.id,
      'answer_type', v_plan.planned_answer,
      'used_provider_track_ids', v_used_ids
    );
end;
$$;

create function private.service_game_preparation_status(
  p_code text,
  p_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_status jsonb;
  v_stalled jsonb := '[]'::jsonb;
  v_deadline timestamptz;
  v_required integer := 0;
  v_player_ready integer := 0;
begin
  select * into v_room
  from public.rooms
  where code = private.clean_room_code(p_code);
  if not found then raise exception using errcode = 'P0001', message = 'ROOM_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.players
    where room_id = v_room.id and user_id = p_user_id and left_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'NOT_IN_ROOM';
  end if;
  select g.audio_preload_deadline
  into v_deadline
  from public.games g
  where g.id = v_room.current_game_id
    and g.full_game_audio_preload;

  select count(*)::integer
  into v_required
  from public.players p
  where p.room_id = v_room.id
    and p.left_at is null
    and p.last_seen_at > clock_timestamp() - interval '30 seconds';

  select count(*)::integer
  into v_player_ready
  from public.players p
  where p.room_id = v_room.id
    and p.left_at is null
    and p.last_seen_at > clock_timestamp() - interval '30 seconds'
    and not exists (
      select 1
      from public.rounds r
      where r.game_id = v_room.current_game_id
        and not exists (
          select 1
          from private.round_audio_ready ar
          where ar.round_id = r.id and ar.player_id = p.id
        )
    );

  if v_deadline is not null and v_deadline <= clock_timestamp() then
    select coalesce(
      jsonb_agg(
        jsonb_build_object('id', p.id, 'nickname', p.nickname)
        order by p.joined_at, p.id
      ),
      '[]'::jsonb
    )
    into v_stalled
    from public.players p
    where p.room_id = v_room.id
      and p.left_at is null
      and p.last_seen_at > clock_timestamp() - interval '30 seconds'
      and exists (
        select 1
        from public.rounds r
        where r.game_id = v_room.current_game_id
          and not exists (
            select 1
            from private.round_audio_ready ar
            where ar.round_id = r.id and ar.player_id = p.id
          )
      );
  end if;

  v_status := private.game_preparation_status(v_room.current_game_id);
  return v_status || jsonb_build_object(
    'player_ready_count', v_player_ready,
    'player_required_count', v_required,
    'audio_preload_deadline', v_deadline,
    'timed_out', v_deadline is not null
      and v_deadline <= clock_timestamp()
      and v_player_ready < v_required,
    'stalled_players', v_stalled
  );
end;
$$;

create function private.service_game_audio_access(
  p_code text,
  p_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_tracks jsonb;
begin
  select * into v_room
  from public.rooms
  where code = private.clean_room_code(p_code);
  if not found then raise exception using errcode = 'P0001', message = 'ROOM_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.players
    where room_id = v_room.id and user_id = p_user_id and left_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'NOT_IN_ROOM';
  end if;
  if exists (
    select 1
    from public.rounds r
    join private.round_preparations rp on rp.round_id = r.id
    where r.game_id = v_room.current_game_id and rp.status <> 'ready'
  ) then
    raise exception using errcode = 'P0001', message = 'AUDIO_NOT_READY';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'round_id', r.id,
        'storage_path', t.storage_path,
        'fallback_url', case
          when t.storage_path is null and t.audio_filename is not null
            then '/audio/' || t.audio_filename
          else null
        end
      )
      order by encode(extensions.digest(r.id::text, 'sha256'), 'hex')
    ),
    '[]'::jsonb
  )
  into v_tracks
  from public.rounds r
  join private.round_preparations rp
    on rp.round_id = r.id and rp.status = 'ready'
  join private.tracks t on t.id = rp.track_id
  where r.game_id = v_room.current_game_id;

  return jsonb_build_object('tracks', v_tracks);
end;
$$;

create function private.mark_game_audio_ready(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_user();
  v_room public.rooms;
  v_player public.players;
begin
  select * into v_room
  from public.rooms
  where code = private.clean_room_code(p_code)
  for update;
  if not found then raise exception using errcode = 'P0001', message = 'ROOM_NOT_FOUND'; end if;
  select * into v_player
  from public.players
  where room_id = v_room.id and user_id = v_user_id and left_at is null;
  if not found then raise exception using errcode = 'P0001', message = 'NOT_IN_ROOM'; end if;

  perform private.advance_room_locked(v_room.id);
  select * into v_room from public.rooms where id = v_room.id for update;
  if v_room.phase <> 'preparing' then
    return private.room_state(v_room.id, v_user_id);
  end if;
  if exists (
    select 1
    from public.rounds r
    join private.round_preparations rp on rp.round_id = r.id
    where r.game_id = v_room.current_game_id and rp.status <> 'ready'
  ) then
    raise exception using errcode = 'P0001', message = 'AUDIO_NOT_READY';
  end if;

  update public.players
  set last_seen_at = clock_timestamp()
  where id = v_player.id;
  insert into private.round_audio_ready (round_id, player_id)
  select r.id, v_player.id
  from public.rounds r
  where r.game_id = v_room.current_game_id
  on conflict (round_id, player_id) do update
  set ready_at = excluded.ready_at;

  perform private.emit_event(v_room.id, 'player_game_audio_ready');
  perform private.advance_room_locked(v_room.id);
  return private.room_state(v_room.id, v_user_id);
end;
$$;

create function public.mark_game_audio_ready(p_code text)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$ select private.mark_game_audio_ready(p_code); $$;

create function public.start_preloaded_game(p_code text)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$ select private.start_preloaded_game(p_code); $$;

create function public.service_game_preparation_status(
  p_code text,
  p_user_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.service_game_preparation_status(p_code, p_user_id); $$;

create function public.service_game_audio_access(
  p_code text,
  p_user_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.service_game_audio_access(p_code, p_user_id); $$;

revoke all on function private.game_preparation_status(uuid)
  from public, anon, authenticated;
revoke all on function private.service_claim_legacy_round_preparation(text, uuid, boolean)
  from public, anon, authenticated;
revoke all on function private.service_claim_round_preparation(text, uuid, boolean)
  from public, anon, authenticated;
revoke all on function private.service_game_preparation_status(text, uuid)
  from public, anon, authenticated;
revoke all on function private.service_game_audio_access(text, uuid)
  from public, anon, authenticated;
revoke all on function private.mark_game_audio_ready(text)
  from public, anon, authenticated;
revoke all on function private.start_preloaded_game(text)
  from public, anon, authenticated;
revoke all on function public.service_game_preparation_status(text, uuid)
  from public, anon, authenticated;
revoke all on function public.service_game_audio_access(text, uuid)
  from public, anon, authenticated;
revoke all on function public.mark_game_audio_ready(text)
  from public, anon, authenticated;
revoke all on function public.start_preloaded_game(text)
  from public, anon, authenticated;

grant execute on function private.mark_game_audio_ready(text) to authenticated;
grant execute on function public.mark_game_audio_ready(text) to authenticated;
grant execute on function private.start_preloaded_game(text) to authenticated;
grant execute on function public.start_preloaded_game(text) to authenticated;
grant execute on function private.service_game_preparation_status(text, uuid)
  to service_role;
grant execute on function private.service_claim_legacy_round_preparation(text, uuid, boolean)
  to service_role;
grant execute on function private.service_claim_round_preparation(text, uuid, boolean)
  to service_role;
grant execute on function private.service_game_audio_access(text, uuid)
  to service_role;
grant execute on function public.service_game_preparation_status(text, uuid)
  to service_role;
grant execute on function public.service_game_audio_access(text, uuid)
  to service_role;
