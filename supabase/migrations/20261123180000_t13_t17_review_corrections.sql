-- Corrections from the grouped 2026-11-23 T13–T17 review (DEC-138–DEC-141).

-- F1: a payment belongs to the checkout that produced it. Persist the Velo
-- intent window so another deposit's payment can be recognised as not ours.
alter table public.velo_topups
  add column intent_created_at timestamptz,
  add column intent_expires_at timestamptz,
  add constraint velo_topup_intent_window check (
    (intent_created_at is null) = (intent_expires_at is null)
    and (intent_created_at is null or intent_expires_at > intent_created_at)
  );
create index velo_topups_unbound_explicit_window
  on public.velo_topups(intent_created_at,intent_expires_at)
  where amount_minor is not null and tx_hash is null;

-- F5: the GET read path retries Horizon receipt checks only after this interval.
alter table public.velo_topups add column verification_checked_at timestamptz;

-- F4/DEC-140: a verified late payment wins over the cancellation attempt. The
-- row leaves `late_paid` as `superseded`, keeps its verified receipt and becomes
-- eligible for the existing T15 credit. An unverified late payment stays fenced.
alter table public.velo_topups drop constraint velo_topup_cancellation_state;
alter table public.velo_topups add constraint velo_topup_cancellation_state check (
  cancellation_state in ('none','fenced','late_paid','resolved','superseded')
);
alter table public.velo_topups drop constraint velo_topup_cancellation_shape;
alter table public.velo_topups add constraint velo_topup_cancellation_shape check (
  (cancellation_state in ('none','superseded')) = (cancelled_at is null)
);

-- Only a superseded cancellation may still reach the credit path. Fenced,
-- late_paid (unverified) and resolved deposits remain non-creditable.
create or replace function public.admit_velo_deposit_credit(
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
  if d.cancelled_at is not null or d.cancellation_state in ('fenced','late_paid','resolved') then
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
