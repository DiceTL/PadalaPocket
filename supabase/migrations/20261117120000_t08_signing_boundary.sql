-- DEC-108: legacy service credentials must not obtain coordinator-signed bytes.
-- No legacy journal, unknown operation, reservation or balance is modified.
create role money_coordinator nologin noinherit;
grant money_coordinator to authenticator;
grant usage on schema public to money_coordinator;
grant select on public.family_members, public.money_operations, public.money_reservations,
 public.money_signed_steps, public.money_dispatch_steps, public.money_dispatch_sources to money_coordinator;
create policy coordinator_read on public.family_members for select to money_coordinator using(true);
create policy coordinator_read on public.money_operations for select to money_coordinator using(true);
create policy coordinator_read on public.money_reservations for select to money_coordinator using(true);
create policy coordinator_read on public.money_signed_steps for select to money_coordinator using(true);
create policy coordinator_read on public.money_dispatch_steps for select to money_coordinator using(true);
create policy coordinator_read on public.money_dispatch_sources for select to money_coordinator using(true);
revoke all on public.money_signed_steps from service_role;

revoke execute on function public.admit_money_operation(uuid,uuid,uuid,text,text,text,text,text,text,jsonb) from service_role;
revoke execute on function public.record_money_signed_step(uuid,uuid,text,text,text,text) from service_role;
revoke execute on function public.claim_money_dispatch(uuid,uuid,text,text,uuid) from service_role;
revoke execute on function public.save_money_dispatch(uuid,uuid,text,text,uuid,text,text) from service_role;
revoke execute on function public.claim_money_dispatch_send(uuid,uuid,text,text,uuid) from service_role;
revoke execute on function public.confirm_money_dispatch(uuid,uuid,text,text,text,text) from service_role;
revoke execute on function public.read_money_recovery(uuid,uuid,text) from service_role;

grant execute on function public.admit_money_operation(uuid,uuid,uuid,text,text,text,text,text,text,jsonb) to money_coordinator;
grant execute on function public.record_money_signed_step(uuid,uuid,text,text,text,text) to money_coordinator;
grant execute on function public.claim_money_dispatch(uuid,uuid,text,text,uuid) to money_coordinator;
grant execute on function public.save_money_dispatch(uuid,uuid,text,text,uuid,text,text) to money_coordinator;
grant execute on function public.claim_money_dispatch_send(uuid,uuid,text,text,uuid) to money_coordinator;
grant execute on function public.confirm_money_dispatch(uuid,uuid,text,text,text,text) to money_coordinator;
grant execute on function public.read_money_recovery(uuid,uuid,text) to money_coordinator;
notify pgrst,'reload schema';
