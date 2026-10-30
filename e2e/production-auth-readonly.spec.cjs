const {test,expect}=require('@playwright/test');

const accounts=JSON.parse(process.env.E2E_ACCOUNTS_JSON||'[]');
const admins=accounts.filter(a=>a.kind==='admin');
const students=accounts.filter(a=>a.kind==='student');

async function adminLogin(page,account){
 await page.goto('/admin');
 await page.locator('input[type=email]').fill(account.email);
 await page.locator('input[type=password]').fill(account.password);
 await page.getByRole('button',{name:/^Sign in$/i}).click();
 await expect(page.getByRole('heading',{name:/Management overview/i})).toBeVisible({timeout:30000});
}

test('Production: full admin reports catalog is accessible to a signed-in Full Admin',async({page})=>{
 const account=admins.find(a=>/full/i.test(a.email));
 if(!account)throw Error('Dedicated Full Admin E2E account is missing');
 await adminLogin(page,account);
 const result=await page.evaluate(async()=>{
  const k=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'));
  const token=k&&JSON.parse(localStorage.getItem(k)||'{}').access_token;
  if(!token)return {error:'No authenticated session'};
  const r=await fetch('/api/admin/reports?mode=catalog',{headers:{Authorization:'Bearer '+token}});
  if(!r.ok)return {status:r.status};
  const json=await r.json();
  return {status:r.status,role:json.role,count:json.reports?.length};
 });
 expect(result).toMatchObject({status:200,role:'FULL_ADMIN',count:19});
});

test('Production: viewer cannot fetch private student-directory or security reports',async({page})=>{
 const account=admins.find(a=>/viewer/i.test(a.email));
 if(!account)throw Error('Dedicated viewer admin E2E account is missing');
 await adminLogin(page,account);
 const result=await page.evaluate(async()=>{
  const k=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'));
  const token=k&&JSON.parse(localStorage.getItem(k)||'{}').access_token;
  if(!token)return {error:'No authenticated session'};
  const headers={Authorization:'Bearer '+token};
  const catalog=await fetch('/api/admin/reports?mode=catalog',{headers});
  const c=await catalog.json();
  const priv=await fetch('/api/admin/reports?report=student-directory',{headers});
  const tech=await fetch('/api/admin/reports?report=function-audit',{headers});
  return {role:c.role,privateStatus:priv.status,techStatus:tech.status,visible:c.reports?.length};
 });
 expect(result.role).not.toBe('FULL_ADMIN');
 expect(result.privateStatus).toBe(403);
 expect(result.techStatus).toBe(403);
 expect(result.visible).toBeGreaterThan(0);
});

test('Production: representative free student can sign in and view dashboard',async({page})=>{
 const account=students.find(a=>a.email==='test_9_free@gmail.com');
 if(!account)throw Error('Dedicated Class 9 test student is missing');
 await page.goto('/app');
 await page.getByRole('button',{name:/^sign in$/i}).first().click();
 const dialog=page.getByRole('dialog',{name:'Student sign in'});
 await dialog.locator('input[type=email]').fill(account.email);
 await dialog.locator('input[type=password]').fill(account.password);
 await dialog.getByRole('button',{name:/^sign in$/i}).click();
 await expect(page.getByRole('heading',{name:/what will you learn today/i})).toBeVisible({timeout:30000});
});
