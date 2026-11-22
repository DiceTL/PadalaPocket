-- DEC-120: reserve capacity without granting the legacy writers to an independent family.
begin;
lock table public.family_members, wallet_custody.family_provisions in share row exclusive mode;

create table wallet_custody.family_capacity_slots (
  slot integer primary key check (slot between 1 and 10),
  family_id uuid not null unique,
  legacy boolean not null default false
);
alter table wallet_custody.family_capacity_slots enable row level security;
revoke all on wallet_custody.family_capacity_slots from public, anon, authenticated, service_role, money_coordinator, family_custody_worker, family_provision_worker;

-- Never silently evict a family on upgrade; an over-capacity baseline aborts the migration.
with candidates as (
  select family_id, true as legacy from public.family_members where wallet_ready
  union all
  select family_id, false from wallet_custody.family_provisions
), families as (
  select family_id, bool_or(legacy) as legacy from candidates group by family_id
)
insert into wallet_custody.family_capacity_slots(slot,family_id,legacy)
select row_number() over (order by legacy desc,family_id),family_id,legacy from families;

create function wallet_custody.claim_family_slot(p_actor uuid, p_family uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare selected integer;
begin
  perform 1 from public.family_members where user_id=p_actor and family_id=p_family and role='parent' for share;
  if not found then raise exception 'PROVISION_FORBIDDEN'; end if;
  perform 1 from public.family_members where family_id=p_family and role='student' for share;
  if not found then raise exception 'PROVISION_FORBIDDEN'; end if;

  perform pg_advisory_xact_lock(hashtextextended('family-capacity:testnet',0));
  select slot into selected from wallet_custody.family_capacity_slots where family_id=p_family;
  if found then return selected; end if;
  select min(candidate) into selected from generate_series(1,10) candidate
    where not exists(select 1 from wallet_custody.family_capacity_slots s where s.slot=candidate);
  if selected is null then raise exception 'FAMILY_CAPACITY_FULL'; end if;
  insert into wallet_custody.family_capacity_slots(slot,family_id) values(selected,p_family);
  return selected;
end $$;
revoke all on function wallet_custody.claim_family_slot(uuid,uuid) from public, anon, authenticated, service_role, money_coordinator, family_custody_worker;
grant execute on function wallet_custody.claim_family_slot(uuid,uuid) to family_provision_worker;

create function wallet_custody.enforce_family_provision_slot() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
  select actor_id into strict actor from public.money_operations where id=new.operation_id and family_id=new.family_id;
  perform wallet_custody.claim_family_slot(actor,new.family_id);
  return new;
end $$;
create trigger require_family_provision_slot before insert on wallet_custody.family_provisions
  for each row execute function wallet_custody.enforce_family_provision_slot();

create function wallet_custody.enforce_legacy_wallet_readiness() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from wallet_custody.family_capacity_slots s where s.family_id=new.family_id and s.legacy) then
    raise exception 'WALLET_ACTIVATION_UNAVAILABLE';
  end if;
  return new;
end $$;
create trigger require_legacy_wallet_readiness before insert or update of wallet_ready,family_id on public.family_members
  for each row when (new.wallet_ready) execute function wallet_custody.enforce_legacy_wallet_readiness();

revoke all on function wallet_custody.enforce_family_provision_slot(),wallet_custody.enforce_legacy_wallet_readiness()
  from public, anon, authenticated, service_role, money_coordinator, family_custody_worker, family_provision_worker;

commit;
