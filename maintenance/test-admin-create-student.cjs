const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(path,overrides={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>overrides[n]||require(n),Response,Request});return exports;}
const parser=load('lib/admin-create-student.ts');
const valid={requestId:'12345678-1234-4234-a234-123456789abc',fullName:'QA Student',email:'qa.student@example.com',password:'Test-only-password-123!',classId:5,membership:'PAID'};
const req=b=>new Request('https://example.test/api/admin/students',{method:'POST',body:JSON.stringify(b)});
function api(role='FULL_ADMIN',options={}) {
 const calls=[];
 const db={
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name.includes('_begin_'))return options.beginError?{error:{code:'22023'}}:{data:options.begin||{status:'CREATE'}};
   if(name.includes('_finish_'))return options.finishError?{error:{code:'XX000'}}:{data:{email:valid.email,membership:'PAID'}};
   return {data:null,error:null};
  },
  auth:{admin:{createUser:async input=>{
   calls.push({auth:input});
   return options.authError?{data:{user:null},error:{code:'email_exists'}}:{data:{user:{id:'created-student'}}};
  }}}
 };
 const route=load('app/api/admin/students/route.ts',{
  '../../../../lib/system-stats-server':{noStore:{'Cache-Control':'no-store'},requireStatsAdmin:async()=>role?{role,user:{id:'verified-admin'},db}:null},
  '../../../../lib/admin-create-student':parser
 });
 return {route,calls};
}
test('valid input normalizes names/email without modifying password',()=>{const r=parser.parseAdminStudent({...valid,fullName:' QA Student ',email:' QA.Student@Example.com '});assert.equal(r.email,'qa.student@example.com');assert.equal(r.fullName,'QA Student');assert.equal(r.password,valid.password);});
test('invalid fields and unsafe membership rejected',()=>{for(const b of [{password:'short'},{password:'x'.repeat(129)},{fullName:' '},{email:'invalid'},{classId:0},{classId:'5'},{membership:'ADMIN'},{requestId:'invalid'}])assert.equal(parser.parseAdminStudent({...valid,...b}),null);});
test('anonymous and Viewer cannot create accounts',async()=>{for(const [role,status]of [[null,401],['ADMIN_VIEW',403]]){const {route,calls}=api(role);assert.equal((await route.POST(req(valid))).status,status);assert.equal(calls.length,0);}});
test('verified email, trusted metadata, paid class and no password in result',async()=>{const {route,calls}=api();const r=await route.POST(req({...valid,p_actor:'spoof'}));assert.equal(r.status,201);const auth=calls.find(c=>c.auth).auth;assert.equal(auth.email_confirm,true);assert.equal(auth.user_metadata.class_id,5);assert.equal(auth.app_metadata.admin_student_actor,'verified-admin');assert.equal(calls[0].args.p_actor,'verified-admin');assert.equal(calls[0].args.p_paid,true);assert.ok(!(await r.text()).includes(valid.password));assert.ok(!calls.filter(c=>c.args).some(c=>JSON.stringify(c.args).includes(valid.password)));});
test('Free choice does not request annual paid grant',async()=>{const {route,calls}=api();await route.POST(req({...valid,membership:'FREE'}));assert.equal(calls[0].args.p_paid,false);});
test('completed retry never recreates Auth account',async()=>{const {route,calls}=api('FULL_ADMIN',{begin:{status:'COMPLETE',result:{email:valid.email}}});assert.equal((await route.POST(req(valid))).status,200);assert.equal(calls.filter(c=>c.auth).length,0);});
test('parallel request reports busy without creating user',async()=>{const {route,calls}=api('FULL_ADMIN',{begin:{status:'BUSY'}});assert.equal((await route.POST(req(valid))).status,409);assert.equal(calls.filter(c=>c.auth).length,0);});
test('recover previous Auth result without resetting password',async()=>{const {route,calls}=api('FULL_ADMIN',{begin:{status:'RECOVER',user_id:'recovered-user'}});assert.equal((await route.POST(req(valid))).status,201);assert.equal(calls.filter(c=>c.auth).length,0);assert.equal(calls.find(c=>c.name?.includes('_finish_')).args.p_user,'recovered-user');});
test('existing email rejected without membership writes',async()=>{const {route,calls}=api('FULL_ADMIN',{authError:true});const r=await route.POST(req(valid));assert.equal(r.status,400);assert.match(await r.text(),/already exists/);assert.ok(!calls.some(c=>c.name?.includes('_finish_')));});
test('incomplete provisioning reports retry and does not claim success',async()=>{const {route}=api('FULL_ADMIN',{finishError:true});assert.equal((await route.POST(req(valid))).status,503);});
test('invalid class rejected before Auth call',async()=>{const {route,calls}=api('FULL_ADMIN',{beginError:true});assert.equal((await route.POST(req(valid))).status,400);assert.equal(calls.filter(c=>c.auth).length,0);});
test('invalid JSON returns 400',async()=>{const {route}=api();assert.equal((await route.POST(new Request('https://example.test',{method:'POST',body:'{'}))).status,400);});
test('teacher requires paid membership and cannot choose arbitrary role',()=>{assert.equal(parser.parseAdminStudent({...valid,accountRole:'TEACHER',membership:'FREE'}),null);assert.equal(parser.parseAdminStudent({...valid,accountRole:'ADMIN'}),null);assert.equal(parser.parseAdminStudent({...valid,accountRole:'TEACHER'}).accountRole,'TEACHER');});
test('teacher role is passed to the server-owned creation request, never user authorization metadata',async()=>{const {route,calls}=api();assert.equal((await route.POST(req({...valid,accountRole:'TEACHER'}))).status,201);assert.equal(calls[0].name,'admin_account_creation_begin_v2');assert.equal(calls[0].args.p_role,'TEACHER');assert.equal(calls.find(c=>c.auth).auth.user_metadata.account_role,undefined);});
