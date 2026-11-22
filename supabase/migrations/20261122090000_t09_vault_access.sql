-- DEC-118: private SQL only. Do not expose wallet_custody or vault through PostgREST.
create extension if not exists supabase_vault with schema vault;
create schema wallet_custody;
create role family_custody_worker nologin noinherit;

create table wallet_custody.family_signing_keys (
  family_id uuid not null,
  signer_role text not null check (signer_role in ('parent', 'student', 'agent')),
  network text not null check (network = 'testnet'),
  public_address text not null unique check (public_address ~ '^G[A-Z2-7]{55}$'),
  key_version integer not null check (key_version > 0),
  vault_secret_id uuid not null unique references vault.secrets(id),
  primary key (family_id, signer_role, network, key_version)
);
alter table wallet_custody.family_signing_keys enable row level security;
revoke all on schema wallet_custody from public, anon, authenticated, service_role, money_coordinator;
revoke all on wallet_custody.family_signing_keys from public, anon, authenticated, service_role, money_coordinator, family_custody_worker;

-- Only trusted backend code supplies the actor and admitted signer binding.
create function wallet_custody.resolve_family_signing_seed(
  p_actor uuid, p_family uuid, p_role text, p_network text, p_address text, p_version integer
) returns text language sql stable security definer set search_path = '' as $$
  select s.decrypted_secret
  from wallet_custody.family_signing_keys k
  join vault.decrypted_secrets s on s.id = k.vault_secret_id
  where k.family_id = p_family and k.signer_role = p_role and k.network = p_network
    and k.public_address = p_address and k.key_version = p_version
    and exists(select 1 from public.family_members m where m.user_id = p_actor and m.family_id = k.family_id);
$$;
revoke all on function wallet_custody.resolve_family_signing_seed(uuid,uuid,text,text,text,integer)
  from public, anon, authenticated, service_role, money_coordinator;
grant usage on schema wallet_custody to family_custody_worker;
grant execute on function wallet_custody.resolve_family_signing_seed(uuid,uuid,text,text,text,integer)
  to family_custody_worker;
