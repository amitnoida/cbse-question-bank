// Read-only checks against the live ExamYari website.
// No user credentials, account creation, subscriptions, coupons, or data mutation.
const base='https://examyari.com';
const paths=[
 ['/', 'text/html'],
 ['/class-9/mathematics','text/html'],
 ['/class-10/science','text/html'],
 ['/robots.txt','text/plain'],
 ['/sitemap.xml','xml'],
 ['/app','text/html'],
 ['/admin','text/html'],
];
async function main(){
 let failures=0;
 for(const [path,type] of paths){
  try{
   const response=await fetch(base+path,{redirect:'manual',headers:{Accept:'text/html,application/xml,text/plain'},signal:AbortSignal.timeout(20000)});
   const actual=response.headers.get('content-type')||'';
   const ok=response.status===200&&(type==='xml'?actual.includes('xml'):actual.includes(type));
   console.log((ok?'PASS':'FAIL')+' '+path+' HTTP '+response.status+' content-type '+actual.split(';')[0]);
   if(!ok)failures++;
   if(path==='/sitemap.xml'&&ok){
     const body=await response.text();
     if(!body.includes('https://examyari.com/')){console.error('FAIL sitemap does not use examyari.com');failures++;}
     else console.log('PASS sitemap uses examyari.com canonical host');
   }
  }catch(error){failures++;console.error('FAIL '+path+': '+error.message);}
 }
 const response=await fetch(base+'/api/admin/reports?mode=catalog',{redirect:'manual',headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});
 const contentType=response.headers.get('content-type')||'';
 if(response.status!==401||!contentType.includes('application/json')){
  console.error('FAIL anonymous admin report check: HTTP '+response.status+' type '+contentType.split(';')[0]);failures++;
 }else console.log('PASS anonymous admin reports denied by application JSON API (401)');
 if(failures)throw Error(failures+' production smoke check(s) failed');
 console.log('PASS: production smoke checks completed without mutation');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
