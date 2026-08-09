
-- Membership tier enum
do $$ begin
  create type public.membership_tier as enum ('none', 'sage', 'oracle');
exception when duplicate_object then null; end $$;

-- Add membership fields + phone to profiles
alter table public.profiles
  add column if not exists membership_tier public.membership_tier not null default 'none',
  add column if not exists membership_expires_at timestamptz,
  add column if not exists phone text unique;

-- Admin update policy for profiles (to change membership)
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (private.has_role(auth.uid(), 'admin'::app_role))
  with check (private.has_role(auth.uid(), 'admin'::app_role));

-- user_activity table
create table if not exists public.user_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null default (now() at time zone 'utc')::date,
  path text,
  created_at timestamptz not null default now(),
  unique (user_id, activity_date, path)
);

grant select, insert on public.user_activity to authenticated;
grant all on public.user_activity to service_role;
alter table public.user_activity enable row level security;

drop policy if exists user_activity_insert_own on public.user_activity;
create policy user_activity_insert_own on public.user_activity
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists user_activity_select_own on public.user_activity;
create policy user_activity_select_own on public.user_activity
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists user_activity_select_admin on public.user_activity;
create policy user_activity_select_admin on public.user_activity
  for select to authenticated using (private.has_role(auth.uid(), 'admin'::app_role));

-- phone_otps table (server-managed only)
create table if not exists public.phone_otps (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists phone_otps_phone_idx on public.phone_otps (phone, created_at desc);

grant all on public.phone_otps to service_role;
alter table public.phone_otps enable row level security;
-- No anon/authenticated grants: only service_role (server functions) touches this table.
