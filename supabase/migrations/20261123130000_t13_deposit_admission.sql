alter table public.velo_topups
  add column amount_minor integer,
  add column mapping_version text,
  add constraint velo_topup_mapping check (
    (amount_minor is null and mapping_version is null)
    or (amount_minor is not null and amount_minor between 1000 and 500000 and mapping_version is not null)
  );
create index velo_topups_family on public.velo_topups(family_id);

-- Keep the historical checkout path, but serialize it against explicit admissions.
create function public.fence_legacy_velo_topup() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.family_id::text,0));
  if exists(select 1 from public.velo_topups where family_id=new.family_id
      and amount_minor is not null and status not in ('paid','failed','expired','cancelled')) then
    raise exception 'TOPUP_PENDING' using errcode='23505';
  end if;
  return new;
end $$;
revoke all on function public.fence_legacy_velo_topup() from public,anon,authenticated;
create trigger fence_legacy_velo_topup before insert on public.velo_topups
  for each row when (new.amount_minor is null) execute function public.fence_legacy_velo_topup();

create function public.admit_velo_deposit(
  p_family uuid,p_parent uuid,p_key uuid,p_revision bigint,p_amount_minor integer,p_receiver text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  deposit public.velo_topups;
  reserved bigint;
  pending boolean;
begin
  if not exists(select 1 from public.family_members where user_id=p_parent and family_id=p_family and role='parent') then
    raise exception 'FORBIDDEN';
  end if;
  -- Same lock as rule edits and legacy checkout admission. No spend path takes this deposit reservation.
  perform pg_advisory_xact_lock(hashtextextended(p_family::text,0));
  select * into deposit from public.velo_topups where parent_id=p_parent and request_key=p_key;
  if found then
    if deposit.family_id<>p_family or deposit.rules_revision is distinct from p_revision
       or deposit.amount_minor is distinct from p_amount_minor then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object('created',false,'deposit',to_jsonb(deposit));
  end if;
  if p_amount_minor is null or p_amount_minor<1000 then raise exception 'DEPOSIT_MINIMUM'; end if;
  if p_amount_minor>500000 then raise exception 'DEPOSIT_CAP_EXCEEDED'; end if;
  if coalesce((select revision from public.family_rules where family_id=p_family),0) is distinct from p_revision then
    raise exception 'RULES_CHANGED';
  end if;
  select coalesce(sum(amount_minor) filter (where status not in ('failed','expired','cancelled')),0),
         coalesce(bool_or(status not in ('paid','failed','expired','cancelled')
           and (amount_minor is not null or status<>'configuration_required')),false)
    into reserved,pending from public.velo_topups where family_id=p_family;
  if pending then raise exception 'TOPUP_PENDING'; end if;
  if reserved+p_amount_minor>500000 then raise exception 'DEPOSIT_CAP_EXCEEDED'; end if;
  insert into public.velo_topups(family_id,parent_id,request_key,rules_revision,amount_stroops,
    expected_receiver,amount_minor,mapping_version,status)
  values(p_family,p_parent,p_key,p_revision,(p_amount_minor::bigint*10000000+484)/968,
    p_receiver,p_amount_minor,'php-xlm-20261107-v1','pending') returning * into deposit;
  return jsonb_build_object('created',true,'deposit',to_jsonb(deposit));
end $$;
revoke all on function public.admit_velo_deposit(uuid,uuid,uuid,bigint,integer,text) from public,anon,authenticated;
grant execute on function public.admit_velo_deposit(uuid,uuid,uuid,bigint,integer,text) to service_role;
