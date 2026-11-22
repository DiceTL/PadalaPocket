-- DEC-110: existing rows stay unmanaged, regardless of later timestamp/configuration changes.
alter table public.needs_funding add column coordinator_version integer not null default 0 check(coordinator_version in (0,8));
alter table public.needs_purchases add column coordinator_version integer not null default 0 check(coordinator_version in (0,8));
alter table public.weekly_events add column coordinator_version integer not null default 0 check(coordinator_version in (0,8));
alter table public.needs_funding alter column coordinator_version set default 8;
alter table public.needs_purchases alter column coordinator_version set default 8;
alter table public.weekly_events alter column coordinator_version set default 8;

create function public.guard_writer_provenance() returns trigger language plpgsql set search_path='' as $$
begin
 if new.coordinator_version is distinct from old.coordinator_version then raise exception 'PROVENANCE_IMMUTABLE'; end if;
 return new;
end $$;
revoke all on function public.guard_writer_provenance() from public,anon,authenticated,service_role,money_coordinator;
create trigger immutable_writer_provenance before update on public.needs_funding for each row execute function public.guard_writer_provenance();
create trigger immutable_writer_provenance before update on public.needs_purchases for each row execute function public.guard_writer_provenance();
create trigger immutable_writer_provenance before update on public.weekly_events for each row execute function public.guard_writer_provenance();

revoke insert,update,delete on public.needs_funding,public.needs_purchases,public.weekly_events,public.weekly_clocks from service_role;
grant select,insert,update on public.needs_funding,public.needs_purchases,public.weekly_events,public.weekly_clocks to money_coordinator;
grant select on public.family_rules to money_coordinator;
create policy coordinator_writer on public.needs_funding to money_coordinator using(true) with check(true);
create policy coordinator_writer on public.needs_purchases to money_coordinator using(true) with check(true);
create policy coordinator_writer on public.weekly_events to money_coordinator using(true) with check(true);
create policy coordinator_writer on public.weekly_clocks to money_coordinator using(true) with check(true);
create policy coordinator_rules_read on public.family_rules for select to money_coordinator using(true);
do $$ begin
 execute format('grant usage,select on sequence %s to money_coordinator',pg_get_serial_sequence('public.needs_purchases','nonce'));
end $$;

revoke execute on function public.reserve_needs_purchase(uuid) from service_role;
revoke execute on function public.begin_purchase_review(uuid,text,text) from service_role;
revoke execute on function public.decide_purchase_review(uuid,uuid,uuid,text,text) from service_role;
revoke execute on function public.admit_purchase_exception(uuid,uuid,uuid) from service_role;
revoke execute on function public.save_weekly_schedule(uuid,uuid,bigint,integer,text) from service_role;
revoke execute on function public.start_weekly_event(uuid,uuid,uuid,bigint,timestamptz,bigint) from service_role;
revoke execute on function public.finish_weekly_event(uuid,boolean) from service_role;
grant execute on function public.reserve_needs_purchase(uuid) to money_coordinator;
grant execute on function public.begin_purchase_review(uuid,text,text) to money_coordinator;
grant execute on function public.decide_purchase_review(uuid,uuid,uuid,text,text) to money_coordinator;
grant execute on function public.admit_purchase_exception(uuid,uuid,uuid) to money_coordinator;
grant execute on function public.save_weekly_schedule(uuid,uuid,bigint,integer,text) to money_coordinator;
grant execute on function public.start_weekly_event(uuid,uuid,uuid,bigint,timestamptz,bigint) to money_coordinator;
grant execute on function public.finish_weekly_event(uuid,boolean) to money_coordinator;
-- Public family activity still performs non-signing review expiry; no dispatch/unknown release is granted.
grant execute on function public.expire_purchase_reviews() to money_coordinator;
notify pgrst,'reload schema';

-- Read-only self-inspection lets hosted verification prove revocation without attempting writes.
create function public.read_money_cutover_access() returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('role',current_user,
  'readsSigned',has_any_column_privilege(current_user,'public.money_signed_steps','SELECT'),
  'tables',(select jsonb_object_agg(name,jsonb_build_object(
   'insert',has_any_column_privilege(current_user,'public.'||name,'INSERT'),
   'update',has_any_column_privilege(current_user,'public.'||name,'UPDATE'),
   'delete',has_table_privilege(current_user,'public.'||name,'DELETE')))
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
