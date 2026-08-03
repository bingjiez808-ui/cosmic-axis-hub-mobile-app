
-- Move has_role out of exposed public schema to prevent signed-in users from calling it via PostgREST
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

revoke execute on function private.has_role(uuid, public.app_role) from public, anon, authenticated;

-- Recreate policies to reference the private function
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists user_roles_select_admin on public.user_roles;

create policy profiles_select_admin on public.profiles
  for select to authenticated using (private.has_role(auth.uid(), 'admin'));

create policy user_roles_select_admin on public.user_roles
  for select to authenticated using (private.has_role(auth.uid(), 'admin'));

-- Drop the public-schema version now that nothing references it
drop function if exists public.has_role(uuid, public.app_role);
