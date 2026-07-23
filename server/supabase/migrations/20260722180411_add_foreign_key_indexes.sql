-- Cover foreign keys used by cleanup, host transfer, and score joins.
create index round_secrets_track_idx on private.round_secrets (track_id);
create index rooms_current_game_idx
  on public.rooms (current_game_id)
  where current_game_id is not null;
create index rooms_host_user_idx on public.rooms (host_user_id);
create index scores_player_idx on public.scores (player_id);
