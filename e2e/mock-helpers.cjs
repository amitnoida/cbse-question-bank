const { expect } = require('@playwright/test');

// Exercise every answer through the UI; no direct grading/database shortcuts.
async function finishMock(page) {
  const heading=page.getByRole('heading',{name:/^Question \d+ of \d+$/i});
  await expect(heading).toBeVisible({timeout:30000});
  const total=Number((await heading.innerText()).match(/of (\d+)/)[1]);
  for(let i=0;i<total;i++){
    await page.getByRole('button',{name:/^Review Unanswered$/i}).click();
    const option=page.locator('button[aria-pressed]').first();
    await expect(option).toBeEnabled();
    const saved=page.waitForResponse(r=>r.url().includes('/rpc/mock_save_answer')&&r.request().method()==='POST');
    await option.click();
    expect((await saved).ok()).toBe(true);
    await expect(option).toBeEnabled();
    if(await page.getByRole('button',{name:'Review Unanswered',exact:true}).isDisabled())break;
  }
  await expect(page.getByRole('button',{name:'Submit Test',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Submit Test',exact:true}).click();
  await expect(page.getByText('Real Mock Test Result',{exact:true})).toBeVisible({timeout:30000});
}
module.exports={finishMock};
