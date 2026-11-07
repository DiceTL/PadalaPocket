alter table public.needs_purchases add column exception_started boolean not null default false,
 add column exception_stage integer not null default 0 check(exception_stage between 0 and 7);
create function public.admit_purchase_exception(p_id uuid,p_parent uuid,p_family uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.needs_purchases;
begin
 perform pg_advisory_xact_lock(616102);
 if not exists(select 1 from public.family_members where user_id=p_parent and family_id=p_family and role='parent') then raise exception 'FORBIDDEN'; end if;
 select * into p from public.needs_purchases where id=p_id and family_id=p_family for update;
 if not found then return jsonb_build_object('error','NOT_FOUND'); end if;
 if p.status not in ('approved','exception_pending') or p.exception_started or p.exception_stage>=7 or p.parent_decision->>'decision' is distinct from 'approve' then return jsonb_build_object('row',to_jsonb(p),'admitted',false); end if;
 update public.needs_purchases set exception_started=true where id=p_id returning * into p;
 return jsonb_build_object('row',to_jsonb(p),'admitted',true);
end $$;
revoke all on function public.admit_purchase_exception(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.admit_purchase_exception(uuid,uuid,uuid) to service_role;
create or replace function public.freeze_purchase_request() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-array['ai','ai_usage','status','reason','reserved','claim_started','steps','evidence','approval_binding','approval_deadline','parent_decision','exception_consent','exception_started','exception_stage']) is distinct from
 (to_jsonb(old)-array['ai','ai_usage','status','reason','reserved','claim_started','steps','evidence','approval_binding','approval_deadline','parent_decision','exception_consent','exception_started','exception_stage']) then raise exception 'IMMUTABLE_PURCHASE'; end if;
 if old.ai is not null and new.ai is distinct from old.ai then raise exception 'IMMUTABLE_ASSESSMENT'; end if;
 if old.approval_binding is not null and (new.approval_binding is distinct from old.approval_binding or new.approval_deadline is distinct from old.approval_deadline) then raise exception 'IMMUTABLE_APPROVAL'; end if;
 if old.parent_decision is not null and new.parent_decision is distinct from old.parent_decision then raise exception 'IMMUTABLE_DECISION'; end if;
 if old.exception_consent is not null and new.exception_consent is distinct from old.exception_consent then raise exception 'IMMUTABLE_CONSENT'; end if;
 return new;
end $$;
