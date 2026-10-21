import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
export function adminDb(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key) throw Error("Missing Supabase server configuration");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function requireStatsAdmin(req:NextRequest){
 const bearer=req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
 if(!bearer) return null;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!anon)return null;
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await client.auth.getUser(bearer);
 if(error||!user)return null;
 const db=adminDb();
 const [member,profile]=await Promise.all([
  db.from("admin_users").select("user_id").eq("user_id",user.id).maybeSingle(),
  db.from("admin_profiles").select("is_active,must_change_password,role").eq("id",user.id).maybeSingle()
 ]);
 if(member.error||profile.error||!member.data||!profile.data?.is_active||profile.data.must_change_password)return null;
 return {db,user,role:profile.data.role};
}
export const noStore={"Cache-Control":"no-store"};
