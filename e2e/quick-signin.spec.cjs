const {test,expect}=require('@playwright/test');
test('Quick sign-in survives a stale initial anonymous session snapshot',async({page})=>{
 test.setTimeout(90000);
 const account=JSON.parse(process.env.E2E_ACCOUNTS_JSON||'[]').find(a=>a.email==='test_8_paid@gmail.com');
 if(!account)throw Error('Missing dedicated Class 8 paid QA account');
 let release;const gate=new Promise(resolve=>{release=resolve;});let delayed=false;
 await page.route('**/rest/v1/classes?*',async route=>{
  if(!delayed){delayed=true;await gate;}
  await route.continue();
 });
 try{
  await page.goto('/app');await page.getByRole('button',{name:'Sign In',exact:true}).first().click();
  const dialog=page.getByRole('dialog',{name:'Student sign in'});
  await dialog.locator('input[type=email]').fill(account.email);await dialog.locator('input[type=password]').fill(account.password);
  const profileStarted=page.waitForRequest(r=>r.url().includes('/rest/v1/student_profiles'));
  await dialog.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(dialog).toBeHidden();await profileStarted;release();
  await expect(page.getByRole('heading',{name:/what will you learn today/i})).toBeVisible({timeout:30000});
  await expect(page.getByRole('button',{name:/Premium Active/i}).first()).toBeVisible({timeout:30000});
  await expect(page.locator('#practice-subject')).toBeVisible();
 }finally{release();}
});
