const { test, expect } = require('@playwright/test');
const accounts=JSON.parse(process.env.E2E_ACCOUNTS_JSON||'[]').filter(a=>a.kind==='admin');

async function openReports(page, account){
 await page.goto('/admin');
 await page.locator('input[type=email]').fill(account.email);
 await page.locator('input[type=password]').fill(account.password);
 await page.getByRole('button',{name:/^Sign in$/i}).click();
 await expect(page.getByRole('heading',{name:/Management overview/i})).toBeVisible({timeout:30000});
 await page.goto('/admin/reports');
 await expect(page.getByRole('heading',{name:'Reports & Admin Insights'})).toBeVisible();
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
 await expect(selector.locator('option')).toHaveCount(5);
 await page.getByRole('tab',{name:/Student Performance/i}).click();
 await expect(selector.locator('option')).toHaveCount(2);
 await page.getByRole('tab',{name:/Admin Operations/i}).click();
 await expect(selector.locator('option')).toHaveCount(5);
 await expect(page.getByRole('heading',{name:/About this report/i})).toBeVisible();
 await page.getByRole('tab',{name:/Technical & Database/i}).click();
 await expect(selector.locator('option')).toHaveCount(4);
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
 await expect(page.getByRole('tab',{name:/Admin Operations/i})).toBeDisabled();
 await expect(page.getByRole('tab',{name:/Technical & Database/i})).toBeDisabled();
 await page.getByRole('tab',{name:/Student Performance/i}).click();
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

test('Full Admin: live function and RLS policy metadata, pagination and CSV export',async({page})=>{
 test.setTimeout(180000);
 const account=accounts.find(a=>/full/i.test(a.email));
 if(!account)throw Error('Missing Full Admin test account');
 await openReports(page,account);
 await page.getByRole('tab',{name:/Technical & Database/i}).click();
 const selector=page.getByRole('combobox',{name:'Select report'});
 await selector.selectOption('function-audit');
 await expect(page.getByText('Matching records',{exact:true})).toBeVisible({timeout:45000});
 await expect(page.getByRole('combobox',{name:'Filter by status'})).toBeVisible();
 await expect(page.getByRole('button',{name:/Export ALL matching rows/i})).toBeEnabled();
 await selector.selectOption('rls-policies');
 await expect(page.getByText('Matching records',{exact:true})).toBeVisible({timeout:45000});
 const responses=await page.evaluate(async()=>{
  const key=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'));
  if(!key)return {error:'No stored session'};
  const token=JSON.parse(localStorage.getItem(key)).access_token;
  const make=(path)=>fetch(path,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
  const functions=await make('/api/admin/reports?report=function-audit&page=1');
  const fn=await functions.json();
  const page2=await make('/api/admin/reports?report=function-audit&page=2');
  const fn2=await page2.json();
  const policies=await make('/api/admin/reports?report=rls-policies');
  const rls=await policies.json();
  const csv=await make('/api/admin/reports?report=rls-policies&mode=csv');
  const csvText=await csv.text();
  const matching=await make('/api/admin/reports?report=function-audit&status=definer&search=admin');
  const matchData=await matching.json();
  return {
   statuses:[functions.status,page2.status,policies.status,csv.status,matching.status],
   fnTotal:fn.total,fnCount:fn.rows?.length,fnPage2:fn2.rows?.length,
   fnColumns:fn.columns,fnSample:fn.rows?.[0],
   rlsTotal:rls.total,rlsCount:rls.rows?.length,rlsColumns:rls.columns,rlsSample:rls.rows?.[0],
   csvHeader:csvText.split(/\r\n/)[0],csvLines:csvText.split(/\r\n/).filter(Boolean).length,
   matchTotal:matchData.total,
  };
 });
 expect(responses.error).toBeUndefined();
 expect(responses.statuses).toEqual([200,200,200,200,200]);
 expect(responses.fnTotal).toBeGreaterThan(50);
 expect(responses.fnCount).toBe(50);
 expect(responses.fnPage2).toBeGreaterThan(0);
 expect(responses.fnColumns).toContain('anon_execute');
 expect(responses.fnColumns).toContain('rls_enabled');
 expect(responses.rlsTotal).toBeGreaterThan(0);
 expect(responses.rlsColumns).toContain('using_expression');
 expect(responses.rlsColumns).toContain('check_expression');
 expect(responses.csvHeader).toContain('using_expression');
 expect(responses.csvLines).toBe(responses.rlsTotal+1);
});
test('Viewer cannot access either security metadata report via API',async({page})=>{
 test.setTimeout(120000);
 const account=accounts.find(a=>/viewer/i.test(a.email));
 if(!account)throw Error('Missing Viewer Admin test account');
 await openReports(page,account);
 const statuses=await page.evaluate(async()=>{
  const key=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'));
  if(!key)return [];
  const token=JSON.parse(localStorage.getItem(key)).access_token;
  const urls=['function-audit','rls-policies'].flatMap(id=>[
   '/api/admin/reports?report='+id,
   '/api/admin/reports?report='+id+'&mode=csv',
  ]);
  return Promise.all(urls.map(async url=>(await fetch(url,{headers:{Authorization:'Bearer '+token}})).status));
 });
 expect(statuses).toEqual([403,403,403,403]);
});

test('Full Admin: Image & Media Audit excludes empty JSON placeholders and includes unresolved assets',async({page})=>{
  test.setTimeout(120000);
  const account=accounts.find(a=>/full/i.test(a.email));
  if(!account)throw new Error('Missing Full Admin');
  await openReports(page,account);
  const data=await page.evaluate(async()=>{
    const key=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'));
    if(!key)return {error:'No session'};
    const auth=JSON.parse(localStorage.getItem(key));
    const response=await fetch('/api/admin/reports?report=media-audit&mode=data&page=1',{headers:{Authorization:'Bearer '+auth.access_token}});
    const body=await response.json();
    return {status:response.status,body};
  });
  expect(data.error).toBeUndefined();
  expect(data.status).toBe(200);
  // The media pool changes after archive/cleanup operations; do not hardcode historical totals.
  // Ensure the current report is populated, paginated and free of empty-media placeholders.
  expect(data.body.total).toBeGreaterThan(0);
  expect(data.body.rows).toHaveLength(Math.min(50,data.body.total));
  for(const row of data.body.rows){
    expect(row.media_ready===false || (row.question_media&&Object.keys(row.question_media).length>0)).toBeTruthy();
  }
});
