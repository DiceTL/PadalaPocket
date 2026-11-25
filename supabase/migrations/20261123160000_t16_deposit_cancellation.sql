-- T16: cancellation is an app-level fence. Velo has no merchant cancel API.
alter table public.velo_topups
  add column cancelled_at timestamptz,
  add column cancellation_state text not null default 'none',
  add column cancellation_checked_at timestamptz,
  add constraint velo_topup_cancellation_state check (
    cancellation_state in ('none','fenced','late_paid','resolved')
  ),
  add constraint velo_topup_cancellation_shape check (
    (cancellation_state='none')=(cancelled_at is null)
  );

-- The coordinator sees cancellation state when reading one exact receipt.
create or replace function public.read_velo_deposit_receipt(p_deposit uuid,p_family uuid,p_parent uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'id',d.id,
    'status',d.status,
    'verificationStatus',d.verification_status,
    'amountMinor',d.amount_minor,
    'amountStroops',d.amount_stroops::text,
    'txHash',d.tx_hash,
    'payerAddress',d.payer_address,
    'verifiedAt',d.verified_at,
    'verifiedLedger',d.verified_ledger::text,
    'cancelledAt',d.cancelled_at,
    'cancellationState',d.cancellation_state
  )
  from public.velo_topups d
  where d.id=p_deposit and d.family_id=p_family and d.parent_id=p_parent
    and exists(
      select 1 from public.family_members m
      where m.user_id=p_parent and m.family_id=p_family and m.role='parent'
    )
$$;
revoke all on function public.read_velo_deposit_receipt(uuid,uuid,uuid)
  from public,anon,authenticated,service_role,money_coordinator;
grant execute on function public.read_velo_deposit_receipt(uuid,uuid,uuid) to money_coordinator;

-- A cancellation with a checkout fence keeps the underlying status non-terminal
-- so T13 cannot admit a replacement until reconciliation proves the checkout dead.
create function public.cancel_velo_deposit(p_family uuid,p_parent uuid,p_deposit uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.velo_topups; checked timestamptz := statement_timestamp();
begin
  if p_family is null or p_parent is null or p_deposit is null then
    raise exception 'INVALID_INPUT';
  end if;
  if not exists(select 1 from public.family_members
      where user_id=p_parent and family_id=p_family and role='parent') then
    raise exception 'FORBIDDEN';
  end if;
  select * into d from public.velo_topups
    where id=p_deposit and family_id=p_family and parent_id=p_parent for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if d.cancelled_at is not null then
    return jsonb_build_object('changed',false,'status',d.status,
      'cancellationState',d.cancellation_state,'cancelledAt',d.cancelled_at);
  end if;
  if exists(select 1 from public.money_operations
      where family_id=p_family and request_key=p_deposit and purpose='deposit_credit') then
    raise exception 'CREDIT_STARTED';
  end if;
  if d.verification_status='verified' then raise exception 'CONFIRMED'; end if;
  if d.status='paid' then raise exception 'PAYMENT_STARTED'; end if;
  if d.status='unknown' then raise exception 'STATUS_UNKNOWN'; end if;
  if d.status in ('failed','expired') then raise exception 'NOT_CANCELLABLE'; end if;
  if d.status='cancelled' then
    return jsonb_build_object('changed',false,'status',d.status,
      'cancellationState',d.cancellation_state,'cancelledAt',d.cancelled_at);
  end if;
  if d.intent_id is null then
    update public.velo_topups
      set status='cancelled',checkout_url=null,cancelled_at=checked,
        cancellation_state='resolved',cancellation_checked_at=checked
      where id=d.id;
    return jsonb_build_object('changed',true,'status','cancelled',
      'cancellationState','resolved','cancelledAt',checked);
  end if;
  update public.velo_topups
    set checkout_url=null,cancelled_at=checked,cancellation_state='fenced',
      cancellation_checked_at=checked
    where id=d.id;
  return jsonb_build_object('changed',true,'status',d.status,
    'cancellationState','fenced','cancelledAt',checked);
end $$;
revoke all on function public.cancel_velo_deposit(uuid,uuid,uuid)
  from public,anon,authenticated,service_role,money_coordinator;
grant execute on function public.cancel_velo_deposit(uuid,uuid,uuid) to service_role;

-- T15 reservation and T16 cancellation serialize on the same deposit row.
create function public.admit_velo_deposit_credit(
  p_deposit uuid,p_family uuid,p_parent uuid,p_source text,p_destination text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.velo_topups; admission jsonb;
begin
  if p_deposit is null or p_family is null or p_parent is null
    or p_source is null or p_source !~ '^G[A-Z2-7]{55}$'
    or p_destination is null or p_destination !~ '^G[A-Z2-7]{55}$'
    or p_source=p_destination then
    raise exception 'INVALID_INPUT';
  end if;
  if not exists(select 1 from public.family_members
      where user_id=p_parent and family_id=p_family and role='parent') then
    raise exception 'FORBIDDEN';
  end if;
  select * into d from public.velo_topups
    where id=p_deposit and family_id=p_family and parent_id=p_parent for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if d.cancelled_at is not null or d.cancellation_state<>'none' then
    raise exception 'DEPOSIT_CANCELLED';
  end if;
  if d.status<>'paid' or d.verification_status<>'verified'
    or d.tx_hash is null or d.payer_address is null
    or d.payer_address !~ '^G[A-Z2-7]{55}$'
    or d.verified_at is null or d.verified_ledger is null or d.verified_ledger<=0
    or d.amount_minor is null or d.amount_stroops is null then
    raise exception 'DEPOSIT_NOT_VERIFIED';
  end if;
  admission := public.admit_money_operation(p_family,p_parent,p_deposit,
    'deposit_credit','testnet','native','project:'||p_source,
    'family:'||p_family::text||':parent',d.amount_stroops::text,
    jsonb_build_object('depositId',d.id,'receiptTxHash',d.tx_hash,
      'sourceAccount',p_source,'destinationAccount',p_destination));
  return admission;
end $$;
revoke all on function public.admit_velo_deposit_credit(uuid,uuid,uuid,text,text)
  from public,anon,authenticated,service_role,money_coordinator;
grant execute on function public.admit_velo_deposit_credit(uuid,uuid,uuid,text,text) to money_coordinator;
notify pgrst,'reload schema';
