create table public.money_dispatch_steps (
 operation_id uuid not null references public.money_operations(id),
 step_key text not null check(step_key ~ '^[a-z][a-z0-9_-]{0,63}$'),
 network text not null default 'testnet' check(network='testnet'),
 source_account text not null check(source_account ~ '^G[A-Z2-7]{55}$'),
 preparation_claim uuid not null unique, dispatch_claim uuid unique,
 phase text not null default 'preparing' check(phase in ('preparing','prepared','dispatching','confirmed')),
 confirmed_ledger bigint check(confirmed_ledger>0), confirmed_result_xdr text,
 created_at timestamptz not null default now(),
 primary key(operation_id,step_key),
 check((phase in ('dispatching','confirmed'))=(dispatch_claim is not null)),
 check((phase='confirmed')=(confirmed_ledger is not null and confirmed_result_xdr is not null)),
 check(phase='confirmed' or (confirmed_ledger is null and confirmed_result_xdr is null))
);
create table public.money_dispatch_sources (
 network text not null default 'testnet' check(network='testnet'),
 source_account text not null check(source_account ~ '^G[A-Z2-7]{55}$'),
 operation_id uuid, step_key text,
 primary key(network,source_account),
 foreign key(operation_id,step_key) references public.money_dispatch_steps(operation_id,step_key),
 check((operation_id is null)=(step_key is null))
);
alter table public.money_dispatch_steps enable row level security;
alter table public.money_dispatch_sources enable row level security;
revoke all on public.money_dispatch_steps,public.money_dispatch_sources from public,anon,authenticated,service_role;
grant select on public.money_dispatch_steps,public.money_dispatch_sources to service_role;

-- Owner-only projection; public RPCs must check the requested family first.
create function public.money_dispatch_view(p_operation uuid,p_step_key text)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('operationId',d.operation_id,'stepKey',d.step_key,'sourceAccount',d.source_account,
  'phase',d.phase,'transactionHash',s.transaction_hash,'signedEnvelope',s.signed_envelope,
  'confirmedLedger',d.confirmed_ledger::text,'canPrepare',false,'canSend',false)
 from public.money_dispatch_steps d left join public.money_signed_steps s using(operation_id,step_key)
 where d.operation_id=p_operation and d.step_key=p_step_key
$$;
revoke all on function public.money_dispatch_view(uuid,text) from public,anon,authenticated,service_role;

create function public.claim_money_dispatch(p_operation uuid,p_family uuid,p_step_key text,p_source text,p_claim uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.money_dispatch_steps; owner public.money_dispatch_sources;
begin
 if p_operation is null or p_family is null or p_claim is null or p_source is null
  or p_source !~ '^G[A-Z2-7]{55}$' or p_step_key is null or p_step_key !~ '^[a-z][a-z0-9_-]{0,63}$' then
  raise exception 'INVALID_INPUT';
 end if;
 if not exists(select 1 from public.money_operations where id=p_operation and family_id=p_family) then
  raise exception 'FORBIDDEN';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('money-dispatch:testnet:'||p_source,0));
 select * into existing from public.money_dispatch_steps where operation_id=p_operation and step_key=p_step_key;
 if found then
  if existing.source_account<>p_source then raise exception 'DISPATCH_IDENTITY_CONFLICT'; end if;
  return public.money_dispatch_view(p_operation,p_step_key);
 end if;
 if exists(select 1 from public.money_signed_steps where operation_id=p_operation and step_key=p_step_key) then
  raise exception 'UNCOORDINATED_STEP';
 end if;
 insert into public.money_dispatch_sources(source_account) values(p_source) on conflict do nothing;
 select * into strict owner from public.money_dispatch_sources where network='testnet' and source_account=p_source for update;
 if owner.operation_id is not null then return jsonb_build_object('phase','busy','canPrepare',false,'canSend',false); end if;
 insert into public.money_dispatch_steps(operation_id,step_key,source_account,preparation_claim)
 values(p_operation,p_step_key,p_source,p_claim) on conflict(operation_id,step_key) do nothing;
 select * into strict existing from public.money_dispatch_steps where operation_id=p_operation and step_key=p_step_key;
 if existing.source_account<>p_source then raise exception 'DISPATCH_IDENTITY_CONFLICT'; end if;
 update public.money_dispatch_sources set operation_id=p_operation,step_key=p_step_key
 where network='testnet' and source_account=p_source;
 return public.money_dispatch_view(p_operation,p_step_key)||jsonb_build_object('canPrepare',true);
end $$;
revoke all on function public.claim_money_dispatch(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_money_dispatch(uuid,uuid,text,text,uuid) to service_role;

create function public.save_money_dispatch(p_operation uuid,p_family uuid,p_step_key text,p_source text,p_claim uuid,p_signed text,p_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.money_dispatch_steps;
begin
 if not exists(select 1 from public.money_operations where id=p_operation and family_id=p_family) then raise exception 'FORBIDDEN'; end if;
 perform pg_advisory_xact_lock(hashtextextended('money-dispatch:testnet:'||p_source,0));
 select * into existing from public.money_dispatch_steps where operation_id=p_operation and step_key=p_step_key for update;
 if not found or existing.preparation_claim is distinct from p_claim then raise exception 'STALE_WORKER'; end if;
 if existing.source_account is distinct from p_source then raise exception 'DISPATCH_IDENTITY_CONFLICT'; end if;
 if existing.phase='preparing' and not exists(select 1 from public.money_dispatch_sources
  where network='testnet' and source_account=p_source and operation_id=p_operation and step_key=p_step_key) then
  raise exception 'STALE_WORKER';
 end if;
 perform public.record_money_signed_step(p_operation,p_family,p_step_key,p_source,p_hash,p_signed);
 if existing.phase='preparing' then
  update public.money_dispatch_steps set phase='prepared' where operation_id=p_operation and step_key=p_step_key;
 end if;
 return public.money_dispatch_view(p_operation,p_step_key);
end $$;
revoke all on function public.save_money_dispatch(uuid,uuid,text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.save_money_dispatch(uuid,uuid,text,text,uuid,text,text) to service_role;

create function public.claim_money_dispatch_send(p_operation uuid,p_family uuid,p_step_key text,p_source text,p_claim uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.money_dispatch_steps;
begin
 if p_claim is null then raise exception 'INVALID_INPUT'; end if;
 if not exists(select 1 from public.money_operations where id=p_operation and family_id=p_family) then raise exception 'FORBIDDEN'; end if;
 perform pg_advisory_xact_lock(hashtextextended('money-dispatch:testnet:'||p_source,0));
 select * into existing from public.money_dispatch_steps where operation_id=p_operation and step_key=p_step_key for update;
 if not found then raise exception 'STALE_WORKER'; end if;
 if existing.source_account is distinct from p_source then raise exception 'DISPATCH_IDENTITY_CONFLICT'; end if;
 if existing.phase<>'prepared' then return public.money_dispatch_view(p_operation,p_step_key); end if;
 if not exists(select 1 from public.money_dispatch_sources where network='testnet' and source_account=p_source
  and operation_id=p_operation and step_key=p_step_key) then raise exception 'STALE_WORKER'; end if;
 if not exists(select 1 from public.money_signed_steps where operation_id=p_operation and step_key=p_step_key and source_account=p_source) then
  raise exception 'UNCOORDINATED_STEP';
 end if;
 update public.money_dispatch_steps set phase='dispatching',dispatch_claim=p_claim where operation_id=p_operation and step_key=p_step_key;
 return public.money_dispatch_view(p_operation,p_step_key)||jsonb_build_object('canSend',true);
end $$;
revoke all on function public.claim_money_dispatch_send(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_money_dispatch_send(uuid,uuid,text,text,uuid) to service_role;

create function public.confirm_money_dispatch(p_operation uuid,p_family uuid,p_step_key text,p_hash text,p_ledger text,p_result_xdr text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.money_dispatch_steps; source text; saved_hash text; ledger bigint;
begin
 if p_ledger is null or p_ledger !~ '^[1-9][0-9]{0,18}$' or p_result_xdr is null
  or octet_length(p_result_xdr) not between 4 and 1048576 or p_result_xdr !~ '^[A-Za-z0-9+/]+={0,2}$' then
  raise exception 'INVALID_INPUT';
 end if;
 if p_ledger::numeric>9223372036854775807 then raise exception 'INVALID_INPUT'; end if;
 ledger:=p_ledger::bigint;
 if not exists(select 1 from public.money_operations where id=p_operation and family_id=p_family) then raise exception 'FORBIDDEN'; end if;
 select source_account into source from public.money_dispatch_steps where operation_id=p_operation and step_key=p_step_key;
 if not found then raise exception 'STALE_WORKER'; end if;
 perform pg_advisory_xact_lock(hashtextextended('money-dispatch:testnet:'||source,0));
 select * into strict existing from public.money_dispatch_steps where operation_id=p_operation and step_key=p_step_key for update;
 select transaction_hash into saved_hash from public.money_signed_steps where operation_id=p_operation and step_key=p_step_key;
 if saved_hash is null or saved_hash is distinct from p_hash then raise exception 'DISPATCH_IDENTITY_CONFLICT'; end if;
 if existing.phase='confirmed' then
  if (existing.confirmed_ledger,existing.confirmed_result_xdr) is distinct from (ledger,p_result_xdr) then
   raise exception 'DISPATCH_IDENTITY_CONFLICT';
  end if;
  return public.money_dispatch_view(p_operation,p_step_key);
 end if;
 if existing.phase<>'dispatching' then raise exception 'STALE_WORKER'; end if;
 update public.money_dispatch_sources set operation_id=null,step_key=null
 where network='testnet' and source_account=source and operation_id=p_operation and step_key=p_step_key;
 if not found then raise exception 'STALE_WORKER'; end if;
 update public.money_dispatch_steps set phase='confirmed',confirmed_ledger=ledger,confirmed_result_xdr=p_result_xdr
 where operation_id=p_operation and step_key=p_step_key;
 return public.money_dispatch_view(p_operation,p_step_key);
end $$;
revoke all on function public.confirm_money_dispatch(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.confirm_money_dispatch(uuid,uuid,text,text,text,text) to service_role;
notify pgrst,'reload schema';
