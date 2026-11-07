create table public.velo_topups (
 id uuid primary key default gen_random_uuid(), family_id uuid not null,
 parent_id uuid not null references public.family_members(user_id), request_key uuid not null,
 rules_revision bigint not null, amount_stroops bigint not null check(amount_stroops>0),
 expected_receiver text not null,
 status text not null default 'creating', intent_id text unique, checkout_url text,
 created_at timestamptz not null default now(), unique(parent_id,request_key)
);
alter table public.velo_topups enable row level security;
revoke all on public.velo_topups from public,anon,authenticated;
grant select,insert,update on public.velo_topups to service_role;
create unique index velo_one_open_topup on public.velo_topups(parent_id) where status not in ('paid','failed','expired','cancelled');
