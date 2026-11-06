create table public.needs_funding (
 id uuid primary key default gen_random_uuid(), family_id uuid not null,
 parent_id uuid not null references public.family_members(user_id), request_key uuid not null,
 price_minor text not null check(price_minor = '968'), amount_stroops text not null check(amount_stroops = '10000000'),
 mapping_version text not null, device_hash text not null,
 status text not null default 'processing' check(status in ('processing','unknown','confirmed','failed')),
 steps jsonb not null default '{}', escrow_stroops text, created_at timestamptz not null default now(),
 unique(parent_id,request_key)
);
alter table public.needs_funding enable row level security;
revoke all on public.needs_funding from anon, authenticated;
create unique index funding_one_unresolved on public.needs_funding(family_id) where status in ('processing','unknown');
