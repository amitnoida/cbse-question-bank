import {NextRequest,NextResponse} from "next/server";
import {requireStatsAdmin,noStore} from "../../../../lib/system-stats-server";
type Row={id:string;name:string;email:string;role:"STUDENT"|"TEACHER"|"ADMIN";className:string;status:string;created:string};
const reply=(x:unknown,status=200)=>NextResponse.json(x,{status,headers:noStore});
// Read-only directory: one view of student, teacher and administrator identities.
// Account creation is centralized at /admin/create-user; no admin-role creation here.
export async function GET(req:NextRequest){
 try{
  const admin=await requireStatsAdmin(req);
  if(!admin)return reply({error:"Administrator login required."},401);
  if(admin.role!=="FULL_ADMIN")return reply({error:"Full Admin required."},403);
  const [students,teachers,admins,classes]=await Promise.all([
   admin.db.from("student_profiles").select("id,full_name,class_id,is_active,account_type,created_at").limit(2000),
   admin.db.from("teacher_profiles").select("id,full_name,class_id,is_active,created_at").limit(2000),
   admin.db.from("admin_profiles").select("id,full_name,is_active,role,created_at").limit(200),
   admin.db.from("classes").select("id,class_name").limit(100)
  ]);
  if([students,teachers,admins,classes].some(x=>x.error))return reply({error:"Unable to read account directory."},503);
  const classById=new Map((classes.data||[]).map(c=>[String(c.id),c.class_name]));
  const emailById=new Map<string,string>();
  let authComplete=false;
  for(let page=1;page<=5;page++){
   const {data,error}=await admin.db.auth.admin.listUsers({page,perPage:1000});
   if(error)return reply({error:"Cannot read account emails securely."},503);
   for(const u of data.users)emailById.set(u.id,u.email||"");
   if(data.users.length<1000){authComplete=true;break;}
  }
  const result=new Map<string,Row>();
  const put=(x:Row)=>result.set(x.id,x);
  for(const s of students.data||[])put({id:s.id,name:s.full_name||"Unnamed student",email:emailById.get(s.id)||"",role:"STUDENT",className:classById.get(String(s.class_id))||"—",status:s.is_active?"Active":"Inactive",created:s.created_at});
  for(const t of teachers.data||[])put({id:t.id,name:t.full_name||"Unnamed teacher",email:emailById.get(t.id)||"",role:"TEACHER",className:classById.get(String(t.class_id))||"—",status:t.is_active?"Active":"Inactive",created:t.created_at});
  for(const a of admins.data||[])put({id:a.id,name:a.full_name||"Unnamed admin",email:emailById.get(a.id)||"",role:"ADMIN",className:"—",status:a.is_active?"Active":"Inactive",created:a.created_at});
  const search=(req.nextUrl.searchParams.get("search")||"").trim().slice(0,100).toLocaleLowerCase();
  const role=req.nextUrl.searchParams.get("role")||"ALL";
  if(!["ALL","STUDENT","TEACHER","ADMIN"].includes(role))return reply({error:"Invalid filter."},400);
  const all=[...result.values()].filter(x=>(role==="ALL"||x.role===role)&&(!search||[x.name,x.email,x.className].some(y=>y.toLocaleLowerCase().includes(search)))).sort((a,b)=>b.created.localeCompare(a.created));
  const page=Math.max(1,Math.min(10000,Number(req.nextUrl.searchParams.get("page")||"1")||1));
  return reply({users:all.slice((page-1)*50,page*50),total:all.length,page,pageSize:50,authComplete,profileTruncated:(students.data?.length||0)===2000||(teachers.data?.length||0)===2000});
 }catch{return reply({error:"Unable to load account directory."},503);}
}
