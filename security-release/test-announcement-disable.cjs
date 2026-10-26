// Exercise the real route with an in-memory identity/database boundary; no network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextResponse } = require('next/server');
let role = 'FULL_ADMIN';
let writes = [];
const database = {
  auth: { getUser: async () => ({ data: { user: { id: 'test-admin' } } }) },
  from(table) {
    return {
      select() { return this; },
      eq(column, value) {
        if (this.patch) writes.push({ table, column, value, patch: this.patch });
        return this;
      },
      update(patch) { this.patch = patch; return this; },
      async maybeSingle() {
        return { data: table === 'admin_profiles'
          ? { role, is_active: true, must_change_password: false }
          : { user_id: 'test-admin' } };
      },
    };
  },
};
const output = ts.transpileModule(fs.readFileSync('app/api/admin/upgrade/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleObject = { exports: {} };
vm.runInNewContext(output, {
  exports: moduleObject.exports,
  module: moduleObject,
  require(name) {
    if (name === '@supabase/supabase-js') return { createClient: () => database };
    if (name === 'next/server') return { NextResponse };
    return require(name);
  },
  process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test' } },
});
async function request(id, authenticated = true) {
  return moduleObject.exports.POST(new Request('https://example.invalid/api/admin/upgrade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: 'Bearer test' } : {}) },
    body: JSON.stringify({ action: 'announcement-disable', id }),
  }));
}
(async () => {
  const id = 'b7817c19-b29d-45a5-bfcf-0987dd411ba9';
  assert.equal((await request(id, false)).status, 401);
  role = 'ADMIN_VIEW';
  assert.equal((await request(id)).status, 403);
  role = 'FULL_ADMIN';
  for (const invalid of ['123', 'not-a-uuid', '', null]) assert.equal((await request(invalid)).status, 400);
  assert.equal(writes.length, 0);
  const result = await request(id);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].table, 'site_announcements');
  assert.equal(writes[0].value, id);
  assert.equal(writes[0].patch.enabled, false);
  console.log('PASS: UUID disables announcement; malformed IDs, anonymous users and viewers cannot write');
})().catch(error => { console.error(error); process.exitCode = 1; });
