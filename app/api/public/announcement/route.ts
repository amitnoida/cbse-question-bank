import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export async function GET(){
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false}});
 const {data,error}=await db.from("site_announcements").select("message").eq("enabled",true).lte("starts_at",new Date().toISOString()).gt("ends_at",new Date().toISOString()).order("starts_at",{ascending:false}).limit(1).maybeSingle();
 return NextResponse.json({message:error?"":(data?.message||"")},{headers:{"Cache-Control":"no-store"}});
}
