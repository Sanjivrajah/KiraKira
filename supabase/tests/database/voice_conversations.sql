begin;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('77777777-7777-4777-8777-777777777777', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'voice-owner@example.test', 'x', now(), now(), now()),
  ('88888888-8888-4888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'voice-colleague@example.test', 'x', now(), now(), now());
insert into public.businesses (id, owner_user_id, legal_name, entity_type)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '77777777-7777-4777-8777-777777777777', 'Voice Test Business', 'other');
insert into public.business_members (business_id, user_id, role, status, accepted_at)
values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '77777777-7777-4777-8777-777777777777', 'owner', 'active', now()),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '88888888-8888-4888-8888-888888888888', 'staff', 'active', now());

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777777', true);

select lives_ok($$
  insert into public.voice_conversations (id, business_id, user_id, provider_conversation_id)
  values ('99999999-9999-4999-8999-999999999999', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '77777777-7777-4777-8777-777777777777', 'provider-test-1')
$$, 'speaker can create a private voice conversation');
select lives_ok($$
  insert into public.voice_conversation_turns (conversation_id, turn_index, role, content)
  values ('99999999-9999-4999-8999-999999999999', 1, 'user', 'I spent RM45 on petrol')
$$, 'speaker can save a text turn');
select is((select count(*) from public.voice_conversation_turns), 1::bigint, 'speaker can read the saved turn');

select set_config('request.jwt.claim.sub', '88888888-8888-4888-8888-888888888888', true);
select is((select count(*) from public.voice_conversations), 0::bigint, 'a colleague in the same business cannot read the speaker transcript');
select is((select count(*) from public.voice_conversation_turns), 0::bigint, 'a colleague cannot read the speaker turns');
select throws_ok($$
  insert into public.voice_conversations (business_id, user_id, provider_conversation_id)
  values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '77777777-7777-4777-8777-777777777777', 'provider-impersonation')
$$, '42501', null, 'a colleague cannot create a transcript as another user');

select * from finish();
rollback;
