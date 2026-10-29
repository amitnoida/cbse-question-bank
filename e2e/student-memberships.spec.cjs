const {test,expect}=require('@playwright/test');
const accounts=JSON.parse(process.env.E2E_ACCOUNTS_JSON||'[]').filter(a=>a.kind==='student'&&/^test_(8|9|10|11|12)_(free|paid)@gmail[.]com$/.test(a.email));
if(accounts.length!==10)throw Error('Expected ten dedicated school accounts');
async function login(page,a){await page.goto('/app');await page.getByRole('button',{name:/^sign in$/i}).first().click();const d=page.getByRole('dialog',{name:'Student sign in'});await d.locator('input[type=email]').fill(a.email);await d.locator('input[type=password]').fill(a.password);await d.getByRole('button',{name:/^sign in$/i}).click();await expect(page.getByRole('heading',{name:/what will you learn today/i})).toBeVisible({timeout:30000});}
for(const [i,a] of accounts.entries())test('school account '+(i+1)+': membership and class selection',async({page})=>{
 await login(page,a);
 const paid=/_paid@/.test(a.email);
 await expect(page.getByRole('button',{name:paid?/Manage membership/i:/Membership plans/i}).first()).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:paid?/Manage membership/i:/Membership plans/i}).first().click();
 await expect(page).toHaveURL(/\/memberships$/);
 await expect(page.getByRole('heading',{name:'Your available classes',exact:true})).toBeVisible({timeout:30000});
 const classNumber=a.email.match(/test_(\d+)_/)[1];
 await expect(page.getByRole('button',{name:new RegExp('Class '+classNumber+' · Selected')})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Your memberships',exact:true})).toBeVisible();
 if(!paid){
  const plan=page.getByRole('combobox').first();
  await expect(plan).toBeVisible();
  await expect.poll(()=>plan.locator('option').count()).toBeGreaterThan(1);
  const value=await plan.locator('option').evaluateAll(options=>options.find(o=>o.value)?.value);
  expect(value).toBeTruthy();await plan.selectOption(value);
  await page.getByRole('button',{name:'Review plan and dates',exact:true}).click();
  await expect(page.getByText(/Online payment is not available yet/)).toBeVisible({timeout:30000});
  await expect(page.getByRole('button',{name:'Confirm membership activation',exact:true})).toHaveCount(0);
 }
 if(i===0){await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
});
test('anonymous membership page cannot disclose account details',async({page})=>{await page.goto('/memberships');await expect(page.getByRole('link',{name:'Sign in to your student account'})).toBeVisible({timeout:30000});await expect(page.getByRole('heading',{name:'Your memberships',exact:true})).toHaveCount(0);});
