alter table public.needs_purchases add column bucket text not null default 'needs' check(bucket in ('needs','wants'));
create or replace function public.snapshot_family_purchase_rules() returns trigger language plpgsql security invoker set search_path='' as $$
declare saved public.family_rules;
begin
 select * into saved from public.family_rules where family_id=new.family_id for share;
 if found then
  new.rules=jsonb_build_object('version','family-v1-'||saved.revision,'capMinor',saved.settings->>'capMinor',
   'capStroops',round((saved.settings->>'capMinor')::numeric*10000000/968)::bigint::text,
   'allowedCategories',saved.settings->(case when new.bucket='wants' then 'wantsCategories' else 'needsCategories' end),'sellerId','demo-seller','mappingVersion','php-xlm-20261107-v1');
 end if;
 return new;
end $$;

create or replace function public.reserve_needs_purchase(p_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare p needs_purchases; credits bigint; used bigint;
begin
 perform pg_advisory_xact_lock(616102);
 select * into p from needs_purchases where id=p_id for update;
 if not found or p.status<>'assessing' then return false; end if;
 if exists(select 1 from needs_funding where status in ('processing','unknown')) then
  update needs_purchases set status='blocked',reason='FUNDING_PENDING' where id=p_id; return false;
 end if;
 select coalesce(sum(case when p.bucket='wants' then coalesce(wants_stroops,'0')::bigint else amount_stroops::bigint end),0) into credits from needs_funding where family_id=p.family_id and status='confirmed';
 select coalesce(sum(amount_stroops),0) into used from needs_purchases where family_id=p.family_id and bucket=p.bucket and reserved and id<>p.id;
 if credits-used<p.amount_stroops then
  update needs_purchases set status='blocked',reason='INSUFFICIENT_FUNDS' where id=p_id; return false;
 end if;
 update needs_purchases set status='reserved',reserved=true where id=p_id;
 return true;
end $$;
revoke all on function public.reserve_needs_purchase(uuid) from public,anon,authenticated;
grant execute on function public.reserve_needs_purchase(uuid) to service_role;
