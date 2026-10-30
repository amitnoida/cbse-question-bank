import {NextRequest,NextResponse} from "next/server";
import {createHash,randomBytes} from "node:crypto";
import {requireStatsAdmin,noStore} from "../../../../lib/system-stats-server";
const respond=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:noStore});
export async function GET(req:NextRequest){
 const a=await requireStatsAdmin(req);
 if(!a)return respond({error:"Admin sign in required."},401);
 if(a.role!=="FULL_ADMIN")return respond({error:"Full Admin only."},403);
 const {data,error}=await a.db.from("guardian_consent_invitations").select("id,guardian_email,verification_method,verification_reference,statement_version,consent_captured_at,created_at,expires_at,used_at,revoked_at,withdrawn_at").order("created_at",{ascending:false}).limit(100);
 if(error)return respond({error:"Consent ledger unavailable."},503);
 return respond({invitations:data||[]});
}
export async function POST(req:NextRequest){
 const a=await requireStatsAdmin(req);
 if(!a)return respond({error:"Admin sign in required."},401);
 if(a.role!=="FULL_ADMIN")return respond({error:"Full Admin only."},403);
 let body:{guardianEmail?:unknown;method?:unknown;reference?:unknown;consentConfirmed?:unknown;adultIdentityConfirmed?:unknown;guardianAuthorityConfirmed?:unknown};
 try{body=await req.json();}catch{return respond({error:"Invalid request."},400);}
 const guardianEmail=typeof body.guardianEmail==="string"?body.guardianEmail.trim().toLowerCase():"";
 const method=body.method,reference=typeof body.reference==="string"?body.reference.trim():"";
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail)||guardianEmail.length>254||!["DIGILOCKER_VERIFIED","GOVERNMENT_ID_CHECKED","EXISTING_TRUSTED_KYC"].includes(String(method))||reference.length<8||reference.length>180||body.consentConfirmed!==true||body.adultIdentityConfirmed!==true||body.guardianAuthorityConfirmed!==true)
 return respond({error:"Check the adult's identity and age, record guardian consent and a meaningful evidence reference before issuing an invitation."},400);
 // The full random bearer secret is returned once, never persisted in plaintext.
 const token=randomBytes(32).toString("hex");
 const token_hash=createHash("sha256").update(token).digest("hex");
 const {data,error}=await a.db.from("guardian_consent_invitations").insert({
   token_hash,guardian_email:guardianEmail,verification_method:method,verification_reference:reference,
   statement_version:"2026-10-30-guardian-v1",consent_captured_at:new Date().toISOString(),issued_by:a.user.id
 }).select("id,expires_at").single();
 if(error)return respond({error:"Guardian invitation could not be issued. Check consent ledger setup."},503);
 return respond({id:data.id,expiresAt:data.expires_at,invitationCode:token,notice:"Deliver this one-use code to the verified guardian privately. It will not be shown again."},201);
}
export async function DELETE(req:NextRequest){
 const a=await requireStatsAdmin(req);
 if(!a)return respond({error:"Admin sign in required."},401);
 if(a.role!=="FULL_ADMIN")return respond({error:"Full Admin only."},403);
 const id=req.nextUrl.searchParams.get("id");
 if(!id||!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(id))return respond({error:"Valid invitation ID required."},400);
 const {error}=await a.db.from("guardian_consent_invitations").update({revoked_at:new Date().toISOString()}).eq("id",id).is("used_at",null);
 if(error)return respond({error:"Unable to revoke invitation."},503);
 return respond({ok:true});
}

export async function PATCH(req:NextRequest){
 const a=await requireStatsAdmin(req);
 if(!a)return respond({error:"Admin sign in required."},401);
 if(a.role!=="FULL_ADMIN")return respond({error:"Full Admin only."},403);
 let b:{id?:unknown;evidence?:unknown};try{b=await req.json();}catch{return respond({error:"Invalid request."},400);}
 const id=typeof b.id==="string"?b.id:"",evidence=typeof b.evidence==="string"?b.evidence.trim():"";
 if(!/^[0-9a-f-]{36}$/i.test(id)||evidence.length<8||evidence.length>180)return respond({error:"A valid invitation and evidence reference are required."},400);
 const {data,error}=await a.db.rpc("cbse_guardian_consent_withdraw_v1",{p_actor:a.user.id,p_invitation:id,p_evidence:evidence});
 if(error)return respond({error:"Withdrawal could not be confirmed. No account changes claimed."},409);
 return respond({result:data});
}
