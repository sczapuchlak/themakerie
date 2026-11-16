-- The Makerie — Pattern Library & nested Projects
--
-- Patterns are reusable instructions; Projects are individual makes of a
-- pattern. Folders organize patterns (one primary folder each). Everything
-- user-owned carries owner_id and is protected by owner-only RLS that also
-- requires the account to be the authorized owner.

-- ------------------------------------------------------------------ helpers

-- Same predicate on every owner-scoped table.
create or replace function public.is_owner(owner uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select owner = (select auth.uid()) and (select public.is_authorized_account());
$$;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- --------------------------------------------------------------- crafts

-- New crafts are a row, not a schema change.
create table public.crafts (
  slug text primary key check (slug ~ '^[a-z][a-z0-9-]{1,30}$'),
  name text not null,
  sort_order integer not null default 100
);

insert into public.crafts (slug, name, sort_order) values
  ('knitting', 'Knitting', 10),
  ('crochet', 'Crochet', 20),
  ('cross-stitch', 'Cross-Stitch', 30),
  ('needlepoint', 'Needlepoint', 40);

alter table public.crafts enable row level security;
create policy "crafts are readable by the owner" on public.crafts
  for select to authenticated using ((select public.is_authorized_account()));
revoke all on public.crafts from anon;

-- -------------------------------------------------------------- folders

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id uuid references public.folders (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  color text check (color in ('lime', 'pink', 'laser', 'ultraviolet', 'aqua', 'peach', 'cobalt')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);

create unique index folders_unique_name_per_parent
  on public.folders (owner_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)));
create index folders_parent_idx on public.folders (parent_id);

-- Parent must belong to the same owner, and nesting may not form a cycle.
create or replace function private.check_folder_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;
  if not exists (select 1 from public.folders f where f.id = new.parent_id and f.owner_id = new.owner_id) then
    raise exception 'Parent folder not found' using errcode = '23503';
  end if;
  if exists (
    with recursive ancestors(id, parent_id) as (
      select f.id, f.parent_id from public.folders f where f.id = new.parent_id
      union all
      select f.id, f.parent_id from public.folders f join ancestors a on f.id = a.parent_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'A folder cannot be moved inside itself' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger folders_check_parent before insert or update of parent_id on public.folders
  for each row execute function private.check_folder_parent();
create trigger folders_touch before update on public.folders
  for each row execute function private.touch_updated_at();

-- ------------------------------------------------------------- patterns

create table public.patterns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  craft text not null references public.crafts (slug),
  designer text,
  source_name text,
  description text,
  category text,
  difficulty smallint check (difficulty between 1 and 5),
  techniques text[] not null default '{}',
  materials text,
  tools text,
  sizes text,
  dimensions text,
  -- Craft-specific optional fields (gauge, hook sizes, fabric count, mesh…)
  craft_details jsonb not null default '{}' check (jsonb_typeof(craft_details) = 'object'),
  tags text[] not null default '{}',
  notes text,
  favorite boolean not null default false,
  cover_path text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text not null default ''
);

create index patterns_owner_created_idx on public.patterns (owner_id, created_at desc, id);
create index patterns_owner_updated_idx on public.patterns (owner_id, updated_at desc, id);
create index patterns_folder_idx on public.patterns (folder_id);
create index patterns_tags_idx on public.patterns using gin (tags);

create or replace function private.patterns_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.folder_id is not null
     and not exists (select 1 from public.folders f where f.id = new.folder_id and f.owner_id = new.owner_id) then
    raise exception 'Folder not found' using errcode = '23503';
  end if;
  new.tags := coalesce((select array_agg(distinct lower(btrim(t))) from unnest(new.tags) t where btrim(t) <> ''), '{}');
  new.techniques := coalesce((select array_agg(distinct btrim(t)) from unnest(new.techniques) t where btrim(t) <> ''), '{}');
  new.search_text := lower(concat_ws(' ',
    new.title, new.designer, new.source_name, new.description, new.category,
    new.materials, new.tools, new.notes,
    array_to_string(new.tags, ' '), array_to_string(new.techniques, ' ')));
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger patterns_before_write before insert or update on public.patterns
  for each row execute function private.patterns_before_write();

-- ------------------------------------------------------- pattern sources

-- The original material, preserved faithfully: files in private storage, or
-- links. A pattern can have any number of each.
create table public.pattern_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pattern_id uuid not null references public.patterns (id) on delete cascade,
  kind text not null check (kind in ('pdf', 'image', 'website', 'video')),
  title text,
  url text,
  url_normalized text,
  storage_path text unique,
  file_name text,
  mime_type text,
  size_bytes bigint check (size_bytes >= 0),
  page_count integer check (page_count >= 0),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (
    (kind in ('pdf', 'image') and storage_path is not null and url is null)
    or (kind in ('website', 'video') and url is not null and storage_path is null)
  ),
  check (url is null or url ~* '^https?://')
);

create index pattern_sources_pattern_idx on public.pattern_sources (pattern_id, sort_order);
create index pattern_sources_url_idx on public.pattern_sources (owner_id, url_normalized) where url_normalized is not null;
create index pattern_sources_sha_idx on public.pattern_sources (owner_id, sha256) where sha256 is not null;

-- --------------------------------------------- structured instructions

-- Optional companion to the original source. Belongs to the reusable
-- pattern; per-project completion lives in project_step_completions.
create table public.pattern_sections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pattern_id uuid not null references public.patterns (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index pattern_sections_pattern_idx on public.pattern_sections (pattern_id, position);

create table public.pattern_steps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  section_id uuid not null references public.pattern_sections (id) on delete cascade,
  position integer not null default 0,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  row_start integer check (row_start > 0),
  row_end integer check (row_end > 0),
  repeat_count integer check (repeat_count > 0),
  created_at timestamptz not null default now(),
  check (row_end is null or row_start is null or row_end >= row_start)
);
create index pattern_steps_section_idx on public.pattern_steps (section_id, position);

-- ------------------------------------------------------------- projects

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Nullable for future patternless projects. RESTRICT: a pattern with
  -- project history can't be deleted by accident; the app asks first.
  pattern_id uuid references public.patterns (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'paused', 'finished', 'abandoned')),
  progress smallint check (progress between 0 and 100),
  size_colorway text,
  notes text,
  started_on date,
  finished_on date,
  last_worked_at timestamptz,
  cover_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_pattern_idx on public.projects (pattern_id);
create index projects_owner_status_idx on public.projects (owner_id, status, last_worked_at desc nulls last);
create trigger projects_touch before update on public.projects
  for each row execute function private.touch_updated_at();

create table public.project_photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  storage_path text not null unique,
  file_name text,
  mime_type text,
  size_bytes bigint check (size_bytes >= 0),
  created_at timestamptz not null default now()
);
create index project_photos_project_idx on public.project_photos (project_id, created_at);

-- Basic work sessions now; the timer phase writes the same records.
create table public.project_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  started_at timestamptz not null default now(),
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  note text,
  created_at timestamptz not null default now()
);
create index project_sessions_project_idx on public.project_sessions (project_id, started_at desc);

create table public.project_step_completions (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  step_id uuid not null references public.pattern_steps (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (project_id, step_id)
);

-- Keep references within one owner (FKs alone don't prevent pointing at
-- someone else's row id).
create or replace function private.check_same_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_owner uuid;
begin
  case tg_table_name
    when 'pattern_sources', 'pattern_sections' then
      select owner_id into parent_owner from public.patterns where id = new.pattern_id;
    when 'pattern_steps' then
      select owner_id into parent_owner from public.pattern_sections where id = new.section_id;
    when 'projects' then
      if new.pattern_id is null then return new; end if;
      select owner_id into parent_owner from public.patterns where id = new.pattern_id;
    when 'project_photos', 'project_sessions', 'project_step_completions' then
      select owner_id into parent_owner from public.projects where id = new.project_id;
  end case;
  if parent_owner is distinct from new.owner_id then
    raise exception 'Related record not found' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger pattern_sources_same_owner before insert or update on public.pattern_sources
  for each row execute function private.check_same_owner();
create trigger pattern_sections_same_owner before insert or update on public.pattern_sections
  for each row execute function private.check_same_owner();
create trigger pattern_steps_same_owner before insert or update on public.pattern_steps
  for each row execute function private.check_same_owner();
create trigger projects_same_owner before insert or update on public.projects
  for each row execute function private.check_same_owner();
create trigger project_photos_same_owner before insert or update on public.project_photos
  for each row execute function private.check_same_owner();
create trigger project_sessions_same_owner before insert or update on public.project_sessions
  for each row execute function private.check_same_owner();
create trigger project_step_completions_same_owner before insert or update on public.project_step_completions
  for each row execute function private.check_same_owner();

-- Logging a session marks the project as worked on.
create or replace function private.project_session_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.projects
     set last_worked_at = greatest(coalesce(last_worked_at, new.started_at), new.started_at)
   where id = new.project_id;
  return new;
end;
$$;
create trigger project_sessions_touch after insert on public.project_sessions
  for each row execute function private.project_session_touch();

-- ------------------------------------------------------------------ RLS

do $$
declare
  t text;
begin
  foreach t in array array[
    'folders', 'patterns', 'pattern_sources', 'pattern_sections', 'pattern_steps',
    'projects', 'project_photos', 'project_sessions', 'project_step_completions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner only" on public.%I for all to authenticated
         using ((select public.is_owner(owner_id)))
         with check ((select public.is_owner(owner_id)))', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

-- --------------------------------------------------------------- views

-- One row per PATTERN, with its project activity summarized.
create view public.pattern_overview
with (security_invoker = true) as
select
  p.*,
  count(pr.id)::int as project_count,
  count(pr.id) filter (where pr.status = 'in_progress')::int as active_count,
  count(pr.id) filter (where pr.status = 'finished')::int as finished_count,
  max(pr.last_worked_at) as last_worked_at,
  exists (select 1 from public.pattern_sources s where s.pattern_id = p.id) as has_sources,
  (select array_agg(distinct s.kind) from public.pattern_sources s where s.pattern_id = p.id) as source_kinds
from public.patterns p
left join public.projects pr on pr.pattern_id = p.id
group by p.id;

-- pattern_count includes every descendant folder. Each pattern has a single
-- folder_id and UNION de-duplicates the tree, so nothing is counted twice.
create view public.folder_overview
with (security_invoker = true) as
with recursive tree as (
  select f.id as root_id, f.id as folder_id from public.folders f
  union
  select t.root_id, c.id from tree t join public.folders c on c.parent_id = t.folder_id
)
select
  f.*,
  (select count(distinct p.id)
     from tree t join public.patterns p on p.folder_id = t.folder_id
    where t.root_id = f.id and p.archived_at is null)::int as pattern_count,
  (select count(*) from public.patterns p where p.folder_id = f.id and p.archived_at is null)::int as direct_pattern_count,
  (select count(*) from public.folders c where c.parent_id = f.id)::int as child_count
from public.folders f;

revoke all on public.pattern_overview, public.folder_overview from anon;

-- ----------------------------------------------------------- functions

-- Delete a folder without deleting anything in it: its patterns and
-- sub-folders move up to its parent (or to Unsorted / top level).
create or replace function public.delete_folder(target uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent uuid;
begin
  select parent_id into parent from public.folders where id = target;
  if not found then
    raise exception 'Folder not found' using errcode = 'P0002';
  end if;
  update public.patterns set folder_id = parent where folder_id = target;
  update public.folders set parent_id = parent where parent_id = target;
  delete from public.folders where id = target;
end;
$$;

revoke execute on function public.delete_folder(uuid) from public, anon;
grant execute on function public.delete_folder(uuid) to authenticated;
revoke execute on function public.is_owner(uuid) from public, anon;
grant execute on function public.is_owner(uuid) to authenticated;

-- -------------------------------------------------------------- storage

-- One private bucket. Paths: <owner_id>/patterns/<pattern_id>/… and
-- <owner_id>/projects/<project_id>/…
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'makerie-files', 'makerie-files', false, 104857600,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "owner reads own files" on storage.objects
  for select to authenticated
  using (bucket_id = 'makerie-files' and (storage.foldername(name))[1] = (select auth.uid())::text
         and (select public.is_authorized_account()));
create policy "owner uploads own files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'makerie-files' and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.is_authorized_account()));
create policy "owner updates own files" on storage.objects
  for update to authenticated
  using (bucket_id = 'makerie-files' and (storage.foldername(name))[1] = (select auth.uid())::text
         and (select public.is_authorized_account()));
create policy "owner deletes own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'makerie-files' and (storage.foldername(name))[1] = (select auth.uid())::text
         and (select public.is_authorized_account()));
