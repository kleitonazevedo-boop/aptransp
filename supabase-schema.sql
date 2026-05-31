-- ============================================================
-- APTRANSP — Schema para instância Supabase externa
-- Rode este SQL no SQL Editor do seu painel Supabase
-- (xitbkklflslcgzqskmml). Idempotente — pode rodar mais de uma vez.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Locais (cache do Google Places) ----------
create table if not exists public.transport_locations (
  id uuid primary key default gen_random_uuid(),
  google_place_id text unique not null,
  name text not null,
  type text not null,
  latitude double precision not null,
  longitude double precision not null,
  address text,
  created_at timestamptz not null default now()
);

-- ---------- Linhas de transporte ----------
create table if not exists public.transport_lines (
  id uuid primary key default gen_random_uuid(),
  line_code text not null,
  line_name text not null,
  transport_type text not null check (transport_type in ('bus','subway','train','terminal')),
  origin text not null,
  destination text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_lines_code on public.transport_lines (line_code);

-- ---------- Paradas por linha (FK pelo placeId do Google) ----------
create table if not exists public.line_stops (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.transport_lines(id) on delete cascade,
  stop_id text not null,
  position integer,
  created_at timestamptz not null default now()
);
create index if not exists idx_line_stops_stop on public.line_stops (stop_id);
create index if not exists idx_line_stops_line on public.line_stops (line_id);

-- ---------- Favoritos ----------
create table if not exists public.favorite_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  line_id uuid not null references public.transport_lines(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- Rotas salvas ----------
create table if not exists public.user_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  origin text not null,
  destination text not null,
  created_at timestamptz not null default now()
);

-- ---------- Histórico ----------
create table if not exists public.route_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  origin text not null,
  destination text not null,
  distance integer not null,
  duration integer not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- GRANTS — necessário para a Data API (PostgREST)
-- ============================================================
grant select on public.transport_lines    to anon, authenticated;
grant select on public.line_stops         to anon, authenticated;
grant select on public.transport_locations to anon, authenticated;
grant insert, update, delete on public.transport_locations to anon, authenticated;
grant select, insert, update, delete on public.favorite_lines to anon, authenticated;
grant select, insert, update, delete on public.user_routes     to anon, authenticated;
grant select, insert                  on public.route_history   to anon, authenticated;

-- ============================================================
-- RLS — abrir para anon (app sem login). Restrinja depois se adicionar auth.
-- ============================================================
alter table public.transport_lines    enable row level security;
alter table public.line_stops         enable row level security;
alter table public.transport_locations enable row level security;
alter table public.favorite_lines     enable row level security;
alter table public.user_routes        enable row level security;
alter table public.route_history      enable row level security;

drop policy if exists "public read lines"     on public.transport_lines;
create policy "public read lines"     on public.transport_lines    for select using (true);

drop policy if exists "public read stops"     on public.line_stops;
create policy "public read stops"     on public.line_stops         for select using (true);

drop policy if exists "public read locations" on public.transport_locations;
create policy "public read locations" on public.transport_locations for select using (true);
drop policy if exists "public write locations" on public.transport_locations;
create policy "public write locations" on public.transport_locations for all using (true) with check (true);

drop policy if exists "public manage favorites" on public.favorite_lines;
create policy "public manage favorites" on public.favorite_lines for all using (true) with check (true);

drop policy if exists "public manage routes"    on public.user_routes;
create policy "public manage routes"    on public.user_routes     for all using (true) with check (true);

drop policy if exists "public insert history"   on public.route_history;
create policy "public insert history"   on public.route_history   for insert with check (true);
drop policy if exists "public read history"     on public.route_history;
create policy "public read history"     on public.route_history   for select using (true);

-- ============================================================
-- SEED MÍNIMO — algumas linhas de SP para a UI ter dados imediatamente.
-- Atualize stop_id com placeIds reais do Google quando integrar SPTrans.
-- ============================================================
insert into public.transport_lines (line_code, line_name, transport_type, origin, destination)
values
  ('875A-10', '875A-10 Term. Pirituba / Lapa', 'bus',    'Terminal Pirituba',  'Lapa'),
  ('477A-10', '477A-10 Sacomã / Pompéia',      'bus',    'Sacomã',             'Pompéia'),
  ('AZUL',    'Linha 1 Azul',                   'subway', 'Jabaquara',          'Tucuruvi'),
  ('VERDE',   'Linha 2 Verde',                  'subway', 'Vila Prudente',      'Vila Madalena'),
  ('VERMELHA','Linha 3 Vermelha',               'subway', 'Corinthians-Itaquera','Palmeiras-Barra Funda'),
  ('AMARELA', 'Linha 4 Amarela',                'subway', 'Vila Sônia',         'Luz'),
  ('CPTM-7',  'Linha 7 Rubi',                   'train',  'Luz',                'Jundiaí'),
  ('CPTM-9',  'Linha 9 Esmeralda',              'train',  'Osasco',             'Grajaú')
on conflict do nothing;
