alter table public.family_members add column wallet_ready boolean not null default false;
update public.family_members set wallet_ready=true;
create table public.student_setup_codes (
 family_id uuid primary key, email text not null, token_hash text not null unique,
 expires_at timestamptz not null, consumed_by uuid references auth.users(id)
);
alter table public.student_setup_codes enable row level security;
revoke all on public.student_setup_codes from public,anon,authenticated;
grant all on public.student_setup_codes to service_role;
create function public.enroll_account(p_user uuid,p_code_hash text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u auth.users; m public.family_members; invitation public.student_setup_codes;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,89));
 select * into u from auth.users where id=p_user;
 if not found or u.email_confirmed_at is null then raise exception 'EMAIL_VERIFICATION_REQUIRED'; end if;
 select * into m from public.family_members where user_id=p_user;
 if found then return to_jsonb(m); end if;
 if p_code_hash is null then
  insert into public.family_members(user_id,family_id,role) values(p_user,gen_random_uuid(),'parent') returning * into m;
 else
  select * into invitation from public.student_setup_codes where token_hash=p_code_hash for update;
  if not found or invitation.consumed_by is not null or invitation.expires_at<=clock_timestamp() or lower(u.email)<>invitation.email then raise exception 'INVALID_OR_EXPIRED_CODE'; end if;
  insert into public.family_members(user_id,family_id,role) values(p_user,invitation.family_id,'student') returning * into m;
  update public.student_setup_codes set consumed_by=p_user where family_id=m.family_id;
 end if;
 return to_jsonb(m);
end $$;
revoke all on function public.enroll_account(uuid,text) from public,anon,authenticated;
grant execute on function public.enroll_account(uuid,text) to service_role;
create function public.create_student_setup_code(p_parent uuid,p_email text,p_hash text) returns void language plpgsql security definer set search_path='' as $$
declare f uuid;
begin
 select family_id into f from public.family_members where user_id=p_parent and role='parent';
 if not found then raise exception 'FORBIDDEN'; end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,90));
 if exists(select 1 from public.family_members where family_id=f and role='student') then raise exception 'STUDENT_ALREADY_LINKED'; end if;
 insert into public.student_setup_codes(family_id,email,token_hash,expires_at) values(f,lower(p_email),p_hash,clock_timestamp()+interval '24 hours')
 on conflict(family_id) do update set email=excluded.email,token_hash=excluded.token_hash,expires_at=excluded.expires_at,consumed_by=null;
end $$;
revoke all on function public.create_student_setup_code(uuid,text,text) from public,anon,authenticated;
grant execute on function public.create_student_setup_code(uuid,text,text) to service_role;
