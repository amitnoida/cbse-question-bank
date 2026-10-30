const {test,expect}=require("@playwright/test");
const accounts=JSON.parse(process.env.E2E_ACCOUNTS_JSON||"[]");
async function login(page,account){
 await page.goto("/admin");
 await page.locator('input[type=email]').fill(account.email);
 await page.locator('input[type=password]').fill(account.password);
 await page.getByRole("button",{name:/^Sign in$/i}).click();
 await expect(page.getByRole("heading",{name:/Management overview/i})).toBeVisible({timeout:30000});
}
async function token(page){return page.evaluate(()=>{const key=Object.keys(localStorage).find(x=>x.startsWith("sb-")&&x.endsWith("-auth-token"));return key?JSON.parse(localStorage.getItem(key)||"{}").access_token:null})}
test("Student signup offers fields without an age gate and requires the supervision acknowledgement",async({page})=>{
 await page.goto("/app?auth=signup");
 await expect(page.getByLabel("Full Name",{exact:true})).toBeVisible();
 await expect(page.locator('input[type="date"]')).toHaveCount(0);
 await expect(page.locator('input[name="age-confirmation"]')).toHaveCount(0);
 const submit=page.getByRole("button",{name:"Create Account",exact:true});
 const acknowledgement=page.getByRole("checkbox",{name:/I agree to the Terms of Use/});
 await expect(acknowledgement).not.toBeChecked();
 await expect(submit).toBeDisabled();
 await acknowledgement.check();
 await expect(submit).toBeEnabled();
 await acknowledgement.uncheck();
 await expect(submit).toBeDisabled();
 await page.goto("/parent-consent");
 await expect(page.getByText("Contacting support is not a prerequisite for online registration.",{exact:false})).toBeVisible();
});
test("Anonymous access to guardian evidence or admin student API denied",async({request})=>{
 for(const p of ["/api/admin/guardian-consents","/api/admin/students"]){
  expect((await request.get(p)).status()).toBe(401);
  expect((await request.post(p,{data:{}})).status()).toBe(401);
 }
});
test("Viewer cannot view guardian verification details",async({page})=>{
 const a=accounts.find(x=>x.kind==="admin"&&/viewer/i.test(x.email));if(!a)throw Error("Viewer QA identity missing");
 await login(page,a);const t=await token(page);
 const statuses=await page.evaluate(async token=>Promise.all(["/api/admin/guardian-consents","/api/admin/students"].map(async p=>(await fetch(p,{headers:{Authorization:"Bearer "+token}})).status)),t);
 expect(statuses).toEqual([403,403]);
});
test("Full Admin cannot create a school student without one-use guardian verification",async({page})=>{
 const a=accounts.find(x=>x.kind==="admin"&&/full/i.test(x.email));if(!a)throw Error("Full Admin QA identity missing");
 await login(page,a);const t=await token(page);
 const result=await page.evaluate(async token=>{
  const r=await fetch("/api/admin/students",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({requestId:crypto.randomUUID(),fullName:"Synthetic No Consent",email:"no-consent-qa@example.com",password:"SyntheticPassword123!",classId:1,membership:"FREE",accountRole:"STUDENT"})});
  return {status:r.status,body:await r.json()};
 },t);
 expect(result.status).toBe(400);
 expect(result.body.error).toMatch(/consent/i);
 await page.goto("/admin/guardian-consents");
 await expect(page.getByRole("heading",{name:/Guardian identity and consent verification/})).toBeVisible();
});
