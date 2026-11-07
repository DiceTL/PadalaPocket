create table public.weekly_clocks (
 family_id uuid primary key, simulated_at timestamptz not null default now(), revision bigint not null default 0,
 weekday integer check(weekday between 0 and 6), local_time text check(local_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 check((weekday is null)=(local_time is null))
);
create table public.weekly_events (
 id uuid primary key, family_id uuid not null, parent_id uuid not null references public.family_members(user_id),
 target_at timestamptz not null, rules_revision bigint not null,
 needs_stroops bigint not null check(needs_stroops>=0), wants_stroops bigint not null check(wants_stroops>=0),
 stage integer not null default 0 check(stage between 0 and 6), stage_started boolean not null default false,
 steps jsonb not null default '{}', status text not null default 'processing' check(status in ('processing','unknown','confirmed','allocation_skipped')),
 notice text, created_at timestamptz not null default now(), unique(family_id,target_at)
);
create unique index one_active_weekly_event on public.weekly_events ((true)) where status in ('processing','unknown');
alter table public.weekly_clocks enable row level security;
alter table public.weekly_events enable row level security;
revoke all on public.weekly_clocks,public.weekly_events from anon,authenticated;

create function public.start_weekly_event(p_id uuid,p_family uuid,p_parent uuid,p_revision bigint,p_target timestamptz,p_rules bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.weekly_clocks; e public.weekly_events; n bigint; w bigint;
begin
 perform pg_advisory_xact_lock(616102);
 if not exists(select 1 from public.family_members where user_id=p_parent and family_id=p_family and role='parent') then raise exception 'FORBIDDEN'; end if;
 select * into e from public.weekly_events where id=p_id and family_id=p_family;
 if found then return to_jsonb(e); end if;
 if coalesce((select revision from public.family_rules where family_id=p_family),0)<>p_rules then raise exception 'RULES_CHANGED'; end if;
 perform public.expire_purchase_reviews();
 if exists(select 1 from public.needs_purchases where status not in ('blocked','claimed','failed','rejected','expired')) or exists(select 1 from public.needs_funding where status in ('processing','unknown')) or exists(select 1 from public.weekly_events where status in ('processing','unknown')) then raise exception 'MONEY_OPERATION_PENDING'; end if;
 select * into c from public.weekly_clocks where family_id=p_family for update;
 if not found or c.revision<>p_revision or c.weekday is null or p_target<=c.simulated_at then raise exception 'CLOCK_CHANGED'; end if;
 select coalesce(sum(amount_stroops::bigint),0),coalesce(sum(wants_stroops::bigint),0) into n,w from public.needs_funding where family_id=p_family and status='confirmed';
 select n-coalesce(sum(amount_stroops) filter(where bucket='needs'),0),w-coalesce(sum(amount_stroops) filter(where bucket='wants'),0) into n,w from public.needs_purchases where family_id=p_family and reserved;
 select n-coalesce(sum(needs_stroops),0),w-coalesce(sum(wants_stroops),0) into n,w from public.weekly_events where family_id=p_family;
 insert into public.weekly_events(id,family_id,parent_id,target_at,rules_revision,needs_stroops,wants_stroops) values(p_id,p_family,p_parent,p_target,p_rules,n,w) returning * into e;
 return to_jsonb(e);
end $$;
revoke all on function public.start_weekly_event(uuid,uuid,uuid,bigint,timestamptz,bigint) from public,anon,authenticated;
grant execute on function public.start_weekly_event(uuid,uuid,uuid,bigint,timestamptz,bigint) to service_role;

-- Share the existing signer lock with all admission paths, including assessment insertion.
create or replace function public.guard_purchase_insert() returns trigger language plpgsql set search_path='' as $$
begin
 perform public.expire_purchase_reviews();
 if exists(select 1 from public.weekly_events where status in ('processing','unknown')) then raise exception 'WEEKLY_PENDING'; end if;
 return new;
end $$;
create or replace function public.guard_needs_funding() returns trigger language plpgsql set search_path='' as $$
begin
 perform public.expire_purchase_reviews();
 if exists(select 1 from public.needs_purchases where status not in ('blocked','claimed','failed','rejected','expired')) or exists(select 1 from public.weekly_events where status in ('processing','unknown') and (id<>new.request_key or stage<>6)) then raise exception 'MONEY_OPERATION_PENDING'; end if;
 return new;
end $$;
create or replace function public.reserve_needs_purchase(p_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare p needs_purchases; credits bigint; used bigint; swept bigint;
begin
 perform pg_advisory_xact_lock(616102);
 select * into p from needs_purchases where id=p_id for update;
 if not found or p.status<>'assessing' then return false; end if;
 if exists(select 1 from needs_funding where status in ('processing','unknown')) or exists(select 1 from weekly_events where status in ('processing','unknown')) then
  update needs_purchases set status='blocked',reason='FUNDING_PENDING' where id=p_id; return false;
 end if;
 select coalesce(sum(case when p.bucket='wants' then wants_stroops::bigint else amount_stroops::bigint end),0) into credits from needs_funding where family_id=p.family_id and status='confirmed';
 select coalesce(sum(amount_stroops),0) into used from needs_purchases where family_id=p.family_id and bucket=p.bucket and reserved and id<>p.id;
 select coalesce(sum(case when p.bucket='wants' then wants_stroops else needs_stroops end),0) into swept from weekly_events where family_id=p.family_id;
 if credits-used-swept<p.amount_stroops then update needs_purchases set status='blocked',reason='INSUFFICIENT_FUNDS' where id=p_id; return false; end if;
 update needs_purchases set status='reserved',reserved=true where id=p_id; return true;
end $$;
create function public.finish_weekly_event(p_id uuid,p_skipped boolean) returns void language plpgsql security definer set search_path='' as $$
declare e public.weekly_events;
begin
 perform pg_advisory_xact_lock(616102);
 select * into e from public.weekly_events where id=p_id for update;
 if not found or e.stage<>6 or e.stage_started or e.status not in ('processing','unknown') then raise exception 'EVENT_NOT_READY'; end if;
 if not p_skipped and not exists(select 1 from public.needs_funding where request_key=p_id and parent_id=e.parent_id and status='confirmed') then raise exception 'ALLOCATION_NOT_CONFIRMED'; end if;
 update public.weekly_events set status=case when p_skipped then 'allocation_skipped' else 'confirmed' end,notice=case when p_skipped then 'Next allowance skipped: parent funding wallet cannot cover the full allocation and fee budget.' else null end where id=p_id;
 update public.weekly_clocks set simulated_at=e.target_at,revision=revision+1 where family_id=e.family_id;
end $$;
revoke all on function public.finish_weekly_event(uuid,boolean) from public,anon,authenticated;
grant execute on function public.finish_weekly_event(uuid,boolean) to service_role;

grant all on public.weekly_clocks,public.weekly_events to service_role;
create or replace function public.save_family_rules(p_family uuid,p_parent uuid,p_expected bigint,p_settings jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_revision bigint; saved public.family_rules;
begin
 if not exists(select 1 from public.family_members where user_id=p_parent and family_id=p_family and role='parent') then raise exception 'FORBIDDEN'; end if;
 perform pg_advisory_xact_lock(616102);
 if exists(select 1 from public.weekly_events where status in ('processing','unknown')) then raise exception 'WEEKLY_PENDING'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family::text,0));
 select revision into current_revision from public.family_rules where family_id=p_family for update;
 if coalesce(current_revision,0)<>p_expected then return null; end if;
 insert into public.family_rules(family_id,revision,settings,updated_by) values(p_family,p_expected+1,p_settings,p_parent)
 on conflict(family_id) do update set revision=excluded.revision,settings=excluded.settings,updated_by=excluded.updated_by,updated_at=now() returning * into saved;
 return jsonb_build_object('revision',saved.revision,'settings',saved.settings,'updated_at',saved.updated_at);
end $$;
create function public.save_weekly_schedule(p_family uuid,p_parent uuid,p_expected bigint,p_weekday integer,p_time text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(616102);
 if not exists(select 1 from public.family_members where user_id=p_parent and family_id=p_family and role='parent') then raise exception 'FORBIDDEN'; end if;
 if exists(select 1 from public.weekly_events where status in ('processing','unknown')) then raise exception 'WEEKLY_PENDING'; end if;
 update public.weekly_clocks set weekday=p_weekday,local_time=p_time,revision=revision+1 where family_id=p_family and revision=p_expected;
 return found;
end $$;
revoke all on function public.save_weekly_schedule(uuid,uuid,bigint,integer,text) from public,anon,authenticated;
grant execute on function public.save_weekly_schedule(uuid,uuid,bigint,integer,text) to service_role;
