-- T17 projects spendable parent principal from confirmed journal credits and
-- allocation reservations. It never reads a wallet secret or exposes signed bytes.
create function public.read_parent_balance(p_family uuid,p_parent uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  with authorized as (
    select 1 from public.family_members
    where user_id=p_parent and family_id=p_family and role='parent'
  ),
  credits as (
    select o.id operation_id,o.request_key deposit_id,o.amount_stroops,o.created_at,
      case when d.phase is null then 'reserved' else d.phase end phase,
      d.confirmed_ledger,s.transaction_hash
    from public.money_operations o
    left join public.money_dispatch_steps d
      on d.operation_id=o.id and d.step_key='credit'
    left join public.money_signed_steps s
      on s.operation_id=o.id and s.step_key='credit'
    where o.family_id=p_family and o.actor_id=p_parent and o.purpose='deposit_credit'
      and exists(select 1 from authorized)
  ),
  sums as (
    select coalesce(sum(amount_stroops) filter (where phase='confirmed'),0)::bigint confirmed_deposit,
      coalesce(sum(amount_stroops) filter (where phase<>'confirmed'),0)::bigint pending_deposit
    from credits
  ),
  allocations as (
    select coalesce(sum(total_stroops::bigint) filter (where status='confirmed'),0)::bigint confirmed_allocation,
      coalesce(sum(total_stroops::bigint) filter (where status in ('processing','unknown')),0)::bigint pending_allocation
    from public.needs_funding
    where family_id=p_family and parent_id=p_parent
  )
  select jsonb_build_object(
    'confirmedDepositStroops',(select confirmed_deposit from sums)::text,
    'pendingDepositStroops',(select pending_deposit from sums)::text,
    'confirmedAllocationStroops',(select confirmed_allocation from allocations)::text,
    'pendingAllocationStroops',(select pending_allocation from allocations)::text,
    'confirmedHoldingsStroops',
      greatest((select confirmed_deposit from sums)-(select confirmed_allocation from allocations),0::bigint)::text,
    'availableStroops',
      greatest((select confirmed_deposit from sums)-(select confirmed_allocation from allocations)
        -(select pending_allocation from allocations),0::bigint)::text,
    'basis','confirmed_journal',
    'deposits',coalesce((
      select jsonb_agg(jsonb_build_object(
        'depositId',c.deposit_id,
        'operationId',c.operation_id,
        'amountStroops',c.amount_stroops::text,
        'creditStatus',case when c.phase='confirmed' then 'confirmed' else 'pending' end,
        'transactionHash',case when c.phase='confirmed' then c.transaction_hash else null end,
        'confirmedLedger',case when c.phase='confirmed' then c.confirmed_ledger::text else null end
      ) order by c.created_at,c.operation_id) from credits c
    ),'[]'::jsonb)
  )
  where exists(select 1 from authorized)
$$;
revoke all on function public.read_parent_balance(uuid,uuid)
  from public,anon,authenticated,service_role,money_coordinator;
grant execute on function public.read_parent_balance(uuid,uuid) to service_role;
notify pgrst,'reload schema';
