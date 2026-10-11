import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
function service(){const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw Error("Server secret SUPABASE_SERVICE_ROLE_KEY missing");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
async function identity(req:NextRequest){
 const token=req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];if(!token)return null;
 const auth=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false}});
 const {data:{user},error}=await auth.auth.getUser(token);if(error||!user)return null;
 const db=service();const {data,error:profileError}=await db.from("admin_profiles").select("role,is_active,must_change_password").eq("id",user.id).maybeSingle();
 if(profileError){if(profileError.code==="42703"||profileError.code==="PGRST204")throw Error("Admin upgrade database migration has not been applied; required admin profile columns are missing.");throw Error("Unable to read administrator profile. Check server logs and database permissions.");}
 const {data:member,error:memberError}=await db.from("admin_users").select("user_id").eq("user_id",user.id).maybeSingle();
 if(memberError)throw Error("Unable to check administrator membership. Check server logs and database permissions.");
 if(!member||!data?.is_active)return null;
 return {user,role:data.role as string,mustChange:!!data.must_change_password,db};
}
const response=(message:string,status:number)=>NextResponse.json({error:message},{status,headers:{"Cache-Control":"no-store"}});
export async function GET(req:NextRequest){try{const a=await identity(req);if(!a)return response("Unauthorized",401);
 if(a.mustChange)return NextResponse.json({role:a.role,mustChange:true,admins:[],students:[],announcements:[]},{headers:{"Cache-Control":"no-store"}});
  const {data:admins,error:adminsError}=await a.db.from("admin_profiles").select("id,full_name,is_active,role,must_change_password,created_at").order("created_at",{ascending:false});
  if(adminsError)return response("Unable to load administrators",500);
 const {data:students,error}=await a.db.rpc("admin_upgrade_student_list",{p_actor:a.user.id});if(error)return response(error.message,400);
 const {data:announcements,error:announcementsError}=await a.db.from("site_announcements").select("id,message,starts_at,ends_at,enabled").order("starts_at",{ascending:false}).limit(100);
  if(announcementsError)return response("Unable to load announcements",500);
 return NextResponse.json({role:a.role,mustChange:a.mustChange,admins,students,announcements},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return response(e instanceof Error?e.message:"Server error",500);}}
export async function POST(req:NextRequest){try{const a=await identity(req);if(!a)return response("Unauthorized",401);
 const body=await req.json();const action=String(body.action||"");
 if(action==="change-password"){
 if(!a.mustChange)return response("Password setup is not pending; use the normal password-reset flow",403);
  const password=String(body.password||"");if(password.length<12||password.length>128)return response("Password must be 12–128 characters",400);
 const {error}=await a.db.auth.admin.updateUserById(a.user.id,{password});if(error)return response(error.message,400);
 const {error:flag}=await a.db.from("admin_profiles").update({must_change_password:false}).eq("id",a.user.id);if(flag)return response(flag.message,400);
 return NextResponse.json({ok:true});}
 if(a.mustChange)return response("Change your temporary password first",403);
 if(a.role!=="FULL_ADMIN")return response("Full Admin permission required",403);
 if(action==="create-admin"){
 const email=String(body.email||"").trim().toLowerCase(),name=String(body.name||"").trim(),role=String(body.role||"");
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name||name.length>120||!["FULL_ADMIN","ADMIN_VIEW"].includes(role))return response("Invalid administrator details",400);
 if(!process.env.RESEND_API_KEY||!process.env.ADMIN_EMAIL_FROM)return response("Configure RESEND_API_KEY and ADMIN_EMAIL_FROM before creating administrators",503);
 const password=randomBytes(24).toString("base64url");
 const {data:created,error}=await a.db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name}});if(error||!created.user)return response(error?.message||"Account creation failed",400);
 const id=created.user.id;
 const {error:profileError}=await a.db.from("admin_profiles").upsert({id,full_name:name,is_active:true,role,must_change_password:true});
 const {error:membershipError}=await a.db.from("admin_users").insert({user_id:id});
 if(profileError||membershipError){await a.db.auth.admin.deleteUser(id);return response(profileError?.message||membershipError?.message||"Provisioning failed",400);}
 const loginUrl=(process.env.NEXT_PUBLIC_SITE_URL||new URL(req.url).origin)+"/admin/upgrade";
 let mail:Response;try{mail=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.ADMIN_EMAIL_FROM,to:[email],subject:"CBSE Exam Prep Guide — administrator access",text:`Hello ${name},\n\nYour administrator account is ready.\nLogin: ${loginUrl}\nEmail: ${email}\nTemporary password: ${password}\n\nSign in using the Admin login at /admin and immediately change this password in Admin Upgrade.\nDo not share this password.\n`})});}catch{await a.db.from("admin_users").delete().eq("user_id",id);await a.db.from("admin_profiles").delete().eq("id",id);await a.db.auth.admin.deleteUser(id);return response("Invitation delivery failed; check account cleanup before retrying",502);}
 if(!mail.ok){await a.db.from("admin_users").delete().eq("user_id",id);await a.db.from("admin_profiles").delete().eq("id",id);await a.db.auth.admin.deleteUser(id);return response("Invitation email failed; account creation was rolled back. Check email provider configuration.",502);}
 return NextResponse.json({ok:true});}
 if(action==="student-status"){
 const id=String(body.id||""),active=body.active;if(!/^[0-9a-f-]{36}$/i.test(id)||typeof active!=="boolean")return response("Invalid student or status",400);
 const {data:member}=await a.db.from("admin_users").select("user_id").eq("user_id",id).maybeSingle();if(member)return response("Cannot modify administrator",403);
 const {data:targetResult,error:targetError}=await a.db.auth.admin.getUserById(id);
 const target=targetResult?.user;
 if(targetError||!target)return response("Student account not found",404);
 const {data:profile,error:profileError}=await a.db.from("student_profiles").select("id,is_active").eq("id",id).maybeSingle();
 if(profileError||!profile)return response("Student profile not found; no changes made",409);
 const wasBanned=!!target.banned_until && new Date(target.banned_until).getTime()>Date.now();
 const {error:authError}=await a.db.auth.admin.updateUserById(id,{ban_duration:active?"none":"876000h"});
 if(authError)return response("Could not update student authentication status",400);
 const {error}=await a.db.from("student_profiles").update({is_active:active}).eq("id",id);
 if(error){await a.db.auth.admin.updateUserById(id,{ban_duration:wasBanned?"876000h":"none"});return response("Student profile update failed; verify account status before retrying",500);}
 return NextResponse.json({ok:true});}
 if(action==="delete-unverified"){
 const id=String(body.id||"");if(!/^[0-9a-f-]{36}$/i.test(id))return response("Invalid ID",400);
 const {data:member}=await a.db.from("admin_users").select("user_id").eq("user_id",id).maybeSingle();if(member)return response("Cannot delete administrator",403);
 const {data:{user},error}=await a.db.auth.admin.getUserById(id);if(error||!user)return response("Student not found",404);
 if(user.email_confirmed_at||Date.now()-new Date(user.created_at).getTime()<48*3600000)return response("Only unverified students older than 48 hours are eligible",403);
 const {error:deleteError}=await a.db.auth.admin.deleteUser(id);if(deleteError)return response("Deletion blocked by related records: "+deleteError.message,409);
 return NextResponse.json({ok:true});}
 if(action==="announcement"){
 const message=String(body.message||"").trim(),starts=String(body.starts||""),ends=String(body.ends||"");
 if(!message||message.length>400||!Number.isFinite(Date.parse(starts))||!Number.isFinite(Date.parse(ends))||Date.parse(ends)<=Date.parse(starts))return response("Provide message (up to 400 characters) and valid start/end times",400);
 const {error}=await a.db.from("site_announcements").insert({message,starts_at:starts,ends_at:ends,enabled:true,created_by:a.user.id});if(error)return response(error.message,400);return NextResponse.json({ok:true});}
 if(action==="announcement-disable"){
 const announcementId=String(body.id ?? "");if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(announcementId))return response("Invalid announcement ID",400);
  const {error}=await a.db.from("site_announcements").update({enabled:false}).eq("id",announcementId);if(error)return response(error.message,400);return NextResponse.json({ok:true});}
 return response("Unknown action",400);
 }catch(e){return response(e instanceof Error?e.message:"Server error",500);}}
