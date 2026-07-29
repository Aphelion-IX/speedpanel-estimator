-- =============================================================================
-- Product catalog seed -- GENERATED, do not edit by hand
-- =============================================================================
-- Regenerate with:  npx vite-node scripts/generate-catalog-seed.ts
--
-- Populates panels/tracks/fixings/sealants, which ship empty. Until they have
-- rows, no price list can be edited: prices are entered per catalog item, so
-- an empty catalog means an empty (and therefore uneditable) price list.
--
-- Idempotent: every insert is guarded by a `where not exists` on the same
-- identity column the pricing engine matches on, so re-running adds nothing
-- and never duplicates a row. It also never UPDATES an existing row, so a
-- catalog you have since edited in Admin > Products is left untouched.
-- =============================================================================

begin;

-- --- Panels: matched downstream by `type` -----------------------------------
insert into panels (type, label, depth, frl, pack, ctrack_stock, ctrack_dim, jtrack_dim, max_h_vert, max_h_horiz, span_vert, span_horiz, corner_post, horiz_ctrack)
select 51, 'P51', '51 mm', '-/60/60', 21, 3, '55 x 56 x 55', '55 x 56 x 90', 5, 5,
       '{"maxW":"Unlimited","maxH":"5.0 m"}'::jsonb, '[{"maxW":"3.0 m","maxH":"3.0 m","cTrack":"55 x 56 x 1.15","fix":"1/face"},{"maxW":"4.5 m","maxH":"3.0 m","cTrack":"55 x 57 x 1.50","fix":"1/face"},{"maxW":"3.0 m","maxH":"4.0 m","cTrack":"55 x 57 x 1.50","fix":"1/face"},{"maxW":"4.5 m","maxH":"4.0 m","cTrack":"55 x 58 x 1.95","fix":"1/face"},{"maxW":"4.5 m","maxH":"5.0 m","cTrack":"55 x 58 x 1.95","fix":"1/face"}]'::jsonb, '[{"maxW":3,"rows":[{"maxH":3,"section":"55 x 56 x 1.15"},{"maxH":4,"section":"55 x 57 x 1.50"},{"maxH":5,"section":"55 x 58 x 1.95"}]},{"maxW":4.5,"rows":[{"maxH":3,"section":"55 x 57 x 1.50"},{"maxH":4,"section":"55 x 58 x 1.95"},{"maxH":5,"section":"55 x 58 x 1.95"}]}]'::jsonb, '[{"wMax":3,"hMax":3,"section":"55 x 56 x 1.15","fix":1},{"wMax":4.5,"hMax":3,"section":"55 x 57 x 1.50","fix":1},{"wMax":3,"hMax":4,"section":"55 x 57 x 1.50","fix":1},{"wMax":4.5,"hMax":4,"section":"55 x 58 x 1.95","fix":1},{"wMax":4.5,"hMax":5,"section":"55 x 58 x 1.95","fix":1},{"wMax":4.5,"hMax":null,"section":"55 x 58 x 1.95","fix":1,"outsideTable":true}]'::jsonb
where not exists (select 1 from panels where type = 51);

insert into panels (type, label, depth, frl, pack, ctrack_stock, ctrack_dim, jtrack_dim, max_h_vert, max_h_horiz, span_vert, span_horiz, corner_post, horiz_ctrack)
select 64, 'P64', '64 mm', '-/90/90', 17, 3, '55 x 68 x 55', '55 x 68 x 90', 5, 5,
       '{"maxW":"Unlimited","maxH":"5.0 m"}'::jsonb, '[{"maxW":"3.0 m","maxH":"3.0 m","cTrack":"55 x 68 x 1.15","fix":"1/face"},{"maxW":"4.5 m","maxH":"3.0 m","cTrack":"55 x 69 x 1.50","fix":"1/face"},{"maxW":"3.0 m","maxH":"4.0 m","cTrack":"55 x 69 x 1.50","fix":"1/face"},{"maxW":"4.5 m","maxH":"4.0 m","cTrack":"55 x 70 x 1.95","fix":"1/face"},{"maxW":"4.5 m","maxH":"5.0 m","cTrack":"55 x 70 x 1.95","fix":"1/face"}]'::jsonb, '[{"maxW":3,"rows":[{"maxH":3,"section":"55 x 68 x 1.15"},{"maxH":4,"section":"55 x 69 x 1.50"},{"maxH":5,"section":"55 x 70 x 1.95"}]},{"maxW":4.5,"rows":[{"maxH":3,"section":"55 x 69 x 1.50"},{"maxH":4,"section":"55 x 70 x 1.95"},{"maxH":5,"section":"55 x 70 x 1.95"}]}]'::jsonb, '[{"wMax":3,"hMax":3,"section":"55 x 68 x 1.15","fix":1},{"wMax":4.5,"hMax":3,"section":"55 x 69 x 1.50","fix":1},{"wMax":3,"hMax":4,"section":"55 x 69 x 1.50","fix":1},{"wMax":4.5,"hMax":4,"section":"55 x 70 x 1.95","fix":1},{"wMax":4.5,"hMax":5,"section":"55 x 70 x 1.95","fix":1},{"wMax":4.5,"hMax":null,"section":"55 x 70 x 1.95","fix":1,"outsideTable":true}]'::jsonb
where not exists (select 1 from panels where type = 64);

insert into panels (type, label, depth, frl, pack, ctrack_stock, ctrack_dim, jtrack_dim, max_h_vert, max_h_horiz, span_vert, span_horiz, corner_post, horiz_ctrack)
select 78, 'P78', '78 mm', '-/120/120', 14, 6, '55 x 82 x 55', '55 x 82 x 90', 14, 6,
       '{"maxW":"Unlimited","maxH":"14.0 m"}'::jsonb, '[{"maxW":"3.0 m","maxH":"3.0 m","cTrack":"90 x 82 x 1.15","fix":"1/face"},{"maxW":"4.5 m","maxH":"3.0 m","cTrack":"90 x 83 x 1.50","fix":"1/face"},{"maxW":"3.0 m","maxH":"4.5 m","cTrack":"90 x 83 x 1.50","fix":"1/face"},{"maxW":"4.5 m","maxH":"4.5 m","cTrack":"90 x 84 x 1.95","fix":"1/face"},{"maxW":"3.5 m","maxH":"6.0 m","cTrack":"90 x 84 x 1.95","fix":"1/face"},{"maxW":"4.5 m","maxH":"6.0 m","cTrack":"90 x 84 x 1.95","fix":"2/face"},{"maxW":"5.0 m","maxH":"Unlimited","cTrack":"90 x 84 x 1.95","fix":"2/face","note":"Stacked/shaft"}]'::jsonb, '[{"maxW":3,"rows":[{"maxH":3,"section":"90 x 82 x 1.15"},{"maxH":4.5,"section":"90 x 83 x 1.50"}]},{"maxW":4.5,"rows":[{"maxH":3,"section":"90 x 83 x 1.50"},{"maxH":4.5,"section":"90 x 84 x 1.95"}]}]'::jsonb, '[{"wMax":3,"hMax":3,"section":"90 x 82 x 1.15","fix":1},{"wMax":4.5,"hMax":3,"section":"90 x 83 x 1.50","fix":1},{"wMax":3,"hMax":4.5,"section":"90 x 83 x 1.50","fix":1},{"wMax":4.5,"hMax":4.5,"section":"90 x 84 x 1.95","fix":1},{"wMax":3.5,"hMax":6,"section":"90 x 84 x 1.95","fix":1},{"wMax":4.5,"hMax":6,"section":"90 x 84 x 1.95","fix":2},{"wMax":4.5,"hMax":null,"section":"90 x 84 x 1.95","fix":2,"outsideTable":true}]'::jsonb
where not exists (select 1 from panels where type = 78);

-- --- Tracks: matched downstream by (kind, system, panel_type) ---------------
insert into tracks (kind, system, label, dim, bmt, panel_type, stock_lengths)
select 'c-track', 'internal', 'C-track - P51', '55 x 56 x 55 - 1.15 mm BMT', '1.15 mm', 51, '[3]'::jsonb
where not exists (select 1 from tracks where kind = 'c-track' and system = 'internal' and panel_type = 51);

insert into tracks (kind, system, label, dim, bmt, panel_type, stock_lengths)
select 'c-track', 'internal', 'C-track - P64', '55 x 68 x 55 - 1.15 mm BMT', '1.15 mm', 64, '[3]'::jsonb
where not exists (select 1 from tracks where kind = 'c-track' and system = 'internal' and panel_type = 64);

insert into tracks (kind, system, label, dim, bmt, panel_type, stock_lengths)
select 'c-track', 'internal', 'C-track - P78', '55 x 82 x 55 - 1.15 mm BMT', '1.15 mm', 78, '[6]'::jsonb
where not exists (select 1 from tracks where kind = 'c-track' and system = 'internal' and panel_type = 78);

insert into tracks (kind, system, label, dim, bmt, panel_type, stock_lengths)
select 'j-track', 'internal', 'J-track - Base', '55 x 82 x 90 - 1.15 mm BMT', '1.15 mm', 78, '[6,3.6,3]'::jsonb
where not exists (select 1 from tracks where kind = 'j-track' and system = 'internal' and panel_type = 78);

insert into tracks (kind, system, label, dim, bmt, panel_type, stock_lengths)
select 'head-flash', 'both', 'Head track flashing', 'Head track flashing 0.7 mm BMT x 130 mm GAL', '0.7 mm', null, '[3]'::jsonb
where not exists (select 1 from tracks where kind = 'head-flash' and system = 'both' and panel_type is null);

insert into tracks (kind, system, label, dim, bmt, panel_type, stock_lengths)
select 'c-track', 'external', 'C-track - Head + 2 sides', '55 x 82 x 55 - 1.15 BMT', '1.15 mm', 78, '[3,3.6,6]'::jsonb
where not exists (select 1 from tracks where kind = 'c-track' and system = 'external' and panel_type = 78);

insert into tracks (kind, system, label, dim, bmt, panel_type, stock_lengths)
select 'j-track', 'external', 'J-track - Base', 'J-track 1.15 BMT - weep holes @ 250 mm', '1.15 mm', 78, '[3,3.6,6]'::jsonb
where not exists (select 1 from tracks where kind = 'j-track' and system = 'external' and panel_type = 78);

insert into tracks (kind, system, label, dim, bmt, panel_type, stock_lengths)
select 'z-flash', 'external', 'Z-flashing (coloured)', 'Z-Flashing 78 mm - 0.7 mm BMT (Coloured)', '0.7 mm', 78, '[3]'::jsonb
where not exists (select 1 from tracks where kind = 'z-flash' and system = 'external' and panel_type = 78);

insert into tracks (kind, system, label, dim, bmt, panel_type, stock_lengths)
select 'horiz-cover', 'external', 'Horizontal joint cover flashing', 'Horizontal external joint cover flashing', '0.7 mm', 78, '[3]'::jsonb
where not exists (select 1 from tracks where kind = 'horiz-cover' and system = 'external' and panel_type = 78);

-- --- Fixings: matched downstream by `length_mm` (30 / 16) -------------------
insert into fixings (code, gauge, length_mm, use, per_box)
select '10g 30mm SDS', '10g', 30, 'Panel to track', 1000
where not exists (select 1 from fixings where length_mm = 30);

insert into fixings (code, gauge, length_mm, use, per_box)
select '10g 16mm SDS', '10g', 16, 'Panel to panel', 1000
where not exists (select 1 from fixings where length_mm = 16);

-- --- Sealants: matched downstream by `system` -------------------------------
insert into sealants (system, product, m2_per_sausage, per_box)
select 'internal', 'Hilti CP606 sealant', 4, 20
where not exists (select 1 from sealants where system = 'internal');

insert into sealants (system, product, m2_per_sausage, per_box)
select 'external', 'Sikaflex 400 Fire PU', 2, 20
where not exists (select 1 from sealants where system = 'external');

commit;
