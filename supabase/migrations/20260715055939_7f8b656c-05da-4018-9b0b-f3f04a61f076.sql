create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = _role
      and _user_id = auth.uid()
  )
$$;

grant usage on schema private to authenticated;
grant execute on function private.has_role(uuid, public.app_role) to authenticated;
revoke execute on function private.has_role(uuid, public.app_role) from anon, public;