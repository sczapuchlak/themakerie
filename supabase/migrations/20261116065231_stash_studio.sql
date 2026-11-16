-- The Makerie — Stash & Supply Studio
--
-- Items describe a supply (a yarn colourway, a floss colour, a hook). Stock
-- lives in lots (a purchase / dye lot) and holdings (quantity buckets within
-- a lot: "4 full skeins", "38 g leftover", "1 partly used ball, amount
-- unknown", "a 30 x 40 cm offcut"). Quantities are integers in exact units:
-- counts, mass in decigrams (0.1 g), length in centimetres, pieces.
--
-- Every stock change is a movement row whose client-generated id makes it
-- idempotent; quantities only change through the stash_* functions, which
-- lock the holding and refuse to go below what is reserved.

-- ------------------------------------------------------------ organisation

create table public.stash_locations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id uuid references public.stash_locations (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  notes text check (char_length(notes) <= 1000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index stash_locations_unique_name
  on public.stash_locations (owner_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)));

create table public.stash_collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id uuid references public.stash_collections (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  color text check (color in ('lime', 'pink', 'laser', 'ultraviolet', 'aqua', 'peach', 'cobalt')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index stash_collections_unique_name
  on public.stash_collections (owner_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)));

-- Custom categories extend the built-in list without schema changes.
create table public.stash_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  family text not null check (family in ('yarn', 'thread', 'fabric', 'notion', 'tool', 'other')),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create unique index stash_categories_unique on public.stash_categories (owner_id, family, lower(btrim(name)));

-- Nested trees never loop.
create or replace function private.check_tree_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cur uuid := new.parent_id;
  depth integer := 0;
  parent_owner uuid;
begin
  if new.parent_id is null then
    return new;
  end if;
  execute format('select owner_id from public.%I where id = $1', tg_table_name) into parent_owner using new.parent_id;
  if parent_owner is distinct from new.owner_id then
    raise exception 'Parent not found' using errcode = '23503';
  end if;
  while cur is not null loop
    if cur = new.id then
      raise exception 'A folder cannot be inside itself' using errcode = '23514';
    end if;
    depth := depth + 1;
    if depth > 50 then
      raise exception 'Nesting is too deep' using errcode = '23514';
    end if;
    execute format('select parent_id from public.%I where id = $1', tg_table_name) into cur using cur;
  end loop;
  return new;
end;
$$;
create trigger stash_locations_tree before insert or update on public.stash_locations
  for each row execute function private.check_tree_parent();
create trigger stash_collections_tree before insert or update on public.stash_collections
  for each row execute function private.check_tree_parent();
create trigger stash_locations_touch before update on public.stash_locations
  for each row execute function private.touch_updated_at();
create trigger stash_collections_touch before update on public.stash_collections
  for each row execute function private.touch_updated_at();

-- ------------------------------------------------------------------- items

create table public.stash_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('material', 'tool')),
  family text not null check (family in ('yarn', 'thread', 'fabric', 'notion', 'tool', 'other')),
  category text not null check (char_length(btrim(category)) between 1 and 60),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  brand text check (char_length(brand) <= 120),
  product_line text check (char_length(product_line) <= 120),
  -- Manufacturer colour codes are strings: "0310", "B5200", "3865".
  color_code text check (char_length(color_code) <= 40),
  color_name text check (char_length(color_name) <= 120),
  -- User-chosen swatches (several for variegated yarn) + approximate families.
  color_hexes text[] not null default '{}',
  color_families text[] not null default '{}',
  -- Family-specific specifications (fiber, weight class, gauge, mesh, size…).
  specs jsonb not null default '{}'::jsonb check (jsonb_typeof(specs) = 'object'),
  -- Per-unit size, for totals when known: one skein = 1000 dg (100 g) / 18288 cm (200 yd).
  unit_label text not null default 'unit' check (char_length(unit_label) between 1 and 30),
  unit_mass_dg integer check (unit_mass_dg > 0),
  unit_length_cm integer check (unit_length_cm > 0),
  low_stock_threshold integer check (low_stock_threshold >= 0),
  collection_id uuid references public.stash_collections (id) on delete set null,
  tags text[] not null default '{}',
  favorite boolean not null default false,
  notes text check (char_length(notes) <= 10000),
  cover_path text,
  archived_at timestamptz,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'tool') = (family = 'tool'))
);
create index stash_items_owner_idx on public.stash_items (owner_id, archived_at, created_at desc);
create index stash_items_family_idx on public.stash_items (owner_id, family, category);
create index stash_items_collection_idx on public.stash_items (collection_id);

create or replace function private.stash_items_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.tags := coalesce((select array_agg(distinct t order by t) from unnest(new.tags) as u(raw), lateral (select lower(btrim(raw)) as t) x where t <> ''), '{}');
  new.color_hexes := coalesce((select array_agg(lower(h)) from unnest(new.color_hexes) as h where h ~* '^#[0-9a-f]{6}$'), '{}');
  new.color_families := coalesce((select array_agg(distinct f) from unnest(new.color_families) as f where f in
    ('red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'brown', 'neutral', 'black', 'white', 'multi')), '{}');
  new.search_text := lower(concat_ws(' ', new.name, new.brand, new.product_line, new.color_code, new.color_name, new.category,
    new.specs ->> 'fiber', new.specs ->> 'weight_class', new.specs ->> 'size', new.specs ->> 'thread_type', new.specs ->> 'fabric_type',
    array_to_string(new.tags, ' '), array_to_string(new.color_families, ' ')));
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger stash_items_before_write before insert or update on public.stash_items
  for each row execute function private.stash_items_before_write();

create table public.stash_photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.stash_items (id) on delete cascade,
  storage_path text not null unique,
  file_name text,
  mime_type text,
  size_bytes bigint check (size_bytes >= 0),
  created_at timestamptz not null default now()
);
create index stash_photos_item_idx on public.stash_photos (item_id, created_at);

-- ------------------------------------------------------------------ stock

-- A lot is one purchase / dye lot / batch, stored in one place.
create table public.stash_lots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.stash_items (id) on delete cascade,
  dye_lot text check (char_length(dye_lot) <= 60),
  location_id uuid references public.stash_locations (id) on delete set null,
  purchased_on date,
  source text check (char_length(source) <= 200),
  price_cents integer check (price_cents >= 0),
  currency text check (currency ~ '^[A-Z]{3}$'),
  condition text check (char_length(condition) <= 60),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stash_lots_item_idx on public.stash_lots (item_id);
create index stash_lots_location_idx on public.stash_lots (location_id);
create trigger stash_lots_touch before update on public.stash_lots
  for each row execute function private.touch_updated_at();

-- A holding is a quantity bucket inside a lot.
create table public.stash_holdings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lot_id uuid not null references public.stash_lots (id) on delete cascade,
  item_id uuid not null references public.stash_items (id) on delete cascade,
  measure text not null check (measure in ('count', 'mass', 'length', 'piece')),
  -- count: units; mass: decigrams; length: centimetres; piece: pieces (1 each)
  quantity integer not null default 0 check (quantity >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  condition text not null default 'full' check (condition in ('full', 'partial')),
  -- "1 partly used ball, exact remainder unknown" → count 1, partial, amount_known false.
  amount_known boolean not null default true,
  entry_unit text not null default 'unit' check (entry_unit in ('unit', 'g', 'oz', 'm', 'yd', 'cm', 'in', 'piece')),
  width_mm integer check (width_mm > 0),
  height_mm integer check (height_mm > 0),
  label text check (char_length(label) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reserved <= quantity),
  check (measure = 'piece' or (width_mm is null and height_mm is null))
);
create index stash_holdings_lot_idx on public.stash_holdings (lot_id);
create index stash_holdings_item_idx on public.stash_holdings (item_id);
create trigger stash_holdings_touch before update on public.stash_holdings
  for each row execute function private.touch_updated_at();

-- Durable history of every change. Never edited; corrections are new rows.
create table public.stash_movements (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.stash_items (id) on delete cascade,
  holding_id uuid references public.stash_holdings (id) on delete set null,
  kind text not null check (kind in ('add', 'use', 'return', 'adjust', 'remove', 'reserve', 'release', 'tool_assign', 'tool_return')),
  measure text check (measure in ('count', 'mass', 'length', 'piece')),
  delta_quantity integer not null default 0,
  delta_reserved integer not null default 0,
  quantity_after integer,
  reserved_after integer,
  project_id uuid references public.projects (id) on delete set null,
  allocation_id uuid,
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index stash_movements_item_idx on public.stash_movements (item_id, created_at desc);
create index stash_movements_project_idx on public.stash_movements (project_id);

-- ------------------------------------------------------------ projects

-- Pattern requirements: specifications, never owned stock.
create table public.pattern_materials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pattern_id uuid not null references public.patterns (id) on delete cascade,
  kind text not null default 'material' check (kind in ('material', 'tool')),
  family text not null default 'other' check (family in ('yarn', 'thread', 'fabric', 'notion', 'tool', 'other')),
  description text not null check (char_length(btrim(description)) between 1 and 300),
  quantity_text text check (char_length(quantity_text) <= 120),
  notes text check (char_length(notes) <= 1000),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index pattern_materials_pattern_idx on public.pattern_materials (pattern_id, position);

-- What a project actually uses. Materials reserve/consume from a holding;
-- tools are linked (assigned) and never consumed.
create table public.stash_allocations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  item_id uuid not null references public.stash_items (id) on delete restrict,
  holding_id uuid references public.stash_holdings (id) on delete set null,
  requirement_id uuid references public.pattern_materials (id) on delete set null,
  kind text not null check (kind in ('material', 'tool')),
  measure text check (measure in ('count', 'mass', 'length', 'piece')),
  planned_quantity integer check (planned_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  used_quantity integer not null default 0 check (used_quantity >= 0),
  status text not null default 'planned' check (status in ('planned', 'active', 'done', 'returned')),
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'material' or (reserved_quantity = 0 and used_quantity = 0))
);
create index stash_allocations_project_idx on public.stash_allocations (project_id);
create index stash_allocations_item_idx on public.stash_allocations (item_id);
create index stash_allocations_holding_idx on public.stash_allocations (holding_id);
create trigger stash_allocations_touch before update on public.stash_allocations
  for each row execute function private.touch_updated_at();

-- Project bags / kits group existing items without duplicating them.
create table public.stash_kits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  project_id uuid references public.projects (id) on delete set null,
  location_id uuid references public.stash_locations (id) on delete set null,
  color text check (color in ('lime', 'pink', 'laser', 'ultraviolet', 'aqua', 'peach', 'cobalt')),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger stash_kits_touch before update on public.stash_kits
  for each row execute function private.touch_updated_at();

create table public.stash_kit_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kit_id uuid not null references public.stash_kits (id) on delete cascade,
  item_id uuid not null references public.stash_items (id) on delete cascade,
  holding_id uuid references public.stash_holdings (id) on delete set null,
  -- Consumables can put part of a holding in the kit; tools link the item.
  quantity integer check (quantity > 0),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index stash_kit_items_kit_idx on public.stash_kit_items (kit_id);
create unique index stash_kit_items_unique on public.stash_kit_items (kit_id, item_id, coalesce(holding_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Wishlist (someday) and shopping list (needed for a project).
create table public.stash_wants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  list text not null default 'shopping' check (list in ('wishlist', 'shopping')),
  family text not null default 'other' check (family in ('yarn', 'thread', 'fabric', 'notion', 'tool', 'other')),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  brand text check (char_length(brand) <= 120),
  color text check (char_length(color) <= 120),
  size text check (char_length(size) <= 80),
  needed_quantity integer check (needed_quantity > 0),
  received_quantity integer not null default 0 check (received_quantity >= 0),
  unit_label text check (char_length(unit_label) <= 30),
  price_cents integer check (price_cents >= 0),
  currency text check (currency ~ '^[A-Z]{3}$'),
  merchant text check (char_length(merchant) <= 120),
  url text check (url is null or url ~* '^https?://'),
  priority smallint not null default 2 check (priority between 1 and 3),
  project_id uuid references public.projects (id) on delete set null,
  item_id uuid references public.stash_items (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'partial', 'received', 'dropped')),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stash_wants_list_idx on public.stash_wants (owner_id, list, status, priority);
create trigger stash_wants_touch before update on public.stash_wants
  for each row execute function private.touch_updated_at();

-- ------------------------------------------------------------ ownership

create or replace function private.stash_check_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ok boolean := true;
begin
  if tg_table_name = 'stash_items' then
    if new.collection_id is not null then
      ok := exists (select 1 from public.stash_collections where id = new.collection_id and owner_id = new.owner_id);
    end if;
  elsif tg_table_name = 'stash_photos' then
    ok := exists (select 1 from public.stash_items where id = new.item_id and owner_id = new.owner_id);
  elsif tg_table_name = 'stash_lots' then
    ok := exists (select 1 from public.stash_items where id = new.item_id and owner_id = new.owner_id)
      and (new.location_id is null or exists (select 1 from public.stash_locations where id = new.location_id and owner_id = new.owner_id));
  elsif tg_table_name = 'stash_holdings' then
    ok := exists (select 1 from public.stash_lots where id = new.lot_id and item_id = new.item_id and owner_id = new.owner_id);
  elsif tg_table_name = 'pattern_materials' then
    ok := exists (select 1 from public.patterns where id = new.pattern_id and owner_id = new.owner_id);
  elsif tg_table_name = 'stash_allocations' then
    ok := exists (select 1 from public.projects where id = new.project_id and owner_id = new.owner_id)
      and exists (select 1 from public.stash_items where id = new.item_id and owner_id = new.owner_id
                    and kind = new.kind)
      and (new.holding_id is null or exists (select 1 from public.stash_holdings where id = new.holding_id and item_id = new.item_id))
      and (new.requirement_id is null or exists (select 1 from public.pattern_materials m join public.projects p on p.pattern_id = m.pattern_id
                                                   where m.id = new.requirement_id and p.id = new.project_id));
  elsif tg_table_name = 'stash_kits' then
    ok := (new.project_id is null or exists (select 1 from public.projects where id = new.project_id and owner_id = new.owner_id))
      and (new.location_id is null or exists (select 1 from public.stash_locations where id = new.location_id and owner_id = new.owner_id));
  elsif tg_table_name = 'stash_kit_items' then
    ok := exists (select 1 from public.stash_kits where id = new.kit_id and owner_id = new.owner_id)
      and exists (select 1 from public.stash_items where id = new.item_id and owner_id = new.owner_id)
      and (new.holding_id is null or exists (select 1 from public.stash_holdings where id = new.holding_id and item_id = new.item_id));
  elsif tg_table_name = 'stash_wants' then
    ok := (new.project_id is null or exists (select 1 from public.projects where id = new.project_id and owner_id = new.owner_id))
      and (new.item_id is null or exists (select 1 from public.stash_items where id = new.item_id and owner_id = new.owner_id));
  end if;
  if not ok then
    raise exception 'Related record not found' using errcode = '23503';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'stash_locations', 'stash_collections', 'stash_categories', 'stash_items', 'stash_photos', 'stash_lots',
    'stash_holdings', 'stash_movements', 'pattern_materials', 'stash_allocations', 'stash_kits', 'stash_kit_items', 'stash_wants'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner only" on public.%I for all to authenticated
         using ((select public.is_owner(owner_id)))
         with check ((select public.is_owner(owner_id)))', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
  foreach t in array array[
    'stash_items', 'stash_photos', 'stash_lots', 'stash_holdings', 'pattern_materials', 'stash_allocations',
    'stash_kits', 'stash_kit_items', 'stash_wants'
  ] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function private.stash_check_refs()', t || '_refs', t);
  end loop;
end;
$$;

-- Movements are an append-only log written only by the functions/triggers below.
revoke insert, update, delete on public.stash_movements from authenticated;

-- Quantities only change through the stash_* functions: the app may update
-- descriptive columns, never quantity/reserved/used directly.
revoke update on public.stash_holdings from authenticated;
grant update (condition, amount_known, entry_unit, width_mm, height_mm, label) on public.stash_holdings to authenticated;
revoke update on public.stash_allocations from authenticated;
grant update (planned_quantity, status, note, requirement_id) on public.stash_allocations to authenticated;

-- New stock arrives with its holding; log it. Reservations always start at 0.
create or replace function private.stash_holding_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if tg_when = 'BEFORE' then
      new.reserved := 0;
      return new;
    end if;
    if new.quantity > 0 then
      insert into public.stash_movements (id, owner_id, item_id, holding_id, kind, measure, delta_quantity, quantity_after, reserved_after, note)
      values (gen_random_uuid(), new.owner_id, new.item_id, new.id, 'add', new.measure, new.quantity, new.quantity, 0, 'Added to stash');
    end if;
    return new;
  end if;
  -- DELETE: never drop stock that a project has reserved; log what goes.
  if old.reserved > 0 then
    raise exception 'This stock is reserved for a project — release it first' using errcode = '23514';
  end if;
  -- Skip the log when the whole item is being deleted (its history goes with it).
  if old.quantity > 0 and exists (select 1 from public.stash_items where id = old.item_id) then
    insert into public.stash_movements (id, owner_id, item_id, holding_id, kind, measure, delta_quantity, quantity_after, reserved_after, note)
    values (gen_random_uuid(), old.owner_id, old.item_id, old.id, 'remove', old.measure, -old.quantity, 0, 0, 'Removed from stash');
  end if;
  return old;
end;
$$;
create trigger stash_holdings_before_insert before insert on public.stash_holdings
  for each row execute function private.stash_holding_insert();
create trigger stash_holdings_after_insert after insert on public.stash_holdings
  for each row execute function private.stash_holding_insert();
create trigger stash_holdings_before_delete before delete on public.stash_holdings
  for each row execute function private.stash_holding_insert();

-- Allocations start empty; tools log assign/return without touching stock.
create or replace function private.stash_allocation_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_when = 'BEFORE' then
    new.reserved_quantity := 0;
    new.used_quantity := 0;
    return new;
  end if;
  if new.kind = 'tool' then
    insert into public.stash_movements (id, owner_id, item_id, kind, project_id, allocation_id, note)
    values (gen_random_uuid(), new.owner_id, new.item_id, 'tool_assign', new.project_id, new.id, 'Assigned to project');
  end if;
  return new;
end;
$$;
create trigger stash_allocations_before_insert before insert on public.stash_allocations
  for each row execute function private.stash_allocation_insert();
create trigger stash_allocations_after_insert after insert on public.stash_allocations
  for each row execute function private.stash_allocation_insert();

-- --------------------------------------------------------- stock functions
-- SECURITY DEFINER so they can write the protected columns and the audit
-- log; each verifies ownership itself with public.is_owner(). Each takes a
-- client-generated id; a repeated id is a no-op returning the current state.

create or replace function public.stash_change(
  p_id uuid,
  p_holding uuid,
  p_kind text,
  p_delta integer,
  p_note text default null
)
returns table (r_quantity integer, r_reserved integer, r_applied boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  h public.stash_holdings%rowtype;
  inserted uuid;
begin
  if p_kind not in ('add', 'adjust', 'remove', 'return') then
    raise exception 'Unknown stock change' using errcode = '22023';
  end if;
  select * into h from public.stash_holdings where id = p_holding for update;
  if not found or not public.is_owner(h.owner_id) then
    raise exception 'Stock not found' using errcode = 'P0002';
  end if;
  insert into public.stash_movements (id, owner_id, item_id, holding_id, kind, measure, delta_quantity, note)
  values (p_id, h.owner_id, h.item_id, h.id, p_kind, h.measure, p_delta, left(p_note, 1000))
  on conflict (id) do nothing returning id into inserted;
  if inserted is null then
    return query select h.quantity, h.reserved, false;
    return;
  end if;
  if (p_kind in ('add', 'return') and p_delta <= 0) or (p_kind = 'remove' and p_delta >= 0) then
    raise exception 'Invalid amount' using errcode = '22023';
  end if;
  if h.quantity + p_delta < h.reserved then
    raise exception 'That would leave less than is reserved for projects' using errcode = '23514';
  end if;
  update public.stash_holdings set quantity = quantity + p_delta where id = h.id;
  update public.stash_movements set quantity_after = h.quantity + p_delta, reserved_after = h.reserved where id = p_id;
  return query select h.quantity + p_delta, h.reserved, true;
end;
$$;

-- Reserve (positive) or release (negative) stock for a project allocation.
create or replace function public.stash_reserve(p_id uuid, p_allocation uuid, p_delta integer)
returns table (r_reserved integer, r_available integer, r_applied boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.stash_allocations%rowtype;
  h public.stash_holdings%rowtype;
  inserted uuid;
begin
  select * into a from public.stash_allocations where id = p_allocation for update;
  if not found or not public.is_owner(a.owner_id) then
    raise exception 'Supply not found' using errcode = 'P0002';
  end if;
  if a.kind <> 'material' or a.holding_id is null then
    raise exception 'Only materials from a specific stock can be reserved' using errcode = '22023';
  end if;
  select * into h from public.stash_holdings where id = a.holding_id for update;
  insert into public.stash_movements (id, owner_id, item_id, holding_id, kind, measure, delta_reserved, project_id, allocation_id)
  values (p_id, a.owner_id, a.item_id, h.id, case when p_delta >= 0 then 'reserve' else 'release' end, h.measure, p_delta, a.project_id, a.id)
  on conflict (id) do nothing returning id into inserted;
  if inserted is null then
    return query select a.reserved_quantity, h.quantity - h.reserved, false;
    return;
  end if;
  if p_delta = 0 then
    raise exception 'Invalid amount' using errcode = '22023';
  end if;
  if p_delta > 0 and h.quantity - h.reserved < p_delta then
    raise exception 'Only % available to reserve', h.quantity - h.reserved using errcode = '23514';
  end if;
  if p_delta < 0 and a.reserved_quantity + p_delta < 0 then
    raise exception 'Cannot release more than is reserved' using errcode = '23514';
  end if;
  update public.stash_holdings set reserved = reserved + p_delta where id = h.id;
  update public.stash_allocations
     set reserved_quantity = reserved_quantity + p_delta,
         status = case when reserved_quantity + p_delta > 0 or used_quantity > 0 then 'active' else status end
   where id = a.id;
  update public.stash_movements set quantity_after = h.quantity, reserved_after = h.reserved + p_delta where id = p_id;
  return query select a.reserved_quantity + p_delta, h.quantity - h.reserved - p_delta, true;
end;
$$;

-- Record material actually used by a project. Uses the project's own
-- reservation first, then free stock; never takes another project's reservation.
create or replace function public.stash_use(p_id uuid, p_allocation uuid, p_amount integer, p_note text default null)
returns table (r_used integer, r_reserved integer, r_quantity integer, r_applied boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.stash_allocations%rowtype;
  h public.stash_holdings%rowtype;
  from_reserved integer;
  inserted uuid;
begin
  select * into a from public.stash_allocations where id = p_allocation for update;
  if not found or not public.is_owner(a.owner_id) then
    raise exception 'Supply not found' using errcode = 'P0002';
  end if;
  if a.kind <> 'material' or a.holding_id is null then
    raise exception 'Tools are never used up' using errcode = '22023';
  end if;
  select * into h from public.stash_holdings where id = a.holding_id for update;
  insert into public.stash_movements (id, owner_id, item_id, holding_id, kind, measure, delta_quantity, project_id, allocation_id, note)
  values (p_id, a.owner_id, a.item_id, h.id, 'use', h.measure, -p_amount, a.project_id, a.id, left(p_note, 1000))
  on conflict (id) do nothing returning id into inserted;
  if inserted is null then
    return query select a.used_quantity, a.reserved_quantity, h.quantity, false;
    return;
  end if;
  if p_amount <= 0 then
    raise exception 'Invalid amount' using errcode = '22023';
  end if;
  from_reserved := least(a.reserved_quantity, p_amount);
  if h.quantity - p_amount < h.reserved - from_reserved then
    raise exception 'Not enough in stock (% available)', h.quantity - (h.reserved - from_reserved) using errcode = '23514';
  end if;
  update public.stash_holdings set quantity = quantity - p_amount, reserved = reserved - from_reserved where id = h.id;
  update public.stash_allocations
     set used_quantity = used_quantity + p_amount, reserved_quantity = reserved_quantity - from_reserved, status = 'active'
   where id = a.id;
  update public.stash_movements set delta_reserved = -from_reserved, quantity_after = h.quantity - p_amount, reserved_after = h.reserved - from_reserved
   where id = p_id;
  return query select a.used_quantity + p_amount, a.reserved_quantity - from_reserved, h.quantity - p_amount, true;
end;
$$;

-- Leftovers come back as their own (usually partial) holding in the same lot.
create or replace function public.stash_return_leftover(
  p_id uuid, p_allocation uuid, p_measure text, p_amount integer, p_amount_known boolean default true, p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.stash_allocations%rowtype;
  h public.stash_holdings%rowtype;
  new_holding uuid;
begin
  if exists (select 1 from public.stash_movements where id = p_id) then
    select holding_id into new_holding from public.stash_movements where id = p_id;
    return new_holding;
  end if;
  select * into a from public.stash_allocations where id = p_allocation for update;
  if not found or not public.is_owner(a.owner_id) or a.kind <> 'material' or a.holding_id is null then
    raise exception 'Supply not found' using errcode = 'P0002';
  end if;
  if p_measure not in ('count', 'mass', 'length') or p_amount <= 0 then
    raise exception 'Invalid amount' using errcode = '22023';
  end if;
  select * into h from public.stash_holdings where id = a.holding_id;
  insert into public.stash_holdings (owner_id, lot_id, item_id, measure, quantity, condition, amount_known, entry_unit, label)
  values (a.owner_id, h.lot_id, a.item_id, p_measure, p_amount, 'partial', p_amount_known,
          case p_measure when 'mass' then 'g' when 'length' then 'm' else 'unit' end, 'Leftover')
  returning id into new_holding;
  insert into public.stash_movements (id, owner_id, item_id, holding_id, kind, measure, delta_quantity, quantity_after, reserved_after, project_id, allocation_id, note)
  values (p_id, a.owner_id, a.item_id, new_holding, 'return', p_measure, p_amount, p_amount, 0, a.project_id, a.id, left(p_note, 1000));
  return new_holding;
end;
$$;

-- Deleting an allocation releases its reservation first (history stays).
create or replace function private.stash_allocation_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.kind = 'tool' then
    insert into public.stash_movements (id, owner_id, item_id, kind, project_id, note)
    values (gen_random_uuid(), old.owner_id, old.item_id, 'tool_return', old.project_id, 'Unassigned from project');
  end if;
  if old.reserved_quantity > 0 and old.holding_id is not null then
    update public.stash_holdings set reserved = greatest(0, reserved - old.reserved_quantity) where id = old.holding_id;
    insert into public.stash_movements (id, owner_id, item_id, holding_id, kind, delta_reserved, project_id, note)
    values (gen_random_uuid(), old.owner_id, old.item_id, old.holding_id, 'release', -old.reserved_quantity, old.project_id, 'Removed from project');
  end if;
  return old;
end;
$$;
create trigger stash_allocations_release before delete on public.stash_allocations
  for each row execute function private.stash_allocation_release();

do $$
declare
  f text;
begin
  foreach f in array array[
    'stash_change(uuid, uuid, text, integer, text)',
    'stash_reserve(uuid, uuid, integer)',
    'stash_use(uuid, uuid, integer, text)',
    'stash_return_leftover(uuid, uuid, text, integer, boolean, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;

-- -------------------------------------------------------------- overview

-- One row per item with stock totals per measure (never mixing units).
create view public.stash_item_overview
with (security_invoker = true) as
select
  i.*,
  coalesce(sum(h.quantity) filter (where h.measure = 'count' and h.condition = 'full'), 0)::int as full_units,
  coalesce(sum(h.quantity) filter (where h.measure = 'count' and h.condition = 'partial'), 0)::int as partial_units,
  coalesce(bool_or(not h.amount_known) filter (where h.quantity > 0), false) as has_unknown_partials,
  coalesce(sum(h.quantity) filter (where h.measure = 'mass'), 0)::int as loose_mass_dg,
  coalesce(sum(h.quantity) filter (where h.measure = 'length'), 0)::int as loose_length_cm,
  coalesce(sum(h.quantity) filter (where h.measure = 'piece'), 0)::int as pieces,
  coalesce(sum(h.reserved), 0)::int as reserved_total,
  coalesce(sum(h.quantity), 0)::int as quantity_total,
  (select count(*) from public.stash_lots l where l.item_id = i.id)::int as lot_count,
  (select array_agg(distinct l.location_id) filter (where l.location_id is not null) from public.stash_lots l where l.item_id = i.id) as location_ids,
  (select count(*) from public.stash_allocations a where a.item_id = i.id and a.status in ('planned', 'active'))::int as active_allocations
from public.stash_items i
left join public.stash_holdings h on h.item_id = i.id
group by i.id;

revoke all on public.stash_item_overview from anon;
