-- pgTAP: Pattern Library data model, ownership and lifecycle.
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

delete from private.authorized_accounts;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'lib-owner@makerie.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b2', 'lib-other@makerie.test', 'authenticated', 'authenticated');
select private.authorize_account('00000000-0000-4000-8000-0000000000a1');

-- Act as the authorized owner
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

insert into public.folders (id, name) values
  ('10000000-0000-4000-8000-000000000001', 'Crochet'),
  ('10000000-0000-4000-8000-000000000002', 'Sweaters');
update public.folders set parent_id = '10000000-0000-4000-8000-000000000001'
 where id = '10000000-0000-4000-8000-000000000002';

select throws_ok(
  $$ update public.folders set parent_id = '10000000-0000-4000-8000-000000000002'
      where id = '10000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'folders cannot be nested inside their own descendants');

select throws_ok(
  $$ insert into public.folders (name) values ('crochet') $$,
  '23505', null, 'sibling folder names are unique (case-insensitive)');

insert into public.patterns (id, title, craft, folder_id, tags, techniques) values
  ('20000000-0000-4000-8000-000000000001', 'My Comfiest Cardigan', 'crochet',
   '10000000-0000-4000-8000-000000000002', array['Cozy', ' gift ', 'cozy'], array['Raglan', '']);

select is((select owner_id from public.patterns where id = '20000000-0000-4000-8000-000000000001'),
  '00000000-0000-4000-8000-0000000000a1'::uuid, 'owner_id comes from the session');
select is((select tags from public.patterns where id = '20000000-0000-4000-8000-000000000001'),
  array['cozy', 'gift'], 'tags are trimmed, lower-cased and de-duplicated');
select ok((select search_text like '%raglan%' and search_text like '%cardigan%'
             from public.patterns where id = '20000000-0000-4000-8000-000000000001'),
  'search text covers title and techniques');

select throws_ok(
  $$ insert into public.patterns (title, craft, owner_id)
     values ('Spoofed', 'knitting', '00000000-0000-4000-8000-0000000000b2') $$,
  '42501', null, 'cannot create a pattern for another owner');
select throws_ok(
  $$ insert into public.patterns (title, craft) values ('Weaving', 'basket-weaving') $$,
  '23503', null, 'craft must exist in the crafts table');

-- Sources: files need a storage path, links need a URL
insert into public.pattern_sources (pattern_id, kind, storage_path, file_name) values
  ('20000000-0000-4000-8000-000000000001', 'pdf',
   '00000000-0000-4000-8000-0000000000a1/patterns/20000000-0000-4000-8000-000000000001/cardigan.pdf', 'cardigan.pdf');
insert into public.pattern_sources (pattern_id, kind, url) values
  ('20000000-0000-4000-8000-000000000001', 'video', 'https://www.youtube.com/watch?v=abc');
select is((select count(*)::int from public.pattern_sources where pattern_id = '20000000-0000-4000-8000-000000000001'),
  2, 'a pattern can hold several sources');
select throws_ok(
  $$ insert into public.pattern_sources (pattern_id, kind) values ('20000000-0000-4000-8000-000000000001', 'pdf') $$,
  '23514', null, 'a PDF source requires a stored file');
select throws_ok(
  $$ insert into public.pattern_sources (pattern_id, kind, url) values ('20000000-0000-4000-8000-000000000001', 'website', 'javascript:alert(1)') $$,
  '23514', null, 'links must be http(s)');

-- Several independent projects from one pattern
insert into public.projects (id, pattern_id, name, status, progress) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Grey cardigan', 'in_progress', 32),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Blue cardigan', 'finished', 100),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'Pink cardigan', 'planned', 0);

select is((select count(*)::int from public.pattern_overview), 1, 'the pattern appears once regardless of projects');
select is((select array[project_count, active_count, finished_count] from public.pattern_overview),
  array[3, 1, 1], 'overview summarizes project activity');

insert into public.project_sessions (project_id, active_seconds, started_at, ended_at)
  values ('30000000-0000-4000-8000-000000000001', 2700, '2026-11-01 10:00+00', '2026-11-01 10:45+00');
select is((select last_worked_at from public.projects where id = '30000000-0000-4000-8000-000000000001'),
  '2026-11-01 10:45+00'::timestamptz, 'logging a session updates last worked');

update public.projects set progress = 50 where id = '30000000-0000-4000-8000-000000000001';
select is((select updated_at = created_at from public.patterns where id = '20000000-0000-4000-8000-000000000001'),
  true, 'project progress never touches the pattern');

select throws_ok(
  $$ delete from public.patterns where id = '20000000-0000-4000-8000-000000000001' $$,
  '23503', null, 'a pattern with projects cannot be deleted by accident');

-- Folder counts roll up through every level, once per pattern
-- Crochet > Sweaters > Cardigans, and Crochet > Hats
insert into public.folders (id, name, parent_id) values
  ('10000000-0000-4000-8000-000000000003', 'Cardigans', '10000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000004', 'Hats', '10000000-0000-4000-8000-000000000001');
insert into public.patterns (id, title, craft, folder_id, archived_at) values
  ('20000000-0000-4000-8000-000000000011', 'Deep cardigan', 'crochet', '10000000-0000-4000-8000-000000000003', null),
  ('20000000-0000-4000-8000-000000000012', 'Archived cardigan', 'crochet', '10000000-0000-4000-8000-000000000003', now()),
  ('20000000-0000-4000-8000-000000000013', 'Granny square', 'crochet', '10000000-0000-4000-8000-000000000001', null),
  ('20000000-0000-4000-8000-000000000014', 'Beanie', 'crochet', '10000000-0000-4000-8000-000000000004', null);
select is((select array[pattern_count, direct_pattern_count, child_count] from public.folder_overview
            where id = '10000000-0000-4000-8000-000000000001'),
  array[4, 1, 2], 'top folder counts patterns in all descendants, each once');
select is((select pattern_count from public.folder_overview where id = '10000000-0000-4000-8000-000000000002'),
  2, 'middle folder counts itself and its sub-folder');
select is((select pattern_count from public.folder_overview where id = '10000000-0000-4000-8000-000000000003'),
  1, 'leaf folder counts only its own, excluding archived');
select is((select pattern_count from public.folder_overview where id = '10000000-0000-4000-8000-000000000004'),
  1, 'sibling branch is counted separately');
select is((select sum(direct_pattern_count)::int from public.folder_overview),
  (select count(*)::int from public.patterns where folder_id is not null and archived_at is null),
  'direct counts partition the filed patterns exactly');
delete from public.patterns where id in ('20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000012',
  '20000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000014');
delete from public.folders where id in ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004');

-- Folder deletion keeps patterns and moves children up
select public.delete_folder('10000000-0000-4000-8000-000000000002');
select is((select folder_id from public.patterns where id = '20000000-0000-4000-8000-000000000001'),
  '10000000-0000-4000-8000-000000000001'::uuid, 'deleting a folder moves its patterns to the parent');
select public.delete_folder('10000000-0000-4000-8000-000000000001');
select is((select folder_id from public.patterns where id = '20000000-0000-4000-8000-000000000001'),
  null, 'deleting a top-level folder moves patterns to Unsorted');
select is((select count(*)::int from public.patterns), 1, 'no pattern is ever deleted with its folder');

-- Explicit delete: projects first, then the pattern cascades its sources
delete from public.projects where pattern_id = '20000000-0000-4000-8000-000000000001';
delete from public.patterns where id = '20000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.pattern_sources), 0, 'deleting a pattern removes its sources');

-- Storage: own folder only
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('makerie-files', '00000000-0000-4000-8000-0000000000a1/patterns/x/file.pdf') $$,
  'owner can upload into their own folder');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('makerie-files', '00000000-0000-4000-8000-0000000000b2/patterns/x/file.pdf') $$,
  '42501', null, 'owner cannot upload into another account''s folder');

-- A different, unauthorized account sees and touches nothing
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}';
select is((select count(*)::int from storage.objects where bucket_id = 'makerie-files'), 0,
  'other accounts cannot read the owner''s files');
select throws_ok(
  $$ insert into public.patterns (title, craft) values ('Mine now', 'knitting') $$,
  '42501', null, 'an unauthorized account cannot create patterns');

-- Anonymous: no access at all
reset role;
set local role anon;
select throws_ok($$ select * from public.patterns $$, '42501', null, 'anon cannot read patterns');

select * from finish();
rollback;
