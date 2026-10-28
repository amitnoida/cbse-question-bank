// Post-deployment variable-length Advanced Mock E2E (dedicated Class 11 school test accounts).
// Run ONLY after dynamic frontend is in production; this test creates one test attempt.
const {test,expect}=require('@playwright/test');
const users=JSON.parse(process.env.E2E_ACCOUNTS_JSON||'[]');
const user=(cls,plan)=>{
 const email='test_'+cls+'_'+plan+'@gmail.com';
 const a=users.find(x=>x.email?.toLowerCase()===email);
 if(!a||!a.password)throw Error('Missing designated QA account '+email);
 return a;
};
async function signIn(page,a){
 await page.goto('/app');
 await page.getByRole('button',{name:/^sign in$/i}).first().click();
 const box=page.getByRole('dialog',{name:'Student sign in'});
 await expect(box).toBeVisible();
 await box.locator('input[type=email]').fill(a.email);
 await box.locator('input[type=password]').fill(a.password);
 await box.getByRole('button',{name:/^sign in$/i}).click();
 await expect(box).toBeHidden({timeout:30000});
}
async function subject(page,name){
 const select=page.locator('#advanced-subject');
 await expect(select).toBeVisible({timeout:30000});
 await select.selectOption({label:name});
 await expect(select.locator('option:checked')).toHaveText(name);
 const count=page.getByText('Released questions',{exact:true}).locator('..').locator('p').nth(1);
 await expect(count).toHaveText(/^\d+$/,{timeout:30000});
 return Number(await count.textContent());
}
test('Class 11: zero questions remains disabled; 14 and 38 question pools are eligible',async({page})=>{
 test.setTimeout(125000);
 await signIn(page,user(11,'paid'));
 await page.goto('/advanced-mock');
 expect(await subject(page,'Biology')).toBe(0);
 await expect(page.getByRole('button',{name:'Start Next Advanced Mock'})).toBeDisabled();
 for(const name of ['Mathematics','Chemistry']){
  const n=await subject(page,name);
  expect(n).toBeGreaterThan(0);expect(n).toBeLessThan(60);
  await expect(page.getByText('Test length',{exact:true}).locator('..').locator('p').nth(1)).toHaveText(n+' questions');
  await expect(page.getByRole('button',{name:'Start Next Advanced Mock'})).toBeEnabled();
 }
});
test('Class 11 free: smaller approved Chemistry pool is still paid-only',async({page})=>{
 test.setTimeout(90000);
 await signIn(page,user(11,'free'));
 await page.goto('/advanced-mock?subject=Chemistry');
 expect(await subject(page,'Chemistry')).toBeGreaterThan(0);
 await expect(page.getByText('An active paid membership is required.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Start Next Advanced Mock'})).toBeDisabled();
});
test('Class 11 paid: start a less-than-60 Chemistry paper, save, resume and score by actual count',async({page})=>{
 test.setTimeout(180000);
 await signIn(page,user(11,'paid'));
 await page.goto('/advanced-mock?subject=Chemistry');
 const n=await subject(page,'Chemistry');
 expect(n).toBeGreaterThan(0); expect(n).toBeLessThan(60);
 const next=page.getByRole('button',{name:'Start Next Advanced Mock'});
 const resume=page.getByRole('button',{name:'Resume Advanced Mock'});
 if(await resume.isVisible()) await resume.click();
 else {await expect(next).toBeEnabled();await next.click();}
 await expect(page.getByText('Question 1 of '+n)).toBeVisible({timeout:30000});
 await expect(page.getByRole('button',{name:/^Question \d+$/})).toHaveCount(n);
 const choice=page.locator('div.space-y-3 > button').first();
 await expect(choice).toBeVisible();
 await choice.click();
 await page.reload();
 await expect(resume).toBeVisible({timeout:30000});
 await resume.click();
 await expect(page.getByText('Question 1 of '+n)).toBeVisible();
 await expect(page.locator('div.space-y-3 > button').first()).toHaveClass(/bg-indigo-50/);
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Submit test'}).click();
 await expect(page.getByText('Advanced Mock Test completed. Your result is saved.')).toBeVisible({timeout:30000});
 await expect(page.getByText(new RegExp('\\\\d+/'+n+' correct'))).toBeVisible();
 await expect(page.getByRole('button',{name:'Print / Save results as PDF'})).toBeVisible();
});
