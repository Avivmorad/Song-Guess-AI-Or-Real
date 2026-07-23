begin;

select plan(25);

select has_schema('private', 'private schema exists');
select has_table('public', 'rooms', 'rooms table exists');
select has_table('public', 'players', 'players table exists');
select has_table('public', 'games', 'games table exists');
select has_table('public', 'rounds', 'rounds table exists');
select has_table('public', 'answers', 'answers table exists');
select has_table('public', 'scores', 'scores table exists');
select has_table('public', 'room_events', 'room events table exists');
select has_table('private', 'tracks', 'private tracks table exists');
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
select has_function(
  'public',
  'submit_answer',
  array['text', 'answer_choice'],
  'submit_answer RPC exists'
);

select * from finish();
rollback;
