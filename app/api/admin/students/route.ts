import {NextRequest,NextResponse} from "next/server";
import {noStore,requireStatsAdmin} from "../../../../lib/system-stats-server";
import {parseAdminStudent} from "../../../../lib/admin-create-student";
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:noStore});
export async function GET(req:NextRequest){
 try{const a=await requireStatsAdmin(req);if(!a)return reply({error:"Sign in as an administrator."},401);if(a.role!=="FULL_ADMIN")return reply({error:"Full Admin permission required."},403);
 const {data,error}=await a.db.from("classes").select("id,class_name,class_number").eq("is_active",true).gte("class_number",8).lte("class_number",12).order("class_number");
 return error?reply({error:"Unable to load school classes."},500):reply({classes:data});
 }catch{return reply({error:"Unable to load account creation form."},500);}
}
export async function POST(req:NextRequest){
 try{
 const a=await requireStatsAdmin(req);if(!a)return reply({error:"Sign in as an administrator."},401);if(a.role!=="FULL_ADMIN")return reply({error:"Full Admin permission required."},403);
 let body:unknown;try{body=await req.json();}catch{return reply({error:"Invalid JSON."},400);}
 const input=parseAdminStudent(body);if(!input)return reply({error:"Enter a full name, valid email, password of 12–128 characters, class and Free/Paid selection."},400);
 const {data:begin,error:beginError}=await a.db.rpc("admin_student_creation_begin_v1",{p_actor:a.user.id,p_request:input.requestId,p_name:input.fullName,p_email:input.email,p_class:input.classId,p_paid:input.membership==="PAID"});
 if(beginError)return reply({error:beginError.code==="22023"?"Choose an active school class and check the account details.":"Unable to start account creation. Retry with the same details."},beginError.code==="22023"?400:409);
 if(begin.status==="COMPLETE")return reply({student:begin.result,alreadyCreated:true});
 if(begin.status==="BUSY")return reply({error:"This submission is still being processed. Retry shortly with the same details."},409);
 let userId=begin.user_id as string|undefined;
 if(begin.status==="CREATE"){
  const {data,error}=await a.db.auth.admin.createUser({email:input.email,password:input.password,email_confirm:true,user_metadata:{full_name:input.fullName,class_id:input.classId},app_metadata:{admin_student_request:input.requestId,admin_student_actor:a.user.id}});
  if(error||!data.user){await a.db.rpc("admin_student_creation_failed_v1",{p_actor:a.user.id,p_request:input.requestId});return reply({error:error?.code==="email_exists"||error?.code==="email_already_exists"||error?.code==="user_already_exists"?"An account already exists for this email. It has not been changed.":"Unable to create the account. Check the email and password, then retry."},400);}
  userId=data.user.id;
 }
 if(!userId)return reply({error:"Account creation could not be confirmed. Retry with the same details."},503);
 const {data:student,error:finishError}=await a.db.rpc("admin_student_creation_finish_v1",{p_actor:a.user.id,p_request:input.requestId,p_user:userId});
 if(finishError)return reply({error:"Account setup is incomplete and student access remains inactive. Retry with the same details to finish safely."},503);
 return reply({student,alreadyCreated:false},201);
 }catch{return reply({error:"Account creation could not be confirmed. Retry with the same details; existing accounts will not be overwritten."},503);}
}
