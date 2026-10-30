const {test,expect}=require('@playwright/test');
test('GA4 sends collection request to Google after explicit consent',async({page})=>{
 const requests=[],responses=[],errors=[];
 page.on('request',r=>{if(/googletagmanager\.com\/gtag\/js|google-analytics\.com\/g\/collect|google-analytics\.com\/collect/.test(r.url()))requests.push({url:r.url().slice(0,350),type:r.resourceType()})});
 page.on('response',r=>{if(/googletagmanager\.com\/gtag\/js|google-analytics\.com\/g\/collect|google-analytics\.com\/collect/.test(r.url()))responses.push({url:r.url().slice(0,350),status:r.status()})});
 page.on('requestfailed',r=>{if(/googletagmanager|google-analytics/.test(r.url()))errors.push({url:r.url().slice(0,350),failure:r.failure()})});
 await page.goto('https://examyari.com/');
 await expect(page.getByRole('region',{name:'Optional website analytics'})).toBeVisible();
 await page.getByRole('button',{name:'Allow public-page analytics'}).click();
 await page.waitForTimeout(7000);
 const status=await page.evaluate(()=>({gtag:typeof window.gtag,layer:(window.dataLayer||[]).map(x=>Array.from(x).slice(0,3)),scripts:[...document.scripts].map(s=>s.src).filter(x=>x.includes('googletagmanager'))}));
 console.log('DIAGNOSTIC '+JSON.stringify({requests,responses,errors,status}));
 expect(requests.some(x=>x.url.includes('googletagmanager.com/gtag/js'))).toBe(true);
 expect(responses.some(x=>x.url.includes('googletagmanager.com/gtag/js')&&x.status===200),'Google library should load').toBe(true);
 expect(requests.some(x=>x.url.includes('/g/collect')&&x.url.includes('G-7LDGQZJF8E')),'GA4 event must be delivered, not just queued').toBe(true);
});
