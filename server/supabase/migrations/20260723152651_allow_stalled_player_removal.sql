-- Hosts may remove an active player who is still missing game audio after the
-- authoritative preload deadline. Lobby removal behavior remains unchanged.
create or replace function private.remove_player(p_code text, p_player_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_user();
  v_room public.rooms;
  v_game public.games;
  v_player public.players;
  v_timeout_removal boolean := false;
begin
  select * into v_room
  from public.rooms
  where code = private.clean_room_code(p_code)
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ROOM_NOT_FOUND';
  end if;
  if v_room.host_user_id <> v_user_id then
    raise exception using errcode = 'P0001', message = 'HOST_ONLY';
  end if;

  select * into v_player
  from public.players
  where id = p_player_id
    and room_id = v_room.id
    and left_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'PLAYER_NOT_FOUND';
  end if;
  if v_player.user_id = v_user_id then
    raise exception using errcode = 'P0001', message = 'HOST_CANNOT_REMOVE_SELF';
  end if;

  if v_room.phase = 'preparing' then
    select * into v_game
    from public.games
    where id = v_room.current_game_id;

    if not found
       or not v_game.full_game_audio_preload
       or v_game.audio_preload_deadline is null
       or v_game.audio_preload_deadline > clock_timestamp() then
      raise exception using errcode = 'P0001', message = 'PRELOAD_DEADLINE_ACTIVE';
    end if;
    if v_player.last_seen_at <= clock_timestamp() - interval '30 seconds'
       or not exists (
         select 1
         from public.rounds r
         where r.game_id = v_game.id
           and not exists (
             select 1
             from private.round_audio_ready ar
             where ar.round_id = r.id
               and ar.player_id = v_player.id
           )
       ) then
      raise exception using errcode = 'P0001', message = 'PLAYER_NOT_STALLED';
    end if;

    v_timeout_removal := true;
  elsif v_room.phase <> 'lobby' then
    raise exception using errcode = 'P0001', message = 'LOBBY_CLOSED';
  end if;

  update public.players
  set left_at = clock_timestamp(), is_ready = false
  where id = v_player.id;

  perform private.emit_event(v_room.id, 'player_removed');

  if v_timeout_removal then
    perform private.advance_room_locked(v_room.id);
  end if;

  return private.room_state(v_room.id, v_user_id);
end;
$$;
