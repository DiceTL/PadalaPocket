-- R-001: server-provisioned memberships; users cannot assign roles.
create table public.family_members (
  user_id uuid primary key references auth.users(id),
  family_id uuid not null,
  role text not null check (role in ('parent', 'student')),
  unique (family_id, role)
);
alter table public.family_members enable row level security;
revoke all on public.family_members from anon, authenticated;
grant select on public.family_members to authenticated;
create policy membership_self on public.family_members for select to authenticated
  using ((select auth.uid()) = user_id);

create table public.identity_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.family_members(user_id),
  request_key uuid not null,
  value text not null check (char_length(value) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (user_id, request_key)
);
alter table public.identity_records enable row level security;
revoke all on public.identity_records from anon, authenticated;
grant select, insert on public.identity_records to authenticated;
create policy record_self_read on public.identity_records for select to authenticated
  using ((select auth.uid()) = user_id);
create policy record_self_insert on public.identity_records for insert to authenticated
  with check ((select auth.uid()) = user_id);
