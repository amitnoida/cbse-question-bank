// Only authorize requests for the explicitly configured Vercel preview host.
// Never forward bypass credentials to Supabase or any third-party origin.
async function installPreviewProtection(page){
 const base=process.env.E2E_BASE_URL;
 const secret=process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
 if(!base||!secret)return;
 const origin=new URL(base).origin;
 if(!origin.endsWith('.vercel.app'))throw Error('Preview bypass requires a .vercel.app deployment');
 await page.route('**/*',async route=>{
  const url=route.request().url();
  if(!url.startsWith(origin+'/'))return route.continue();
  return route.continue({headers:{...route.request().headers(),'x-vercel-protection-bypass':secret}});
 });
}
module.exports={installPreviewProtection};
