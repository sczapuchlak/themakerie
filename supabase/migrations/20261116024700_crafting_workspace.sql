-- The Makerie — Crafting Workspace
--
-- Counters, an accurate session timer, flexible progress, a project journal,
-- per-project reading positions and offline-safe sync. Every table is
-- owner-scoped with the same owner-only RLS as the Pattern Library.
--
-- Offline sync: rows the app creates offline carry client-generated UUIDs so
-- replays are idempotent. Counter changes are stored as events and applied
-- by public.apply_counter_event(), so concurrent increments merge instead of
-- overwriting each other.

-- ------------------------------------------------------------ sessions
-- Timer sessions: active time is accumulated across pauses; the running
-- stretch is (now - resumed_at). duration_seconds is what totals use, so a
-- manual correction replaces the tracked time instead of adding to it.

alter table public.project_sessions
  add column ended_at timestamptz,
  add column resumed_at timestamptz,
  add column active_seconds integer not null default 0 check (active_seconds between 0 and 604800),
  add column adjusted_seconds integer check (adjusted_seconds between 0 and 604800),
  add column status text not null default 'finished' check (status in ('active', 'paused', 'finished')),
  add column accomplished text check (char_length(accomplished) <= 4000),
  add column progress_before smallint check (progress_before between 0 and 100),
  add column progress_after smallint check (progress_after between 0 and 100),
  add column units_before integer check (units_before >= 0),
  add column units_after integer check (units_after >= 0),
  add column client_updated_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

-- Carry Phase 3 manual logs over. duration_minutes is KEPT (deprecated,
-- now nullable) for one release so this migration is non-destructive and
-- Phase 3 code keeps working until the new app is deployed; a later
-- migration can drop it once nothing reads it.
update public.project_sessions
   set active_seconds = duration_minutes * 60,
       ended_at = started_at + make_interval(mins => duration_minutes),
       status = 'finished'
 where duration_minutes is not null;
alter table public.project_sessions alter column duration_minutes drop not null;
comment on column public.project_sessions.duration_minutes is
  'DEPRECATED: mirror of duration_seconds in whole minutes (finished sessions only). Use duration_seconds.';

alter table public.project_sessions
  add column duration_seconds integer generated always as (coalesce(adjusted_seconds, active_seconds)) stored,
  add constraint project_sessions_state check (
    (status = 'active' and resumed_at is not null and ended_at is null)
    or (status = 'paused' and resumed_at is null and ended_at is null)
    or (status = 'finished' and resumed_at is null and ended_at is not null)
  ),
  add constraint project_sessions_order check (ended_at is null or ended_at >= started_at);

-- At most one running or paused session per project: no accidental duplicates.
create unique index project_sessions_one_open on public.project_sessions (project_id)
  where status <> 'finished';

-- Transition shim, both directions:
--  * a Phase 3-style insert (duration_minutes only) becomes a proper finished
--    session, so sessions logged by the old app during the rollout are right;
--  * duration_minutes mirrors the effective duration for anything still
--    reading it (NULL while a session is open or outside its old 1–1440 range).
create or replace function private.project_sessions_legacy_minutes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  secs integer;
begin
  if tg_op = 'INSERT' and new.duration_minutes is not null and new.active_seconds = 0
     and new.adjusted_seconds is null and new.status = 'finished' then
    new.active_seconds := new.duration_minutes * 60;
    new.ended_at := coalesce(new.ended_at, new.started_at + make_interval(mins => new.duration_minutes));
  end if;
  if new.status = 'finished' then
    secs := coalesce(new.adjusted_seconds, new.active_seconds);
    new.duration_minutes := case when secs between 30 and 86400 then greatest(1, round(secs / 60.0))::integer end;
  else
    new.duration_minutes := null;
  end if;
  return new;
end;
$$;
create trigger project_sessions_legacy_minutes before insert or update on public.project_sessions
  for each row execute function private.project_sessions_legacy_minutes();

create trigger project_sessions_updated before update on public.project_sessions
  for each row execute function private.touch_updated_at();

create or replace function private.project_session_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  worked timestamptz := coalesce(new.ended_at, new.resumed_at, new.started_at);
begin
  update public.projects
     set last_worked_at = greatest(coalesce(last_worked_at, worked), worked)
   where id = new.project_id;
  return new;
end;
$$;
drop trigger project_sessions_touch on public.project_sessions;
create trigger project_sessions_touch after insert or update on public.project_sessions
  for each row execute function private.project_session_touch();

-- ------------------------------------------------------------ counters

create table public.project_counters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  value integer not null default 0 check (value >= 0),
  step integer not null default 1 check (step between 1 and 1000),
  target integer check (target between 1 and 1000000),
  -- Rollover: reaching the target wraps to zero and, optionally, adds one to
  -- another counter (rows within a repeat -> repeats). Always shown in the UI.
  rollover boolean not null default false,
  rollover_counter_id uuid references public.project_counters (id) on delete set null,
  section_id uuid references public.pattern_sections (id) on delete set null,
  is_main boolean not null default false,
  position integer not null default 0,
  client_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (rollover_counter_id is distinct from id)
);
create index project_counters_project_idx on public.project_counters (project_id, position);
create unique index project_counters_one_main on public.project_counters (project_id) where is_main;
create trigger project_counters_touch before update on public.project_counters
  for each row execute function private.touch_updated_at();

create table public.project_counter_events (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  counter_id uuid not null references public.project_counters (id) on delete cascade,
  kind text not null check (kind in ('add', 'set')),
  amount integer not null check (amount between -1000000 and 1000000),
  value_after integer,
  rolled_over boolean not null default false,
  session_id uuid references public.project_sessions (id) on delete set null,
  created_at timestamptz not null default now()
);
create index project_counter_events_counter_idx on public.project_counter_events (counter_id, created_at desc);

-- ------------------------------------------------------------ progress

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  position integer not null default 0,
  done_at timestamptz,
  session_id uuid references public.project_sessions (id) on delete set null,
  client_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_milestones_project_idx on public.project_milestones (project_id, position);
create trigger project_milestones_touch before update on public.project_milestones
  for each row execute function private.touch_updated_at();

alter table public.projects
  add column progress_method text not null default 'manual'
    check (progress_method in ('manual', 'units', 'rows', 'steps', 'milestones')),
  add column progress_target integer check (progress_target between 1 and 10000000),
  add column progress_done integer not null default 0 check (progress_done >= 0),
  add column unit_label text check (char_length(unit_label) <= 60),
  -- Only an explicitly connected counter drives progress (units or rows).
  add column progress_counter_id uuid references public.project_counters (id) on delete set null,
  -- Last-used reader source and panel, restored when Work Mode opens.
  add column workspace jsonb not null default '{}'::jsonb,
  add column client_updated_at timestamptz not null default now();

-- Progress history: one row per recorded change, so the method or target can
-- change later without rewriting the past.
create table public.project_progress_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  session_id uuid references public.project_sessions (id) on delete set null,
  recorded_at timestamptz not null default now(),
  method text not null check (method in ('manual', 'units', 'rows', 'steps', 'milestones')),
  percent smallint not null check (percent between 0 and 100),
  done integer check (done >= 0),
  target integer check (target >= 1),
  note text check (char_length(note) <= 1000)
);
create index project_progress_events_project_idx on public.project_progress_events (project_id, recorded_at);

-- ------------------------------------------------------------ journal

create table public.project_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null default 'note' check (kind in
    ('note', 'modification', 'substitution', 'gauge', 'size', 'mistake', 'reminder', 'materials')),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  session_id uuid references public.project_sessions (id) on delete set null,
  pinned boolean not null default false,
  client_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_notes_project_idx on public.project_notes (project_id, created_at desc);
create trigger project_notes_touch before update on public.project_notes
  for each row execute function private.touch_updated_at();

-- Session photos are project photos linked to a session; show_in_gallery
-- lets a later Gallery include only the ones worth showing.
alter table public.project_photos
  add column session_id uuid references public.project_sessions (id) on delete set null,
  add column caption text check (char_length(caption) <= 500),
  add column show_in_gallery boolean not null default true;

-- ------------------------------------------------------------ reader

-- Each project keeps its own place in each source, even when several
-- projects share a pattern. Guides are row/column highlighters.
create table public.project_reader_states (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  source_id uuid not null references public.pattern_sources (id) on delete cascade,
  page integer not null default 1 check (page >= 1),
  zoom real not null default 1 check (zoom between 0.1 and 10),
  fit text not null default 'width' check (fit in ('width', 'page', 'custom')),
  scroll_left real not null default 0,
  scroll_top real not null default 0,
  guides jsonb not null default '[]'::jsonb check (jsonb_typeof(guides) = 'array'),
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, source_id)
);
create trigger project_reader_states_touch before update on public.project_reader_states
  for each row execute function private.touch_updated_at();

create table public.project_bookmarks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  source_id uuid not null references public.pattern_sources (id) on delete cascade,
  page integer not null check (page >= 1),
  y real not null default 0 check (y between 0 and 1),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  created_at timestamptz not null default now()
);
create index project_bookmarks_project_idx on public.project_bookmarks (project_id, source_id, page);

-- ------------------------------------------------------------ ownership

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
    else
      select owner_id into parent_owner from public.projects where id = new.project_id;
  end case;
  if parent_owner is distinct from new.owner_id then
    raise exception 'Related record not found' using errcode = '23503';
  end if;
  return new;
end;
$$;

-- Counter links, reader sources and sessions must belong to the same project.
create or replace function private.check_project_links()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Nested IFs: PL/pgSQL resolves NEW fields even behind a false AND.
  if tg_table_name = 'project_counters' then
    if new.rollover_counter_id is not null
       and not exists (select 1 from public.project_counters
                        where id = new.rollover_counter_id and project_id = new.project_id) then
      raise exception 'Linked counter must belong to the same project' using errcode = '23514';
    end if;
    if new.section_id is not null
       and not exists (select 1 from public.pattern_sections s join public.projects p on p.pattern_id = s.pattern_id
                        where s.id = new.section_id and p.id = new.project_id) then
      raise exception 'Section must belong to the project''s pattern' using errcode = '23514';
    end if;
  elsif tg_table_name in ('project_reader_states', 'project_bookmarks') then
    if not exists (select 1 from public.pattern_sources s join public.projects p on p.pattern_id = s.pattern_id
                    where s.id = new.source_id and p.id = new.project_id) then
      raise exception 'Source must belong to the project''s pattern' using errcode = '23514';
    end if;
  elsif tg_table_name = 'projects' then
    if new.progress_counter_id is not null
       and not exists (select 1 from public.project_counters
                        where id = new.progress_counter_id and project_id = new.id) then
      raise exception 'Progress counter must belong to the project' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'project_counters', 'project_counter_events', 'project_milestones', 'project_progress_events',
    'project_notes', 'project_reader_states', 'project_bookmarks'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner only" on public.%I for all to authenticated
         using ((select public.is_owner(owner_id)))
         with check ((select public.is_owner(owner_id)))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function private.check_same_owner()', t || '_same_owner', t);
  end loop;
  foreach t in array array['project_counters', 'project_reader_states', 'project_bookmarks', 'projects'] loop
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function private.check_project_links()', t || '_links', t);
  end loop;
end;
$$;

-- Sessions/notes/milestones/progress/photo links stay inside one project.
create or replace function private.check_session_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.session_id is not null
     and not exists (select 1 from public.project_sessions where id = new.session_id and project_id = new.project_id) then
    raise exception 'Session must belong to the same project' using errcode = '23514';
  end if;
  return new;
end;
$$;
do $$
declare
  t text;
begin
  foreach t in array array['project_counter_events', 'project_milestones', 'project_progress_events', 'project_notes', 'project_photos'] loop
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function private.check_session_link()', t || '_session_link', t);
  end loop;
end;
$$;

-- ------------------------------------------------------------ main counter

-- Every project has a main row counter from the start.
create or replace function private.project_main_counter()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.project_counters (owner_id, project_id, name, is_main, position)
  values (new.owner_id, new.id, 'Rows', true, 0);
  return new;
end;
$$;
create trigger projects_main_counter after insert on public.projects
  for each row execute function private.project_main_counter();

insert into public.project_counters (owner_id, project_id, name, is_main, position)
select p.owner_id, p.id, 'Rows', true, 0 from public.projects p
 where not exists (select 1 from public.project_counters c where c.project_id = p.id and c.is_main);

-- ------------------------------------------------------------ counter events

-- Applies one counter change exactly once (the event id is the idempotency
-- key), so retries and offline replays never double-count. Returns the
-- counter's value afterwards and whether this call applied the change.
create or replace function public.apply_counter_event(
  p_id uuid,
  p_counter uuid,
  p_kind text,
  p_amount integer,
  p_at timestamptz default null,
  p_session uuid default null
)
returns table (r_counter uuid, r_value integer, r_rolled integer, r_applied boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c public.project_counters%rowtype;
  next_value integer;
  rolls integer := 0;
  inserted uuid;
  i integer;
begin
  if p_kind not in ('add', 'set') then
    raise exception 'Unknown counter change' using errcode = '22023';
  end if;
  select * into c from public.project_counters where id = p_counter for update;
  if not found then
    raise exception 'Counter not found' using errcode = 'P0002';
  end if;

  insert into public.project_counter_events (id, owner_id, project_id, counter_id, kind, amount, session_id, created_at)
  values (p_id, c.owner_id, c.project_id, c.id, p_kind, p_amount, p_session,
          least(coalesce(p_at, now()), now() + interval '5 minutes'))
  on conflict (id) do nothing
  returning id into inserted;

  if inserted is null then
    return query select c.id, c.value, 0, false;
    return;
  end if;

  next_value := case when p_kind = 'set' then greatest(p_amount, 0) else greatest(c.value + p_amount, 0) end;
  if p_kind = 'add' and p_amount > 0 and c.rollover and c.target is not null and next_value >= c.target then
    rolls := next_value / c.target;
    next_value := next_value % c.target;
  end if;

  update public.project_counters set value = next_value where id = c.id;
  update public.project_counter_events set value_after = next_value, rolled_over = rolls > 0 where id = p_id;

  if rolls > 0 and c.rollover_counter_id is not null then
    for i in 1..least(rolls, 1000) loop
      -- Deterministic id: the linked increment is tied to this event.
      perform public.apply_counter_event(
        extensions.uuid_generate_v5(p_id, 'rollover-' || i), c.rollover_counter_id, 'add', 1, p_at, p_session);
    end loop;
  end if;

  return query select c.id, next_value, rolls, true;
end;
$$;

revoke execute on function public.apply_counter_event(uuid, uuid, text, integer, timestamptz, uuid) from public, anon;
grant execute on function public.apply_counter_event(uuid, uuid, text, integer, timestamptz, uuid) to authenticated;
