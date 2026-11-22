-- DEC-119: private provisioning. Account and Vault bindings commit before any ledger send.
create role family_provision_worker nologin noinherit;
create table wallet_custody.family_provisions (
  family_id uuid primary key,
  operation_id uuid not null unique references public.money_operations(id),
  completed_at timestamptz
);
alter table wallet_custody.family_provisions enable row level security;
revoke all on wallet_custody.family_provisions from public, anon, authenticated, service_role, money_coordinator, family_custody_worker;
grant usage on schema wallet_custody to family_provision_worker;

create function wallet_custody.begin_family_provision(p_actor uuid, p_family uuid, p_request uuid,
  p_source text, p_terms jsonb, p_keys jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  existing public.money_operations;
  admission jsonb;
  accounts jsonb;
  item jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('family-provision:'||p_family::text, 0));
  if not exists(select 1 from public.family_members where family_id=p_family and user_id=p_actor and role='parent' and not wallet_ready)
    or not exists(select 1 from public.family_members where family_id=p_family and role='student' and not wallet_ready) then
    raise exception 'PROVISION_FORBIDDEN';
  end if;
  select o.* into existing from wallet_custody.family_provisions f join public.money_operations o on o.id=f.operation_id
    where f.family_id=p_family;
  if found then
    if (existing.actor_id,existing.request_key,existing.source_ref,existing.request_payload->'terms')
      is distinct from (p_actor,p_request,p_source,p_terms) then raise exception 'PROVISION_CONFLICT'; end if;
    return jsonb_build_object('operationId',existing.id,'accounts',existing.request_payload->'accounts');
  end if;
  if p_keys is null then return null; end if;
  if jsonb_typeof(p_keys) is distinct from 'array' or jsonb_array_length(p_keys)<>3
    or (select array_agg(k->>'role' order by k->>'role') from jsonb_array_elements(p_keys) k)
      is distinct from array['agent','parent','student']::text[]
    or exists(select 1 from jsonb_array_elements(p_keys) k where (k->>'seed') is null or (k->>'seed') !~ '^S[A-Z2-7]{55}$'
      or (k->>'address') is null or (k->>'address')=p_source) then raise exception 'INVALID_INPUT'; end if;
  for item in select * from jsonb_array_elements(p_keys) loop
    insert into wallet_custody.family_signing_keys(family_id,signer_role,network,public_address,key_version,vault_secret_id)
    values(p_family,item->>'role','testnet',item->>'address',1,vault.create_secret(item->>'seed'));
  end loop;
  select jsonb_object_agg(k->>'role',k->>'address') into accounts from jsonb_array_elements(p_keys) k;
  admission := public.admit_money_operation(p_family,p_actor,p_request,'device_setup','testnet','native',p_source,
    'family:'||p_family::text,'0',jsonb_build_object('kind','family_provision','terms',p_terms,'accounts',accounts));
  insert into wallet_custody.family_provisions(family_id,operation_id) values(p_family,(admission->>'id')::uuid);
  return jsonb_build_object('operationId',admission->>'id','accounts',accounts);
end $$;

create function wallet_custody.finish_family_provision(p_actor uuid, p_family uuid, p_operation uuid) returns boolean
language sql security definer set search_path='' as $$
  update wallet_custody.family_provisions f set completed_at=coalesce(f.completed_at,statement_timestamp())
  where f.family_id=p_family and f.operation_id=p_operation
    and exists(select 1 from public.money_operations o where o.id=p_operation and o.actor_id=p_actor)
    and 7=(select count(*) from public.money_dispatch_steps d where d.operation_id=p_operation and d.phase='confirmed'
      and d.step_key in ('accounts','needs_device','wants_device','savings_device','my_money_device','needs_policy','wants_policy'))
  returning true;
$$;
revoke all on function wallet_custody.begin_family_provision(uuid,uuid,uuid,text,jsonb,jsonb),
  wallet_custody.finish_family_provision(uuid,uuid,uuid) from public, anon, authenticated, service_role, money_coordinator, family_custody_worker;
grant execute on function wallet_custody.begin_family_provision(uuid,uuid,uuid,text,jsonb,jsonb),
  wallet_custody.finish_family_provision(uuid,uuid,uuid) to family_provision_worker;
