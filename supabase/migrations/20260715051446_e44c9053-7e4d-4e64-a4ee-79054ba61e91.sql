
-- Extend admin-grant triggers to also allow a specific whitelisted email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update set email = excluded.email;

  if new.email_confirmed_at is not null
     and (
       lower(split_part(new.email, '@', 2)) = 'destinylib.com'
       or lower(new.email) = 'icejie0311@163.com'
     ) then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email, updated_at = now() where id = new.id;
  if new.email_confirmed_at is not null
     and (old.email_confirmed_at is null or old.email_confirmed_at is distinct from new.email_confirmed_at)
     and (
       lower(split_part(new.email, '@', 2)) = 'destinylib.com'
       or lower(new.email) = 'icejie0311@163.com'
     ) then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

-- If the user already exists (verified), grant admin now.
insert into public.user_roles (user_id, role)
select u.id, 'admin'::app_role
from auth.users u
where lower(u.email) = 'icejie0311@163.com'
  and u.email_confirmed_at is not null
on conflict (user_id, role) do nothing;
