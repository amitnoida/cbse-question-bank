const {test,expect}=require('@playwright/test');
test('Subject selection retries a transient count failure without downloading the question bank',async({page})=>{
 test.setTimeout(90000);
 const account=JSON.parse(process.env.E2E_ACCOUNTS_JSON||'[]').find(a=>a.email==='test_10_paid@gmail.com');
 if(!account)throw Error('Missing Class 10 paid QA account');
 let bodyRequests=0;let countCalls=0;
 page.on('request',request=>{if(request.url().includes('/rpc/cbse_subject_practice_questions_v2'))bodyRequests++;});
 await page.route('**/rpc/cbse_selection_counts_v1',async route=>{
  if(countCalls++===0)await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({code:'57014',message:'Simulated temporary timeout'})});
  else await route.continue();
 });
 await page.goto('/app');await page.getByRole('button',{name:'Sign In',exact:true}).first().click();
 const dialog=page.getByRole('dialog',{name:'Student sign in'});
 await dialog.locator('input[type=email]').fill(account.email);await dialog.locator('input[type=password]').fill(account.password);
 await dialog.getByRole('button',{name:'Sign In',exact:true}).click();
 await expect(page.getByRole('heading',{name:/what will you learn today/i})).toBeVisible({timeout:30000});
 await expect.poll(()=>page.locator('#practice-subject option').count()).toBeGreaterThan(1);
 await page.locator('#practice-subject').selectOption('Mathematics');
 await expect(page.getByRole('button',{name:/Start Next Mock Test|Resume Mock Test/})).toBeEnabled({timeout:30000});
 await expect(page.getByRole('button',{name:/Start \/ Resume Practice/})).toBeEnabled();
 expect(countCalls).toBe(2);expect(bodyRequests).toBe(0);
 await expect(page.getByRole('heading',{name:"We'll Be Back Shortly"})).toHaveCount(0);
});
