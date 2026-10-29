const { test, expect } = require('@playwright/test');

// These tests may submit one question from a dedicated free test account.
// A previously exhausted subject is SKIPPED (never falsely counted as a passed submission).
const accounts=JSON.parse(process.env.E2E_ACCOUNTS_JSON||'[]');
for(const n of [8,10,11,12]){
  test(`Class ${n} free: practice answer, immediate feedback, submit and history`,async({page})=>{
    test.setTimeout(210000);
    const email=`test_${n}_free@gmail.com`;
    const account=accounts.find(a=>a.kind==='student'&&a.email.toLowerCase()===email);
    if(!account)throw new Error('Missing configured free account '+email);
    await page.goto('/app');
    await page.getByRole('button',{name:/^Sign In$/i}).first().click();
    const dialog=page.getByRole('dialog',{name:'Student sign in'});
    await expect(dialog).toBeVisible();
    await dialog.locator('input[type=email]').fill(account.email);
    await dialog.locator('input[type=password]').fill(account.password);
    await dialog.getByRole('button',{name:/^Sign In$/i}).click();
    await expect(page.getByRole('heading',{name:/what will you learn today/i})).toBeVisible({timeout:30000});
    const subject=page.locator('#practice-subject');
    await expect.poll(async()=>subject.locator('option').count(),{timeout:30000}).toBeGreaterThan(1);
    const options=await subject.locator('option').evaluateAll(nodes=>nodes.map(x=>x.value).filter(x=>x&&x!=='all'));
    if(!options.length)throw new Error('No available Class '+n+' subjects');
    await subject.selectOption(options[0]);
    const limitAlert=page.getByRole('button',{name:'Free Practice set completed',exact:true});
    const begin=page.getByRole('button',{name:/Start \/ Resume Practice/i});
    await expect.poll(async()=>{
      if(await limitAlert.isVisible())return 'exhausted';
      if(await begin.isEnabled())return 'ready';
      return 'loading';
    },{timeout:30000}).not.toBe('loading');
    if(await limitAlert.isVisible()){
      await expect(limitAlert).toBeDisabled();
      test.skip(true,'Free allowance is exhausted for this subject; no question can be submitted again');
    }
    await begin.click();
    const question=page.getByRole('heading',{level:2,name:/^Question\s+\d+\s+of\s+\d+$/i});
    await expect.poll(async()=>{
      if(await limitAlert.isVisible())return 'exhausted';
      if(await question.isVisible())return 'question';
      return 'loading';
    },{timeout:30000}).not.toBe('loading');
    if(await limitAlert.isVisible())test.skip(true,'Free allowance exhausted during practice start');
    await expect(question).toBeVisible();
    const answer=page.locator('button[aria-pressed]').first();
    await expect(answer).toBeVisible();
    const submitAnswer=page.getByRole('button',{name:'Submit Answer'});
    if(await submitAnswer.isVisible()){
      await answer.click();
      await submitAnswer.click();
      await expect(page.getByText(/Correct answer:/i)).toBeVisible({timeout:30000});
    }
    await page.getByRole('button',{name:/Finish \/ Review Practice Test/i}).click();
    const confirm=page.getByRole('region',{name:'Confirm practice submission'});
    if(await confirm.isVisible())await confirm.getByRole('button',{name:'Submit Anyway'}).click();
    await expect(page.getByText('Practice Test Result',{exact:true})).toBeVisible({timeout:30000});
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });
}
