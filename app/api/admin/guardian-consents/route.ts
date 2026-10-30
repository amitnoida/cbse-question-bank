import {NextRequest,NextResponse} from "next/server";
import {requireStatsAdmin,noStore} from "../../../../lib/system-stats-server";
const respond=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:noStore});
const methods=["DIGILOCKER","OFFLINE_GOVERNMENT_ID","RELIABLE_EXISTING_RECORD"];
export async function GET(req:NextRequest){
 try{const a=await requireStatsAdmin(req);if(!a)return respond({error:"Admin login required"},401);if(a.role!=="FULL_ADMIN")return respond({error:"Full Admin required"},403);
 const {data,error}=await a.db.from("guardian_account_consents").select("id,guardian_name,guardian_email,verification_method,consent_notice_version,guardian_consented_at,verified_at,student_id,creation_request").order("created_at",{ascending:false}).limit(100);
 return error?respond({error:"Consent register unavailable"},503):respond({consents:data});}catch{return respond({error:"Unable to load consent register"},503);}
}
export async function POST(req:NextRequest){
 try{
 const a=await requireStatsAdmin(req);if(!a)return respond({error:"Admin login required"},401);if(a.role!=="FULL_ADMIN")return respond({error:"Full Admin required"},403);
 let b;try{b=await req.json()}catch{return respond({error:"Invalid JSON"},400)}
 const name=String(b?.guardianName||"").trim(),email=String(b?.guardianEmail||"").trim().toLowerCase(),method=String(b?.method||"");
 const reference=String(b?.verificationReference||"").trim(),relationship=String(b?.relationshipBasis||"").trim(),evidence=String(b?.consentReference||"").trim();
 if(!methods.includes(method)||name.length<2||name.length>120||!/^\S+@\S+\.\S+$/.test(email)||email.length>254||reference.length<8||reference.length>120||relationship.length<8||relationship.length>300||evidence.length<8||evidence.length>120||b?.adultVerified!==true||b?.guardianAuthorityVerified!==true||b?.explicitConsentReceived!==true)
 return respond({error:"Verified adult identity, guardian relationship and affirmative informed consent must each be documented before account creation."},400);
 if(/\d{12}|aadhaar|passport.*\d|date of birth|dob\s*[:=]/i.test(reference+" "+evidence))return respond({error:"Do not store identity document numbers or raw personal identity data."},400);
 const date=new Date(String(b?.consentedAt||""));if(Number.isNaN(date.getTime())||date.getTime()>Date.now()||date.getTime()<Date.now()-365*24*60*60*1000)return respond({error:"Provide actual guardian consent timestamp."},400);
 const {data,error}=await a.db.from("guardian_account_consents").insert({
 guardian_name:name,guardian_email:email,verification_method:method,verification_reference:reference,
 relationship_basis:relationship,consent_evidence_reference:evidence,guardian_consented_at:date.toISOString(),verified_by:a.user.id
 }).select("id").single();
 return error?respond({error:"Could not record guardian consent. No child account created."},503):respond({id:data.id},201);
 }catch{return respond({error:"Guardian consent was not recorded."},503)}
}
