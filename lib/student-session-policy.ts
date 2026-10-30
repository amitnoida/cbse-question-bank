export const SESSION_REVOKED_CODE="CBSE_SESSION_REVOKED";
export const SESSION_REVOKED_EVENT="cbse:student-session-revoked";
export const SESSION_REVOKED_MESSAGE="You were signed out because your account was used on another device. Only two active sessions are allowed.";
type Claim={allowed:boolean;enforced?:boolean;exempt?:boolean;code?:string};
type AuthClaims={sub?:string;session_id?:string;role?:string};
export function sessionClaims(token:string):AuthClaims|null{
 try{const encoded=token.split('.')[1];if(!encoded)return null;return JSON.parse(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')));}catch{return null;}
}
// Parsing is for deduplication only; the database verifies the signed Auth identity.
export function createSessionPolicyFetch(baseUrl:string,apiKey:string,transport:typeof fetch,onRevoked:(sessionId:string)=>void):typeof fetch{
 const completed=new Set<string>();const flights=new Map<string,Promise<Claim>>();
 async function claim(token:string,sid:string):Promise<Claim>{
  const existing=flights.get(sid);if(existing)return existing;
  const pending=(async()=>{
   const r=await transport(`${baseUrl}/rest/v1/rpc/cbse_claim_student_session_v1`,{method:'POST',headers:{apikey:apiKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}',cache:'no-store'});
   if(!r.ok)throw Error('Unable to verify student session');
   const result=await r.json() as Claim;
   if(result.allowed&&(result.enforced||result.exempt))completed.add(sid);
   return result;
  })();flights.set(sid,pending);try{return await pending;}finally{flights.delete(sid);}
 }
 return async(input,init)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  if(!url.startsWith(`${baseUrl}/rest/v1/`))return transport(input,init);
  const headers=new Headers(input instanceof Request?input.headers:undefined);new Headers(init?.headers).forEach((v,k)=>headers.set(k,v));
  const token=headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];const identity=token?sessionClaims(token):null;
  if(token&&identity?.sub&&identity.session_id&&!url.endsWith('/rpc/cbse_claim_student_session_v1')){
   if(!completed.has(identity.session_id)){
    const result=await claim(token,identity.session_id);
    if(!result.allowed){onRevoked(identity.session_id);return new Response(JSON.stringify({code:SESSION_REVOKED_CODE,message:SESSION_REVOKED_MESSAGE}),{status:403,headers:{'Content-Type':'application/json'}});}
   }
  }
  const response=await transport(input,init);
  if(response.status===403){try{const body=await response.clone().json();if(body.code===SESSION_REVOKED_CODE&&identity?.session_id)onRevoked(identity.session_id);}catch{/* Preserve the original response. */}}
  return response;
 };
}
