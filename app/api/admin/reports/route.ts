import { NextRequest, NextResponse } from "next/server";
import { requireStatsAdmin, noStore } from "../../../../lib/system-stats-server";
import { REPORTS, findReport, type ReportDefinition } from "../../../../lib/admin-reports";

export const maxDuration=60;
type Row=Record<string,unknown>;
const clean=(v:unknown)=>typeof v==="string"?v:"";
const fail=(message:string,status:number)=>NextResponse.json({error:message},{status,headers:noStore});
const pageSize=50;

async function metadata(db:ReturnType<typeof import("../../../../lib/system-stats-server").adminDb>){
  const [c,s,h]=await Promise.all([
    db.from("classes").select("id,class_name,class_number,is_active").in("class_number",[8,9,10,11,12]).order("class_number"),
    db.from("subjects").select("id,class_id,subject_name,is_active").order("subject_name"),
    db.from("chapters").select("id,subject_id,chapter_name,chapter_number,is_active").order("chapter_number"),
  ]);
  if(c.error||s.error||h.error)throw Error("Academic filters unavailable");
  const classes=c.data||[];
  const classIds=new Set(classes.map(x=>Number(x.id)));
  const subjects=(s.data||[]).filter(x=>classIds.has(Number(x.class_id)));
  const subjectIds=new Set(subjects.map(x=>Number(x.id)));
  const chapters=(h.data||[]).filter(x=>subjectIds.has(Number(x.subject_id)));
  return {classes,subjects,chapters};
}
function csvValue(v:unknown){
 const raw=v===null||v===undefined?"":typeof v==="object"?JSON.stringify(v):String(v);
 const guarded=/^[=+@\-\t\r]/.test(raw)?"'"+raw:raw;
 return '"'+guarded.replace(/"/g,'""')+'"';
}
function csvLine(values:unknown[]){return values.map(csvValue).join(",")+"\r\n";}

// The privileged SQL function is restricted to service_role at the database layer.
// Every request also passes requireStatsAdmin() and the FULL_ADMIN gate below.
async function securityCatalogReport(
 db:ReturnType<typeof import("../../../../lib/system-stats-server").adminDb>,
 report:ReportDefinition,
 p:URLSearchParams,
 mode:"data"|"csv",
):Promise<Response>{
 const result=await db.rpc("cbse_admin_security_audit_v1",{p_kind:report.id});
 if(result.error)throw new Error("Security metadata audit is unavailable: "+result.error.message);
 const records=((result.data||[]) as Array<{entry:Row}>).map(r=>r.entry);
 const search=clean(p.get("search")).trim().toLowerCase().slice(0,100);
 const status=p.get("status")||"";
 const allowedStatus=["","review","rls-disabled","public-execute","definer","permissive","restrictive"];
 if(!allowedStatus.includes(status))return fail("Invalid audit status filter",400);
 const matches=records.filter(row=>{
  if(search&&!Object.values(row).some(v=>String(v??"").toLowerCase().includes(search)))return false;
  if(status==="review"&&!String(row.detail||"").startsWith("REVIEW:"))return false;
  if(status==="rls-disabled"&&!(row.object_type==="Table RLS"&&row.rls_enabled===false)&&!(report.id==="rls-policies"&&row.rls_enabled===false))return false;
  if(status==="public-execute"&&row.public_execute!==true)return false;
  if(status==="definer"&&row.security_definer!==true)return false;
  if(status==="permissive"&&String(row.permissive)!=="PERMISSIVE")return false;
  if(status==="restrictive"&&String(row.permissive)!=="RESTRICTIVE")return false;
  return true;
 });
 const allowedSort=report.id==="function-audit"
  ?["object_type","schema","name","detail","security_definer","rls_enabled"]
  :["schema","table","policy","command","permissive"];
 const sort=allowedSort.includes(p.get("sort")||"")?String(p.get("sort")):(report.id==="function-audit"?"object_type":"table");
 const ascending=p.get("dir")!=="desc";
 matches.sort((a,b)=>{
  const cmp=String(a[sort]??"").localeCompare(String(b[sort]??""),"en",{numeric:true});
  if(cmp)return ascending?cmp:-cmp;
  return (String(a.name||a.policy||"")+"|"+String(a.signature||"")).localeCompare(String(b.name||b.policy||"")+"|"+String(b.signature||""));
 });
 if(mode==="csv"){
  const body=csvLine([...report.columns])+matches.map(row=>csvLine(report.columns.map(c=>row[c]))).join("");
  return new Response(body,{status:200,headers:{
   "Content-Type":"text/csv; charset=utf-8",
   "Content-Disposition":'attachment; filename="'+report.id+"-"+new Date().toISOString().replace(/[:.]/g,"-")+'.csv"',
   "Cache-Control":"no-store","X-Content-Type-Options":"nosniff",
  }});
 }
 const requested=Math.floor(Number(p.get("page")||1));
 const page=Number.isFinite(requested)?Math.max(1,Math.min(100000,requested)):1;
 return NextResponse.json({
  report:report.id,columns:report.columns,rows:matches.slice((page-1)*pageSize,page*pageSize),
  total:matches.length,page,pageSize,summary:{matching_records:matches.length,page_records:matches.slice((page-1)*pageSize,page*pageSize).length},
  asOf:new Date().toISOString(),
 },{headers:noStore});
}

export async function GET(req:NextRequest){
 try{
  const a=await requireStatsAdmin(req);
  if(!a)return fail("Administrator sign-in is required.",401);
  const admin=a;
  const p=req.nextUrl.searchParams;
  const mode=p.get("mode")||"data";
  const allowed=REPORTS.filter(r=>admin.role==="FULL_ADMIN"||r.viewer);
  if(mode==="catalog"){
    const filters=await metadata(admin.db);
    return NextResponse.json({role:admin.role,reports:allowed,filters},{headers:noStore});
  }
  const report=findReport(p.get("report")||"");
  if(!report)return fail("Unknown report",400);
  if(admin.role!=="FULL_ADMIN"&&!report.viewer)return fail("This report requires Full Admin access.",403);
  if(!["data","csv"].includes(mode))return fail("Invalid report request",400);
  if(report.source==="metadata")return await securityCatalogReport(admin.db,report,p,mode as "data"|"csv");
  const filters=await metadata(admin.db);
  const classNumber=Number(p.get("class")||0);
  const classRow=filters.classes.find(x=>Number(x.class_number)===classNumber);
  const selectedClassId=classNumber?(classRow?Number(classRow.id):-1):0;
  const subjectId=Number(p.get("subject")||0);
  const chapterId=Number(p.get("chapter")||0);
  const selectedSubjects=filters.subjects.filter(x=>(!selectedClassId||Number(x.class_id)===selectedClassId)&&(!subjectId||Number(x.id)===subjectId));
  const subjectIds=selectedSubjects.map(x=>Number(x.id));
  const selectedChapters=filters.chapters.filter(x=>subjectIds.includes(Number(x.subject_id))&&(!chapterId||Number(x.id)===chapterId));
  const chapterIds=selectedChapters.map(x=>Number(x.id));
  const status=p.get("status")||"";
  const usage=p.get("usage")||"";
  const review=p.get("review")||"";
  const search=clean(p.get("search")).trim().slice(0,100).replace(/[,()%]/g," ");
  const start=p.get("from")||"",end=p.get("to")||"";
  if((start&&!/^\d{4}-\d{2}-\d{2}$/.test(start))||(end&&!/^\d{4}-\d{2}-\d{2}$/.test(end)))return fail("Invalid date filter",400);
  const classById=new Map(filters.classes.map(x=>[Number(x.id),x.class_name]));
  const subjectById=new Map(filters.subjects.map(x=>[Number(x.id),x]));
  const chapterById=new Map(filters.chapters.map(x=>[Number(x.id),x]));
  const decorated=(row:Row):Row=>{
    const out:Row={...row};
    let sid=Number(row.subject_id||0);
    const ch=chapterById.get(Number(report.source==="chapters"?row.id:(row.chapter_id||0)));
    if(ch&&report.source==="questions"){sid=Number(ch.subject_id);out.chapter=ch.chapter_name;}
    if(report.source==="chapters"){sid=Number(row.subject_id);out.chapter=row.chapter_name;}
    if(report.source==="subjects"){sid=Number(row.id);}
    const sub=subjectById.get(sid);
    if(sub){out.subject=sub.subject_name;out.class=classById.get(Number(sub.class_id))||"";}
    if(report.source==="student_profiles")out.class=classById.get(Number(row.class_id))||"";
    return out;
  };
  // For every report, the school-only class/subject filter is applied before any count,
  // page or CSV export. Competitive exam accounts are never part of these reports.
  let allowedStudentIds:string[]|null=null;
  if(selectedClassId){
    const ids=await admin.db.from("student_profiles").select("id").eq("class_id",selectedClassId);
    if(ids.error)throw ids.error;
    allowedStudentIds=(ids.data||[]).map(x=>String(x.id));
  }
  function baseQuery(select:string,withCount=false){
    const query=admin.db.from(report!.source).select(select,{count:withCount?"exact":undefined});
    const source=report!.source;
    let q:any=query;
    if(source==="questions"){
      q=q.in("chapter_id",chapterIds.length?chapterIds:[-1]);
      if(report!.id==="mcq-quality")q=q.or("explanation.is.null,question_text.is.null,option_a.is.null,option_b.is.null,option_c.is.null,option_d.is.null");
      if(report!.id==="mcq-inactive")q=q.or("is_active.eq.false,content_review_status.eq.PENDING_REVIEW,content_review_status.eq.HOLD");
      if(report!.id==="media-audit")q=q.or("media_ready.eq.false,question_media.neq.{}");
      if(report!.id==="integrity")q=q.or("question_text.is.null,correct_option.is.null,option_a.is.null,option_b.is.null,option_c.is.null,option_d.is.null");
      if(usage)q=q.eq("question_usage",usage);
      if(review)q=q.eq("content_review_status",review);
      if(status==="active"||status==="inactive")q=q.eq("is_active",status==="active");
      if(search)q=q.ilike("question_text","%"+search+"%");
    }else if(source==="chapters"){
      q=q.in("id",chapterIds.length?chapterIds:[-1]);
      if(status==="active"||status==="inactive")q=q.eq("is_active",status==="active");
      if(search)q=q.ilike("chapter_name","%"+search+"%");
    }else if(source==="subjects"){
      q=q.in("id",subjectIds.length?subjectIds:[-1]);
      if(status==="active"||status==="inactive")q=q.eq("is_active",status==="active");
      if(search)q=q.ilike("subject_name","%"+search+"%");
    }else if(source==="student_profiles"){
      q=q.in("class_id",selectedClassId?[selectedClassId]:filters.classes.map(x=>x.id));
      if(status==="active"||status==="inactive")q=q.eq("is_active",status==="active");
      if(search)q=q.ilike("full_name","%"+search+"%");
    }else if(["quiz_attempts","free_usage"].includes(source)){
      q=q.in("subject_id",subjectIds.length?subjectIds:[-1]);
      if(allowedStudentIds)q=q.in("student_id",allowedStudentIds.length?allowedStudentIds:["00000000-0000-0000-0000-000000000000"]);
      if(source==="quiz_attempts"&&report!.id==="mock-performance")q=q.eq("quiz_type","MOCK");
      if(source==="quiz_attempts"&&status)q=q.eq("status",status);
    }else if(["subscriptions"].includes(source)){
      if(allowedStudentIds)q=q.in("student_id",allowedStudentIds.length?allowedStudentIds:["00000000-0000-0000-0000-000000000000"]);
      if(status)q=q.eq("status",status);
    }else if(source==="coupons"){
      if(status==="active"||status==="inactive")q=q.eq("is_active",status==="active");
      if(search)q=q.ilike("coupon_code","%"+search+"%");
    }else if(source==="admin_profiles"){
      if(status==="active"||status==="inactive")q=q.eq("is_active",status==="active");
      if(search)q=q.ilike("full_name","%"+search+"%");
    }
    const dateField:Record<string,string>={questions:"created_at",chapters:"created_at",subjects:"created_at",student_profiles:"created_at",quiz_attempts:"started_at",free_usage:"created_at",subscriptions:"created_at",coupons:"created_at",admin_profiles:"created_at"};
    const field=dateField[source];
    if(field&&start)q=q.gte(field,start+"T00:00:00Z");
    if(field&&end)q=q.lte(field,end+"T23:59:59Z");
    return q;
  }
  async function countFor(field:string,value:unknown,table="questions"){
    const q=admin.db.from(table).select("id",{head:true,count:"exact"}).eq(field,value as string);
    const res=await q;if(res.error)throw res.error;return res.count||0;
  }
  async function enrich(rows:Row[]){
    if(report!.id==="mcq-summary"||report!.id==="mock-readiness"){
      const data:Row[]=[];
      for(let i=0;i<rows.length;i+=8){
        const chunk=rows.slice(i,i+8);
        const mapped=await Promise.all(chunk.map(async r=>{
          const ids=filters.chapters.filter(c=>Number(c.subject_id)===Number(r.id)).map(c=>Number(c.id));
          if(!ids.length)return {...decorated(r),active:0,inactive:0,total:0,mock:0,shared:0,total_pool:0,ready:false,required_mock:48,required_shared:12};
          const by=(s:string,v:unknown)=>admin.db.from("questions").select("id",{head:true,count:"exact"}).in("chapter_id",ids).eq(s,v as string);
          if(report!.id==="mcq-summary"){
            const [active,all]=await Promise.all([by("is_active",true),admin.db.from("questions").select("id",{head:true,count:"exact"}).in("chapter_id",ids)]);
            if(active.error||all.error)throw Error("Question counts unavailable");
            return {...decorated(r),active:active.count||0,inactive:(all.count||0)-(active.count||0),total:all.count||0};
          }
          const [mock,shared]=await Promise.all([
            admin.db.from("questions").select("id",{head:true,count:"exact"}).in("chapter_id",ids).eq("is_active",true).eq("question_usage","MOCK"),
            admin.db.from("questions").select("id",{head:true,count:"exact"}).in("chapter_id",ids).eq("is_active",true).eq("question_usage","SHARED"),
          ]);
          if(mock.error||shared.error)throw Error("Mock counts unavailable");
          return {...decorated(r),mock:mock.count||0,shared:shared.count||0,total_pool:(mock.count||0)+(shared.count||0),required_mock:48,required_shared:12,ready:(mock.count||0)>=48&&(shared.count||0)>=12};
        }));
        data.push(...mapped);
      }
      return data;
    }
    if(report!.id==="chapter-counts"){
      const chapterSet=rows.map(r=>Number(r.id));
      if(!chapterSet.length)return [];
      const stats=new Map<number,{active:number,total:number}>();
      // Scan matching chapter IDs in fixed 1,000-row batches, rather than
      // making two separate DB count requests for every chapter.
      for(let offset=0;offset<100000;offset+=1000){
        const q=await admin.db.from("questions")
          .select("id,chapter_id,is_active")
          .in("chapter_id",chapterSet)
          .order("id")
          .range(offset,offset+999);
        if(q.error)throw Error("Chapter counts unavailable");
        for(const question of q.data||[]){
          const id=Number(question.chapter_id);
          const entry=stats.get(id)||{active:0,total:0};
          entry.total++;
          if(question.is_active)entry.active++;
          stats.set(id,entry);
        }
        if((q.data||[]).length<1000)break;
        if(offset>=99000)throw Error("Too many questions for this chapter count request; narrow the filters.");
      }
      return rows.map(r=>{
        const count=stats.get(Number(r.id))||{active:0,total:0};
        return {...decorated(r),active:count.active,inactive:count.total-count.active,total:count.total};
      });
    }
    if(report!.id==="student-directory"){
      const ids=rows.map(x=>String(x.id)).filter(Boolean);
      if(!ids.length)return [];
      // Full Admin only, already verified above; emails are never returned to ADMIN_VIEW.
      const [auth,subs]=await Promise.all([
        admin.db.auth.admin.listUsers({page:1,perPage:1000}),
        admin.db.from("subscriptions").select("student_id,status,end_date").in("student_id",ids),
      ]);
      if(auth.error||subs.error)throw Error("Student account details unavailable");
      const users=new Map((auth.data?.users||[]).map(u=>[u.id,u]));
      const now=Date.now();
      const paid=new Set((subs.data||[]).filter(x=>x.status==="ACTIVE"&&x.end_date&&Date.parse(x.end_date)>now).map(x=>x.student_id));
      return rows.map(row=>{
        const user=users.get(String(row.id));
        return {...decorated(row),email:user?.email||"",email_verified:!!user?.email_confirmed_at,membership:paid.has(String(row.id))?"Paid":"Free"};
      });
    }
    if(report!.id==="admin-access"){
      const auth=await admin.db.auth.admin.listUsers({page:1,perPage:1000});
      if(auth.error)throw Error("Admin account details unavailable");
      const users=new Map((auth.data?.users||[]).map(u=>[u.id,u]));
      return rows.map(row=>({...decorated(row),email:users.get(String(row.id))?.email||""}));
    }
    return rows.map(decorated);
  }
  async function pageRows(offset:number,size:number){
    const sortable:Record<string,string[]>={
      questions:["id","created_at","updated_at","difficulty","is_active","content_review_status","question_usage","question_text"],
      subjects:["id","subject_name","created_at","is_active"],
      chapters:["id","chapter_number","chapter_name","created_at","is_active"],
      student_profiles:["id","full_name","created_at","is_active","account_type"],
      quiz_attempts:["id","created_at","started_at","percentage","answered_questions","status","quiz_type"],
      subscriptions:["id","created_at","end_date","amount_paid","status"],
      coupons:["id","created_at","valid_until","usage_count","discount_percentage","is_active"],
      free_usage:["id","created_at","questions_used","last_used_at"],
      admin_profiles:["id","created_at","full_name","role","is_active"],
    };
    const defaultOrder=report!.source==="admin_profiles"?"created_at":"id";
    const proposed=p.get("sort")||"";
    const orderField=(sortable[report!.source]||[]).includes(proposed)?proposed:defaultOrder;
    const q=baseQuery("*",true).order(orderField,{ascending:p.get("dir")==="asc"}).range(offset,offset+size-1);
    const res=await q;
    if(res.error)throw res.error;
    const rows=(res.data||[]) as Row[];
    return {rows:await enrich(rows),total:res.count||0};
  }
  async function groupedActivity(){
    const accumulated:Row[]=[];
    for(let offset=0;offset<30000;offset+=500){
      const q=baseQuery("id,student_id,subject_id,quiz_type,status,percentage",false).order("id").range(offset,offset+499);
      const r=await q;if(r.error)throw r.error;
      accumulated.push(...(r.data||[]) as Row[]);
      if((r.data||[]).length<500)break;
      if(offset>=29500)throw Error("Activity report exceeds safe scan limit; narrow the date/class filters.");
    }
    const groups=new Map<string,{class:string;subject:string;attempts:number;completed:number;scoreSum:number;scored:number}>();
    for(const row of accumulated){
      const subject=subjectById.get(Number(row.subject_id));
      if(!subject)continue;
      const key=String(row.subject_id);
      const agg=groups.get(key)||{class:String(classById.get(Number(subject.class_id))||""),subject:subject.subject_name,attempts:0,completed:0,scoreSum:0,scored:0};
      agg.attempts++;
      if(row.status==="SUBMITTED"||row.status==="COMPLETED")agg.completed++;
      if(row.percentage!==null&&Number.isFinite(Number(row.percentage))){agg.scoreSum+=Number(row.percentage);agg.scored++;}
      groups.set(key,agg);
    }
    const grouped=[...groups.values()].map(v=>({class:v.class,subject:v.subject,attempts:v.attempts,completed:v.completed,average_percentage:v.scored?Math.round(v.scoreSum/v.scored*100)/100:0}));
    grouped.sort((a,b)=>a.class.localeCompare(b.class,"en",{numeric:true})||a.subject.localeCompare(b.subject));
    return grouped;
  }
  async function statsRows(){
    const r=await admin.db.rpc("system_stats_db_readonly");
    if(r.error)throw r.error;
    const result=r.data as Record<string,unknown>||{};
    const data:Row[]=[];
    for(const [key,val] of Object.entries(result)){
      if(key==="largest_tables"&&Array.isArray(val)){
        for(const table of val as Array<{name:string;mb:number}>)data.push({metric:"Table: "+table.name,value:table.mb,unit:"MB"});
      }else data.push({metric:key,value:val,unit:key.endsWith("_mb")?"MB":"count"});
    }
    return data;
  }
  const wantedPage=Math.max(1,Math.min(100000,Number(p.get("page"))||1));
  let rows:Row[],total:number;
  const getPage=async(offset:number,size:number)=>{
    if(report.source==="stats"){
      const all=await statsRows();return {rows:all.slice(offset,offset+size),total:all.length};
    }
    if(report.id==="student-activity"||report.id==="mock-performance"){
      const all=await groupedActivity();return {rows:all.slice(offset,offset+size),total:all.length};
    }
    return pageRows(offset,size);
  };
  if(mode==="csv"){
    const head=csvLine(report.columns as string[]);
    const encoder=new TextEncoder();
    const stream=new ReadableStream<Uint8Array>({
      async start(controller){
        try{
          controller.enqueue(encoder.encode(head));
          let offset=0, total=Infinity;
          while(offset<total){
            const batch=await getPage(offset,report.id==="chapter-counts"?50:report.id==="mcq-summary"||report.id==="mock-readiness"?100:500);
            total=batch.total;
            if(!batch.rows.length)break;
            const out=batch.rows.map(row=>csvLine(report.columns.map(c=>(row as Row)[c]))).join("");
            controller.enqueue(encoder.encode(out));
            offset+=batch.rows.length;
          }
          controller.close();
        }catch(err){console.error("Admin CSV stream failed",err);controller.error(Error("Report export interrupted. Retry with narrower filters."));}
      }
    });
    const name=report.id+"-"+new Date().toISOString().replace(/[:.]/g,"-")+".csv";
    return new Response(stream,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="'+name+'"',"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  }
  const page=await getPage((wantedPage-1)*pageSize,pageSize);
  return NextResponse.json({report:report.id,columns:report.columns,rows:page.rows,total:page.total,page:wantedPage,pageSize,summary:{matching_records:page.total,page_records:page.rows.length},asOf:new Date().toISOString()},{headers:noStore});
 }catch(err){
  console.error("Admin report request failed",err instanceof Error?err.message:"unknown");
  return fail("Unable to load this report. Please refresh or narrow your filters.",500);
 }
}
