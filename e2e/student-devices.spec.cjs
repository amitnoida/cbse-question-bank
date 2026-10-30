const {test,expect}=require('@playwright/test');
const {randomBytes,randomUUID}=require('node:crypto');
const project='https://darfsuqfmmunxqiyqlvn.supabase.co';
const accounts=JSON.parse(process.env.E2E_ACCOUNTS_JSON||'[]');
async function adminLogin(page){const a=accounts.find(a=>a.kind==='admin'&&/full/i.test(a.email));if(!a)throw Error('QA Full Admin missing');await page.goto('/admin');await page.locator('input[type=email]').fill(a.email);await page.locator('input[type=password]').fill(a.password);await page.getByRole('button',{name:/^Sign in$/i}).click();await expect(page.getByRole('heading',{name:'Management overview'})).toBeVisible({timeout:30000});}
async function studentLogin(page,email,password){await page.goto('/app');await page.getByRole('button',{name:/^sign in$/i}).first().click();const dialog=page.getByRole('dialog',{name:'Student sign in'});await dialog.locator('input[type=email]').fill(email);await dialog.locator('input[type=password]').fill(password);await dialog.getByRole('button',{name:/^sign in$/i}).click();await expect(page.getByRole('heading',{name:/what will you learn today/i})).toBeVisible({timeout:30000});}
async function session(page){return page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'));return key?JSON.parse(localStorage.getItem(key)):null;});}
async function rpc(request,key,token,name,data={}){return request.post(project+'/rest/v1/rpc/'+name,{headers:{apikey:key,Authorization:'Bearer '+token},data});}

test('two browser sessions: oldest logout, old JWT/refresh denied, saved work preserved and local logout isolated',async({browser,request})=>{
 test.setTimeout(240000);
 const run=process.env.GITHUB_RUN_ID;if(!/^\d+$/.test(run||''))throw Error('Run identity required');
 const email=`qa_devices_${run}_${process.env.GITHUB_RUN_ATTEMPT||1}@example.com`,password=randomBytes(24).toString('base64url')+'aA1!';
 const adminContext=await browser.newContext();const admin=await adminContext.newPage();
 const contexts=[];
 let apiKey;
 try{
  await adminLogin(admin);
  admin.on('request',r=>{if(r.url().startsWith(project+'/rest/v1/'))apiKey=r.headers().apikey||apiKey;});
  await admin.goto('/admin/create-user');await expect.poll(()=>admin.getByRole('combobox').first().locator('option').count()).toBeGreaterThan(1);
  await admin.getByLabel('Full name',{exact:true}).fill('QA Disposable Device Policy');await admin.getByLabel('Email ID',{exact:true}).fill(email);await admin.locator('input[type=password]').fill(password);
  await admin.getByRole('combobox').first().selectOption({label:'Class 9'});await admin.getByRole('combobox').nth(1).selectOption('PAID');
  const created=admin.waitForResponse(r=>r.url().endsWith('/api/admin/students')&&r.request().method()==='POST');await admin.getByRole('button',{name:'Submit',exact:true}).click();expect((await created).status()).toBe(201);
  async function device(){const c=await browser.newContext();contexts.push(c);const p=await c.newPage();p.on('request',r=>{if(r.url().startsWith(project+'/rest/v1/'))apiKey=r.headers().apikey||apiKey;});await studentLogin(p,email,password);return p;}
  const first=await device();const one=await session(first);expect(one?.access_token).toBeTruthy();await expect.poll(()=>Boolean(apiKey)).toBe(true);
  // Wait for the deliberate post-deployment rollout switch before testing evictions.
  await expect.poll(async()=>{const r=await rpc(request,apiKey,one.access_token,'cbse_claim_student_session_v1');return r.ok()?(await r.json()).enforced:false;},{timeout:180000}).toBe(true);
  const subjects=await request.get(project+'/rest/v1/subjects?select=id,subject_name&class_id=eq.1&is_active=eq.true',{headers:{apikey:apiKey,Authorization:'Bearer '+one.access_token}});expect(subjects.ok()).toBe(true);
  const subject=(await subjects.json()).find(s=>s.subject_name==='Mathematics');expect(subject?.id).toBeTruthy();
  const assigned=await rpc(request,apiKey,one.access_token,'cbse_start_practice_v2',{p_subject_id:subject.id,p_chapter_ids:[],p_set_number:1});expect(assigned.ok()).toBe(true);const practice=await assigned.json();const question=practice.question_ids[0];
  expect((await rpc(request,apiKey,one.access_token,'submit_practice_answer_locked',{p_session_id:practice.id,p_question_id:question,p_answer:'A'})).ok()).toBe(true);
  const allocated=await rpc(request,apiKey,one.access_token,'start_next_mock_paper_v3',{p_subject_id:subject.id,p_chapter_ids:[]});expect(allocated.ok()).toBe(true);const allocatedData=await allocated.json();const paper=Array.isArray(allocatedData)?allocatedData[0]:allocatedData;
  const opened=await rpc(request,apiKey,one.access_token,'mock_open_exam',{p_kind:'full',p_paper_id:paper.id});expect(opened.ok()).toBe(true);const exam=(await opened.json())[0];
  const second=await device();const two=await session(second);
  // Another tab uses the same browser's storage/Auth session and must not take a third slot.
  const tab=await contexts[1].newPage();await tab.goto('/app');await expect(tab.getByRole('heading',{name:/what will you learn today/i})).toBeVisible({timeout:30000});
  expect((await session(tab)).access_token.split('.')[1]).toBe(two.access_token.split('.')[1]);
  expect((await rpc(request,apiKey,one.access_token,'cbse_student_session_status_v1')).status()).toBe(200);
  const third=await device();const three=await session(third);
  const denied=await rpc(request,apiKey,one.access_token,'cbse_save_practice_progress_v1',{p_session_id:practice.id,p_index:1});expect(denied.status()).toBe(403);const refusal=await denied.json();expect(refusal.code).toBe('PT403');expect(refusal.details).toBe('CBSE_SESSION_REVOKED');
  const submit=await rpc(request,apiKey,one.access_token,'mock_finish_exam',{p_session_id:exam.session_id});expect(submit.status()).toBe(403);
  const oldRead=await request.get(project+'/rest/v1/student_profiles?select=id',{headers:{apikey:apiKey,Authorization:'Bearer '+one.access_token}});expect(oldRead.status()).toBe(403);
  const oldReport=await request.get('https://cbse-question-bank.vercel.app/api/reports/mock?attemptId=1',{headers:{Authorization:'Bearer '+one.access_token}});expect([401,403]).toContain(oldReport.status());
  const refreshed=await request.post(project+'/auth/v1/token?grant_type=refresh_token',{headers:{apikey:apiKey},data:{refresh_token:one.refresh_token}});expect(refreshed.ok()).toBe(false);
  await first.bringToFront();await expect(first).toHaveURL(/session=limit/,{timeout:35000});await expect(first.getByText('You were signed out because your account was used on another device. Only two active sessions are allowed.',{exact:true})).toBeVisible();
  expect((await rpc(request,apiKey,two.access_token,'cbse_student_session_status_v1')).status()).toBe(200);expect((await rpc(request,apiKey,three.access_token,'cbse_student_session_status_v1')).status()).toBe(200);
  const resumed=await rpc(request,apiKey,three.access_token,'cbse_start_practice_v2',{p_subject_id:subject.id,p_chapter_ids:[],p_set_number:1});expect(resumed.ok()).toBe(true);const after=await resumed.json();expect(after.id).toBe(practice.id);expect(JSON.stringify(after.answers)).toContain(String(question));
  const resumedExam=await rpc(request,apiKey,three.access_token,'mock_open_exam',{p_kind:'full',p_paper_id:paper.id});expect(resumedExam.ok()).toBe(true);expect((await resumedExam.json())[0].deadline_at).toBe(exam.deadline_at);
  // New sign-in replaces the next oldest (second), preserving third + fourth.
  await studentLogin(first,email,password);const four=await session(first);
  expect((await rpc(request,apiKey,two.access_token,'cbse_student_session_status_v1')).status()).toBe(403);expect((await rpc(request,apiKey,three.access_token,'cbse_student_session_status_v1')).status()).toBe(200);
  const rows=await request.get(project+'/rest/v1/student_device_sessions?select=revoked_at',{headers:{apikey:apiKey,Authorization:'Bearer '+four.access_token}});expect(rows.ok()).toBe(true);expect((await rows.json()).filter(r=>r.revoked_at===null).length).toBe(2);
  // Ordinary sign out must not terminate the other retained device.
  await first.getByRole('button',{name:/^Logout$/i}).first().click();await expect(first.getByRole('heading',{name:/what will you learn today/i})).toHaveCount(0,{timeout:15000});expect((await rpc(request,apiKey,three.access_token,'cbse_student_session_status_v1')).status()).toBe(200);
 }finally{for(const c of contexts)await c.close();await adminContext.close();}
});
test('three admin browser sessions remain exempt',async({browser,request})=>{
 test.setTimeout(120000);const contexts=[];let apiKey;
 try{for(let i=0;i<3;i++){const c=await browser.newContext();contexts.push(c);const p=await c.newPage();p.on('request',r=>{if(r.url().startsWith(project+'/rest/v1/'))apiKey=r.headers().apikey||apiKey;});await adminLogin(p);}
 for(const c of contexts){const s=await session(c.pages()[0]);const r=await rpc(request,apiKey,s.access_token,'cbse_claim_student_session_v1');expect(r.ok()).toBe(true);expect((await r.json()).exempt).toBe(true);}
 }finally{for(const c of contexts)await c.close();}
});
