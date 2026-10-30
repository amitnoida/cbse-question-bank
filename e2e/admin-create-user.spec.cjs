const {test,expect}=require('@playwright/test');
const {randomBytes}=require('node:crypto');
const accounts=JSON.parse(process.env.E2E_ACCOUNTS_JSON||'[]').filter(a=>a.kind==='admin');
async function adminLogin(page,kind){const a=accounts.find(a=>new RegExp(kind,'i').test(a.email));if(!a)throw Error('Required QA admin missing');await page.goto('/admin');await page.locator('input[type=email]').fill(a.email);await page.locator('input[type=password]').fill(a.password);await page.getByRole('button',{name:/^Sign in$/i}).click();await expect(page.getByRole('heading',{name:'Management overview'})).toBeVisible({timeout:30000});}
async function adminRequest(page,body){return page.evaluate(async(body)=>{const key=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'));const session=JSON.parse(localStorage.getItem(key));const r=await fetch('/api/admin/students',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};},body);}
test('create user rejects anonymous access',async({request})=>{expect((await request.get('/api/admin/students')).status()).toBe(401);expect((await request.post('/api/admin/students',{data:{}})).status()).toBe(401);});
test('Admin Viewer cannot create students',async({page})=>{await adminLogin(page,'viewer');expect((await adminRequest(page,{})).status).toBe(403);await page.goto('/admin/create-user');await expect(page.getByRole('main').getByRole('alert')).toHaveText('Full Admin permission required.',{timeout:30000});await expect(page.getByRole('button',{name:'Submit',exact:true})).toHaveCount(0);});
for(const membership of ['FREE','PAID'])test('Full Admin creates verified '+membership+' student with consistent Class 12 membership',async({page,browser})=>{
 test.setTimeout(180000);
 const run=process.env.GITHUB_RUN_ID;if(!/^\d+$/.test(run||''))throw Error('Run identity required for scoped fixture cleanup');
 const email=`qa_admin_create_${run}_${process.env.GITHUB_RUN_ATTEMPT||1}_${membership.toLowerCase()}@example.com`;
 const password=randomBytes(24).toString('base64url')+'aA1!';
 await adminLogin(page,'full');await page.getByRole('link',{name:'Create user →',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Create user',exact:true})).toBeVisible();
 await page.getByLabel('Full name',{exact:true}).fill('QA Admin Created '+membership);
 await page.getByLabel('Email ID',{exact:true}).fill(email);
 await page.locator('input[type=password]').fill(password);
 await expect.poll(()=>page.getByRole('combobox').first().locator('option').count()).toBeGreaterThan(1);
 await page.getByRole('combobox').first().selectOption({label:'Class 12'});await page.getByLabel('Free / Paid',{exact:true}).selectOption(membership);
 const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/admin/students')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Submit',exact:true}).click();const response=await responsePromise;
 expect(response.status()).toBe(201);const result=(await response.json()).student;
 expect(result.email_verified).toBe(true);expect(result.membership).toBe(membership);
 if(membership==='PAID'){const duration=new Date(result.end_date)-new Date(result.start_date);expect(duration).toBeGreaterThan(392*86400000);expect(duration).toBeLessThan(399*86400000);}
 else expect(result.end_date).toBeNull();
 await expect(page.getByRole('heading',{name:'Student account created',exact:true})).toBeVisible();
 const retry=await adminRequest(page,response.request().postDataJSON());expect(retry.status).toBe(200);expect(retry.data.alreadyCreated).toBe(true);expect(retry.data.student.user_id).toBe(result.user_id);
 const context=await browser.newContext();const student=await context.newPage();
 try{
  await student.goto('/app');await student.getByRole('button',{name:/^sign in$/i}).first().click();const d=student.getByRole('dialog',{name:'Student sign in'});
  await d.locator('input[type=email]').fill(email);await d.locator('input[type=password]').fill(password);await d.getByRole('button',{name:/^sign in$/i}).click();
  await expect(student.getByRole('heading',{name:/what will you learn today/i})).toBeVisible({timeout:30000});
  const button=student.getByRole('button',{name:membership==='PAID'?/Manage membership/i:/Membership plans/i}).first();await expect(button).toBeVisible({timeout:30000});await button.click();
  await expect(student.getByRole('heading',{name:'Plans and classes',exact:true})).toBeVisible({timeout:30000});await expect(student.getByRole('radio')).toHaveCount(7);
  await expect(student.getByLabel('Activation',{exact:true})).toHaveCount(0);await student.getByRole('radio',{name:/Class 12/}).check();
  await expect(student.getByPlaceholder('Enter coupon code')).toBeVisible();
  if(membership==='FREE'){await student.getByPlaceholder('Enter coupon code').fill('FREETRIAL');await student.getByRole('button',{name:'Review plan and dates',exact:true}).click();await expect(student.getByRole('button',{name:'Confirm membership activation',exact:true})).toBeVisible({timeout:30000});}
 }finally{await context.close();}
});
