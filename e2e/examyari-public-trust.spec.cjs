const {test,expect}=require("@playwright/test");
test("Trust pages disclose contact, privacy, learning limits and guardian supervision",async({page})=>{
 await page.goto("/");
 await expect(page.getByRole("link",{name:"Privacy"})).toBeVisible();
 await expect(page.getByRole("link",{name:"Terms"})).toBeVisible();
 await expect(page.getByRole("link",{name:"Contact support"})).toBeVisible();
 for(const [url,heading] of [["/privacy","Privacy Policy"],["/terms","Terms of Use"],["/contact","Contact ExamYari Support"]]){
  await page.goto(url);
  await expect(page.getByRole("heading",{level:1,name:heading})).toBeVisible();
  await expect(page.getByText("support.cbseexam@gmail.com").first()).toBeVisible();
  const response=await page.request.get(url);
  expect(response.status()).toBe(200);
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
 }
 await page.goto("/app?auth=signup");
 await expect(page.getByRole("checkbox",{name:/If I am under 18/})).toBeVisible();
 await expect(page.getByRole("link",{name:"Privacy Policy"})).toBeVisible();
});
test("Privacy choices do not require acceptance to view public educational pages",async({page})=>{
 await page.goto("/");
 await page.getByRole("button",{name:"Decline"}).click();
 await page.goto("/class-9/mathematics");
 await expect(page.getByRole("button",{name:"Allow public-page analytics"})).toHaveCount(0);
});


test("Student signup rejects short passwords without creating an account",async({page})=>{
 await page.route("**/auth/v1/signup",route=>route.abort("blockedbyclient"));
 await page.goto("/app?auth=signup");
 const dialog=page.getByRole("dialog",{name:"Create student account"});
 await expect(dialog).toBeVisible({timeout:30000});
 await dialog.locator("#student-field-1").fill("Security Test");
 await dialog.locator("#student-field-2").fill("no-account-created@example.invalid");
 await dialog.locator("#student-field-3").fill("Short123");
 await dialog.locator("#student-field-4").fill("Short123");
 const classes=dialog.locator("#student-field-5");
 await expect.poll(async()=>classes.locator("option").count(),{timeout:30000}).toBeGreaterThan(1);
 await classes.selectOption({index:1});
 await dialog.locator("#registration-acknowledgement").check();
 await dialog.getByRole("button",{name:"Create Account"}).click();
 await expect(dialog.getByText("Password must contain 12–128 characters.")).toBeVisible();
});
