-- DEC-109: setup records reserve exactly zero principal; payments remain positive.
alter table public.money_operations drop constraint money_operations_amount_stroops_check;
alter table public.money_operations add constraint money_operations_amount_stroops_check
 check(amount_stroops>0 or (purpose='device_setup' and amount_stroops=0));

create or replace function public.admit_money_operation(
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
   or p_amount_stroops is null or p_amount_stroops !~ '^(0|[1-9][0-9]{0,18})$'
   or ((p_purpose='device_setup') is distinct from (p_amount_stroops='0'))
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
-- CREATE OR REPLACE preserves T08's coordinator-only execution grants.
notify pgrst,'reload schema';
