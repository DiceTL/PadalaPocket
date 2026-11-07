create table public.family_rules (
 family_id uuid primary key,
 revision bigint not null check (revision > 0),
 settings jsonb not null check (
  jsonb_typeof(settings)='object'
  and (settings->>'capMinor') ~ '^[1-9][0-9]{0,8}$'
  and (settings->>'weeklyAmountMinor') ~ '^[1-9][0-9]{0,8}$'
  and (settings->>'needsPercent')::integer between 0 and 100
  and jsonb_typeof(settings->'needsCategories')='array'
  and jsonb_typeof(settings->'wantsCategories')='array'
 ),
 updated_by uuid not null references public.family_members(user_id),
 updated_at timestamptz not null default now()
);
alter table public.family_rules enable row level security;
revoke all on public.family_rules from public,anon,authenticated;
grant select,insert,update on public.family_rules to service_role;

create function public.save_family_rules(p_family uuid,p_parent uuid,p_expected bigint,p_settings jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_revision bigint; saved public.family_rules;
begin
 if not exists(select 1 from public.family_members where user_id=p_parent and family_id=p_family and role='parent') then
  raise exception 'FORBIDDEN';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_family::text,0));
 select revision into current_revision from public.family_rules where family_id=p_family for update;
 if coalesce(current_revision,0)<>p_expected then return null; end if;
 insert into public.family_rules(family_id,revision,settings,updated_by)
 values(p_family,p_expected+1,p_settings,p_parent)
 on conflict(family_id) do update set revision=excluded.revision,settings=excluded.settings,updated_by=excluded.updated_by,updated_at=now()
 returning * into saved;
 return jsonb_build_object('revision',saved.revision,'settings',saved.settings,'updated_at',saved.updated_at);
end $$;
revoke all on function public.save_family_rules(uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.save_family_rules(uuid,uuid,bigint,jsonb) to service_role;

create function public.snapshot_family_purchase_rules() returns trigger language plpgsql security invoker set search_path='' as $$
declare saved public.family_rules;
begin
 select * into saved from public.family_rules where family_id=new.family_id for share;
 if found then
  new.rules=jsonb_build_object('version','family-v1-'||saved.revision,'capMinor',saved.settings->>'capMinor',
   'capStroops',round((saved.settings->>'capMinor')::numeric*10000000/968)::bigint::text,
   'allowedCategories',saved.settings->'needsCategories','sellerId','demo-seller','mappingVersion','php-xlm-20261107-v1');
 end if;
 return new;
end $$;
revoke all on function public.snapshot_family_purchase_rules() from public,anon,authenticated;
create trigger snapshot_family_purchase_rules before insert on public.needs_purchases
 for each row execute function public.snapshot_family_purchase_rules();
