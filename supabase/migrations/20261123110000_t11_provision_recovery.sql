-- DEC-121: only provisioning can release unsigned preparation or retire provably unsent policies.
alter table public.money_dispatch_steps drop constraint money_dispatch_steps_phase_check;
alter table public.money_dispatch_steps add constraint money_dispatch_steps_phase_check
  check (phase in ('preparing','prepared','dispatching','confirmed','abandoned'));

create or replace function public.recover_provision_preparation(p_operation uuid,p_family uuid,p_step_key text,p_source text,p_claim uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare held public.money_dispatch_sources;
begin
  if not exists(select 1 from public.money_operations where id=p_operation and family_id=p_family
    and purpose='device_setup' and request_payload->>'kind' in ('family_provision','family_policy_renewal')) then
    raise exception 'FORBIDDEN';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('money-dispatch:testnet:'||p_source,0));
  if p_claim is null then
    select * into held from public.money_dispatch_sources where source_account=p_source and network='testnet';
    if not found or not exists(select 1 from public.money_operations where id=held.operation_id and purpose='device_setup'
      and request_payload->>'kind' in ('family_provision','family_policy_renewal')) then return false; end if;
    p_operation := held.operation_id;
    p_step_key := held.step_key;
  end if;
  if not exists(select 1 from public.money_dispatch_steps d where d.operation_id=p_operation and d.step_key=p_step_key
    and d.source_account=p_source and d.phase='preparing' and d.dispatch_claim is null
    and (d.preparation_claim=p_claim or (p_claim is null and d.created_at<=clock_timestamp()-interval '2 minutes'))
    and not exists(select 1 from public.money_signed_steps s where s.operation_id=d.operation_id and s.step_key=d.step_key)) then return false; end if;
  update public.money_dispatch_sources set operation_id=null,step_key=null where source_account=p_source
    and operation_id=p_operation and step_key=p_step_key;
  delete from public.money_dispatch_steps where operation_id=p_operation and step_key=p_step_key;
  return true;
end $$;

create function public.retire_unsent_provision_policy(p_operation uuid,p_family uuid,p_step_key text,p_source text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_step_key not in ('needs_policy','wants_policy','needs_revoke','wants_revoke') or not exists(select 1 from public.money_operations where id=p_operation
    and family_id=p_family and purpose='device_setup' and request_payload->>'kind' in ('family_provision','family_policy_renewal')
    and request_payload->'accounts'->>'parent'=p_source) then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended('money-dispatch:testnet:'||p_source,0));
  update public.money_dispatch_steps set phase='abandoned',preparation_claim=gen_random_uuid()
    where operation_id=p_operation and step_key=p_step_key and source_account=p_source
    and phase in ('preparing','prepared') and dispatch_claim is null;
  if found then
    update public.money_dispatch_sources set operation_id=null,step_key=null where source_account=p_source
      and operation_id=p_operation and step_key=p_step_key;
  end if;
  return not exists(select 1 from public.money_dispatch_steps where operation_id=p_operation and step_key=p_step_key
    and phase not in ('confirmed','abandoned'));
end $$;

revoke all on function public.recover_provision_preparation(uuid,uuid,text,text,uuid),
  public.retire_unsent_provision_policy(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.recover_provision_preparation(uuid,uuid,text,text,uuid),
  public.retire_unsent_provision_policy(uuid,uuid,text,text) to money_coordinator;

alter table wallet_custody.family_provisions add column policy_operation_id uuid unique references public.money_operations(id);
create function wallet_custody.family_provision_policy(p_actor uuid,p_family uuid,p_operation uuid,
  p_previous uuid,p_request uuid,p_terms jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_policy public.money_operations; original public.money_operations; admission jsonb;
begin
  if p_request is not null then
    perform 1 from wallet_custody.family_provisions where family_id=p_family for update;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('family-provision:'||p_family::text,0));
  select o.* into strict original from wallet_custody.family_provisions f join public.money_operations o on o.id=f.operation_id
    where f.family_id=p_family and o.id=p_operation and o.actor_id=p_actor;
  select o.* into strict current_policy from wallet_custody.family_provisions f join public.money_operations o
    on o.id=coalesce(f.policy_operation_id,f.operation_id) where f.family_id=p_family;
  if p_request is not null then
    if current_policy.request_key=p_request and current_policy.id<>original.id then
      if current_policy.request_payload->'terms' is distinct from p_terms then raise exception 'PROVISION_CONFLICT'; end if;
    else
      if p_previous is distinct from current_policy.id or exists(select 1 from public.money_operations
        where family_id=p_family and request_key=p_request) then raise exception 'PROVISION_CONFLICT'; end if;
      if jsonb_typeof(p_terms) is distinct from 'object' or p_terms->>'policyExpiresAt' is null
        or (p_terms->>'policyExpiresAt')::timestamptz <= (current_policy.request_payload->'terms'->>'policyExpiresAt')::timestamptz
        or p_terms->>'maxFeeStroops' is null then raise exception 'INVALID_INPUT'; end if;
      if exists(select 1 from public.money_dispatch_steps where operation_id=current_policy.id
        and step_key in ('needs_policy','wants_policy','needs_revoke','wants_revoke')
        and phase not in ('confirmed','abandoned')) then raise exception 'PROVISION_CONFLICT'; end if;
      admission := public.admit_money_operation(p_family,p_actor,p_request,'device_setup','testnet','native',
        original.request_payload->'accounts'->>'parent','family:'||p_family::text,'0',
        jsonb_build_object('kind','family_policy_renewal','original',original.id,'accounts',original.request_payload->'accounts','terms',p_terms));
      select * into strict current_policy from public.money_operations where id=(admission->>'id')::uuid;
      update wallet_custody.family_provisions set policy_operation_id=current_policy.id,completed_at=null where family_id=p_family;
    end if;
  end if;
  return jsonb_build_object('operationId',current_policy.id,'requestKey',current_policy.request_key,'terms',current_policy.request_payload->'terms');
end $$;

create or replace function wallet_custody.finish_family_provision(p_actor uuid,p_family uuid,p_operation uuid) returns boolean
language sql security definer set search_path='' as $$
  update wallet_custody.family_provisions f set completed_at=coalesce(f.completed_at,statement_timestamp())
  where f.family_id=p_family and coalesce(f.policy_operation_id,f.operation_id)=p_operation
    and exists(select 1 from public.money_operations o where o.id=f.operation_id and o.actor_id=p_actor)
    and 5=(select count(*) from public.money_dispatch_steps d where d.operation_id=f.operation_id and d.phase='confirmed'
      and d.step_key in ('accounts','needs_device','wants_device','savings_device','my_money_device'))
    and 2=(select count(*) from public.money_dispatch_steps d where d.operation_id=p_operation and d.phase='confirmed'
      and d.step_key in ('needs_policy','wants_policy'))
  returning true;
$$;
revoke all on function wallet_custody.family_provision_policy(uuid,uuid,uuid,uuid,uuid,jsonb)
  from public,anon,authenticated,service_role,money_coordinator,family_custody_worker;
grant execute on function wallet_custody.family_provision_policy(uuid,uuid,uuid,uuid,uuid,jsonb) to family_provision_worker;
notify pgrst,'reload schema';

create function wallet_custody.guard_current_provision_policy() returns trigger
language plpgsql security definer set search_path='' as $$
declare current_id uuid;
begin
  select coalesce(f.policy_operation_id,f.operation_id) into current_id from wallet_custody.family_provisions f
    where f.operation_id=new.operation_id or f.policy_operation_id=new.operation_id
    or f.operation_id=(select (o.request_payload->>'original')::uuid from public.money_operations o
      where o.id=new.operation_id and o.request_payload->>'kind'='family_policy_renewal')
    for share;
  if found and current_id<>new.operation_id then raise exception 'STALE_WORKER'; end if;
  return new;
end $$;
create trigger guard_current_provision_policy before insert or update of phase on public.money_dispatch_steps
  for each row when (new.step_key in ('needs_policy','wants_policy','needs_revoke','wants_revoke')
    and new.phase in ('preparing','dispatching'))
  execute function wallet_custody.guard_current_provision_policy();
revoke all on function wallet_custody.guard_current_provision_policy() from public,anon,authenticated,service_role,
  money_coordinator,family_custody_worker,family_provision_worker;
