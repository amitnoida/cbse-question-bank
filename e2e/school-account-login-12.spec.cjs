// 12-account Stage 2 preview E2E: 10 school students + 2 admins. No MCQ submissions.
// Uses existing E2E_ACCOUNTS_JSON Actions secret; never logs passwords.
const {test,expect}=require('@playwright/test');
const previewHost=new URL(process.env.E2E_BASE_URL||'https://cbse-question-bank.vercel.app').hostname;
const previewProtected=previewHost!=='cbse-question-bank.vercel.app';
const token=process.env.E2E_VERCEL_BYPASS||'';
let all;
try{all=JSON.parse(process.env.E2E_ACCOUNTS_JSON||'null');}
catch{throw Error('E2E_ACCOUNTS_JSON is not valid JSON');}
if(!Array.isArray(all))throw Error('E2E_ACCOUNTS_JSON must contain configured test credentials');
const schoolPattern=/^test_(8|9|10|11|12)_(free|paid)@gmail\.com$/i;
const accounts=all.filter(a=>a&&typeof a.email==='string'&&(a.kind==='admin'||(a.kind==='student'&&schoolPattern.test(a.email))));
if(accounts.length!==12)throw Error('Expected exactly 12 school/admin accounts; actual count: '+accounts.length);
if(accounts.filter(a=>a.kind==='admin').length!==2)throw Error('Expected 2 admin test accounts');
if(accounts.filter(a=>a.kind==='student'&&schoolPattern.test(a.email)).length!==10)throw Error('Expected 10 Class 8–12 free/paid accounts');
const seen=new Set();
for(const a of accounts){
 if(typeof a.password!=='string'||a.password.length<1)throw Error('Test password missing');
 const email=a.email.toLowerCase();
 if(seen.has(email))throw Error('Duplicate test account email');
 seen.add(email);
}
for(const n of [8,9,10,11,12])for(const plan of ['free','paid']){
 if(!seen.has('test_'+n+'_'+plan+'@gmail.com'))throw Error('Required school account is missing');
}
// Strict host-scoped Vercel automation header; NEVER send to Supabase or external origins.
async function permitPreview(page){
 if(!previewProtected)return;
 if(!token)throw Error('Preview uses Vercel Authentication. Configure VERCEL_AUTOMATION_BYPASS_SECRET in GitHub Actions secrets; do not disable protection or expose token.');
 await page.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.hostname===previewHost){
   return route.continue({headers:{...request.headers(),'x-vercel-protection-bypass':token}});
  }
  return route.continue();
 });
}
async function signIn(page,account){
 await permitPreview(page);
 if(account.kind==='admin'){
  await page.goto('/admin');
  await expect(page.locator('input[type=email]')).toBeVisible({timeout:30000});
  await page.locator('input[type=email]').fill(account.email);
  await page.locator('input[type=password]').fill(account.password);
  await page.getByRole('button',{name:/^sign in$/i}).first().click();
  await expect(page.getByText('Administrator sign in')).toBeHidden({timeout:30000});
  await expect(page).toHaveURL(/\/admin/, {timeout:30000});
 }else{
  await page.goto('/app');
  const signin=page.getByRole('button',{name:/^sign in$/i}).first();
  await expect(signin).toBeVisible({timeout:30000});
  await signin.click();
  const dialog=page.getByRole('dialog',{name:'Student sign in'});
  await expect(dialog).toBeVisible();
  await dialog.locator('input[type=email]').fill(account.email);
  await dialog.locator('input[type=password]').fill(account.password);
  await dialog.getByRole('button',{name:/^sign in$/i}).click();
  await expect(dialog).toBeHidden({timeout:30000});
  await expect(page).toHaveURL(/\/(app|dashboard)(\/|$)/, {timeout:30000});
 }
}
for(let i=0;i<accounts.length;i++){
 const a=accounts[i],school=schoolPattern.exec(a.email);
 test('12-account school/admin login '+(i+1)+' '+(a.kind==='admin'?'admin':school?'Class '+school[1]:'unknown'), async({page})=>{
  test.setTimeout(120000);
  await signIn(page,a);
  if(a.kind==='student'){
   await page.goto('/app');
   await expect(page.getByRole('heading',{name:'Advanced Mock Test'})).toHaveCount(0);
   await expect(page.getByRole('link',{name:'Advanced Mock Tests'})).toHaveCount(0);
  }
 });
}
