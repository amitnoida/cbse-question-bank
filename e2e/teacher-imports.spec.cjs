const {test,expect}=require('@playwright/test');
const {randomBytes}=require('node:crypto');
const {execFileSync}=require('node:child_process');const fs=require('node:fs');
const accounts=JSON.parse(process.env.E2E_ACCOUNTS_JSON||'[]');
async function adminLogin(page){const a=accounts.find(a=>a.kind==='admin'&&/full/i.test(a.email));if(!a)throw Error('QA Full Admin missing');await page.goto('/admin');await page.locator('input[type=email]').fill(a.email);await page.locator('input[type=password]').fill(a.password);await page.getByRole('button',{name:/^Sign in$/i}).click();await expect(page.getByRole('heading',{name:'Management overview'})).toBeVisible({timeout:30000});}
async function token(page){return page.evaluate(()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'));return k?JSON.parse(localStorage.getItem(k)).access_token:null;});}
async function api(request,page,path,body){return request.fetch('https://cbse-question-bank.vercel.app'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+await token(page)},...(body?{data:body}:{})});}
async function login(page,email,password){await page.goto('/app');await page.getByRole('button',{name:/^sign in$/i}).first().click();const d=page.getByRole('dialog',{name:'Student sign in'});await d.locator('input[type=email]').fill(email);await d.locator('input[type=password]').fill(password);await d.getByRole('button',{name:/^sign in$/i}).click();}
async function create(page,email,password,role){await page.goto('/admin/create-user');await expect(page.getByLabel('Class',{exact:true})).toBeVisible({timeout:30000});await page.getByLabel('Full name',{exact:true}).fill('QA Disposable Import POC');await page.getByLabel('Email ID',{exact:true}).fill(email);await page.locator('input[type=password]').fill(password);await page.getByLabel('Class',{exact:true}).selectOption({label:'Class 12'});await page.getByLabel('Account type',{exact:true}).selectOption(role);if(role==='TEACHER'){await expect(page.getByLabel('Free / Paid',{exact:true})).toBeDisabled();await expect(page.getByLabel('Free / Paid',{exact:true})).toHaveValue('PAID');}const response=page.waitForResponse(r=>r.url().endsWith('/api/admin/students')&&r.request().method()==='POST');await page.getByRole('button',{name:'Submit',exact:true}).click();expect((await response).status()).toBe(201);await expect(page.getByRole('heading',{name:role==='TEACHER'?'Teacher account created':'Student account created'})).toBeVisible();}

test('PDF + Word: teacher uploads, admin imports readable MCQs, skips failures/duplicates, retries safely and deletes sources',async({browser,request})=>{
 test.setTimeout(300000);const run=process.env.GITHUB_RUN_ID,attempt=process.env.GITHUB_RUN_ATTEMPT||1;if(!/^\d+$/.test(run||''))throw Error('Run identity required');
 const suffix=run+'-'+attempt,email=`qa_import_${run}_${attempt}@example.com`,password=randomBytes(24).toString('base64url')+'aA1!';
 execFileSync('python',['maintenance/generate-import-poc.py',suffix,'e2e/generated-import-fixtures']);
 const ac=await browser.newContext(),tc=await browser.newContext();
 try{
 const admin=await ac.newPage();admin.setDefaultTimeout(20000);admin.on('pageerror',e=>console.log('Admin page error:',e.message));await adminLogin(admin);await create(admin,email,password,'TEACHER');
 const teacher=await tc.newPage();teacher.setDefaultTimeout(20000);await login(teacher,email,password);await expect(teacher).toHaveURL(/\/teacher$/,{timeout:30000});
 const h=await(await api(request,teacher,'/api/teacher')).json();const subject=h.subjects.find(s=>/mathematics/i.test(s.subject_name));expect(subject).toBeTruthy();
 await teacher.getByLabel('Subject for new MCQs',{exact:true}).selectOption(String(subject.id));
 const chapterSelect=teacher.getByLabel('Chapter for this file',{exact:true});await expect.poll(()=>chapterSelect.locator('option').count()).toBeGreaterThan(1);
 const chapter=await chapterSelect.locator('option').evaluateAll(opts=>opts.find(o=>/differentiab|derivative/i.test(o.textContent))?.value||opts.find(o=>o.value)?.value);expect(chapter).toBeTruthy();await chapterSelect.selectOption(chapter);
 await teacher.getByLabel('Note (optional)',{exact:true}).fill('QA import POC '+suffix+' — disposable original source documents.');
 await teacher.locator('input[type=file]').setInputFiles([{name:'poc-mcqs.pdf',mimeType:'application/pdf',buffer:fs.readFileSync('e2e/generated-import-fixtures/poc-mcqs.pdf')},{name:'poc-mcqs.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:fs.readFileSync('e2e/generated-import-fixtures/poc-mcqs.docx')}]);
 await teacher.getByRole('button',{name:'Submit new MCQs',exact:true}).click();await expect(teacher.getByRole('status')).toContainText('Teacher-verified MCQs submitted',{timeout:30000});
 console.log('POC: teacher files submitted');const home=await(await api(request,teacher,'/api/teacher')).json();const submission=home.submissions.find(s=>s.note.includes(suffix));expect(submission.teacher_mcq_files).toHaveLength(2);
 expect((await api(request,teacher,'/api/admin/teacher-imports')).status()).toBe(403);
 await admin.goto('/admin/teacher-imports');await expect(admin.getByRole('heading',{name:'Teacher MCQ Imports',exact:true})).toBeVisible();
 const all=await(await api(request,admin,'/api/admin/teacher-imports')).json();console.log('POC: dashboard API files',all.files?.length);const sourceFiles=all.files.filter(f=>f.submission_id===submission.id);expect(sourceFiles).toHaveLength(2);
 const pdf=sourceFiles.find(f=>f.file_name.endsWith('.pdf')),word=sourceFiles.find(f=>f.file_name.endsWith('.docx'));
 // Interrupt the first download. No import history or source deletion may occur.
 await admin.route(/\/storage\/v1\/object\/sign\/teacher-mcq-submissions\//,route=>route.abort(),{times:1});
 console.log('POC: interrupting first download');let card=admin.getByRole('article').filter({has:admin.getByRole('heading',{name:'poc-mcqs.pdf',exact:true})}).filter({hasText:suffix});await card.getByRole('button',{name:'Process & Import',exact:true}).click();await expect(admin.getByRole('alert')).toBeVisible({timeout:30000});
 const afterFailure=await(await api(request,admin,'/api/admin/teacher-imports')).json();const kept=afterFailure.files.find(f=>f.id===pdf.id);expect(kept.source_deleted_at).toBeNull();expect(Array.isArray(kept.teacher_mcq_imports)?kept.teacher_mcq_imports.length:kept.teacher_mcq_imports).toBeFalsy();
 console.log('POC: interrupted download preserved source');const expected=[[pdf,3,2],[word,2,3]];
 for(const [file,imported,skipped] of expected){
 console.log('POC: processing',file.file_name);card=admin.getByRole('article').filter({has:admin.getByRole('heading',{name:file.file_name,exact:true})}).filter({hasText:suffix});await card.getByRole('button',{name:'Process & Import',exact:true}).click();await expect(admin.getByRole('alert')).toHaveCount(0);await Promise.race([card.getByText('Completed — source file deleted',{exact:true}).waitFor({timeout:90000}),admin.getByRole('alert').waitFor({timeout:90000}).then(async()=>{throw Error(await admin.getByRole('alert').innerText());})]);
 const status=await(await api(request,admin,'/api/admin/teacher-imports')).json();const row=status.files.find(f=>f.id===file.id);const batch=Array.isArray(row.teacher_mcq_imports)?row.teacher_mcq_imports[0]:row.teacher_mcq_imports;expect(batch.imported_count).toBe(imported);expect(batch.skipped_count).toBe(skipped);expect(batch.source_deleted_at).toBeTruthy();
 const view=await api(request,admin,`/api/admin/teacher-imports?fileId=${file.id}`);expect(view.ok()).toBe(true);const questions=(await view.json()).questions;expect(questions).toHaveLength(imported);for(const q of questions){expect(q.chapter_id).toBe(Number(chapter));expect(q.is_active).toBe(true);expect(q.explanation.length).toBeGreaterThan(5);expect(q.question_text).toContain(suffix);}
 await card.getByRole('button',{name:'View imported MCQs',exact:true}).click();await expect(card.locator('details')).toHaveCount(imported);
 const retry=await api(request,admin,'/api/admin/teacher-imports',{action:'import',fileId:file.id,chapterId:Number(chapter),sha256:'a'.repeat(64),text:'Retry after committed import'});expect(retry.ok()).toBe(true);expect((await retry.json()).batch.imported_count).toBe(imported);
 const missing=await api(request,teacher,'/api/teacher/submissions',{action:'download',submissionId:submission.id,fileId:file.id});expect(missing.status()).toBe(404);
 }
 await teacher.reload();await expect(teacher.getByText(/Processing complete. Readable, complete MCQs imported/)).toBeVisible();
 }finally{await ac.close().catch(()=>{});await tc.close().catch(()=>{});}
});
