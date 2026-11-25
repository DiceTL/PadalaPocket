-- T15 reads one exact family/parent receipt in the isolated coordinator.
-- The public service role and browser roles cannot call this projection.
create function public.read_velo_deposit_receipt(p_deposit uuid,p_family uuid,p_parent uuid)
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
    'verifiedLedger',d.verified_ledger::text
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
notify pgrst,'reload schema';
