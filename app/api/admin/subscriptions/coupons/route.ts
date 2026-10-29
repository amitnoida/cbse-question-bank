import {NextRequest,NextResponse} from "next/server";
import {noStore,requireStatsAdmin} from "../../../../../lib/system-stats-server";
import {productCodes} from "../../../../../lib/subscription-catalog";
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:noStore});
export async function GET(req:NextRequest){
 try{
 const a=await requireStatsAdmin(req);if(!a)return reply({error:"Sign in as an administrator."},401);if(a.role!=="FULL_ADMIN")return reply({error:"Full Admin permission required."},403);
 const after=Number(req.nextUrl.searchParams.get("after")||0);if(!Number.isSafeInteger(after)||after<0)return reply({error:"Invalid page."},400);
 const {data,error}=await a.db.from("coupons").select("id,coupon_code,applicable_plan_code,membership_validity,discount_percentage,is_active,valid_until,usage_count,usage_limit").gt("id",after).order("id").limit(51);
 if(error)return reply({error:"Unable to load coupons."},500);
 return reply({coupons:data.slice(0,50),next:data.length>50?data[49].id:null});
 }catch{return reply({error:"Unable to load coupons."},500);}
}
export async function PATCH(req:NextRequest){
 try{
 const a=await requireStatsAdmin(req);if(!a)return reply({error:"Sign in as an administrator."},401);if(a.role!=="FULL_ADMIN")return reply({error:"Full Admin permission required."},403);
 let b;try{b=await req.json();}catch{return reply({error:"Invalid JSON."},400);}
 const codes:readonly string[]=[...productCodes,"PAID_99","CLASS10_149","COMBINED_199"];
 if(!b||!Number.isSafeInteger(b.id)||b.id<1||!codes.includes(b.product)||!["COUPON_EXPIRY","ONE_YEAR"].includes(b.validity))return reply({error:"Invalid coupon configuration."},400);
 const {data,error}=await a.db.rpc("admin_set_membership_coupon_scope_v1",{p_actor:a.user.id,p_coupon_id:b.id,p_product:b.product,p_validity:b.validity});
 if(error)return reply({error:"Unable to save coupon configuration."},500);
 return reply({coupon:data});
 }catch{return reply({error:"Unable to save coupon configuration."},500);}
}
