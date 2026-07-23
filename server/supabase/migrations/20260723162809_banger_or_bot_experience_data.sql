alter table public.games
  add column audio_playlist_revision integer not null default 1
  check (audio_playlist_revision > 0);

create or replace function private.game_preparation_status(p_game_id uuid)
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
  v_revision integer := 1;
  v_error_code text;
  v_status text;
begin
  select g.audio_playlist_revision
  into v_revision
  from public.games g
  where g.id = p_game_id;

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
    'error_code', v_error_code,
    'playlist_revision', coalesce(v_revision, 1)
  );
end;
$$;

create function private.service_skip_game_track(
  p_code text,
  p_user_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_game public.games;
  v_round_id uuid;
begin
  select * into v_room
  from public.rooms
  where code = private.clean_room_code(p_code)
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ROOM_NOT_FOUND';
  end if;
  if not exists (
    select 1
    from public.players
    where room_id = v_room.id
      and user_id = p_user_id
      and left_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'NOT_IN_ROOM';
  end if;
  if v_room.host_user_id <> p_user_id then
    raise exception using errcode = 'P0001', message = 'HOST_ONLY';
  end if;
  if v_room.phase <> 'preparing' then
    raise exception using errcode = 'P0001', message = 'SKIP_NOT_AVAILABLE';
  end if;

  select * into v_game
  from public.games
  where id = v_room.current_game_id
  for update;

  if not found or not v_game.full_game_audio_preload then
    raise exception using errcode = 'P0001', message = 'SKIP_NOT_AVAILABLE';
  end if;

  select r.id
  into v_round_id
  from public.rounds r
  join private.round_preparations rp on rp.round_id = r.id
  where r.game_id = v_game.id
  order by
    case rp.status
      when 'failed' then 0
      when 'preparing' then 1
      when 'pending' then 2
      else 3
    end,
    r.round_number
  limit 1
  for update of rp;

  if v_round_id is null then
    raise exception using errcode = 'P0001', message = 'SKIP_NOT_AVAILABLE';
  end if;

  update private.round_preparations
  set
    status = 'pending',
    lease_until = null,
    last_error_code = null,
    ready_at = null
  where round_id = v_round_id;

  delete from private.round_secrets where round_id = v_round_id;
  delete from private.round_audio_ready ar
  using public.rounds r
  where ar.round_id = r.id and r.game_id = v_game.id;

  update public.games
  set audio_playlist_revision = audio_playlist_revision + 1
  where id = v_game.id;

  perform private.emit_event(v_room.id, 'game_track_skipped');
  return private.service_game_preparation_status(p_code, p_user_id);
end;
$$;

create function public.service_skip_game_track(
  p_code text,
  p_user_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$ select private.service_skip_game_track(p_code, p_user_id); $$;

create or replace function private.room_state(p_room_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_me public.players;
  v_game public.games;
  v_round public.rounds;
  v_track private.tracks;
  v_preparation private.round_preparations;
  v_answer public.answers;
  v_players jsonb := '[]'::jsonb;
  v_leaderboard jsonb := '[]'::jsonb;
  v_round_history jsonb := '[]'::jsonb;
  v_submitted_count integer := 0;
  v_ready_count integer := 0;
  v_required_ready_count integer := 0;
  v_round_payload jsonb := null;
  v_revealed boolean := false;
begin
  select * into v_room from public.rooms where id = p_room_id;
  select * into v_me
  from public.players
  where room_id = p_room_id and user_id = p_user_id and left_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_IN_ROOM';
  end if;

  if v_room.current_game_id is not null then
    select * into v_game from public.games where id = v_room.current_game_id;
    select * into v_round
    from public.rounds
    where game_id = v_room.current_game_id
      and round_number = v_room.current_round;

    if v_round.id is not null then
      select * into v_preparation
      from private.round_preparations where round_id = v_round.id;
      if v_preparation.track_id is not null then
        select * into v_track
        from private.tracks where id = v_preparation.track_id;
      end if;
      select * into v_answer
      from public.answers
      where round_id = v_round.id and player_id = v_me.id;
      select count(*) into v_submitted_count
      from public.answers where round_id = v_round.id;
      select count(*) into v_ready_count
      from private.round_audio_ready ar
      join public.players p on p.id = ar.player_id
      where ar.round_id = v_round.id
        and p.left_at is null
        and p.last_seen_at > clock_timestamp() - interval '30 seconds';
      select count(*) into v_required_ready_count
      from public.players p
      where p.room_id = p_room_id
        and p.left_at is null
        and p.last_seen_at > clock_timestamp() - interval '30 seconds';

      v_revealed := v_room.phase in ('reveal', 'intermission', 'finished');
      v_round_payload := jsonb_build_object(
        'id', v_round.id,
        'number', v_round.round_number,
        'total', v_room.round_count,
        'starts_at', v_round.starts_at,
        'deadline_at', v_round.deadline_at,
        'audio_url', case
          when v_track.storage_path is null
            and v_track.audio_filename is not null
            then '/audio/' || v_track.audio_filename
          else null
        end,
        'audio_available', v_preparation.status = 'ready',
        'audio_duration_seconds', v_track.duration_seconds,
        'preparation_status', coalesce(v_preparation.status, 'pending'),
        'preparation_error', v_preparation.last_error_code,
        'audio_ready_count', v_ready_count,
        'audio_required_count', v_required_ready_count,
        'submitted_count', v_submitted_count,
        'own_answer', case
          when v_answer.id is null then null else v_answer.choice
        end,
        'own_points', case
          when v_revealed then coalesce(v_answer.total_points, 0) else null
        end,
        'answered_in_seconds', case
          when v_revealed and v_answer.id is not null
            then greatest(
              0,
              extract(epoch from (v_answer.submitted_at - v_round.starts_at))
            )
          else null
        end,
        'correct_answer', case
          when v_revealed then v_track.correct_answer else null
        end,
        'title', case when v_revealed then v_track.title else null end,
        'artist', case when v_revealed then v_track.artist else null end,
        'source_type', case
          when v_revealed then v_track.source_type else null
        end,
        'provider', case when v_revealed then v_track.provider else null end,
        'source_url', case
          when v_revealed then v_track.source_url else null
        end,
        'license_url', case
          when v_revealed then v_track.license_url else null
        end,
        'genres', case
          when v_revealed then to_jsonb(v_track.genres) else null
        end,
        'reveal_description', case
          when v_revealed then v_track.reveal_description else null
        end,
        'license_note', case
          when v_revealed then v_track.license_note else null
        end
      );
    end if;

    select coalesce(
      jsonb_agg(history_item order by round_number),
      '[]'::jsonb
    )
    into v_round_history
    from (
      select
        r.round_number,
        jsonb_build_object(
          'round_number', r.round_number,
          'title', t.title,
          'artist', t.artist,
          'answer_type', t.correct_answer,
          'provider', t.provider,
          'source_url', t.source_url,
          'license_url', t.license_url,
          'own_answer', a.choice,
          'own_points', coalesce(a.total_points, 0),
          'was_correct', coalesce(a.choice = t.correct_answer, false)
        ) as history_item
      from public.rounds r
      join private.round_preparations rp
        on rp.round_id = r.id and rp.status = 'ready'
      join private.tracks t on t.id = rp.track_id
      left join public.answers a
        on a.round_id = r.id and a.player_id = v_me.id
      where r.game_id = v_room.current_game_id and r.status = 'scored'
    ) history;
  end if;

  select coalesce(
    jsonb_agg(player_json order by joined_at, id),
    '[]'::jsonb
  )
  into v_players
  from (
    select
      p.joined_at,
      p.id,
      jsonb_build_object(
        'id', p.id,
        'nickname', p.nickname,
        'is_ready', p.is_ready,
        'is_host', p.user_id = v_room.host_user_id,
        'is_connected',
          p.last_seen_at > clock_timestamp() - interval '30 seconds',
        'score', p.score,
        'has_submitted', case
          when v_round.id is null then false
          else exists (
            select 1
            from public.answers a
            where a.round_id = v_round.id and a.player_id = p.id
          )
        end
      ) as player_json
    from public.players p
    where p.room_id = p_room_id and p.left_at is null
  ) listed_players;

  select coalesce(
    jsonb_agg(rank_json order by score desc, joined_at, id),
    '[]'::jsonb
  )
  into v_leaderboard
  from (
    select
      p.score,
      p.joined_at,
      p.id,
      jsonb_build_object(
        'id', p.id,
        'nickname', p.nickname,
        'score', p.score,
        'is_host', p.user_id = v_room.host_user_id,
        'is_me', p.id = v_me.id
      ) as rank_json
    from public.players p
    where p.room_id = p_room_id and p.left_at is null
  ) ranked_players;

  return jsonb_build_object(
    'server_now', clock_timestamp(),
    'room', jsonb_build_object(
      'id', v_room.id,
      'code', v_room.code,
      'phase', v_room.phase,
      'phase_ends_at', v_room.phase_ends_at,
      'current_round', v_room.current_round,
      'created_at', v_room.created_at,
      'settings', jsonb_build_object(
        'round_count', v_room.round_count,
        'round_duration_seconds', v_room.round_duration_seconds,
        'reveal_duration_seconds', v_room.reveal_duration_seconds,
        'negative_points', v_room.negative_points,
        'allow_answer_changes', v_room.allow_answer_changes,
        'music_volume', v_room.music_volume,
        'song_pack', v_room.song_pack
      )
    ),
    'me', jsonb_build_object(
      'id', v_me.id,
      'nickname', v_me.nickname,
      'is_host', v_me.user_id = v_room.host_user_id,
      'is_ready', v_me.is_ready
    ),
    'players', v_players,
    'round', v_round_payload,
    'round_history', v_round_history,
    'leaderboard', v_leaderboard
  );
end;
$$;

revoke all on function private.service_skip_game_track(text, uuid)
  from public, anon, authenticated;
revoke all on function public.service_skip_game_track(text, uuid)
  from public, anon, authenticated;
grant execute on function private.service_skip_game_track(text, uuid)
  to service_role;
grant execute on function public.service_skip_game_track(text, uuid)
  to service_role;
