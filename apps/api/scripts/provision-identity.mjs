// R-001 operator only. Run with node --env-file=.env.local; never deploy credentials.
import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const path = '.env.r001-accounts.json';
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) throw new Error('Missing server provisioning configuration.');
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let state;
try { state = JSON.parse(await readFile(path, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  state = { familyId: randomUUID(), accounts: ['parent', 'student'].map(role => ({ role, email: `${role}@padalapocket.example.test`, password: randomBytes(24).toString('base64url') })) };
  await writeFile(path, JSON.stringify(state), { mode: 0o600, flag: 'wx' });
}
for (const account of state.accounts) {
  if (!account.id) {
    const { data, error } = await client.auth.admin.createUser({ email: account.email, password: account.password, email_confirm: true });
    if (error) throw new Error(`Provisioning ${account.role} failed (${error.status}); inspect Auth before retrying.`);
    account.id = data.user.id;
    await writeFile(path, JSON.stringify(state), { mode: 0o600 });
  }
  const { error } = await client.from('family_members').upsert({ user_id: account.id, family_id: state.familyId, role: account.role });
  if (error) throw new Error('Membership provisioning failed.');
  console.log(JSON.stringify({ role: account.role, userId: account.id }));
}
console.log('Credentials saved only in ignored .env.r001-accounts.json.');
