// Single consolidated post-release production Advanced Mock E2E for four parallel agents.
// Uses only configured 12 test accounts. Three 60-question paid submissions create
// isolated Advanced Mock attempt history in paid test accounts. No production MCQ edits.
const {test,expect}=require('@playwright/test');
const all=JSON.parse(process.env.E2E_ACCOUNTS_JSON||'null');
if(!Array.isArray(all))throw new Error('Missing E2E_ACCOUNTS_JSON');

function account(cls,plan) {
 const address='test_'+cls+'_'+plan+'@gmail.com';
 const a=all.find(x=>x.email?.toLowerCase()===address);
 if(!a||typeof a.password!=='string'||!a.password)throw new Error('Missing dedicated test account '+address);
 return a;
}
async function signIn(page,user) {
 await page.goto('/app');
 await page.getByRole('button',{name:/^sign in$/i}).first().click();
 const dlg=page.getByRole('dialog',{name:'Student sign in'});
 await expect(dlg).toBeVisible({timeout:30000});
 await dlg.locator('input[type=email]').fill(user.email);
 await dlg.locator('input[type=password]').fill(user.password);
 await dlg.getByRole('button',{name:/^sign in$/i}).click();
 await expect(dlg).toBeHidden({timeout:30000});
}
async function openSubject(page,name){
 await page.goto('/advanced-mock?subject='+encodeURIComponent(name));
 await expect(page.getByRole('heading',{name:'Advanced Mock Test',exact:true})).toBeVisible({timeout:30000});
 await expect(page.locator('#advanced-subject option:checked')).toHaveText(name,{timeout:30000});
 await expect(page.getByText('Released questions')).toBeVisible({timeout:30000});
}
test('Anonymous student cannot access Advanced Mock',async({page})=>{
 test.setTimeout(60000);
 await page.goto('/advanced-mock?subject=Physics');
 await expect(page.getByText('Please sign in to access Advanced Mock Tests.')).toBeVisible({timeout:30000});
 await expect(page.getByRole('button',{name:'Start Next Advanced Mock'})).toHaveCount(0);
});
for(const cls of [8,9,10]){
 test('Class '+cls+' cannot access Class 11/12 Advanced Mock',async({page})=>{
  test.setTimeout(90000);
  await signIn(page,account(cls,'free'));
  await page.goto('/advanced-mock?subject=Physics');
  await expect(page.getByText('Advanced Mock Tests are available for Class 11 and Class 12 students only.')).toBeVisible({timeout:30000});
  await expect(page.getByRole('button',{name:'Start Next Advanced Mock'})).toHaveCount(0);
 });
}
for(const [cls,subjects] of [[11,['Biology','Chemistry','Mathematics']],[12,['Physics','Mathematics']]]){
 test('Class '+cls+' under-60 subjects gated: '+subjects.join(', '),async({page})=>{
  test.setTimeout(170000);
  await signIn(page,account(cls,'paid'));
  for(const subject of subjects){
   await openSubject(page,subject);
   await expect(page.getByText(/Tests unlock when at least 60 questions in this subject have been approved/)).toBeVisible({timeout:30000});
   await expect(page.getByRole('button',{name:'Start Next Advanced Mock'})).toBeDisabled();
  }
 });
}
for(const [cls,subject] of [[11,'Physics'],[12,'Chemistry'],[12,'Biology']]){
 test('Class '+cls+' free blocked despite >=60 '+subject+' approved MCQs',async({page})=>{
  test.setTimeout(90000);
  await signIn(page,account(cls,'free'));
  await openSubject(page,subject);
  await expect(page.getByText('An active paid membership is required.')).toBeVisible({timeout:30000});
  await expect(page.getByRole('button',{name:'Start Next Advanced Mock'})).toBeDisabled();
 });
}
for(const [cls,subject] of [[11,'Physics'],[12,'Chemistry'],[12,'Biology']]){
 test('Class '+cls+' paid full 60-question '+subject+': assignment, autosave, resume, finish, history and PDF action',async({page})=>{
  test.setTimeout(480000);
  await signIn(page,account(cls,'paid'));
  await openSubject(page,subject);
  await expect(page.getByText(/Tests unlock when at least 60 questions/)).toHaveCount(0);
  const next=page.getByRole('button',{name:'Start Next Advanced Mock'});
  const resume=page.getByRole('button',{name:'Resume Advanced Mock'});
  await expect.poll(async()=>{
   return (await next.isVisible() && await next.isEnabled()) || await resume.isVisible();
  },{timeout:35000}).toBe(true);
  if(await resume.isVisible()) await resume.click();
  else await next.click();
  await expect(page.getByText('Question 1 of 60')).toBeVisible({timeout:30000});
  await expect(page.locator('[aria-label="Question navigation"] button')).toHaveCount(60);
  // Active answer/explanation must be withheld until submission.
  await expect(page.getByText('Correct answer:')).toHaveCount(0);
  const choices=()=>page.locator('div.space-y-3 > button');
  await expect(choices()).toHaveCount(4);
  await choices().first().click();
  await expect(choices().first()).toHaveClass(/bg-indigo-50/,{timeout:25000});
  // Persisted on server and survives browser reload.
  await page.reload();
  await expect(resume).toBeVisible({timeout:35000});
  await resume.click();
  await expect(page.getByText('Question 1 of 60')).toBeVisible({timeout:30000});
  await expect(choices().first()).toHaveClass(/bg-indigo-50/,{timeout:25000});
  for(let i=0;i<60;i++){
   await expect(page.getByText('Question '+(i+1)+' of 60')).toBeVisible({timeout:15000});
   const choice=choices().nth(i%4);
   await choice.click();
   await expect(choice).toHaveClass(/bg-indigo-50/,{timeout:15000});
   if(i<59)await page.getByRole('button',{name:'Next',exact:true}).click();
  }
  await expect(page.getByText('60 answered',{exact:false})).toBeVisible({timeout:15000});
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Submit test'}).click();
  await expect(page.getByText('Advanced Mock Test completed. Your result is saved.')).toBeVisible({timeout:45000});
  await expect(page.getByText('Correct answer:')).toHaveCount(1);
  const pdf=page.getByRole('button',{name:'Print / Save results as PDF'});
  await expect(pdf).toBeVisible();
  await page.evaluate(()=>{window.__finalPrintInvoked=false;window.print=()=>{window.__finalPrintInvoked=true};});
  await pdf.click();
  expect(await page.evaluate(()=>window.__finalPrintInvoked)).toBe(true);
  // Re-open stored completed paper via on-site history; no answer changes.
  await page.getByRole('button',{name:'Back to history'}).click();
  await expect(page.getByText('Your Advanced Mock history')).toBeVisible({timeout:30000});
  const completed=page.getByRole('button',{name:/Advanced (Mock|Retake) \d+ — COMPLETED/}).first();
  await expect(completed).toBeVisible();
  await completed.click();
  await expect(page.getByText('Correct answer:')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Print / Save results as PDF'})).toBeVisible();
 });
}
