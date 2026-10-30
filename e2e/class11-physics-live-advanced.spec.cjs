// Controlled production E2E for the released Class 11 Physics Advanced Mock.
// Only two dedicated existing test accounts; creates one Advanced Mock attempt for paid test account.
// No writes to public.questions, subscriptions, standard mock or other accounts.
const {test,expect}=require('@playwright/test');
const all=JSON.parse(process.env.E2E_ACCOUNTS_JSON||'null');
if(!Array.isArray(all))throw new Error('Missing E2E_ACCOUNTS_JSON secret');
const lookup=email=>{
 const acc=all.find(x=>x.email?.toLowerCase()===email);
 if(!acc||typeof acc.password!=='string')throw new Error('Missing expected test account: '+email);
 return acc;
};
const free=lookup('test_11_free@gmail.com');
const paid=lookup('test_11_paid@gmail.com');
async function login(page,acc){
 await page.goto('/app');
 const sign=page.getByRole('button',{name:/^sign in$/i}).first();
 await expect(sign).toBeVisible({timeout:30000});
 await sign.click();
 const form=page.getByRole('dialog',{name:'Student sign in'});
 await expect(form).toBeVisible();
 await form.locator('input[type=email]').fill(acc.email);
 await form.locator('input[type=password]').fill(acc.password);
 await form.getByRole('button',{name:/^sign in$/i}).click();
 await expect(form).toBeHidden({timeout:30000});
 await page.goto('/advanced-mock?subject=Physics');
 await expect(page.getByRole('heading',{name:'Advanced Mock Test',exact:true})).toBeVisible({timeout:30000});
 await expect(page.locator('#advanced-subject')).toHaveValue(/^\d+$/);
 await expect(page.locator('#advanced-subject option:checked')).toHaveText('Physics');
 await expect(page.getByText('Released questions')).toBeVisible();
 await expect(page.locator('section').first().getByText('60',{exact:true}).first()).toBeVisible({timeout:30000});
}

test('Class 11 free cannot start Physics Advanced Mock',async({page})=>{
 test.setTimeout(90000);
 await login(page,free);
 await expect(page.getByText('An active paid membership is required.')).toBeVisible({timeout:20000});
 await expect(page.getByRole('button',{name:'Start Next Advanced Mock'})).toBeDisabled();
});

test('Class 11 paid: start, save, reload, resume, answer all 60 and finish isolated Advanced Mock',async({page})=>{
 test.setTimeout(240000);
 await login(page,paid);
 await expect(page.getByRole('button',{name:'Start Next Advanced Mock'})).toBeEnabled({timeout:25000});
 await page.getByRole('button',{name:'Start Next Advanced Mock'}).click();
 await expect(page.getByText('Question 1 of 60')).toBeVisible({timeout:30000});
 await expect(page.getByText('Correct answer:')).toHaveCount(0);
 const choices=()=>page.locator('div.space-y-3 > button');
 await expect(choices()).toHaveCount(4);
 await choices().first().click();
 await expect(choices().first()).toHaveClass(/bg-indigo-50/);
 await page.reload();
 await expect(page.getByRole('button',{name:'Resume Advanced Mock'})).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'Resume Advanced Mock'}).click();
 await expect(page.getByText('Question 1 of 60')).toBeVisible({timeout:30000});
 await expect(choices().first()).toHaveClass(/bg-indigo-50/);
 for(let i=0;i<60;i++){
   await expect(page.getByText('Question '+(i+1)+' of 60')).toBeVisible({timeout:15000});
   const opt=choices().nth(i%4);
   await opt.click();
   await expect(opt).toHaveClass(/bg-indigo-50/,{timeout:15000});
   if(i<59)await page.getByRole('button',{name:'Next',exact:true}).click();
 }
 await expect(page.getByText('60 answered')).toBeVisible();
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Submit test'}).click();
 await expect(page.getByText('Advanced Mock Test completed. Your result is saved.')).toBeVisible({timeout:30000});
 await expect(page.getByRole('button',{name:'Print / Save results as PDF'})).toBeVisible();
 await expect(page.getByText('Correct answer:')).toHaveCount(1);
});
