import {NextRequest,NextResponse} from "next/server";
import {requireStatsAdmin,noStore} from "../../../../lib/system-stats-server";
export const dynamic="force-dynamic";
const respond=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:noStore});
type UseRow={student_id:string;subject_id:number;questions_used:number|null;questions_allowed:number|null;last_used_at:string|null};
export async function GET(req:NextRequest){
 try{
  const a=await requireStatsAdmin(req);
  if(!a)return respond({error:"Administrator sign-in required."},401);
  if(a.role!=="FULL_ADMIN")return respond({error:"Full Admin required."},403);
  const [subjects,classes]=await Promise.all([
   a.db.from("subjects").select("id,subject_name,class_id").limit(500),
   a.db.from("classes").select("id,class_name,class_number").limit(100)
  ]);
  if(subjects.error||classes.error)return respond({error:"Academic catalog unavailable."},503);
  const classesById=new Map((classes.data||[]).map(c=>[Number(c.id),c.class_name]));
  const subsById=new Map((subjects.data||[]).map(s=>[Number(s.id),{subject:s.subject_name,className:classesById.get(Number(s.class_id))||"Other"}]));
  const rows:UseRow[]=[];
  let complete=false;
  for(let start=0;start<50000;start+=1000){
   const {data,error}=await a.db.from("free_usage").select("student_id,subject_id,questions_used,questions_allowed,last_used_at").order("id").range(start,start+999);
   if(error)return respond({error:"Cannot read usage records."},503);
   rows.push(...(data||[]));
   if((data||[]).length<1000){complete=true;break;}
  }
  type Agg={className:string;subject:string;used:number;allowance:number;records:number;students:Set<string>};
  const map=new Map<string,Agg>();
  let used=0,allowance=0,exhausted=0;
  const students=new Set<string>();
  for(const row of rows){
   const v=Math.max(0,Number(row.questions_used)||0),limit=Math.max(0,Number(row.questions_allowed)||0);
   const meta=subsById.get(Number(row.subject_id))||{subject:"Unknown",className:"Unknown"};
   const key=meta.className+"\u0000"+meta.subject;
   let item=map.get(key);if(!item){item={className:meta.className,subject:meta.subject,used:0,allowance:0,records:0,students:new Set()};map.set(key,item);}
   item.used+=v;item.allowance+=limit;item.records++;item.students.add(row.student_id);
   students.add(row.student_id);used+=v;allowance+=limit;if(limit>0&&v>=limit)exhausted++;
  }
  const bySubject=[...map.values()].map(x=>({className:x.className,subject:x.subject,used:x.used,allowance:x.allowance,remaining:Math.max(0,x.allowance-x.used),students:x.students.size,records:x.records})).sort((a,b)=>a.className.localeCompare(b.className,undefined,{numeric:true})||a.subject.localeCompare(b.subject));
  return respond({asOf:new Date().toISOString(),complete,summary:{used,allowance,remaining:Math.max(0,allowance-used),students:students.size,usageRecords:rows.length,exhaustedRecords:exhausted},bySubject,definition:"Usage and allowance are totals of actual free_usage records; zero recorded usage does not mean zero website activity."});
 }catch{return respond({error:"Unable to retrieve usage dashboard."},503);}
}
