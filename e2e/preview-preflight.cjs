// Fail fast if protected Vercel preview cannot be reached by automation.
// This checks only unauthenticated application behavior; no student sign-ins.
const base=process.env.E2E_BASE_URL;
const secret=process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
async function main(){
 if(!base||!secret)throw Error('Required preview URL or GitHub automation secret missing');
 const origin=new URL(base);
 if(origin.protocol!=='https:'||!origin.hostname.endsWith('.vercel.app'))
  throw Error('Refusing to forward bypass credential outside Vercel preview');
 const res=await fetch(new URL('/api/admin/reports?mode=catalog',origin),{
  headers:{'x-vercel-protection-bypass':secret,'Accept':'application/json'},
  redirect:'manual',
  signal:AbortSignal.timeout(15000)
 });
 const ct=res.headers.get('content-type')||'';
 console.log('Protected preview API preflight: HTTP',res.status,'type',ct.split(';')[0]);
 if(res.status>=300&&res.status<400)throw Error('Vercel preview returned redirect instead of application API; check bypass configuration');
 if(!ct.includes('application/json'))throw Error('Vercel login/protection or HTML response received instead of application JSON');
 if(res.status!==401)throw Error('Unauthenticated admin report API must return HTTP 401');
 console.log('PASS: Vercel bypass reaches application and app rejects anonymous reports');
}
main().catch(e=>{console.error('PREVIEW PREFLIGHT FAILED:',e.message);process.exitCode=1});
