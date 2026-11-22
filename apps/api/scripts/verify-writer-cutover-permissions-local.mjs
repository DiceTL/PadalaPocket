import assert from 'node:assert/strict';
import { assertLocalProject, assertLoopbackBindings, command, project } from './local-verification.mjs';

// Existing isolated database only; all fixture/rule changes roll back, including on error.
let stage = 'local-bindings';
const sql = text => command('docker', ['exec', `supabase_db_${project}`, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-c', text]);
try {
  await assertLocalProject(); assertLoopbackBindings();
  stage = 'coordinator-purchase-insert';
  sql(`begin;
    set local statement_timeout='10s';
    create temporary table t08_purchase_fixture on commit drop as
      select s.user_id as student_id,s.family_id,p.user_id as parent_id,
        gen_random_uuid() as needs_key,gen_random_uuid() as wants_key
      from public.family_members s join public.family_members p using(family_id)
      where s.role='student' and p.role='parent' limit 1;
    do $$ begin
      if (select count(*) from t08_purchase_fixture)<>1 then raise exception 'FIXTURE_REQUIRED'; end if;
    end $$;
    grant select on t08_purchase_fixture to money_coordinator;
    insert into public.family_rules(family_id,revision,settings,updated_by)
      select family_id,1,'{"capMinor":"484","weeklyAmountMinor":"968","needsPercent":60,"needsCategories":["school_supplies"],"wantsCategories":["books"]}'::jsonb,parent_id
      from t08_purchase_fixture
      on conflict(family_id) do update set revision=public.family_rules.revision+1,settings=excluded.settings;
    set local role money_coordinator;
    insert into public.needs_purchases(family_id,student_id,request_key,fingerprint,seller_id,price_minor,
      amount_stroops,photo_base64,photo_mime,photo_hash,rules,bucket,status)
      select family_id,student_id,case when bucket='needs' then needs_key else wants_key end,
        repeat('a',64),'demo-seller','242',2500000,'dGVzdA==','image/png',repeat('b',64),
        '{"untrusted":true}'::jsonb,bucket,'blocked'
      from t08_purchase_fixture cross join (values ('needs'),('wants')) as buckets(bucket);
    do $$ declare purchase public.needs_purchases; saved public.family_rules; seen integer:=0; begin
      for purchase in select p.* from public.needs_purchases p join t08_purchase_fixture f
        on p.request_key in (f.needs_key,f.wants_key) loop
        select * into strict saved from public.family_rules where family_id=purchase.family_id;
        if purchase.coordinator_version<>8 or purchase.rules is distinct from jsonb_build_object(
          'version','family-v1-'||saved.revision,'capMinor','484','capStroops','5000000',
          'allowedCategories',saved.settings->(case when purchase.bucket='wants' then 'wantsCategories' else 'needsCategories' end),
          'sellerId','demo-seller','mappingVersion','php-xlm-20261107-v1') then raise exception 'SNAPSHOT_MISMATCH'; end if;
        seen:=seen+1;
      end loop;
      if seen<>2 then raise exception 'PURCHASES_MISSING'; end if;
      begin
        update public.family_rules set revision=revision where false;
        raise exception 'COORDINATOR_RULE_WRITE_ALLOWED';
      exception when insufficient_privilege then null; end;
      if has_function_privilege(current_user,'public.snapshot_family_purchase_rules()','EXECUTE') then
        raise exception 'TRIGGER_DIRECT_EXECUTE_ALLOWED'; end if;
    end $$;
    reset role;
    rollback;`);
  stage = 'legacy-mutation-revocation';
  const result = sql(`begin; set local role service_role;
    select public.read_money_cutover_access(); rollback;`);
  const access = JSON.parse(result.split('\n').find(line => line.startsWith('{')));
  assert.equal(access.role, 'service_role'); assert.equal(access.readsSigned, false);
  for (const table of ['needs_funding', 'needs_purchases', 'weekly_events', 'weekly_clocks']) {
    for (const right of ['insert', 'update', 'delete', 'truncate']) assert.equal(access.tables[table][right], false);
  }
  console.log('PASS: writer-cutover-permissions-local');
} catch {
  console.error(`FAIL: writer-cutover-permissions-local (${stage})`); process.exitCode = 1;
}
