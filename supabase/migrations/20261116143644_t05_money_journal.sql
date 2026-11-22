-- T05 foundation only; no existing writer, balance, signing authority or unknown is changed.
create table public.money_operations (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null, actor_id uuid not null, request_key uuid not null,
 purpose text not null check(purpose ~ '^[a-z][a-z0-9_-]{0,63}$'),
 network text not null check(network='testnet'), asset text not null check(asset='native'),
 source_ref text not null check(source_ref ~ '^[A-Za-z0-9:._-]{1,200}$'),
 destination_ref text not null check(destination_ref ~ '^[A-Za-z0-9:._-]{1,200}$'),
 amount_stroops bigint not null check(amount_stroops>0),
 request_payload jsonb not null check(jsonb_typeof(request_payload)='object'),
 request_fingerprint text not null check(request_fingerprint ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 unique(family_id,request_key)
);
create table public.money_reservations (
 operation_id uuid primary key references public.money_operations(id),
 state text not null default 'held' check(state='held'),
 created_at timestamptz not null default now()
);
-- Amount, asset, family and source are inherited from the immutable operation, not duplicated.
create table public.money_signed_steps (
 operation_id uuid not null references public.money_operations(id),
 step_key text not null check(step_key ~ '^[a-z][a-z0-9_-]{0,63}$'),
 network text not null check(network='testnet'),
 source_account text not null check(source_account ~ '^G[A-Z2-7]{55}$'),
 transaction_hash text not null check(transaction_hash ~ '^[a-f0-9]{64}$'),
 signed_envelope text not null check(octet_length(signed_envelope) between 4 and 1048576),
 created_at timestamptz not null default now(),
 primary key(operation_id,step_key), unique(network,transaction_hash)
);

alter table public.money_operations enable row level security;
alter table public.money_reservations enable row level security;
alter table public.money_signed_steps enable row level security;
revoke all on public.money_operations,public.money_reservations,public.money_signed_steps from public,anon,authenticated,service_role;
grant select on public.money_operations,public.money_reservations,public.money_signed_steps to service_role;

create function public.guard_money_journal_immutable() returns trigger
language plpgsql set search_path='' as $$
begin
 raise exception 'JOURNAL_IMMUTABLE';
end $$;
revoke all on function public.guard_money_journal_immutable() from public,anon,authenticated,service_role;
create trigger immutable_money_operation before update or delete on public.money_operations
 for each row execute function public.guard_money_journal_immutable();
create trigger immutable_money_reservation before update or delete on public.money_reservations
 for each row execute function public.guard_money_journal_immutable();
create trigger immutable_money_signed_step before update or delete on public.money_signed_steps
 for each row execute function public.guard_money_journal_immutable();

create function public.admit_money_operation(
 p_family uuid,p_actor uuid,p_request_key uuid,p_purpose text,p_network text,p_asset text,
 p_source_ref text,p_destination_ref text,p_amount_stroops text,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare operation public.money_operations; amount bigint; fingerprint text;
begin
 if p_family is null or p_actor is null or p_request_key is null
   or p_network is distinct from 'testnet' or p_asset is distinct from 'native'
   or p_purpose is null or p_purpose !~ '^[a-z][a-z0-9_-]{0,63}$'
   or p_source_ref is null or p_source_ref !~ '^[A-Za-z0-9:._-]{1,200}$'
   or p_destination_ref is null or p_destination_ref !~ '^[A-Za-z0-9:._-]{1,200}$'
   or p_amount_stroops is null or p_amount_stroops !~ '^[1-9][0-9]{0,18}$'
   or jsonb_typeof(p_payload) is distinct from 'object' then
  raise exception 'INVALID_INPUT';
 end if;
 if p_amount_stroops::numeric>9223372036854775807 then raise exception 'INVALID_INPUT'; end if;
 amount:=p_amount_stroops::bigint;
 if not exists(select 1 from public.family_members where user_id=p_actor and family_id=p_family) then
  raise exception 'FORBIDDEN';
 end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_object(
  'family',p_family,'actor',p_actor,'requestKey',p_request_key,'purpose',p_purpose,
  'network',p_network,'asset',p_asset,'source',p_source_ref,'destination',p_destination_ref,
  'amountStroops',p_amount_stroops,'payload',p_payload
 )::text,'UTF8')),'hex');
 insert into public.money_operations(family_id,actor_id,request_key,purpose,network,asset,
  source_ref,destination_ref,amount_stroops,request_payload,request_fingerprint)
 values(p_family,p_actor,p_request_key,p_purpose,p_network,p_asset,p_source_ref,p_destination_ref,amount,p_payload,fingerprint)
 on conflict(family_id,request_key) do nothing;
 -- A conflicting insert waits for its transaction; this statement then reads the committed winner.
 select * into strict operation from public.money_operations
  where family_id=p_family and request_key=p_request_key for update;
 if (operation.actor_id,operation.purpose,operation.network,operation.asset,operation.source_ref,
     operation.destination_ref,operation.amount_stroops,operation.request_payload)
  is distinct from (p_actor,p_purpose,p_network,p_asset,p_source_ref,p_destination_ref,amount,p_payload) then
  raise exception 'IDEMPOTENCY_CONFLICT';
 end if;
 insert into public.money_reservations(operation_id) values(operation.id) on conflict(operation_id) do nothing;
 return jsonb_build_object('id',operation.id,'familyId',operation.family_id,'requestKey',operation.request_key,
  'amountStroops',operation.amount_stroops::text,'requestFingerprint',operation.request_fingerprint,
  'reservation',jsonb_build_object('operationId',operation.id,'state','held'));
end $$;
revoke all on function public.admit_money_operation(uuid,uuid,uuid,text,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.admit_money_operation(uuid,uuid,uuid,text,text,text,text,text,text,jsonb) to service_role;

create function public.record_money_signed_step(
 p_operation uuid,p_family uuid,p_step_key text,p_source_account text,p_transaction_hash text,p_signed_envelope text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.money_signed_steps;
begin
 if p_operation is null or p_family is null
   or p_step_key is null or p_step_key !~ '^[a-z][a-z0-9_-]{0,63}$'
   or p_source_account is null or p_source_account !~ '^G[A-Z2-7]{55}$'
   or p_transaction_hash is null or p_transaction_hash !~ '^[a-f0-9]{64}$'
   or p_signed_envelope is null or octet_length(p_signed_envelope) not between 4 and 1048576
   or length(p_signed_envelope)%4<>0 or p_signed_envelope !~ '^[A-Za-z0-9+/]+={0,2}$' then
  raise exception 'INVALID_INPUT';
 end if;
 -- Serialize saved-stage admission only; per-source signing and dispatch belong to T06.
 perform 1 from public.money_operations where id=p_operation and family_id=p_family for update;
 if not found then raise exception 'FORBIDDEN'; end if;
 select * into saved from public.money_signed_steps where operation_id=p_operation and step_key=p_step_key;
 if found then
  if (saved.source_account,saved.transaction_hash,saved.signed_envelope)
   is distinct from (p_source_account,p_transaction_hash,p_signed_envelope) then
   raise exception 'IDEMPOTENCY_CONFLICT';
  end if;
 else
  begin
   insert into public.money_signed_steps(operation_id,step_key,network,source_account,transaction_hash,signed_envelope)
   values(p_operation,p_step_key,'testnet',p_source_account,p_transaction_hash,p_signed_envelope) returning * into saved;
  exception when unique_violation then raise exception 'TRANSACTION_REUSED';
  end;
 end if;
 return jsonb_build_object('operationId',saved.operation_id,'stepKey',saved.step_key,'network',saved.network,
  'sourceAccount',saved.source_account,'transactionHash',saved.transaction_hash,'signedEnvelope',saved.signed_envelope);
end $$;
revoke all on function public.record_money_signed_step(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_money_signed_step(uuid,uuid,text,text,text,text) to service_role;

notify pgrst,'reload schema';
