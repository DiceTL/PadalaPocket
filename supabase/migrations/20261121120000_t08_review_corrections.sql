-- DEC-112: preserve snapshot locking without granting general rule writes to the coordinator.
-- The existing trigger body has only a schema-qualified SELECT FOR SHARE and NEW.rules assignment.
alter function public.snapshot_family_purchase_rules() security definer;
alter function public.snapshot_family_purchase_rules() set search_path='';
revoke all on function public.snapshot_family_purchase_rules() from public,anon,authenticated,service_role,money_coordinator;

-- Legacy GRANT ALL also included TRUNCATE; RLS and UPDATE triggers do not guard it.
revoke truncate on public.needs_funding,public.needs_purchases,public.weekly_events,public.weekly_clocks from service_role;

create or replace function public.read_money_cutover_access() returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('role',current_user,
  'readsSigned',has_any_column_privilege(current_user,'public.money_signed_steps','SELECT'),
  'tables',(select jsonb_object_agg(name,jsonb_build_object(
   'insert',has_any_column_privilege(current_user,'public.'||name,'INSERT'),
   'update',has_any_column_privilege(current_user,'public.'||name,'UPDATE'),
   'delete',has_table_privilege(current_user,'public.'||name,'DELETE'),
   'truncate',has_table_privilege(current_user,'public.'||name,'TRUNCATE')))
   from unnest(array['needs_funding','needs_purchases','weekly_events','weekly_clocks']) as t(name)),
  'rpcs',(select jsonb_object_agg(signature,has_function_privilege(current_user,signature,'EXECUTE'))
   from unnest(array[
    'public.admit_money_operation(uuid,uuid,uuid,text,text,text,text,text,text,jsonb)',
    'public.record_money_signed_step(uuid,uuid,text,text,text,text)',
    'public.claim_money_dispatch(uuid,uuid,text,text,uuid)',
    'public.save_money_dispatch(uuid,uuid,text,text,uuid,text,text)',
    'public.claim_money_dispatch_send(uuid,uuid,text,text,uuid)',
    'public.confirm_money_dispatch(uuid,uuid,text,text,text,text)',
    'public.read_money_recovery(uuid,uuid,text)',
    'public.reserve_needs_purchase(uuid)',
    'public.begin_purchase_review(uuid,text,text)',
    'public.decide_purchase_review(uuid,uuid,uuid,text,text)',
    'public.admit_purchase_exception(uuid,uuid,uuid)',
    'public.save_weekly_schedule(uuid,uuid,bigint,integer,text)',
    'public.start_weekly_event(uuid,uuid,uuid,bigint,timestamptz,bigint)',
    'public.finish_weekly_event(uuid,boolean)']) as f(signature)))
$$;
revoke all on function public.read_money_cutover_access() from public,anon,authenticated;
grant execute on function public.read_money_cutover_access() to service_role,money_coordinator;
notify pgrst,'reload schema';
