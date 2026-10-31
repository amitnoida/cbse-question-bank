const {test,expect}=require('@playwright/test');
// Production-safe: no accounts, purchases, saved answers or email requests are created.
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('cbse-install-dismissed-until-v1',String(Date.now()+86400000)));
});
async function fits(page,selector){
 const bad=await page.locator(selector).evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.width&&r.height&&s.visibility!=='hidden'&&(r.left< -1||r.right>innerWidth+1)}).map(n=>({tag:n.tagName,text:n.textContent?.slice(0,80)})));
 expect(bad,'Visible content must fit the phone width').toEqual([]);
}
test('homepage navigation and actions fit portrait and landscape',async({page})=>{
 await page.goto('/');await expect(page.getByRole('link',{name:'Try 10 questions',exact:true})).toBeVisible();
 await fits(page,'h1,nav,a.ey-primary-action,a.ey-secondary-action');
 await page.setViewportSize({width:740,height:360});await fits(page,'h1,nav,a.ey-primary-action,a.ey-secondary-action');
});
test('signup inputs are readable, usable and do not cause focus zoom',async({page})=>{
 await page.goto('/app?auth=signup');const dialog=page.getByRole('dialog',{name:'Create student account'});
 await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'Create Account',exact:true})).toBeDisabled();
 const sizes=await dialog.locator('input:not([type=checkbox]):not([type=radio]),select').evaluateAll(ns=>ns.map(n=>parseFloat(getComputedStyle(n).fontSize)));
 expect(sizes.length).toBeGreaterThan(3);for(const size of sizes)expect(size).toBeGreaterThanOrEqual(16);
 await dialog.locator('input[type=email]').fill('mobile-check@example.invalid');
 await fits(page,'[role=dialog],[role=dialog] input,[role=dialog] select');
 await dialog.getByRole('button',{name:'Close signup'}).click();await expect(dialog).not.toBeVisible();
});
test('login and password recovery open without sending email',async({page})=>{
 await page.goto('/app');await page.getByRole('button',{name:'Continue to Sign In',exact:true}).click();
 const login=page.getByRole('dialog',{name:'Student sign in'});await expect(login).toBeVisible();
 await login.getByRole('button',{name:'Forgot password?',exact:true}).click();
 const recovery=page.getByRole('dialog',{name:'Request reset email'});await expect(recovery).toBeVisible();
 await recovery.locator('input[type=email]').fill('mobile-check@example.invalid');await fits(page,'[role=dialog],[role=dialog] input');
 await recovery.getByRole('button',{name:'← Back to Sign In',exact:true}).click();await expect(login).toBeVisible();
});
test('home-screen instructions replace floating install controls',async({page})=>{
 await page.goto('/');await page.getByRole('region',{name:'Optional website analytics'}).getByRole('button',{name:'Decline',exact:true}).click();
 await expect(page.getByRole('button',{name:/Install app/})).toHaveCount(0);
 await page.getByText('View Android and iPhone instructions',{exact:true}).click();
 await expect(page.getByRole('heading',{name:'Android · Chrome'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'iPhone · Safari'})).toBeVisible();
 await fits(page,'details,details section');
 await page.getByRole('link',{name:'Installation help',exact:true}).click();
 await expect(page).toHaveURL(/\/install$/);await expect(page.getByRole('heading',{name:'iPhone · Safari'})).toBeVisible();
});
test('demo finishes at signup with no start checkbox',async({page})=>{
 await page.goto('/try');await expect(page.getByRole('checkbox')).toHaveCount(0);
 await expect(page.getByRole('combobox').first().locator('option')).toHaveText(['Class 8','Class 9','Class 10','Class 11','Class 12']);
 await page.getByRole('combobox').first().selectOption('12');await page.getByRole('combobox').nth(1).selectOption('Science');
 await page.getByRole('button',{name:'Start my free demo'}).click();
 for(let i=1;i<=10;i++){
  await expect(page.getByText(`Question ${i} of 10`,{exact:false})).toBeVisible();
  await page.getByRole('radio').first().check();await page.getByRole('button',{name:'Check my answer',exact:true}).click();
  const next=page.getByRole('button',{name:i===10?'Finish':'Next question →',exact:true});await expect(next).toBeEnabled();
  await fits(page,'main h3,main fieldset,main button');await next.click();
 }
 await expect(page).toHaveURL(/\/app\?auth=signup$/);await expect(page.getByRole('heading',{name:'Create your account',exact:true})).toBeVisible();
});
test('manifest, icons and viewport support phone installation',async({request,page})=>{
 const response=await request.get('/manifest.webmanifest');expect(response.ok()).toBeTruthy();const manifest=await response.json();
 expect(manifest.display).toBe('standalone');expect(manifest.short_name).toBe('ExamShuru');
 for(const icon of manifest.icons)expect((await request.get(icon.src)).ok()).toBeTruthy();
 await page.goto('/');const viewport=await page.locator('meta[name=viewport]').getAttribute('content');expect(viewport).toContain('viewport-fit=cover');expect(viewport).not.toMatch(/user-scalable=no|maximum-scale=1/);
});

// Auth responses below are intercepted: no real account is created and no email is sent.
test('signup offers resend with the same email, correct callback and cooldown',async({page})=>{
 let sent=0;await page.clock.install();
 await page.route('**/auth/v1/signup**',route=>route.fulfill({json:{user:{id:'test-only',email:'mobile-check@example.invalid'},session:null}}));
 await page.route('**/auth/v1/resend**',async route=>{
  sent++;const body=route.request().postDataJSON();expect(body.type).toBe('signup');expect(body.email).toBe('mobile-check@example.invalid');
  expect(route.request().url()).toContain('redirect_to=https%3A%2F%2Fexamshuru.com%2Fauth%2Fcallback');
  await route.fulfill({json:{}});
 });
 await page.goto('/app?auth=signup');const d=page.getByRole('dialog',{name:'Create student account'});
 await d.getByLabel('Full Name',{exact:true}).fill('Mobile Test');await d.getByLabel('Email ID',{exact:true}).fill('mobile-check@example.invalid');
 await d.getByLabel('Password',{exact:true}).fill('Test-Only-Password-123!');await d.getByLabel('Confirm Password',{exact:true}).fill('Test-Only-Password-123!');
 await d.locator('select').selectOption({index:1});await d.getByRole('checkbox').check();
 await d.getByRole('button',{name:'Create Account',exact:true}).click();
 await expect(d.getByRole('button',{name:/Resend available in/})).toBeDisabled();
 await page.clock.fastForward(61000);
 await d.getByRole('button',{name:'Resend verification email',exact:true}).click();
 await expect(d.getByRole('status')).toContainText('new verification email has been requested');
 await expect(d.getByRole('button',{name:/Resend available in/})).toBeDisabled();expect(sent).toBe(1);
 await fits(page,'[role=dialog], [aria-label="Email verification help"]');
});
test('unconfirmed sign-in offers resend and handles rate limits',async({page})=>{
 await page.route('**/auth/v1/token**',route=>route.fulfill({status:400,headers:{'x-supabase-api-version':'2024-01-01'},json:{code:'email_not_confirmed',msg:'Email not confirmed'}}));
 await page.route('**/auth/v1/resend**',route=>route.fulfill({status:429,headers:{'x-supabase-api-version':'2024-01-01'},json:{code:'over_email_send_rate_limit',msg:'email rate limit exceeded'}}));
 await page.goto('/app');await page.getByRole('button',{name:'Continue to Sign In',exact:true}).click();
 const d=page.getByRole('dialog',{name:'Student sign in'});
 await d.getByLabel('Email ID',{exact:true}).fill('mobile-check@example.invalid');await d.getByLabel('Password',{exact:true}).fill('Test-Only-Password-123!');
 await d.getByRole('button',{name:'Sign In',exact:true}).click();
 await d.getByRole('button',{name:'Resend verification email',exact:true}).click();
 await expect(d.getByRole('status')).toContainText('Too many email requests');
 await expect(d.getByRole('button',{name:/Resend available in/})).toBeDisabled();
});
