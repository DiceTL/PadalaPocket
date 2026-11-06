create table public.needs_purchases (
 id uuid primary key default gen_random_uuid(), family_id uuid not null,
 student_id uuid not null references public.family_members(user_id), request_key uuid not null,
 fingerprint text not null, seller_id text not null check(seller_id='demo-seller'),
 price_minor text not null, amount_stroops bigint not null check(amount_stroops>0),
 photo_base64 text not null, photo_mime text not null, photo_hash text not null,
 rules jsonb not null, ai jsonb, ai_usage jsonb,
 status text not null default 'assessing' check(status in ('assessing','blocked','reserved','policy_pending','authorization_pending','merchant_pending','claim_pending','claimed','failed','unknown')),
 reason text, reserved boolean not null default false, claim_started boolean not null default false,
 nonce bigint generated always as identity, steps jsonb not null default '{}',
 evidence jsonb not null default '{}', created_at timestamptz not null default now(),
 unique(student_id,request_key)
);
alter table public.needs_purchases enable row level security;
revoke all on public.needs_purchases from anon,authenticated;
-- This demo has one family and shared source/merchant signers.
create unique index one_active_purchase on public.needs_purchases ((true)) where status not in ('blocked','claimed','failed');
create function public.guard_needs_funding() returns trigger language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(616102);
 if exists(select 1 from needs_purchases where status not in ('blocked','claimed','failed')) then
  raise exception 'PURCHASE_PENDING';
 end if;
 return new;
end $$;
create trigger guard_needs_funding before insert on public.needs_funding for each row execute function public.guard_needs_funding();
create function public.reserve_needs_purchase(p_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare p needs_purchases; credits bigint; used bigint;
begin
 perform pg_advisory_xact_lock(616102);
 select * into p from needs_purchases where id=p_id for update;
 if not found or p.status<>'assessing' then return false; end if;
 if exists(select 1 from needs_funding where status in ('processing','unknown')) then
  update needs_purchases set status='blocked',reason='FUNDING_PENDING' where id=p_id; return false;
 end if;
 select coalesce(sum(amount_stroops::bigint),0) into credits from needs_funding where family_id=p.family_id and status='confirmed';
 select coalesce(sum(amount_stroops),0) into used from needs_purchases where family_id=p.family_id and reserved and id<>p.id;
 if credits-used<p.amount_stroops then
  update needs_purchases set status='blocked',reason='INSUFFICIENT_FUNDS' where id=p_id; return false;
 end if;
 update needs_purchases set status='reserved',reserved=true where id=p_id;
 return true;
end $$;
revoke all on function public.reserve_needs_purchase(uuid) from public,anon,authenticated;
grant execute on function public.reserve_needs_purchase(uuid) to service_role;
