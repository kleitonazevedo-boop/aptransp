-- =============================================================================
-- APTRANSP — Wave 0 (limpeza segurança) + Wave 1 (schema novo)
-- Rodar no SQL Editor do Supabase (xitbkklflslcgzqskmml).
-- Idempotente; pode rodar várias vezes sem quebrar.
-- =============================================================================

-- =============================================================================
-- WAVE 0 — REMOVER POLICIES INSEGURAS (role public/anon em tabelas privadas)
-- =============================================================================

-- user_profile: drop policies que liberam pra qualquer um
drop policy if exists "select own profile" on public.user_profile;
drop policy if exists "insert own profile" on public.user_profile;
drop policy if exists "update own profile" on public.user_profile;
drop policy if exists "delete own profile" on public.user_profile;

-- favorite_lines: drop public manage
drop policy if exists "public manage favorites" on public.favorite_lines;

-- route_history: drop public insert/read
drop policy if exists "public insert history" on public.route_history;
drop policy if exists "public read history" on public.route_history;

-- transport_locations: drop public write (leitura pública pode ficar se quiser)
drop policy if exists "public write locations" on public.transport_locations;

-- user_routes: drop public manage
drop policy if exists "public manage routes" on public.user_routes;

-- Revoga privilégios diretos de anon nessas tabelas
revoke all on public.user_profile      from anon;
revoke all on public.favorite_lines    from anon;
revoke all on public.favorite_routes   from anon;
revoke all on public.route_history     from anon;
revoke all on public.user_routes       from anon;

-- =============================================================================
-- WAVE 1 — SCHEMA NOVO
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) ROLES (admin / user) com função has_role security-definer
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role    public.app_role not null,
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- ---------------------------------------------------------------------------
-- 2) FAVORITE_PLACES — origem/destino salvos com estrelinha
-- ---------------------------------------------------------------------------
create table if not exists public.favorite_places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  label       text not null,            -- "Academia", "Mãe", etc
  endereco    text not null,
  latitude    double precision,
  longitude   double precision,
  kind        text default 'custom',    -- custom | casa | trabalho
  created_at  timestamptz not null default now()
);

grant select, insert, update, delete on public.favorite_places to authenticated;
grant all on public.favorite_places to service_role;
alter table public.favorite_places enable row level security;

drop policy if exists "places_own" on public.favorite_places;
create policy "places_own" on public.favorite_places
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3) SYSTEM_LOGS — logs do app (debug GPS, erros, ações admin)
-- ---------------------------------------------------------------------------
create table if not exists public.system_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  level       text not null default 'info',   -- debug | info | warn | error
  source      text,                            -- "gps" | "sptrans" | "gtfs" | ...
  message     text not null,
  meta        jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists system_logs_created_idx on public.system_logs (created_at desc);
create index if not exists system_logs_level_idx   on public.system_logs (level);

grant select, insert on public.system_logs to authenticated;
grant all on public.system_logs to service_role;
alter table public.system_logs enable row level security;

-- Qualquer authenticated insere o seu próprio log (user_id pode ser null)
drop policy if exists "logs_insert_self" on public.system_logs;
create policy "logs_insert_self" on public.system_logs
  for insert to authenticated
  with check (user_id is null or auth.uid() = user_id);

-- Usuário comum vê só seus logs; admin vê tudo
drop policy if exists "logs_select_own_or_admin" on public.system_logs;
create policy "logs_select_own_or_admin" on public.system_logs
  for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 4) GTFS_IMPORTS — controle de uploads/imports GTFS
-- ---------------------------------------------------------------------------
create table if not exists public.gtfs_imports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  storage_path  text not null,                -- caminho no bucket gtfs-uploads
  filename      text,
  status        text not null default 'pending', -- pending|processing|done|error
  table_name    text,                          -- gtfs_stops, gtfs_stop_times, ...
  rows_imported integer default 0,
  rows_total    integer,
  next_offset   bigint default 0,             -- para resume em chunks
  error_message text,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now()
);

grant select, insert, update on public.gtfs_imports to authenticated;
grant all on public.gtfs_imports to service_role;
alter table public.gtfs_imports enable row level security;

-- só admin gerencia imports
drop policy if exists "gtfs_imports_admin" on public.gtfs_imports;
create policy "gtfs_imports_admin" on public.gtfs_imports
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- =============================================================================
-- STORAGE BUCKETS — avatars (público) + gtfs-uploads (privado, admin)
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('gtfs-uploads', 'gtfs-uploads', false)
on conflict (id) do nothing;

-- avatars: leitura pública; cada usuário escreve dentro de pasta = seu auth.uid()
drop policy if exists "avatars_public_read"  on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_write" on storage.objects;
create policy "avatars_owner_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- gtfs-uploads: só admin
drop policy if exists "gtfs_uploads_admin_all" on storage.objects;
create policy "gtfs_uploads_admin_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'gtfs-uploads' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'gtfs-uploads' and public.has_role(auth.uid(), 'admin'));

-- Adiciona coluna avatar_url no user_profile (se ainda não existir)
alter table public.user_profile
  add column if not exists avatar_url text;

-- =============================================================================
-- FIM. Após rodar, peça pra você mesmo virar admin:
--   insert into public.user_roles (user_id, role)
--   values ('<seu auth.uid()>', 'admin');
-- =============================================================================
