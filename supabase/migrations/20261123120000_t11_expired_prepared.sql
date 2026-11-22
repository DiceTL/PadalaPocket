-- DEC-122: preserve expired unsent bytes while rotating the active preparation claim.
create table wallet_custody.retired_provision_envelopes (
  like public.money_signed_steps including defaults,
  retired_at timestamptz not null default clock_timestamp(),
  primary key (network, transaction_hash)
);
alter table wallet_custody.retired_provision_envelopes enable row level security;
revoke all on wallet_custody.retired_provision_envelopes from public,anon,authenticated,service_role,
  money_coordinator,family_custody_worker,family_provision_worker;

create function wallet_custody.guard_active_signed_step() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' and exists(select 1 from wallet_custody.retired_provision_envelopes a
    where (a.network,a.transaction_hash,a.operation_id,a.step_key,a.source_account,a.signed_envelope,a.created_at)
    =(old.network,old.transaction_hash,old.operation_id,old.step_key,old.source_account,old.signed_envelope,old.created_at)) then
    return old;
  end if;
  raise exception 'JOURNAL_IMMUTABLE';
end $$;
revoke all on function wallet_custody.guard_active_signed_step() from public,anon,authenticated,service_role,money_coordinator;
create or replace trigger immutable_money_signed_step before update or delete on public.money_signed_steps
  for each row execute function wallet_custody.guard_active_signed_step();
create trigger immutable_retired_provision_envelope before update or delete on wallet_custody.retired_provision_envelopes
  for each row execute function public.guard_money_journal_immutable();

create function public.replace_expired_provision_envelope(p_operation uuid,p_family uuid,p_step_key text,p_source text,
  p_claim uuid,p_hash text,p_max_time bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.money_operations where id=p_operation and family_id=p_family and purpose='device_setup'
    and request_payload->>'kind' in ('family_provision','family_policy_renewal')) then raise exception 'FORBIDDEN'; end if;
  if p_claim is null or p_max_time is null or p_max_time<=0 or p_max_time>extract(epoch from clock_timestamp())
    then raise exception 'INVALID_INPUT'; end if;
  -- The coordinator validates the immutable envelope's signature, hash and time bounds before calling.
  perform pg_advisory_xact_lock(hashtextextended('money-dispatch:testnet:'||p_source,0));
  insert into wallet_custody.retired_provision_envelopes(operation_id,step_key,network,source_account,transaction_hash,signed_envelope,created_at)
  select s.operation_id,s.step_key,s.network,s.source_account,s.transaction_hash,s.signed_envelope,s.created_at
    from public.money_signed_steps s join public.money_dispatch_steps d using(operation_id,step_key)
    join public.money_dispatch_sources f on f.network=d.network and f.source_account=d.source_account
      and f.operation_id=d.operation_id and f.step_key=d.step_key
    where s.operation_id=p_operation and s.step_key=p_step_key and s.source_account=p_source and s.transaction_hash=p_hash
      and d.phase='prepared' and d.dispatch_claim is null and d.source_account=p_source;
  if not found then raise exception 'STALE_WORKER'; end if;
  delete from public.money_signed_steps where operation_id=p_operation and step_key=p_step_key;
  update public.money_dispatch_steps set phase='preparing',preparation_claim=p_claim,created_at=clock_timestamp()
    where operation_id=p_operation and step_key=p_step_key;
  return public.money_dispatch_view(p_operation,p_step_key)||jsonb_build_object('canPrepare',true);
end $$;

alter function public.claim_money_dispatch_send(uuid,uuid,text,text,uuid) rename to claim_money_dispatch_send_internal;
revoke all on function public.claim_money_dispatch_send_internal(uuid,uuid,text,text,uuid)
  from public,anon,authenticated,service_role,money_coordinator;
create function public.claim_money_dispatch_send(p_operation uuid,p_family uuid,p_step_key text,p_source text,p_claim uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.money_operations where id=p_operation and purpose='device_setup'
    and request_payload->>'kind' in ('family_provision','family_policy_renewal')) then raise exception 'FORBIDDEN'; end if;
  return public.claim_money_dispatch_send_internal(p_operation,p_family,p_step_key,p_source,p_claim);
end $$;
create function public.claim_provision_dispatch_send(p_operation uuid,p_family uuid,p_step_key text,p_source text,
  p_claim uuid,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.money_operations where id=p_operation and family_id=p_family and purpose='device_setup'
    and request_payload->>'kind' in ('family_provision','family_policy_renewal')) then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended('money-dispatch:testnet:'||p_source,0));
  if not exists(select 1 from public.money_signed_steps where operation_id=p_operation and step_key=p_step_key
    and source_account=p_source and transaction_hash=p_hash) then raise exception 'STALE_WORKER'; end if;
  return public.claim_money_dispatch_send_internal(p_operation,p_family,p_step_key,p_source,p_claim);
end $$;
revoke all on function public.claim_money_dispatch_send(uuid,uuid,text,text,uuid),
  public.claim_provision_dispatch_send(uuid,uuid,text,text,uuid,text),
  public.replace_expired_provision_envelope(uuid,uuid,text,text,uuid,text,bigint) from public,anon,authenticated,service_role;
grant execute on function public.claim_money_dispatch_send(uuid,uuid,text,text,uuid),
  public.claim_provision_dispatch_send(uuid,uuid,text,text,uuid,text),
  public.replace_expired_provision_envelope(uuid,uuid,text,text,uuid,text,bigint) to money_coordinator;
notify pgrst,'reload schema';
