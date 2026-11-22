-- Observation only: no claims, dispatch, reservation release or credit is created by this RPC.
create function public.read_money_recovery(p_operation uuid,p_family uuid,p_step_key text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare dispatch public.money_dispatch_steps; reservation text;
begin
 if p_operation is null or p_family is null or p_step_key is null or p_step_key !~ '^[a-z][a-z0-9_-]{0,63}$' then
  raise exception 'INVALID_INPUT';
 end if;
 if not exists(select 1 from public.money_operations where id=p_operation and family_id=p_family) then
  raise exception 'FORBIDDEN';
 end if;
 select state into reservation from public.money_reservations where operation_id=p_operation;
 select * into dispatch from public.money_dispatch_steps where operation_id=p_operation and step_key=p_step_key;
 if not found then
  return jsonb_build_object('operationId',p_operation,'stepKey',p_step_key,'reservationState',reservation,
   'phase',case when exists(select 1 from public.money_signed_steps where operation_id=p_operation and step_key=p_step_key)
    then 'unmanaged' else 'unstarted' end);
 end if;
 return public.money_dispatch_view(p_operation,p_step_key)||jsonb_build_object(
  'network',dispatch.network,'reservationState',reservation,'confirmedResultXdr',dispatch.confirmed_result_xdr,
  'ownsSource',exists(select 1 from public.money_dispatch_sources where network=dispatch.network
   and source_account=dispatch.source_account and operation_id=p_operation and step_key=p_step_key));
end $$;
revoke all on function public.read_money_recovery(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.read_money_recovery(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
