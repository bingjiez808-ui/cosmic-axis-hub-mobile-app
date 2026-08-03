grant usage on schema private to authenticated;
grant execute on function private.has_role(uuid, public.app_role) to authenticated;