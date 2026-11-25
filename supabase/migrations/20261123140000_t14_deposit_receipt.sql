alter table public.velo_topups
  add column payer_address text,
  add column tx_hash text,
  add column verification_status text not null default 'unverified',
  add column verified_at timestamptz,
  add column verified_ledger bigint,
  add constraint velo_topup_verification_status check (
    verification_status in ('unverified','verified','mismatch','unavailable')
  ),
  add constraint velo_topup_tx_hash_format check (
    tx_hash is null or tx_hash ~ '^[a-f0-9]{64}$'
  ),
  add constraint velo_topup_verified_receipt check (
    verification_status <> 'verified'
    or (tx_hash is not null and payer_address is not null and verified_at is not null
        and verified_ledger is not null and verified_ledger > 0)
  ),
  add constraint velo_topup_unverified_receipt check (
    verification_status = 'verified'
    or (tx_hash is null and verified_at is null and verified_ledger is null)
  );

create unique index velo_topup_tx_hash on public.velo_topups(tx_hash) where tx_hash is not null;
