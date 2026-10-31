import {createClient} from "@supabase/supabase-js";
import {NextRequest,NextResponse} from "next/server";
import {adminDb} from "../system-stats-server";
import type {MembershipState} from "../student-memberships";
export const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export async function learningUser(req:NextRequest){
 const token=req.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];if(!token)return null;
 const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
 const {data:{user},error}=await client.auth.getUser(token);if(error||!user||!user.email_confirmed_at)return null;
 const {data:policy,error:policyError}=await client.rpc("cbse_claim_student_session_v1");if(policyError||!policy?.allowed)return null;
 const {data:active,error:activeError}=await client.rpc("is_active_student");if(activeError||!active)return null;
 const {data:membership,error:membershipError}=await client.rpc("cbse_student_memberships_v1");if(membershipError||!membership)return null;
 return {db:adminDb(),user,membership:membership as MembershipState};
}
export async function body(req:NextRequest){const text=await req.text();if(text.length>12000)throw Error("Request too large");return JSON.parse(text);}
export function must<T>(result:{data:T;error:unknown}):T{if(result.error)throw Error("Learning service unavailable");return result.data;}
