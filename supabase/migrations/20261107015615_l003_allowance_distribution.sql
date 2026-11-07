alter table public.needs_funding drop constraint needs_funding_price_minor_check;
alter table public.needs_funding drop constraint needs_funding_amount_stroops_check;
alter table public.needs_funding add column wants_stroops text not null default '0', add column total_stroops text, add column wants_device_hash text, add column rules_revision bigint;
update public.needs_funding set total_stroops=amount_stroops;
alter table public.needs_funding alter column total_stroops set not null;
alter table public.needs_funding add constraint funding_amounts_valid check (price_minor ~ '^[1-9][0-9]{0,8}$' and amount_stroops ~ '^(0|[1-9][0-9]*)$' and wants_stroops ~ '^(0|[1-9][0-9]*)$' and total_stroops::numeric>0 and total_stroops::numeric=amount_stroops::numeric+wants_stroops::numeric);
-- All families share the owner signer; serialize legacy deposits and allocations.
create unique index funding_global_unresolved on public.needs_funding ((true)) where status in ('processing','unknown');
