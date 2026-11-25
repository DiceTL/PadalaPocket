-- DEC-142: T38 gives the isolated coordinator the caller, destination resolver
-- and source binding for deposit credit. Both functions are PostgREST RPCs that
-- only the coordinator role may execute; neither is granted to the public API.

-- The trusted coordinator resolves who owns a deposit instead of trusting a
-- caller-supplied family or parent. Credit admission still rechecks the exact
-- family/parent through read_velo_deposit_receipt.
create function public.resolve_velo_deposit_owner(p_deposit uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('depositId',d.id,'familyId',d.family_id,'parentId',d.parent_id)
  from public.velo_topups d
  where d.id=p_deposit
$$;
revoke all on function public.resolve_velo_deposit_owner(uuid)
  from public,anon,authenticated,service_role,money_coordinator;
grant execute on function public.resolve_velo_deposit_owner(uuid) to money_coordinator;

-- The credit destination is the family's custodial parent account, pinned to
-- Testnet. A current parent membership and a completed provision are required,
-- so an unprovisioned or incomplete family has no resolvable destination and is
-- refused rather than credited to a guess.
create function public.resolve_family_parent_destination(p_family uuid, p_parent uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('address',k.public_address,'network',k.network,'version',k.key_version)
  from wallet_custody.family_signing_keys k
  join wallet_custody.family_provisions f
    on f.family_id=k.family_id and f.completed_at is not null
  where k.family_id=p_family and k.signer_role='parent' and k.network='testnet'
    and exists(
      select 1 from public.family_members m
      where m.user_id=p_parent and m.family_id=k.family_id and m.role='parent'
    )
  order by k.key_version desc
  limit 1
$$;
revoke all on function public.resolve_family_parent_destination(uuid,uuid)
  from public,anon,authenticated,service_role,money_coordinator;
grant execute on function public.resolve_family_parent_destination(uuid,uuid) to money_coordinator;
notify pgrst,'reload schema';
