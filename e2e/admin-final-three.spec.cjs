const {test,expect}=require("@playwright/test");
const accounts=JSON.parse(process.env.E2E_ACCOUNTS_JSON||"[]").filter(x=>x.kind==="admin");
async function login(page,a){
 await page.goto("/admin");
 await page.locator('input[type=email]').fill(a.email);
 await page.locator('input[type=password]').fill(a.password);
 await page.getByRole("button",{name:/^Sign in$/i}).click();
 await expect(page.getByRole("heading",{name:/Management overview/i})).toBeVisible({timeout:30000});
}
async function token(page){return page.evaluate(()=>{const key=Object.keys(localStorage).find(x=>x.startsWith("sb-")&&x.endsWith("-auth-token"));return key?JSON.parse(localStorage.getItem(key)||"{}").access_token:null;});}
test("Full Admin: unified user directory and real allowance usage are available",async({page})=>{
 const a=accounts.find(x=>/full/i.test(x.email));if(!a)throw Error("No Full Admin QA account");
 await login(page,a);
 const bearer=await token(page);expect(bearer).toBeTruthy();
 const status=await page.evaluate(async t=>{
  const headers={Authorization:"Bearer "+t};
  const paths=["/api/admin/accounts","/api/admin/usage","/api/admin/teacher-imports"];
  return await Promise.all(paths.map(async p=>{const r=await fetch(p,{headers,cache:"no-store"});return {path:p,status:r.status,data:await r.json()};}));
 },bearer);
 expect(status.map(x=>x.status)).toEqual([200,200,200]);
 expect(Array.isArray(status[0].data.users)).toBe(true);
 expect(status[0].data.total).toBeGreaterThan(0);
 expect(status[0].data.users.every(x=>["STUDENT","TEACHER","ADMIN"].includes(x.role))).toBe(true);
 expect(status[1].data.summary.used).toBeGreaterThanOrEqual(0);
 expect(status[1].data.summary.allowance).toBeGreaterThanOrEqual(status[1].data.summary.used);
 expect(Array.isArray(status[1].data.bySubject)).toBe(true);
 expect(Array.isArray(status[2].data.files)).toBe(true);
 await page.goto("/admin/accounts");await expect(page.getByRole("heading",{name:"Unified user directory"})).toBeVisible();
 await expect(page.getByText(/accounts match/)).toBeVisible({timeout:30000});
 await page.goto("/admin/usage");await expect(page.getByRole("heading",{name:"Student usage and allowances"})).toBeVisible();
 await expect(page.getByText("Questions consumed")).toBeVisible({timeout:30000});
 await page.goto("/admin/teacher-imports");await expect(page.getByRole("button",{name:"Auto-process eligible files on this page"})).toBeVisible();
});
test("Viewer Admin cannot access personally identifying or usage endpoints",async({page})=>{
 const a=accounts.find(x=>/viewer/i.test(x.email));if(!a)throw Error("No Viewer QA account");
 await login(page,a);const bearer=await token(page);
 const statuses=await page.evaluate(async t=>Promise.all(["/api/admin/accounts","/api/admin/usage","/api/admin/teacher-imports"].map(async p=>(await fetch(p,{headers:{Authorization:"Bearer "+t}})).status)),bearer);
 expect(statuses).toEqual([403,403,403]);
});
test("Anonymous cannot access account or allowance data",async({request})=>{
 for(const path of ["/api/admin/accounts","/api/admin/usage"]){const res=await request.get(path);expect(res.status()).toBe(401);}
});
