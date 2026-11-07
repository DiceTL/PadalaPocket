alter table public.needs_purchases drop constraint needs_purchases_status_check;
alter table public.needs_purchases add constraint needs_purchases_status_check check(status in ('assessing','blocked','reserved','policy_pending','authorization_pending','merchant_pending','claim_pending','claimed','failed','unknown','awaiting_parent','approved','rejected','expired','exception_pending'));
alter table public.needs_purchases add column approval_binding text, add column approval_deadline timestamptz, add column parent_decision jsonb, add column exception_consent jsonb;
drop index public.one_active_purchase;
create unique index one_active_purchase on public.needs_purchases ((true)) where status not in ('blocked','claimed','failed','rejected','expired');

create function public.expire_purchase_reviews() returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(616102);
 update public.needs_purchases set status='expired',reason='APPROVAL_EXPIRED',reserved=false
 where status='awaiting_parent' and approval_deadline<=clock_timestamp() and steps='{}'::jsonb and parent_decision is null;
end $$;
revoke all on function public.expire_purchase_reviews() from public,anon,authenticated;
grant execute on function public.expire_purchase_reviews() to service_role;

create or replace function public.guard_needs_funding() returns trigger language plpgsql set search_path='' as $$
begin
 perform public.expire_purchase_reviews();
 if exists(select 1 from public.needs_purchases where status not in ('blocked','claimed','failed','rejected','expired')) then raise exception 'PURCHASE_PENDING'; end if;
 return new;
end $$;

create function public.guard_purchase_insert() returns trigger language plpgsql set search_path='' as $$
begin
 perform public.expire_purchase_reviews();
 return new;
end $$;
create trigger guard_purchase_insert before insert on public.needs_purchases for each row execute function public.guard_purchase_insert();
revoke all on function public.guard_purchase_insert() from public,anon,authenticated;

create function public.begin_purchase_review(p_id uuid,p_binding text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.needs_purchases;
begin
 perform pg_advisory_xact_lock(616102);
 select * into p from public.needs_purchases where id=p_id for update;
 if not found or p.status<>'reserved' or not p.reserved or p.steps<>'{}'::jsonb then return null; end if;
 if p_reason not in ('CAP_EXCEEDED','CATEGORY_DISALLOWED') or p_binding !~ '^[a-f0-9]{64}$' or p.ai is null then raise exception 'INVALID_INPUT'; end if;
 update public.needs_purchases set approval_binding=p_binding,approval_deadline=created_at+interval '10 minutes',
 status=case when created_at+interval '10 minutes'<=clock_timestamp() then 'expired' else 'awaiting_parent' end,
 reason=case when created_at+interval '10 minutes'<=clock_timestamp() then 'APPROVAL_EXPIRED' else p_reason end,
 reserved=created_at+interval '10 minutes'>clock_timestamp() where id=p_id returning * into p;
 return to_jsonb(p);
end $$;
revoke all on function public.begin_purchase_review(uuid,text,text) from public,anon,authenticated;
grant execute on function public.begin_purchase_review(uuid,text,text) to service_role;

create function public.decide_purchase_review(p_id uuid,p_parent uuid,p_family uuid,p_decision text,p_binding text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.needs_purchases;
begin
 perform pg_advisory_xact_lock(616102);
 if not exists(select 1 from public.family_members where user_id=p_parent and family_id=p_family and role='parent') then raise exception 'FORBIDDEN'; end if;
 perform public.expire_purchase_reviews();
 select * into p from public.needs_purchases where id=p_id and family_id=p_family for update;
 if not found then return jsonb_build_object('error','NOT_FOUND'); end if;
 if p_decision not in ('approve','reject') then return jsonb_build_object('error','INVALID_INPUT'); end if;
 if p.approval_binding is distinct from p_binding then return jsonb_build_object('error','PURCHASE_CHANGED'); end if;
 if p.parent_decision is not null then
  if p.parent_decision->>'decision'=p_decision and p.parent_decision->>'parentId'=p_parent::text then return jsonb_build_object('row',to_jsonb(p),'admitted',false); end if;
  return jsonb_build_object('error','DECISION_ALREADY_CLOSED');
 end if;
 if p.status='expired' then return jsonb_build_object('error','APPROVAL_EXPIRED'); end if;
 if p.status<>'awaiting_parent' or p.approval_deadline<=clock_timestamp() then return jsonb_build_object('error','DECISION_ALREADY_CLOSED'); end if;
 update public.needs_purchases set status=case when p_decision='approve' then 'approved' else 'rejected' end,
 reserved=p_decision='approve',reason=case when p_decision='approve' then null else 'PARENT_REJECTED' end,
 parent_decision=jsonb_build_object('decision',p_decision,'parentId',p_parent,'binding',p_binding,'decidedAt',clock_timestamp()) where id=p_id returning * into p;
 return jsonb_build_object('row',to_jsonb(p),'admitted',p_decision='approve');
end $$;
revoke all on function public.decide_purchase_review(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.decide_purchase_review(uuid,uuid,uuid,text,text) to service_role;

create function public.freeze_purchase_request() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-array['ai','ai_usage','status','reason','reserved','claim_started','steps','evidence','approval_binding','approval_deadline','parent_decision','exception_consent']) is distinct from
 (to_jsonb(old)-array['ai','ai_usage','status','reason','reserved','claim_started','steps','evidence','approval_binding','approval_deadline','parent_decision','exception_consent']) then raise exception 'IMMUTABLE_PURCHASE'; end if;
 if old.ai is not null and new.ai is distinct from old.ai then raise exception 'IMMUTABLE_ASSESSMENT'; end if;
 if old.approval_binding is not null and (new.approval_binding is distinct from old.approval_binding or new.approval_deadline is distinct from old.approval_deadline) then raise exception 'IMMUTABLE_APPROVAL'; end if;
 if old.parent_decision is not null and new.parent_decision is distinct from old.parent_decision then raise exception 'IMMUTABLE_DECISION'; end if;
 if old.exception_consent is not null and new.exception_consent is distinct from old.exception_consent then raise exception 'IMMUTABLE_CONSENT'; end if;
 return new;
end $$;
create trigger freeze_purchase_request before update on public.needs_purchases for each row execute function public.freeze_purchase_request();
revoke all on function public.freeze_purchase_request() from public,anon,authenticated;
