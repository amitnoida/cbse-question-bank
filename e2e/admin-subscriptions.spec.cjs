const {test,expect}=require('@playwright/test');
const accounts=JSON.parse(process.env.E2E_ACCOUNTS_JSON||'[]').filter(a=>a.kind==='admin');
async function login(page,kind){
 const account=accounts.find(a=>new RegExp(kind,'i').test(a.email));
 if(!account)throw Error('Required QA admin missing');
 await page.goto('/admin');
 await page.locator('input[type=email]').fill(account.email);
 await page.locator('input[type=password]').fill(account.password);
 await page.getByRole('button',{name:/^Sign in$/i}).click();
 await expect(page.getByRole('heading',{name:/Management overview/i})).toBeVisible({timeout:30000});
}
async function status(page,method){return page.evaluate(async(method)=>{
 const key=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'));
 const session=JSON.parse(localStorage.getItem(key));
 const r=await fetch('/api/admin/subscriptions',{method,headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},...(method==='PATCH'?{body:'{}'}:{})});
 return r.status;
},method);}
test('subscription API rejects anonymous requests',async({request})=>{
 expect((await request.get('/api/admin/subscriptions')).status()).toBe(401);
 expect((await request.patch('/api/admin/subscriptions',{data:{}})).status()).toBe(401);
});
test('Full Admin sees seven editable plans on desktop and mobile',async({page})=>{
 await login(page,'full');
 await page.getByRole('link',{name:'Subscription plans →',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Subscription plans',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Save plan',exact:true})).toHaveCount(7,{timeout:30000});
 await expect(page.getByRole('form',{name:'Edit COMBO_9_10'})).toBeVisible();
 expect(await status(page,'GET')).toBe(200);
 expect(await status(page,'PATCH')).toBe(400);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await expect(page.getByRole('heading',{name:'Subscription plans',exact:true})).toBeVisible();
});
test('Admin Viewer cannot read or edit subscription catalogue',async({page})=>{
 await login(page,'viewer');
 expect(await status(page,'GET')).toBe(403);
 expect(await status(page,'PATCH')).toBe(403);
 await page.goto('/admin/subscriptions');
 await expect(page.getByRole('alert')).toHaveText('Full Admin permission required.',{timeout:30000});
 await expect(page.getByRole('button',{name:'Save plan',exact:true})).toHaveCount(0);
});
