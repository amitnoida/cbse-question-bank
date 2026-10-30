const {test,expect}=require("@playwright/test");
test("Anonymous users cannot issue guardian consent invitations",async({request})=>{
 const result=await request.post("/api/admin/guardian-consent",{data:{guardianEmail:"fake@example.test",method:"GOVERNMENT_ID_CHECKED",reference:"QA-FAKE-00001",consentConfirmed:true,adultIdentityConfirmed:true}});
 expect(result.status()).toBe(401);
 const list=await request.get("/api/admin/guardian-consent");
 expect(list.status()).toBe(401);
});
test("New student signup requires a verified guardian code",async({page})=>{
 await page.goto("/app?auth=signup");
 await expect(page.getByRole("dialog",{name:/student.*sign.*up|create.*account/i})).toBeVisible({timeout:15000}).catch(async()=>{await expect(page.getByText(/Verified guardian invitation code/i)).toBeVisible();});
 await expect(page.getByLabel("Verified guardian invitation code")).toBeVisible();
 await expect(page.getByText(/Email confirmation alone is not enough/)).toBeVisible();
 await expect(page.getByRole("link",{name:"Privacy Policy"})).toBeVisible();
});
