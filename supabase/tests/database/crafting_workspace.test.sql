-- pgTAP: Crafting Workspace — counters, timer sessions, progress, reader state.
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

delete from private.authorized_accounts;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000000c1', 'ws-owner@makerie.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d2', 'ws-other@makerie.test', 'authenticated', 'authenticated');
select private.authorize_account('00000000-0000-4000-8000-0000000000c1');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}';

insert into public.patterns (id, title, craft) values ('a0000000-0000-4000-8000-000000000001', 'Granny Blanket', 'crochet');
insert into public.pattern_sources (id, pattern_id, kind, storage_path) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'pdf',
   '00000000-0000-4000-8000-0000000000c1/patterns/a0000000-0000-4000-8000-000000000001/blanket.pdf');
insert into public.projects (id, pattern_id, name, status) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Blanket one', 'in_progress'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Blanket two', 'in_progress');

-- Counters ------------------------------------------------------------
select is((select count(*)::int from public.project_counters where is_main), 2, 'every project gets a main row counter');
select throws_ok(
  $$ insert into public.project_counters (project_id, name, is_main) values ('c0000000-0000-4000-8000-000000000001', 'Rows 2', true) $$,
  '23505', null, 'only one main counter per project');

insert into public.project_counters (id, project_id, name, target, rollover) values
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Squares', 40, false),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'Rounds in square', 4, true);
update public.project_counters set rollover_counter_id = 'd0000000-0000-4000-8000-000000000002'
 where id = 'd0000000-0000-4000-8000-000000000003';

select is((select r_value from public.apply_counter_event('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'add', 1)),
  1, 'increment applies');
select is((select r_applied from public.apply_counter_event('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'add', 1)),
  false, 'replaying the same event id is ignored');
select is((select value from public.project_counters where id = 'd0000000-0000-4000-8000-000000000003'), 1, 'replay does not double-count');

select public.apply_counter_event('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000003', 'add', 1);
select public.apply_counter_event('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003', 'add', 1);
select is((select r_rolled from public.apply_counter_event('e0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000003', 'add', 1)),
  1, 'reaching the target rolls over');
select is((select array[(select value from public.project_counters where id = 'd0000000-0000-4000-8000-000000000003'),
                        (select value from public.project_counters where id = 'd0000000-0000-4000-8000-000000000002')]),
  array[0, 1], 'rollover wraps to zero and adds one to the linked counter');
select is((select rolled_over from public.project_counter_events where id = 'e0000000-0000-4000-8000-000000000004'),
  true, 'the rollover is recorded on the event');

select is((select r_value from public.apply_counter_event('e0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000002', 'add', -5)),
  0, 'counters never go below zero');
select is((select r_value from public.apply_counter_event('e0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000002', 'set', 16)),
  16, 'set (reset / undo) writes an exact value');

select throws_ok(
  $$ update public.project_counters set rollover_counter_id = (select id from public.project_counters where project_id = 'c0000000-0000-4000-8000-000000000002' and is_main)
      where id = 'd0000000-0000-4000-8000-000000000003' $$,
  '23514', null, 'a counter cannot link to another project''s counter');

-- Sessions ------------------------------------------------------------
insert into public.project_sessions (id, project_id, started_at, resumed_at, status) values
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '2026-11-10 09:00+00', '2026-11-10 09:00+00', 'active');
select throws_ok(
  $$ insert into public.project_sessions (project_id, started_at, resumed_at, status)
     values ('c0000000-0000-4000-8000-000000000001', now(), now(), 'active') $$,
  '23505', null, 'a project cannot have two open sessions');
select lives_ok(
  $$ insert into public.project_sessions (project_id, started_at, resumed_at, status)
     values ('c0000000-0000-4000-8000-000000000002', now(), now(), 'active') $$,
  'another project under the same pattern can run its own session');
select throws_ok(
  $$ update public.project_sessions set status = 'paused' where id = 'f0000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'a paused session must not have a running stretch');

-- Pause after 1h, resume, finish after another 3h: 4h active.
update public.project_sessions set status = 'paused', resumed_at = null, active_seconds = 3600
 where id = 'f0000000-0000-4000-8000-000000000001';
update public.project_sessions set status = 'active', resumed_at = '2026-11-10 10:30+00'
 where id = 'f0000000-0000-4000-8000-000000000001';
update public.project_sessions set status = 'finished', resumed_at = null, active_seconds = 14400,
       ended_at = '2026-11-10 13:30+00', progress_before = 20, progress_after = 40
 where id = 'f0000000-0000-4000-8000-000000000001';
select is((select duration_seconds from public.project_sessions where id = 'f0000000-0000-4000-8000-000000000001'),
  14400, 'duration excludes paused time');
update public.project_sessions set adjusted_seconds = 13500 where id = 'f0000000-0000-4000-8000-000000000001';
select is((select duration_seconds from public.project_sessions where id = 'f0000000-0000-4000-8000-000000000001'),
  13500, 'a manual correction replaces tracked time instead of adding to it');
select is((select last_worked_at from public.projects where id = 'c0000000-0000-4000-8000-000000000001'),
  '2026-11-10 13:30+00'::timestamptz, 'finishing a session updates last worked');

-- Rollout compatibility: duration_minutes is kept and mirrored
select is((select duration_minutes from public.project_sessions where id = 'f0000000-0000-4000-8000-000000000001'),
  225, 'deprecated duration_minutes mirrors the corrected duration');
select is((select duration_minutes from public.project_sessions
            where project_id = 'c0000000-0000-4000-8000-000000000002' and status = 'active'),
  null, 'open sessions have no legacy minutes');
insert into public.project_sessions (id, project_id, started_at, duration_minutes) values
  ('f0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000001', '2026-11-12 09:00+00', 45);
select is((select array[active_seconds, duration_seconds] from public.project_sessions where id = 'f0000000-0000-4000-8000-000000000009'),
  array[2700, 2700], 'a Phase 3-style insert (minutes only) becomes a proper session');
select is((select ended_at from public.project_sessions where id = 'f0000000-0000-4000-8000-000000000009'),
  '2026-11-12 09:45+00'::timestamptz, 'and gets an end time');

-- Session links stay within the project
select throws_ok(
  $$ insert into public.project_notes (project_id, body, session_id)
     values ('c0000000-0000-4000-8000-000000000002', 'wrong', 'f0000000-0000-4000-8000-000000000001') $$,
  '23514', null, 'notes cannot attach to another project''s session');
select lives_ok(
  $$ insert into public.project_photos (project_id, storage_path, session_id)
     values ('c0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c1/projects/c0000000-0000-4000-8000-000000000001/p.jpg',
             'f0000000-0000-4000-8000-000000000001') $$,
  'session photos attach to their session');

-- Progress ------------------------------------------------------------
update public.projects set progress_method = 'units', progress_target = 40, unit_label = 'granny squares',
       progress_counter_id = 'd0000000-0000-4000-8000-000000000002'
 where id = 'c0000000-0000-4000-8000-000000000001';
select is((select progress_method from public.projects where id = 'c0000000-0000-4000-8000-000000000001'),
  'units', 'progress method and connected counter can be set');
select throws_ok(
  $$ update public.projects set progress_counter_id = 'd0000000-0000-4000-8000-000000000002'
      where id = 'c0000000-0000-4000-8000-000000000002' $$,
  '23514', null, 'progress cannot be driven by another project''s counter');

-- Reader state --------------------------------------------------------
insert into public.project_reader_states (project_id, source_id, page, zoom) values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 7, 1.5),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 2, 1);
select is((select array_agg(page order by project_id) from public.project_reader_states),
  array[7, 2], 'projects sharing a pattern keep independent reading positions');

-- Another account -----------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000d2","role":"authenticated"}';
select is((select count(*)::int from public.project_counters), 0, 'other accounts see no counters');
select throws_ok(
  $$ select public.apply_counter_event(gen_random_uuid(), 'd0000000-0000-4000-8000-000000000002', 'add', 1) $$,
  'P0002', null, 'other accounts cannot change counters');
reset role;
set local role anon;
select throws_ok($$ select * from public.project_sessions $$, '42501', null, 'anon cannot read sessions');

select * from finish();
rollback;
