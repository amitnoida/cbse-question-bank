const {test,expect}=require('@playwright/test');
const {finishMock}=require('./mock-helpers.cjs');
const accounts=JSON.parse(process.env.E2E_ACCOUNTS_JSON||'[]');
async function login(page,n,kind='free'){
 const account=accounts.find(a=>a.email===`test_${n}_${kind}@gmail.com`);
 if(!account)throw Error('Missing dedicated QA account');
 await page.goto('/app');await page.getByRole('button',{name:'Sign In',exact:true}).first().click();
 const dialog=page.getByRole('dialog',{name:'Student sign in'});
 await dialog.locator('input[type=email]').fill(account.email);await dialog.locator('input[type=password]').fill(account.password);
 await dialog.getByRole('button',{name:'Sign In',exact:true}).click();
 await expect(page.getByRole('heading',{name:/what will you learn today/i})).toBeVisible({timeout:30000});
}
async function subject(page,value){
 const select=page.locator('#practice-subject');
 await expect.poll(()=>select.locator('option').count(),{timeout:30000}).toBeGreaterThan(1);
 if(!value)value=await select.locator('option').evaluateAll(els=>els.find(e=>e.value&&e.value!=='all').value);
 await select.selectOption(value);
 await expect(page.getByRole('button',{name:/Start Next Mock Test|Resume Mock Test/}).first()).toBeEnabled({timeout:30000});
 return value;
}
async function chapters(page,ids){
 await page.locator('#practice-chapter summary').click();
 for(const id of ids)await page.locator(`#practice-chapter input[value="${id}"]`).check();
 await page.locator('#practice-chapter summary').click();
 await expect(page.getByRole('button',{name:/Start Next Mock Test|Resume Mock Test/})).toBeEnabled({timeout:30000});
}
for(const n of [8,9,10,11,12])test(`Class ${n} free: one 60-question mock, saved resume and second-set block`,async({page})=>{
 test.setTimeout(360000);await login(page,n);const selected=await subject(page);
 await page.getByRole('button',{name:/Start Next Mock Test|Resume Mock Test/}).click();
 await expect(page.getByRole('heading',{name:/Question 1 of 60/})).toBeVisible({timeout:30000});
 await expect(page.getByRole('button',{name:'Submit Test',exact:true})).toBeDisabled();
 await expect(page.getByText('Ready to submit your Mock Test?')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Submit Anyway',exact:true})).toHaveCount(0);
 await expect(page.getByText('Question map')).toHaveCount(0);
 await page.locator('button[aria-pressed]').first().click();
 await expect(page.getByText(/Answered: 1 \/ 60/)).toBeVisible();
 await page.reload();await expect(page.locator('#practice-subject')).toBeVisible({timeout:30000});await subject(page,selected);
 await page.getByRole('button',{name:/Resume Mock Test/}).click();
 await expect(page.getByText(/Answered: 1 \/ 60/)).toBeVisible({timeout:30000});
 await finishMock(page);
 await page.goto('/app');await expect(page.locator('#practice-subject')).toBeVisible({timeout:30000});
 await page.locator('#practice-subject').selectOption(selected);
 await expect(page.getByRole('button',{name:'Free Mock set completed',exact:true})).toBeDisabled({timeout:30000});
 await expect(page.getByRole('button',{name:/Start \/ Resume Practice/})).toBeEnabled();
});
test('Free Class 9: three chapters make shorter sets; Practice and Mock are independent subject allowances',async({page})=>{
 test.setTimeout(360000);await login(page,9);await subject(page,'Social Science');await chapters(page,[220,224,228]);
 const assignment=page.waitForResponse(r=>r.url().includes('/rpc/cbse_start_practice_v2'));
 await page.getByRole('button',{name:/Start \/ Resume Practice/}).click();
 const practice=await (await assignment).json();
 expect(practice.chapter_ids).toEqual([220,224,228]);expect(practice.question_ids.length).toBeGreaterThan(0);expect(practice.question_ids.length).toBeLessThan(60);
 await expect(page.getByRole('heading',{name:new RegExp(`Question 1 of ${practice.question_ids.length}`)})).toBeVisible();
 await page.locator('button[aria-pressed]').first().click();await page.getByRole('button',{name:'Submit Answer',exact:true}).click();
 await expect(page.getByText(/Correct answer:/i)).toBeVisible();
 await page.getByRole('button',{name:/Finish \/ Review Practice Test/}).click();
 await page.getByRole('region',{name:'Confirm practice submission'}).getByRole('button',{name:'Submit Anyway',exact:true}).click();
 await expect(page.getByText('Practice Test Result',{exact:true})).toBeVisible({timeout:30000});
 await page.goto('/app');await expect(page.locator('#practice-subject')).toBeVisible({timeout:30000});await subject(page,'Social Science');
 await expect(page.getByRole('button',{name:'Free Practice set completed',exact:true})).toBeDisabled();
 await chapters(page,[220,224,228]);
 const assigned=page.waitForResponse(r=>r.url().includes('/rpc/start_next_mock_paper_v3'));
 await page.getByRole('button',{name:/Start Next Mock Test/}).click();const paper=await(await assigned).json();
 expect(paper.chapter_ids).toEqual([220,224,228]);expect(paper.question_ids.length).toBeGreaterThan(0);expect(paper.question_ids.length).toBeLessThan(60);
 await finishMock(page);
 await page.goto('/app');await expect(page.locator('#practice-subject')).toBeVisible({timeout:30000});await page.locator('#practice-subject').selectOption('Social Science');
 await expect(page.getByRole('button',{name:'Free Mock set completed',exact:true})).toBeDisabled({timeout:30000});
 await expect(page.getByRole('button',{name:'Free Practice set completed',exact:true})).toBeDisabled();
});
test('Paid Class 9: chapter mock below 60 questions and next mock remain available',async({page})=>{
 test.setTimeout(180000);await login(page,9,'paid');await subject(page,'Social Science');await chapters(page,[220]);
 const assigned=page.waitForResponse(r=>r.url().includes('/rpc/start_next_mock_paper_v3'));
 await page.getByRole('button',{name:/Start Next Mock Test|Resume Mock Test/}).click();const paper=await(await assigned).json();
 expect(paper.chapter_ids).toEqual([220]);expect(paper.question_ids.length).toBeLessThan(60);await finishMock(page);
 const reportResponse=page.waitForResponse(r=>r.url().includes('/api/reports/mock?attemptId='));
 await page.getByRole('link',{name:'Download Complete Report PDF',exact:true}).click();
 const response=await reportResponse;expect(response.ok()).toBe(true);const report=await response.json();
 expect(report.attempt.total).toBe(paper.question_ids.length);expect(report.items).toHaveLength(paper.question_ids.length);
 await page.goto('/app');await expect(page.locator('#practice-subject')).toBeVisible({timeout:30000});await subject(page,'Social Science');
 await expect(page.getByRole('button',{name:/Start Next Mock Test/})).toBeEnabled();
});
test('Mobile portal: Public Homepage, Sign In and Sign Up share one row',async({page})=>{
 await page.setViewportSize({width:360,height:800});await page.goto('/app');
 const nav=page.getByRole('navigation',{name:'Student portal navigation'});
 const items=[nav.getByRole('link',{name:/Public Homepage/}),nav.getByRole('button',{name:'Sign In',exact:true}),nav.getByRole('button',{name:'Sign Up',exact:true})];
 const boxes=[];for(const item of items){await expect(item).toBeVisible();boxes.push(await item.boundingBox());}
 expect(Math.max(...boxes.map(b=>b.y))-Math.min(...boxes.map(b=>b.y))).toBeLessThan(3);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await items[2].click();await expect(page.getByRole('dialog',{name:'Create student account'})).toBeVisible();
});
