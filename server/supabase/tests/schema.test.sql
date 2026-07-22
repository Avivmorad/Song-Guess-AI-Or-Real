begin;

select plan(14);

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
select has_function(
  'public',
  'create_room',
  array['text', 'jsonb'],
  'create_room RPC exists'
);
select has_function(
  'public',
  'submit_answer',
  array['text', 'answer_choice'],
  'submit_answer RPC exists'
);

select * from finish();
rollback;
