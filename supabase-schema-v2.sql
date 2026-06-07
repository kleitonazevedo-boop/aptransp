-- ============================================================================
-- APTRANSP — Schema v2
-- Rode no SQL Editor do Supabase (projeto xitbkklflslcgzqskmml)
-- Idempotente: usa CREATE ... IF NOT EXISTS / DROP POLICY IF EXISTS.
-- ============================================================================

-- ---------- Extensões -------------------------------------------------------
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1) PERFIL DE USUÁRIO
-- ============================================================================
create table if not exists public.user_profile (
  id                  uuid primary key default gen_random_uuid(),
  auth_user_id        uuid not null unique references auth.users(id) on delete cascade,
  nome                text,
  email               text,
  telefone            text,
  data_nascimento     date,
  idade               integer generated always as (
    case when data_nascimento is null then null
         else extract(year from age(data_nascimento))::int end
  ) stored,
  endereco_residencial text,
  endereco_trabalho    text,
  cidade              text,
  estado              text,
  cep                 text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

grant select, insert, update, delete on public.user_profile to authenticated;
grant all on public.user_profile to service_role;
alter table public.user_profile enable row level security;

drop policy if exists "profile_select_own" on public.user_profile;
create policy "profile_select_own" on public.user_profile
  for select to authenticated using (auth.uid() = auth_user_id);

drop policy if exists "profile_insert_own" on public.user_profile;
create policy "profile_insert_own" on public.user_profile
  for insert to authenticated with check (auth.uid() = auth_user_id);

drop policy if exists "profile_update_own" on public.user_profile;
create policy "profile_update_own" on public.user_profile
  for update to authenticated using (auth.uid() = auth_user_id);

drop policy if exists "profile_delete_own" on public.user_profile;
create policy "profile_delete_own" on public.user_profile
  for delete to authenticated using (auth.uid() = auth_user_id);

-- Trigger: cria perfil vazio ao registrar usuário
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profile (auth_user_id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', new.email))
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 2) HISTÓRICO DE ROTAS
-- ============================================================================
create table if not exists public.route_history (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  origem            text not null,
  destino           text not null,
  modo_transporte   text not null,
  distancia         integer,
  tempo_estimado    integer,
  created_at        timestamptz not null default now()
);
create index if not exists route_history_user_idx on public.route_history(user_id, created_at desc);

grant select, insert, update, delete on public.route_history to authenticated;
grant all on public.route_history to service_role;
alter table public.route_history enable row level security;

drop policy if exists "history_own" on public.route_history;
create policy "history_own" on public.route_history
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- 3) FAVORITOS — ROTAS
-- ============================================================================
create table if not exists public.favorite_routes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  origem            text not null,
  destino           text not null,
  modo_transporte   text not null,
  distancia         integer,
  tempo_estimado    integer,
  created_at        timestamptz not null default now()
);
create index if not exists favorite_routes_user_idx on public.favorite_routes(user_id, created_at desc);

grant select, insert, update, delete on public.favorite_routes to authenticated;
grant all on public.favorite_routes to service_role;
alter table public.favorite_routes enable row level security;

drop policy if exists "fav_routes_own" on public.favorite_routes;
create policy "fav_routes_own" on public.favorite_routes
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- 4) FAVORITOS — LINHAS SPTRANS (mantida da versão anterior se já existir)
-- ============================================================================
create table if not exists public.favorite_lines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  line_id     text not null,
  line_code   text,
  line_name   text,
  created_at  timestamptz not null default now(),
  unique (user_id, line_id)
);
grant select, insert, update, delete on public.favorite_lines to authenticated;
grant all on public.favorite_lines to service_role;
alter table public.favorite_lines enable row level security;
drop policy if exists "fav_lines_own" on public.favorite_lines;
create policy "fav_lines_own" on public.favorite_lines
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- 5) GTFS — Schema mínimo (carga via \copy posterior)
-- ============================================================================
create table if not exists public.gtfs_agency (
  agency_id        text primary key,
  agency_name      text,
  agency_url       text,
  agency_timezone  text,
  agency_lang      text,
  agency_phone     text
);

create table if not exists public.gtfs_routes (
  route_id          text primary key,
  agency_id         text,
  route_short_name  text,
  route_long_name   text,
  route_desc        text,
  route_type        integer,
  route_url         text,
  route_color       text,
  route_text_color  text
);
create index if not exists gtfs_routes_short_idx on public.gtfs_routes(route_short_name);

create table if not exists public.gtfs_stops (
  stop_id      text primary key,
  stop_code    text,
  stop_name    text,
  stop_desc    text,
  stop_lat     double precision,
  stop_lon     double precision,
  zone_id      text,
  stop_url     text,
  location_type integer,
  parent_station text
);
create index if not exists gtfs_stops_geo_idx on public.gtfs_stops(stop_lat, stop_lon);

create table if not exists public.gtfs_trips (
  route_id      text,
  service_id    text,
  trip_id       text primary key,
  trip_headsign text,
  direction_id  integer,
  block_id      text,
  shape_id      text
);
create index if not exists gtfs_trips_route_idx on public.gtfs_trips(route_id);
create index if not exists gtfs_trips_shape_idx on public.gtfs_trips(shape_id);

create table if not exists public.gtfs_shapes (
  shape_id           text,
  shape_pt_lat       double precision,
  shape_pt_lon       double precision,
  shape_pt_sequence  integer,
  shape_dist_traveled double precision,
  primary key (shape_id, shape_pt_sequence)
);

create table if not exists public.gtfs_stop_times (
  trip_id        text,
  arrival_time   text,
  departure_time text,
  stop_id        text,
  stop_sequence  integer,
  stop_headsign  text,
  pickup_type    integer,
  drop_off_type  integer,
  shape_dist_traveled double precision,
  primary key (trip_id, stop_sequence)
);
create index if not exists gtfs_stop_times_stop_idx on public.gtfs_stop_times(stop_id);

create table if not exists public.gtfs_frequencies (
  trip_id      text,
  start_time   text,
  end_time     text,
  headway_secs integer,
  exact_times  integer,
  primary key (trip_id, start_time)
);

create table if not exists public.gtfs_calendar (
  service_id text primary key,
  monday     boolean,
  tuesday    boolean,
  wednesday  boolean,
  thursday   boolean,
  friday     boolean,
  saturday   boolean,
  sunday     boolean,
  start_date text,
  end_date   text
);

create table if not exists public.gtfs_fare_attributes (
  fare_id           text primary key,
  price             numeric,
  currency_type     text,
  payment_method    integer,
  transfers         integer,
  transfer_duration integer
);

create table if not exists public.gtfs_fare_rules (
  fare_id        text,
  route_id       text,
  origin_id      text,
  destination_id text,
  contains_id    text
);

-- GTFS é referencial público — leitura aberta
grant select on public.gtfs_agency, public.gtfs_routes, public.gtfs_stops,
               public.gtfs_trips, public.gtfs_shapes, public.gtfs_stop_times,
               public.gtfs_frequencies, public.gtfs_calendar,
               public.gtfs_fare_attributes, public.gtfs_fare_rules
  to anon, authenticated;
grant all on public.gtfs_agency, public.gtfs_routes, public.gtfs_stops,
             public.gtfs_trips, public.gtfs_shapes, public.gtfs_stop_times,
             public.gtfs_frequencies, public.gtfs_calendar,
             public.gtfs_fare_attributes, public.gtfs_fare_rules
  to service_role;

alter table public.gtfs_agency        enable row level security;
alter table public.gtfs_routes        enable row level security;
alter table public.gtfs_stops         enable row level security;
alter table public.gtfs_trips         enable row level security;
alter table public.gtfs_shapes        enable row level security;
alter table public.gtfs_stop_times    enable row level security;
alter table public.gtfs_frequencies   enable row level security;
alter table public.gtfs_calendar      enable row level security;
alter table public.gtfs_fare_attributes enable row level security;
alter table public.gtfs_fare_rules    enable row level security;

do $$
declare t text;
begin
  for t in
    select unnest(array[
      'gtfs_agency','gtfs_routes','gtfs_stops','gtfs_trips','gtfs_shapes',
      'gtfs_stop_times','gtfs_frequencies','gtfs_calendar',
      'gtfs_fare_attributes','gtfs_fare_rules'
    ])
  loop
    execute format('drop policy if exists "%I_read" on public.%I', t, t);
    execute format('create policy "%I_read" on public.%I for select using (true)', t, t);
  end loop;
end$$;

-- ============================================================================
-- 6) Helper: buscar paradas GTFS próximas (raio em metros)
-- ============================================================================
create or replace function public.gtfs_stops_near(_lat double precision, _lng double precision, _radius_m integer default 800)
returns table(stop_id text, stop_name text, stop_lat double precision, stop_lon double precision, distance_m double precision)
language sql stable security definer set search_path = public as $$
  select s.stop_id, s.stop_name, s.stop_lat, s.stop_lon,
         (6371000 * acos(
            cos(radians(_lat)) * cos(radians(s.stop_lat)) *
            cos(radians(s.stop_lon) - radians(_lng)) +
            sin(radians(_lat)) * sin(radians(s.stop_lat))
         )) as distance_m
  from public.gtfs_stops s
  where s.stop_lat between _lat - 0.01 and _lat + 0.01
    and s.stop_lon between _lng - 0.01 and _lng + 0.01
  order by distance_m
  limit 50;
$$;

grant execute on function public.gtfs_stops_near(double precision, double precision, integer)
  to anon, authenticated;
