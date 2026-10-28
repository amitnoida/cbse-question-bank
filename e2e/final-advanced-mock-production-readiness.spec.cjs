// Final production readiness/negative-gate checks — read-only UI flows.
// The 3 ready-subject paid/free full-journey tests are separate specs in the SAME workflow run.
// Uses only existing dedicated school E2E credentials. No student account modifications.
const {test,expect}=require('@playwright/test');
let all;
try{all=JSON.parse(process.env.E2E_ACCOUNTS_JSON||'null');}
catch{throw new Error('E2E_ACCOUNTS_JSON must contain configured credentials');}
if(!Array.isArray(all))throw new Error('E2E_ACCOUNTS_JSON secret not configured');
const get=(classNumber,plan)=>{
 const email='test_'+classNumber+'_'+plan+'@gmail.com';
 const acc=all.find(a=>a.email?.toLowerCase()===email);
 if(!acc||typeof acc.password!=='string')throw new Error('Missing designated '+email);
 return acc;
};
async function login(page,acc) {
 await page.goto('/app');
 const sign=page.getByRole('button',{name:/^sign in$/i}).first();
 await expect(sign).toBeVisible({timeout:30000});
 await sign.click();
 const dialog=page.getByRole('dialog',{name:'Student sign in'});
 await expect(dialog).toBeVisible();
 await dialog.locator('input[type=email]').fill(acc.email);
 await dialog.locator('input[type=password]').fill(acc.password);
 await dialog.getByRole('button',{name:/^sign in$/i}).click();
 await expect(dialog).toBeHidden({timeout:30000});
}
async function assertSubject(page,subject,count,ready){
 const select=page.locator('#advanced-subject');
 await expect(select).toBeVisible({timeout:30000});
 await select.selectOption({label:subject});
 await expect(select.locator('option:checked')).toHaveText(subject,{timeout:30000});
 const countNode=page.getByText('Released questions',{exact:true}).locator('..').locator('p').nth(1);
 await expect(countNode).toHaveText(/^\\d+$/,{timeout:30000});
 const reported=Number(await countNode.textContent());
 // Other academic agents may add valid releases while CI is running; the UI must
 // show at least the previously reconciled pool, and preserve the 60-item gate.
 expect(reported).toBeGreaterThanOrEqual(count);
 if(ready)expect(reported).toBeGreaterThanOrEqual(60);
 else expect(reported).toBeLessThan(60);
 const unavailable=page.getByText('Advanced Mock questions are being academically reviewed.',{exact:false});
 if(ready){
  await expect(unavailable).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Start Next Advanced Mock'})).toBeEnabled({timeout:20000});
 }else{
  await expect(unavailable).toBeVisible();
  await expect(page.getByRole('button',{name:'Start Next Advanced Mock'})).toBeDisabled();
 }
}
test('Class 11 paid: live subject counts; Chemistry, Mathematics and Biology insufficient for 60',async({page})=>{
 test.setTimeout(150000);
 await login(page,get(11,'paid'));
 await page.goto('/advanced-mock?subject=Biology');
 await expect(page.getByRole('heading',{name:'Advanced Mock Test',exact:true})).toBeVisible({timeout:30000});
 await assertSubject(page,'Biology',0,false);
 await assertSubject(page,'Chemistry',38,false);
 await assertSubject(page,'Mathematics',13,false);
 // Positive eligibility for released Class 11 Physics, but actual start/finish is exercised in full-journey spec.
 await assertSubject(page,'Physics',75,true);
});
test('Class 12 paid: live subject counts; Physics and Mathematics insufficient for 60',async({page})=>{
 test.setTimeout(150000);
 await login(page,get(12,'paid'));
 await page.goto('/advanced-mock?subject=Physics');
 await expect(page.getByRole('heading',{name:'Advanced Mock Test',exact:true})).toBeVisible({timeout:30000});
 await assertSubject(page,'Physics',22,false);
 await assertSubject(page,'Mathematics',17,false);
 await assertSubject(page,'Chemistry',99,true);
 await assertSubject(page,'Biology',110,true);
});
test('Class 10 paid student cannot access Class 11/12 Advanced Mock',async({page})=>{
 test.setTimeout(90000);
 await login(page,get(10,'paid'));
 await page.goto('/advanced-mock');
 await expect(page.getByText('Advanced Mock Tests are available for Class 11 and Class 12 students only.')).toBeVisible({timeout:30000});
 await expect(page.locator('#advanced-subject')).toHaveCount(0);
});
