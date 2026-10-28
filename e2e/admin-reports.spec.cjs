const { test, expect } = require('@playwright/test');
const accounts=JSON.parse(process.env.E2E_ACCOUNTS_JSON||'[]').filter(a=>a.kind==='admin');

async function openReports(page, account){
 await page.goto('/admin');
 await page.locator('input[type=email]').fill(account.email);
 await page.locator('input[type=password]').fill(account.password);
 await page.getByRole('button',{name:/^Sign in$/i}).click();
 await expect(page.getByRole('heading',{name:/Management overview/i})).toBeVisible({timeout:30000});
 await page.goto('/admin/reports');
 await expect(page.getByRole('heading',{name:'Reports & Database Audit'})).toBeVisible();
 await expect(page.getByRole('tab',{name:/MCQ & Academic/i})).toBeVisible({timeout:30000});
}
test('Reports API must reject unauthenticated requests',async({request})=>{
 const response=await request.get('/api/admin/reports?mode=catalog');
 expect(response.status()).toBe(401);
});
test('Full Admin: all 19 reporting menus available and live MCQ summary renders',async({page})=>{
 test.setTimeout(180000);
 const account=accounts.find(a=>/full/i.test(a.email));
 if(!account)throw Error('Full Admin account is missing');
 await openReports(page,account);
 await expect(page.getByText('Full Admin',{exact:true})).toBeVisible();
 const selector=page.getByRole('combobox',{name:'Select report'});
 await expect(selector.locator('option')).toHaveCount(8);
 await page.getByRole('tab',{name:/Students & Business/i}).click();
 await expect(selector.locator('option')).toHaveCount(6);
 await page.getByRole('tab',{name:/Database, Security & Administration/i}).click();
 await expect(selector.locator('option')).toHaveCount(5);
 await page.getByRole('tab',{name:/MCQ & Academic/i}).click();
 await expect(page.getByText('Matching records',{exact:true})).toBeVisible({timeout:90000});
 const apiStatus=await page.evaluate(async()=>{
  const key=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'));
  if(!key)return 'no local token';
  const session=JSON.parse(localStorage.getItem(key));
  const r=await fetch('/api/admin/reports?mode=data&report=mcq-master&class=9&page=1',{headers:{Authorization:'Bearer '+session.access_token}});
  return r.status;
 });
 expect(apiStatus).toBe(200);
});
test('Viewer: MCQ and aggregate reports only; security and student identities restricted',async({page})=>{
 test.setTimeout(120000);
 const account=accounts.find(a=>/viewer/i.test(a.email));
 if(!account)throw Error('Viewer admin account is missing');
 await openReports(page,account);
 const selector=page.getByRole('combobox',{name:'Select report'});
 await expect(selector.locator('option')).toHaveCount(8);
 await expect(page.getByRole('tab',{name:/Database, Security & Administration/i})).toBeDisabled();
 await page.getByRole('tab',{name:/Students & Business/i}).click();
 await expect(selector.locator('option')).toHaveCount(2);
 await expect(selector.locator('option',{hasText:'Student Directory'})).toHaveCount(0);
 await expect(selector.locator('option',{hasText:'Subscription & Expiry'})).toHaveCount(0);
 const protectedStatus=await page.evaluate(async()=>{
  const key=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'));
  if(!key)return 'no local token';
  const saved=JSON.parse(localStorage.getItem(key));
  const r=await fetch('/api/admin/reports?mode=data&report=student-directory',{headers:{Authorization:'Bearer '+saved.access_token}});
  return r.status;
 });
 expect(protectedStatus).toBe(403);
});
