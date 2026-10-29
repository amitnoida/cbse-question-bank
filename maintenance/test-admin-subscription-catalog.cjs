// Focused API authorization/validation tests. No credentials or network calls.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, overrides = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code, {exports, require: name => overrides[name] || require(name), console, Response, Request});
  return exports;
}
const catalog = load('lib/subscription-catalog.ts');
const valid = {code:'CLASS_8',revision:1,name:'Class 8',price_inr:99.99,description:'Both modes',status:'ready'};
function api(admin, rpcResult = {data:valid,error:null}) {
  const calls = [];
  const db = {rpc:async(name,args) => {calls.push({name,args}); return rpcResult;}, from:() => {
    const chain={select:()=>chain,order:()=>chain,limit:()=>chain,then:resolve=>resolve({data:[],error:null})};return chain;
  }};
  const route=load('app/api/admin/subscriptions/route.ts', {
    '../../../../lib/system-stats-server':{noStore:{'Cache-Control':'no-store'},requireStatsAdmin:async()=>admin ? {...admin,db}:null},
    '../../../../lib/subscription-catalog':catalog,
  });
  return {route,calls};
}
const req=body=>new Request('https://example.test/api/admin/subscriptions',{method:'PATCH',body:JSON.stringify(body)});
test('all seven products validate; draft can omit price',()=>{
  for(const code of catalog.productCodes)assert.ok(catalog.parseProductInput({...valid,code}));
  assert.ok(catalog.parseProductInput({...valid,price_inr:null,status:'draft'}));
});
test('reject malformed prices, identities, status and content',()=>{
  for(const price_inr of [-1,1.001,NaN,Infinity,1000000,'99',undefined])assert.equal(catalog.parseProductInput({...valid,price_inr}),null);
  for(const change of [{price_inr:null},{code:'FREE'},{revision:0},{revision:'1'},{status:'active'},{name:'  '},{description:'x'.repeat(1001)}])assert.equal(catalog.parseProductInput({...valid,...change}),null);
});
test('unauthenticated GET and PATCH denied',async()=>{
  const {route,calls}=api(null); assert.equal((await route.GET(new Request('https://example.test'))).status,401);assert.equal((await route.PATCH(req(valid))).status,401);assert.equal(calls.length,0);
});
test('viewer GET and PATCH denied',async()=>{
  const {route,calls}=api({role:'ADMIN_VIEW',user:{id:'viewer'}});assert.equal((await route.GET(new Request('https://example.test'))).status,403);assert.equal((await route.PATCH(req(valid))).status,403);assert.equal(calls.length,0);
});
test('full admin gets catalogue with no-store',async()=>{
  const {route}=api({role:'FULL_ADMIN',user:{id:'owner'}});const response=await route.GET(new Request('https://example.test'));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
});
test('actor comes from verified account, never request body',async()=>{
  const {route,calls}=api({role:'FULL_ADMIN',user:{id:'verified-admin'}});const r=await route.PATCH(req({...valid,p_actor:'attacker',class_numbers:[12]}));assert.equal(r.status,200);assert.equal(calls[0].args.p_actor,'verified-admin');assert.equal(calls[0].args.class_numbers,undefined);
});
test('conflicting revision returns 409',async()=>{
  const {route}=api({role:'FULL_ADMIN',user:{id:'owner'}},{data:null,error:{code:'40001'}});assert.equal((await route.PATCH(req(valid))).status,409);
});
test('invalid input never reaches database',async()=>{
  const {route,calls}=api({role:'FULL_ADMIN',user:{id:'owner'}});assert.equal((await route.PATCH(req({...valid,price_inr:-1}))).status,400);assert.equal(calls.length,0);
});
test('malformed JSON returns 400',async()=>{
  const {route}=api({role:'FULL_ADMIN',user:{id:'owner'}});assert.equal((await route.PATCH(new Request('https://example.test',{method:'PATCH',body:'{'}))).status,400);
});
test('database errors do not disclose internals',async()=>{
  const {route}=api({role:'FULL_ADMIN',user:{id:'owner'}},{data:null,error:{code:'XX000',message:'private database detail'}});const r=await route.PATCH(req(valid));assert.equal(r.status,500);assert.ok(!(await r.text()).includes('private database detail'));
});
