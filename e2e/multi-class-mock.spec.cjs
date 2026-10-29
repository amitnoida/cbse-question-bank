const { test, expect } = require('@playwright/test');

// These tests only use dedicated E2E paid accounts. They create mock attempts,
// so they must run via manual workflow_dispatch, not on a nightly schedule.
const accounts=JSON.parse(process.env.E2E_ACCOUNTS_JSON||'[]');

async function loginPaidStudent(page, classNumber) {
  const email=`test_${classNumber}_paid@gmail.com`;
  const account=accounts.find(a=>a.kind==='student' && a.email.toLowerCase()===email);
  if(!account)throw new Error('Missing configured paid test account for Class '+classNumber);
  await page.goto('/app');
  await page.getByRole('button',{name:/^Sign In$/i}).first().click();
  const dialog=page.getByRole('dialog',{name:'Student sign in'});
  await expect(dialog).toBeVisible();
  await dialog.locator('input[type=email]').fill(account.email);
  await dialog.locator('input[type=password]').fill(account.password);
  await dialog.getByRole('button',{name:/^Sign In$/i}).click();
  await expect(page.getByRole('heading',{name:/what will you learn today/i})).toBeVisible({timeout:30000});
}
for(const classNumber of [8,10,11,12]){
  test(`Class ${classNumber} paid: begin, answer and submit 60-question real mock`,async({page})=>{
    test.setTimeout(210000);
    await loginPaidStudent(page,classNumber);
    const subject=page.locator('#practice-subject');
    await expect.poll(async()=>subject.locator('option').count(),{timeout:30000}).toBeGreaterThan(1);
    const values=await subject.locator('option').evaluateAll(items=>items.map(x=>x.value).filter(x=>x && x!=='all'));
    if(!values.length)throw new Error('No available subject for Class '+classNumber);
    await subject.selectOption(values[0]);
    const start=page.getByRole('button',{name:/Start Next Mock Test|Resume Mock Test|Resume Retake|Start Mock Test|Start Randomized Retake|Retake Mock/i}).first();
    await expect(start).toBeEnabled({timeout:30000});
    await start.click();
    await expect(page.getByRole('heading',{name:/Question \d+ of 60/i})).toBeVisible({timeout:30000});
    const option=page.locator('button[aria-pressed]').first();
    await expect(option).toBeVisible();
    await option.click();
    await expect(page.getByText(/Answered: [1-9]\d* \/ 60/)).toBeVisible({timeout:30000});
    await page.getByRole('button',{name:/Finish \/ Review Mock Test/i}).click();
    const confirm=page.getByRole('region',{name:'Confirm mock submission'});
    if(await confirm.isVisible())await confirm.getByRole('button',{name:'Submit Anyway'}).click();
    await expect(page.getByText('Real Mock Test Result',{exact:true})).toBeVisible({timeout:30000});
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });
}
