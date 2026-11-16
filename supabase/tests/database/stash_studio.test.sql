-- pgTAP: Stash — quantities, lots, reservations, consumption, tools, kits, owners.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

delete from private.authorized_accounts;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000000f1', 'st-owner@makerie.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f2', 'st-other@makerie.test', 'authenticated', 'authenticated');
select private.authorize_account('00000000-0000-4000-8000-0000000000f1');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}';

-- Locations nest; no cycles
insert into public.stash_locations (id, name) values ('1a000000-0000-4000-8000-000000000001', 'Closet');
insert into public.stash_locations (id, name, parent_id) values ('1a000000-0000-4000-8000-000000000002', 'Top shelf', '1a000000-0000-4000-8000-000000000001');
select throws_ok($$ update public.stash_locations set parent_id = '1a000000-0000-4000-8000-000000000002' where id = '1a000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'locations cannot nest inside themselves');

-- Yarn with two dye lots
insert into public.stash_items (id, kind, family, category, name, brand, color_code, color_name, color_hexes, unit_label, unit_mass_dg, unit_length_cm, tags)
values ('1b000000-0000-4000-8000-000000000001', 'material', 'yarn', 'Yarn', 'Special DK', 'Stylecraft', '1034', 'Sherbet', array['#F477D3', 'bad'], 'skein', 1000, 26500, array[' Cozy', 'cozy']);
select is((select color_hexes from public.stash_items where id = '1b000000-0000-4000-8000-000000000001'), array['#f477d3'], 'invalid swatches are dropped');
select ok((select search_text like '%1034%' and search_text like '%stylecraft%' from public.stash_items where id = '1b000000-0000-4000-8000-000000000001'), 'search covers code and brand');
insert into public.stash_lots (id, item_id, dye_lot, location_id) values
  ('1c000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', 'A123', '1a000000-0000-4000-8000-000000000002'),
  ('1c000000-0000-4000-8000-000000000002', '1b000000-0000-4000-8000-000000000001', 'B456', null);
-- 2 full skeins + 38 g leftover in lot A; 1 partly used ball (unknown) in lot B
insert into public.stash_holdings (id, lot_id, item_id, measure, quantity, condition, reserved) values
  ('1d000000-0000-4000-8000-000000000001', '1c000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', 'count', 2, 'full', 99);
insert into public.stash_holdings (id, lot_id, item_id, measure, quantity, condition, entry_unit) values
  ('1d000000-0000-4000-8000-000000000002', '1c000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', 'mass', 380, 'partial', 'g');
insert into public.stash_holdings (id, lot_id, item_id, measure, quantity, condition, amount_known) values
  ('1d000000-0000-4000-8000-000000000003', '1c000000-0000-4000-8000-000000000002', '1b000000-0000-4000-8000-000000000001', 'count', 1, 'partial', false);
select is((select reserved from public.stash_holdings where id = '1d000000-0000-4000-8000-000000000001'), 0, 'reservations cannot be set on insert');
select is((select array[full_units, partial_units, loose_mass_dg] from public.stash_item_overview where id = '1b000000-0000-4000-8000-000000000001'),
  array[2, 1, 380], 'overview keeps full, partial and measured stock separate');
select is((select has_unknown_partials from public.stash_item_overview where id = '1b000000-0000-4000-8000-000000000001'), true, 'unknown partials are flagged, not guessed');
select is((select count(*)::int from public.stash_movements where kind = 'add'), 3, 'new stock is logged');
select throws_ok($$ update public.stash_holdings set quantity = 50 where id = '1d000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'quantities cannot be edited directly');
select throws_ok($$ insert into public.stash_movements (id, item_id, kind) values (gen_random_uuid(), '1b000000-0000-4000-8000-000000000001', 'add') $$,
  '42501', null, 'the history log cannot be written directly');

-- Add more, idempotently
select is((select r_quantity from public.stash_change('1e000000-0000-4000-8000-000000000001', '1d000000-0000-4000-8000-000000000001', 'add', 3, 'Bought more')), 5, 'add more');
select is((select r_applied from public.stash_change('1e000000-0000-4000-8000-000000000001', '1d000000-0000-4000-8000-000000000001', 'add', 3, 'Bought more')), false, 'a retried add is ignored');
select is((select quantity from public.stash_holdings where id = '1d000000-0000-4000-8000-000000000001'), 5, 'no double add');
select throws_ok($$ select public.stash_change(gen_random_uuid(), '1d000000-0000-4000-8000-000000000001', 'remove', -9, null) $$,
  '23514', null, 'stock never goes negative');

-- Two projects on one pattern
insert into public.patterns (id, title, craft) values ('1f000000-0000-4000-8000-000000000001', 'Cardigan', 'knitting');
insert into public.pattern_materials (id, pattern_id, family, description, quantity_text) values
  ('2a000000-0000-4000-8000-000000000001', '1f000000-0000-4000-8000-000000000001', 'yarn', 'DK yarn', '800 yards');
insert into public.projects (id, pattern_id, name) values
  ('2b000000-0000-4000-8000-000000000001', '1f000000-0000-4000-8000-000000000001', 'Blue cardigan'),
  ('2b000000-0000-4000-8000-000000000002', '1f000000-0000-4000-8000-000000000001', 'Gift cardigan');
insert into public.stash_allocations (id, project_id, item_id, holding_id, kind, measure, planned_quantity, requirement_id) values
  ('2c000000-0000-4000-8000-000000000001', '2b000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', '1d000000-0000-4000-8000-000000000001', 'material', 'count', 4, '2a000000-0000-4000-8000-000000000001'),
  ('2c000000-0000-4000-8000-000000000002', '2b000000-0000-4000-8000-000000000002', '1b000000-0000-4000-8000-000000000001', '1d000000-0000-4000-8000-000000000001', 'material', 'count', 3, null);
select is((select r_available from public.stash_reserve('2d000000-0000-4000-8000-000000000001', '2c000000-0000-4000-8000-000000000001', 4)), 1, 'reserve 4 of 5, 1 left');
select is((select r_applied from public.stash_reserve('2d000000-0000-4000-8000-000000000001', '2c000000-0000-4000-8000-000000000001', 4)), false, 'double-tapped reserve is ignored');
select throws_ok($$ select public.stash_reserve(gen_random_uuid(), '2c000000-0000-4000-8000-000000000002', 3) $$,
  '23514', null, 'another project cannot over-reserve the same stock');
select lives_ok($$ select public.stash_reserve(gen_random_uuid(), '2c000000-0000-4000-8000-000000000002', 1) $$, 'it can reserve what is left');
select throws_ok($$ select public.stash_change(gen_random_uuid(), '1d000000-0000-4000-8000-000000000001', 'remove', -1, null) $$,
  '23514', null, 'reserved stock cannot be removed from under a project');

-- Use 2 (from its reservation), release 1, return a leftover
select is((select array[r_used, r_reserved, r_quantity] from public.stash_use('2e000000-0000-4000-8000-000000000001', '2c000000-0000-4000-8000-000000000001', 2, 'Body')),
  array[2, 2, 3], 'using draws on the project''s own reservation first');
select is((select r_applied from public.stash_use('2e000000-0000-4000-8000-000000000001', '2c000000-0000-4000-8000-000000000001', 2, 'Body')), false, 'a replayed use is not deducted twice');
select is((select array[quantity, reserved] from public.stash_holdings where id = '1d000000-0000-4000-8000-000000000001'), array[3, 3], 'holding totals stay consistent');
select lives_ok($$ select public.stash_reserve(gen_random_uuid(), '2c000000-0000-4000-8000-000000000001', -1) $$, 'release unused reservation');
select ok((select public.stash_return_leftover('2f000000-0000-4000-8000-000000000001', '2c000000-0000-4000-8000-000000000001', 'mass', 300, true, 'Leftover from body') is not null), 'leftover comes back');
select is((select array[measure, condition, quantity::text] from public.stash_holdings where label = 'Leftover'), array['mass', 'partial', '300'], 'leftover is a partial holding with its own amount');

-- Tools are never consumed
insert into public.stash_items (id, kind, family, category, name, specs) values
  ('3a000000-0000-4000-8000-000000000001', 'tool', 'tool', 'Circular needle', '4.0 mm circular', '{"size":"4.0 mm","length":"80 cm"}');
insert into public.stash_lots (id, item_id) values ('3b000000-0000-4000-8000-000000000001', '3a000000-0000-4000-8000-000000000001');
insert into public.stash_holdings (id, lot_id, item_id, measure, quantity) values ('3c000000-0000-4000-8000-000000000001', '3b000000-0000-4000-8000-000000000001', '3a000000-0000-4000-8000-000000000001', 'count', 1);
insert into public.stash_allocations (id, project_id, item_id, kind) values ('3d000000-0000-4000-8000-000000000001', '2b000000-0000-4000-8000-000000000001', '3a000000-0000-4000-8000-000000000001', 'tool');
select throws_ok($$ select public.stash_use(gen_random_uuid(), '3d000000-0000-4000-8000-000000000001', 1, null) $$, '22023', null, 'tools cannot be used up');
select is((select quantity from public.stash_holdings where id = '3c000000-0000-4000-8000-000000000001'), 1, 'linking a tool leaves its count untouched');

-- Kits link items without duplicating them
insert into public.stash_kits (id, name, project_id) values ('3e000000-0000-4000-8000-000000000001', 'Cardigan bag', '2b000000-0000-4000-8000-000000000001');
insert into public.stash_kit_items (kit_id, item_id, holding_id, quantity) values ('3e000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', '1d000000-0000-4000-8000-000000000001', 2);
select is((select count(*)::int from public.stash_items), 2, 'kits do not create item copies');

-- Project history protects items
select throws_ok($$ delete from public.stash_items where id = '1b000000-0000-4000-8000-000000000001' $$, null, null, 'items used by projects cannot be deleted');

-- Another account / anon
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000f2","role":"authenticated"}';
select is((select count(*)::int from public.stash_items), 0, 'other accounts see no stash');
select throws_ok($$ select public.stash_change(gen_random_uuid(), '1d000000-0000-4000-8000-000000000001', 'add', 1, null) $$, 'P0002', null, 'other accounts cannot change stock');
reset role;
set local role anon;
select throws_ok($$ select * from public.stash_items $$, '42501', null, 'anon cannot read stash');

select * from finish();
rollback;
