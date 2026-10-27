const { test, expect } = require('@playwright/test');
const accounts = JSON.parse(process.env.E2E_ACCOUNTS_JSON || '[]');
const student = accounts.filter(a => a.kind === 'student');
const admin = accounts.filter(a => a.kind === 'admin');
const by = (pattern) => student.find(a => pattern.test(a.email));
async function loginStudent(page, account) {
  await page.goto('/app');
  await page.getByRole('button', {name:/^sign in$/i}).first().click();
  const dialog=page.getByRole('dialog',{name:'Student sign in'});
  await dialog.locator('input[type=email]').fill(account.email);
  await dialog.locator('input[type=password]').fill(account.password);
  await dialog.getByRole('button',{name:/^sign in$/i}).click();
  await expect(page.getByRole('heading',{name:/what will you learn today/i})).toBeVisible({timeout:30000});
}
async function chooseSubject(page) {
  const select=page.locator('#practice-subject');
  await expect.poll(async()=>select.locator('option').count(),{timeout:30000}).toBeGreaterThan(1);
  const options=await select.locator('option').evaluateAll(els=>els.map(e=>({value:e.value,label:e.textContent.trim()})).filter(e=>e.value!=='all' && e.value));
  if(!options.length) throw new Error('No active subjects available for enrolled class');
  await select.selectOption(options[0].value);
  await expect(page.getByRole('button',{name:/Start \/ Resume Practice/i})).toBeEnabled({timeout:30000});
  return options[0];
}
for (const account of student) {
  test('subject navigation and membership: ' + account.email, async ({page}) => {
    test.setTimeout(90000);
    await loginStudent(page,account);
    await expect(page.locator('#student-field-12')).toBeDisabled();
    const select=page.locator('#practice-subject');
    await expect.poll(async()=>select.locator('option').count(),{
      timeout:30000,
      message:'No subject options loaded for '+account.email+'; investigate active subjects/class configuration'
    }).toBeGreaterThan(1);
    await chooseSubject(page);
    const paid=account.email.endsWith('_paid@gmail.com');
    await expect(page.getByRole('button',{name:paid?/Premium Active/i:/Subscribe ₹99/i}).first()).toBeVisible({timeout:30000});
    if(!paid) await expect(page.getByText(/Real Mock Tests require a paid membership/i)).toBeVisible();
    await page.getByRole('link',{name:/Dashboard/i}).first().click();
    await expect(page).toHaveURL(/dashboard/);
  });
}
test('admin role restrictions: full administrator vs viewer',async({browser})=>{
  test.setTimeout(180000);
  for(const account of admin){
    const page=await browser.newPage();
    try{
      await page.goto('/admin');
      await page.locator('input[type=email]').fill(account.email);
      await page.locator('input[type=password]').fill(account.password);
      await page.getByRole('button',{name:/^sign in$/i}).click();
      await expect(page.getByRole('heading',{name:'Management overview'})).toBeVisible({timeout:30000});
      await page.goto('/admin/upgrade');
      const viewer=/viewer/i.test(account.email);
      await expect(page.locator('p').filter({hasText:'Your role:'}).locator('strong')).toHaveText(viewer?'Admin Viewer':'Full Admin',{timeout:30000});
      if(viewer){
        await expect(page.getByRole('button',{name:/Create admin and email temporary password/i})).toHaveCount(0);
        await expect(page.getByRole('button',{name:/Schedule announcement/i})).toHaveCount(0);
      }else{
        await expect(page.getByRole('button',{name:/Create admin and email temporary password/i})).toBeVisible();
      }
    }finally{await page.close();}
  }
});
// These two tests intentionally write only to dedicated E2E student accounts.
// Practice answers consume free allowance and submissions create attempt history.
test('free student: practice answer, feedback, submission and dashboard history',async({page})=>{
  test.setTimeout(180000);
  const account=by(/test_9_free@gmail\.com$/i);
  if(!account) throw Error('Missing class 9 free test account');
  await loginStudent(page,account);
  await chooseSubject(page);
  // The free-usage alert is populated asynchronously after subject selection.
  // Wait for either the exhausted allowance or the enabled practice action.
  const limitAlert=page.getByRole('alert').filter({hasText:'Free question limit reached'});
  const practiceStart=page.getByRole('button',{name:/Start \/ Resume Practice/i});
  await expect.poll(async()=>{
    if(await limitAlert.isVisible()) return 'exhausted';
    if(await practiceStart.isEnabled()) return 'ready';
    return 'loading';
  },{timeout:30000}).not.toBe('loading');
  if(await limitAlert.isVisible()) {
    await expect(page.getByText(/10 \/ 10 used/i)).toBeVisible();
    test.info().annotations.push({type:'coverage',description:'Class 9 free Mathematics allowance exhausted: limit guard verified; answer/submission/history journey not exercised'});
    return;
  }
  await practiceStart.click();
  const questionHeading=page.getByRole('heading',{level:2,name:/^Question\\s+\\d+\\s+of\\s+\\d+$/i});
  await expect.poll(async()=>{
    if(await limitAlert.isVisible()) return 'exhausted';
    if(await questionHeading.isVisible()) return 'question';
    return 'loading';
  },{timeout:30000}).not.toBe('loading');
  if(await limitAlert.isVisible()) {
    await expect(page.getByText(/10 \/ 10 used/i)).toBeVisible();
    test.info().annotations.push({type:'coverage',description:'Class 9 free allowance exhausted after practice start: limit guard verified; full practice journey not exercised'});
    return;
  }
  await expect(questionHeading).toBeVisible();
  const answer=page.locator('button[aria-pressed]').first();
  if(await page.getByRole('button',{name:'Submit Answer'}).isVisible()){
    await answer.click();
    await page.getByRole('button',{name:'Submit Answer'}).click();
    await expect(page.getByText(/Correct answer:/i)).toBeVisible({timeout:30000});
  }
  await page.getByRole('button',{name:/Finish \/ Review Practice Test/i}).click();
  const confirmation=page.getByRole('region',{name:'Confirm practice submission'});
  if(await confirmation.isVisible()) await confirmation.getByRole('button',{name:'Submit Anyway'}).click();
  await expect(page.getByText('Practice Test Result',{exact:true})).toBeVisible({timeout:30000});
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard/);
});
test('paid student: 60-question mock, answer persistence and result',async({page})=>{
  test.setTimeout(180000);
  const account=by(/test_9_paid@gmail\.com$/i);
  if(!account) throw Error('Missing class 9 paid test account');
  await loginStudent(page,account);
  await chooseSubject(page);
  const start=page.getByRole('button',{name:/Start Next Mock Test|Resume Mock Test|Start Mock Test|Retake Mock/i}).first();
  const unavailable=page.getByRole('button',{name:/Need 48 MOCK and 12 SHARED questions/i});
  if(await unavailable.isVisible()){
    test.info().annotations.push({type:'blocked',description:'Insufficient eligible 48 MOCK + 12 SHARED question pool'});
    test.skip(true,'Mock pool lacks 48 MOCK + 12 SHARED questions');
  }
  await expect(start).toBeEnabled({timeout:30000});
  await start.click();
  await expect(page.getByRole('heading',{name:/Question 1 of 60/i})).toBeVisible({timeout:30000});
  await page.locator('button[aria-pressed]').first().click();
  await expect(page.getByText(/Answered: 1 \/ 60/)).toBeVisible({timeout:30000});
  await page.getByRole('button',{name:/Finish \/ Review Mock Test/i}).click();
  await page.getByRole('region',{name:'Confirm mock submission'}).getByRole('button',{name:'Submit Anyway'}).click();
  await expect(page.getByText('Real Mock Test Result',{exact:true})).toBeVisible({timeout:30000});
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard/);
});
