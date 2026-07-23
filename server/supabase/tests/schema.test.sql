begin;

select plan(38);

select has_schema('private', 'private schema exists');
select has_table('public', 'rooms', 'rooms table exists');
select has_table('public', 'players', 'players table exists');
select has_table('public', 'games', 'games table exists');
select has_table('public', 'rounds', 'rounds table exists');
select has_table('public', 'answers', 'answers table exists');
select has_table('public', 'scores', 'scores table exists');
select has_table('public', 'room_events', 'room events table exists');
select has_table('private', 'tracks', 'private tracks table exists');
select has_column('private', 'tracks', 'provider', 'track provider metadata exists');
select has_column('private', 'tracks', 'storage_path', 'private audio path exists');
select has_column('private', 'tracks', 'source_url', 'track source URL exists');
select has_column('private', 'tracks', 'license_url', 'track license URL exists');
select has_column('private', 'tracks', 'genres', 'future genre tags exist');
select has_table(
  'private',
  'round_secrets',
  'hidden round classification table exists'
);
select has_table('private', 'round_plans', 'hidden balanced round plans table exists');
select has_table(
  'private',
  'round_preparations',
  'private round preparation table exists'
);
select has_table(
  'private',
  'round_audio_ready',
  'private per-player audio readiness table exists'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.rooms'::regclass),
  true,
  'rooms has row level security enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.answers'::regclass),
  true,
  'answers has row level security enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'private.round_preparations'::regclass),
  true,
  'round preparations have row level security enabled'
);
select is(
  (select public from storage.buckets where id = 'track-audio'),
  false,
  'track audio bucket is private'
);
select has_function(
  'public',
  'create_room',
  array['text', 'jsonb'],
  'create_room RPC exists'
);
select has_function(
  'public',
  'mark_round_audio_ready',
  array['text', 'uuid'],
  'audio readiness RPC exists'
);
select has_function(
  'public',
  'service_claim_round_preparation',
  array['text', 'uuid', 'boolean'],
  'service preparation claim RPC exists'
);
select has_function(
  'public',
  'service_round_audio_access',
  array['text', 'uuid', 'uuid'],
  'service audio access RPC exists'
);
select has_function(
  'private',
  'balanced_round_plan',
  array['integer'],
  'balanced round planner exists'
);
select ok(
  (
    select count(*) = 6
      and count(*) filter (where planned_answer = 'real') = 3
      and count(*) filter (where planned_answer = 'ai') = 3
    from private.balanced_round_plan(6)
  ),
  'even round plans contain equal real and AI rounds'
);
select ok(
  (
    select count(*) = 5
      and abs(
        count(*) filter (where planned_answer = 'real')
        - count(*) filter (where planned_answer = 'ai')
      ) = 1
    from private.balanced_round_plan(5)
  ),
  'odd round plans differ by exactly one round'
);
select is(
  (select typtype::text from pg_type where oid = 'public.room_phase'::regtype),
  'e',
  'room phase enum exists'
);
select ok(
  exists (
    select 1
    from unnest(enum_range(null::public.room_phase)) as phase
    where phase::text = 'preparing'
  ),
  'room phase includes preparing'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.service_claim_round_preparation(text,uuid,boolean)',
    'execute'
  ),
  false,
  'authenticated users cannot claim preparation through service RPC'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.service_claim_round_preparation(text,uuid,boolean)',
    'execute'
  )
  and has_function_privilege(
    'service_role',
    'public.service_round_audio_access(text,uuid,uuid)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.service_round_audio_access(text,uuid,uuid)',
    'execute'
  ),
  'only the service role can use trusted preparation and audio access RPCs'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.mark_round_audio_ready(text,uuid)',
    'execute'
  ),
  true,
  'authenticated players can acknowledge prepared audio'
);
select has_function(
  'public',
  'submit_answer',
  array['text', 'answer_choice'],
  'submit_answer RPC exists'
);

insert into auth.users (id, is_anonymous)
values ('00000000-0000-0000-0000-000000000101', true);
insert into public.rooms (id, code, host_user_id, song_pack)
values (
  '00000000-0000-0000-0000-000000000102',
  'QATEST',
  '00000000-0000-0000-0000-000000000101',
  'dynamic'
);
insert into public.players (id, room_id, user_id, nickname, is_ready)
values (
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000101',
  'SQL Tester',
  true
);
insert into public.games (id, room_id, game_number)
values (
  '00000000-0000-0000-0000-000000000104',
  '00000000-0000-0000-0000-000000000102',
  1
);
update public.rooms set
  current_game_id = '00000000-0000-0000-0000-000000000104',
  current_round = 1,
  phase = 'preparing'
where id = '00000000-0000-0000-0000-000000000102';
insert into public.rounds (id, game_id, room_id, round_number)
values (
  '00000000-0000-0000-0000-000000000105',
  '00000000-0000-0000-0000-000000000104',
  '00000000-0000-0000-0000-000000000102',
  1
);
insert into private.round_plans (round_id, planned_answer)
values ('00000000-0000-0000-0000-000000000105', 'real');
insert into private.round_preparations (round_id, status, attempts, lease_until)
values (
  '00000000-0000-0000-0000-000000000105',
  'preparing',
  1,
  clock_timestamp() + interval '45 seconds'
);

select is(
  private.service_complete_jamendo_round(
    '00000000-0000-0000-0000-000000000105',
    'pgtap-jamendo-1',
    'SQL Test Track',
    'SQL Test Artist',
    180,
    '11111111-1111-1111-1111-111111111111.mp3',
    'https://www.jamendo.com/track/1',
    'https://creativecommons.org/licenses/by/4.0/',
    array['rock', 'electronic'],
    repeat('a', 64)
  ) ->> 'status',
  'ready',
  'Jamendo completion makes a claimed round ready'
);
select ok(
  exists (
    select 1 from private.tracks
    where provider = 'jamendo'
      and provider_track_id = 'pgtap-jamendo-1'
      and title = 'SQL Test Track'
      and artist = 'SQL Test Artist'
      and source_url = 'https://www.jamendo.com/track/1'
      and license_url = 'https://creativecommons.org/licenses/by/4.0/'
      and genres = array['rock', 'electronic']
      and storage_path = '11111111-1111-1111-1111-111111111111.mp3'
  ),
  'per-round preparation stores audio and reveal metadata'
);
select is(
  private.service_round_audio_access(
    'QATEST',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000105'
  ) ->> 'storage_path',
  '11111111-1111-1111-1111-111111111111.mp3',
  'room members receive the prepared private audio path'
);

select * from finish();
rollback;
