"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import type { ReportDefinition, ReportCategory } from "../../../lib/admin-reports";

type Class={id:number;class_name:string;class_number:number};
type Subject={id:number;class_id:number;subject_name:string};
type Chapter={id:number;subject_id:number;chapter_name:string;chapter_number:number|null};
type Filters={classes:Class[];subjects:Subject[];chapters:Chapter[]};
type Catalog={role:string;reports:ReportDefinition[];filters:Filters};
type Row=Record<string,unknown>;
type Result={columns:string[];rows:Row[];total:number;page:number;pageSize:number;summary:{matching_records:number;page_records:number};asOf:string};
const categories:{id:ReportCategory;title:string;description:string}[]=[
 {id:"mcq",title:"MCQ & Academic",description:"Question bank, content health and mock readiness"},
 {id:"operations",title:"Admin Operations",description:"Student enrollment, memberships, coupons and admin users"},
 {id:"students",title:"Student Performance",description:"Student activity and mock test outcomes"},
 {id:"system",title:"Technical & Database",description:"Developer-only database, security and integrity audits"},
];

// Explanations and suggested actions are guidance, not automated security or academic findings.
const reportGuidance: Record<string,[string,string,string]> = {"mcq-summary":["Question counts by class and subject, split into active and inactive.","Find subjects with limited question coverage.","Review subjects with unusually low active counts; counts do not confirm academic accuracy."],"mcq-master":["Complete question text, options, answers and explanations.","Inspect a particular question or verify answer content.","Check suspicious answers with an academic reviewer before editing."],"academic-master":["Configured classes, subjects and chapter reference records.","Check syllabus and chapter mapping.","Verify chapter names and mappings against the applicable syllabus."],"chapter-counts":["Active and inactive question counts per chapter.","Find chapters with too few usable questions.","Prioritize chapters with low active question counts for content review."],"mcq-quality":["Questions flagged for missing explanations or incomplete content.","Identify content needing corrections.","Review the affected questions before activating them."],"mcq-inactive":["Inactive questions and questions pending academic clearance.","Track blocked content.","Review reasons for inactivity; do not bulk-activate unverified questions."],"media-audit":["Questions with media references or pending image assets.","Identify questions requiring diagram or image checks.","Preview essential images and verify accessibility; a ready flag alone is not proof."],"mock-readiness":["Question pool availability against the configured mock eligibility rule.","Identify subjects that cannot support the intended mock format.","Check missing MOCK/SHARED counts and content quality before enabling tests."],"student-directory":["Registered student accounts, verification and membership information.","Manage enrollment and identify accounts needing attention.","Investigate unverified or inactive accounts using authorized workflows."],"student-activity":["Aggregated student quiz attempts and outcomes.","Understand engagement by class and subject.","Compare periods and distinguish attempts from unique students."],"subscriptions":["Membership status, start dates, expiry and recorded payments.","Identify upcoming renewals and expired access.","Review expiring memberships and verify entitlement dates before contacting students."],"coupons":["Created coupon codes, validity and redemption limits.","Monitor coupon availability and usage.","Check expiring coupons and redemption limits; retain redeemed history."],"mock-performance":["Aggregated mock-test attempts, completions and scores.","Spot subjects where students may need more support.","Investigate low averages with enough real-student attempts; do not assume answer keys are wrong."],"free-usage":["Per-subject free practice consumption.","Understand trial usage and possible upgrade interest.","Review usage patterns without treating every free user as a conversion prospect."],"function-audit":["Database table RLS and function execution security metadata.","Support developer review of database access controls.","Review verified exceptions with a qualified developer; function-only fields are not applicable to table rows."],"db-size":["Live database sizes and performance-related totals.","Track database growth and capacity.","Compare against a verified provider quota; investigate unusual growth."],"rls-policies":["Database row-level security policies and their expressions.","Help technical reviewers assess access restrictions.","Review policy ownership and scope before changing any permissions."],"integrity":["Potential missing question values; not a full integrity certification.","Find data-quality records needing investigation.","Validate flagged records before making database corrections."],"admin-access":["Administrator accounts, roles, activation and password setup state.","Review authorized administrative access.","Investigate inactive accounts or pending password setup; roles alone are not vulnerabilities."]};
const label=(v:string)=>v.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
const format=(v:unknown)=>{
 if(v===null||v===undefined)return "—";
 if(typeof v==="boolean")return v?"Yes":"No";
 if(typeof v==="object")return JSON.stringify(v);
 if(typeof v==="string"&&/^\d{4}-\d\d-\d\dT/.test(v))return new Date(v).toLocaleString("en-IN");
 return String(v);
};
// Keep database identifiers in the export and underlying API, but show meaningful
// business labels first. Technical identifiers remain available on demand.
const businessColumns=(report:string,columns:string[])=>{
 if(["student-directory","admin-access","subscriptions","coupons","free-usage"].includes(report))return columns.filter(c=>c!=="id"&&c!=="student_id"&&c!=="plan_id");
 return columns;
};
const friendlyHeader=(column:string)=>({
 full_name:"Name",email_verified:"Email verified",is_active:"Status",
 must_change_password:"Password setup required",created_at:"Created on",
 valid_until:"Coupon expires",valid_from:"Coupon valid from",
 end_date:"Membership expires",start_date:"Membership starts",
 amount_paid:"Amount paid",discount_percentage:"Discount",
 usage_count:"Redemptions",usage_limit:"Redemption limit",
 questions_used:"Free questions used",questions_allowed:"Free allowance",
 last_used_at:"Last practice",account_type:"Account type",
 } as Record<string,string>)[column]||label(column);
const friendlyValue=(report:string,column:string,value:unknown)=>{
 if(report==="admin-access"&&column==="role")return value==="FULL_ADMIN"?"Full Admin":value==="ADMIN_VIEW"?"Viewer Admin":format(value);
 if(column==="must_change_password")return value===true?"Required":value===false?"Complete":"Unknown";
 if(column==="is_active")return value===true?"Active":value===false?"Inactive":"Unknown";
 if(column==="discount_percentage"&&value!==null&&value!==undefined)return format(value)+"%";
 return format(value);
};
export default function AdminReportsPage(){
 const [catalog,setCatalog]=useState<Catalog|null>(null);
 const [activeCategory,setCategory]=useState<ReportCategory>("operations");
 const [reportId,setReportId]=useState("student-directory");
 const [classNumber,setClassNumber]=useState("");
 const [subjectId,setSubjectId]=useState("");
 const [chapterId,setChapterId]=useState("");
 const [status,setStatus]=useState("");
 const [usage,setUsage]=useState("");
 const [review,setReview]=useState("");
 const [search,setSearch]=useState("");
 const [from,setFrom]=useState("");
 const [to,setTo]=useState("");
 const [sortField,setSortField]=useState("");
 const [direction,setDirection]=useState("desc");
 const [loading,setLoading]=useState(false);
 const [catalogLoading,setCatalogLoading]=useState(true);
 const [error,setError]=useState("");
 const [result,setResult]=useState<Result|null>(null);
 const [exportBusy,setExportBusy]=useState(false);
 const [exportedBytes,setExportedBytes]=useState(0);
 const [requestVersion,setRequestVersion]=useState(0);

 const getBearer=useCallback(async()=>{
  const {data:{session},error}=await supabase.auth.getSession();
  if(error||!session?.access_token)throw new Error("Sign in to the admin dashboard before viewing reports.");
  return session.access_token;
 },[]);
 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    const token=await getBearer();
    const res=await fetch("/api/admin/reports?mode=catalog",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
    const data=await res.json();
    if(!res.ok)throw Error(data.error||"Unable to load admin report catalog");
    if(active)setCatalog(data as Catalog);
   }catch(e){if(active)setError(e instanceof Error?e.message:"Unable to open reports");}
   finally{if(active)setCatalogLoading(false);}
  })();
  return()=>{active=false;};
 },[getBearer]);

 const reports=catalog?.reports||[];
 const chosen=reports.find(r=>r.id===reportId);
 const sortChoices:Record<string,{value:string;label:string}[]> = {
  questions:[{value:"id",label:"Question ID"},{value:"created_at",label:"Created"},{value:"updated_at",label:"Updated"},{value:"difficulty",label:"Difficulty"},{value:"is_active",label:"Active status"},{value:"content_review_status",label:"Review status"},{value:"question_usage",label:"Question usage"},{value:"question_text",label:"Question text"}],
  chapters:[{value:"id",label:"Chapter ID"},{value:"chapter_number",label:"Chapter number"},{value:"chapter_name",label:"Chapter name"},{value:"created_at",label:"Created"}],
  subjects:[{value:"id",label:"Subject ID"},{value:"subject_name",label:"Subject name"},{value:"created_at",label:"Created"}],
  student_profiles:[{value:"id",label:"Student ID"},{value:"full_name",label:"Student name"},{value:"created_at",label:"Created"}],
  quiz_attempts:[{value:"id",label:"Attempt ID"},{value:"started_at",label:"Started"},{value:"percentage",label:"Percentage"}],
  subscriptions:[{value:"id",label:"Subscription ID"},{value:"end_date",label:"Expiry"},{value:"amount_paid",label:"Paid amount"}],
  coupons:[{value:"id",label:"Coupon ID"},{value:"valid_until",label:"Expiry"},{value:"usage_count",label:"Redeemed count"}],
  free_usage:[{value:"id",label:"Usage ID"},{value:"questions_used",label:"Questions used"},{value:"last_used_at",label:"Last used"}],
  admin_profiles:[{value:"created_at",label:"Created"},{value:"full_name",label:"Name"},{value:"role",label:"Role"}],
 };
 const sorts=chosen?.source==="metadata"
  ?(chosen.id==="function-audit"?
    [{value:"object_type",label:"Object type"},{value:"name",label:"Function or table name"},{value:"detail",label:"Review findings"},{value:"security_definer",label:"SECURITY DEFINER"}]:
    [{value:"table",label:"Table name"},{value:"policy",label:"Policy name"},{value:"command",label:"SQL command"},{value:"permissive",label:"Policy mode"}])
  :(chosen?sortChoices[chosen.source]||[]:[]);
 const showAcademic=["questions","subjects","chapters","quiz_attempts","free_usage","student_profiles"].includes(chosen?.source||"");
 const showSubject=["questions","subjects","chapters","quiz_attempts","free_usage"].includes(chosen?.source||"");
 const showChapter=["questions","chapters"].includes(chosen?.source||"");
 const showQuestionFields=chosen?.source==="questions";
 const showStatus=["questions","chapters","subjects","quiz_attempts","student_profiles","subscriptions","coupons","admin_profiles","metadata"].includes(chosen?.source||"");
 const showDates=!["stats","metadata"].includes(chosen?.source||"");
 const showSearch=["questions","subjects","chapters","student_profiles","coupons","admin_profiles","metadata"].includes(chosen?.source||"");
 const categoryReports=reports.filter(r=>r.category===activeCategory);
 const availableSubjects=useMemo(()=>catalog?.filters.subjects.filter(s=>!classNumber||String(s.class_id)===String(catalog.filters.classes.find(c=>String(c.class_number)===classNumber)?.id))||[],[catalog,classNumber]);
 const availableChapters=useMemo(()=>catalog?.filters.chapters.filter(c=>(!subjectId||String(c.subject_id)===subjectId)&&(!classNumber||availableSubjects.some(s=>s.id===c.subject_id)))||[],[catalog,availableSubjects,subjectId,classNumber]);

 const params=useCallback((chosenId:string,page:number,mode:"data"|"csv")=>{
  const p=new URLSearchParams({report:chosenId,page:String(page),mode,dir:direction});
  if(sortField)p.set("sort",sortField);
  if(classNumber)p.set("class",classNumber);
  if(subjectId)p.set("subject",subjectId);
  if(chapterId)p.set("chapter",chapterId);
  if(status)p.set("status",status);
  if(usage)p.set("usage",usage);
  if(review)p.set("review",review);
  if(search.trim())p.set("search",search.trim());
  if(from)p.set("from",from);
  if(to)p.set("to",to);
  return p;
 },[classNumber,subjectId,chapterId,status,usage,review,search,from,to,direction,sortField]);

 const load=useCallback(async(id=reportId,page=1)=>{
  setLoading(true);setError("");setResult(null);
  try{
   const token=await getBearer();
   const r=await fetch("/api/admin/reports?"+params(id,page,"data"),{headers:{Authorization:"Bearer "+token},cache:"no-store"});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||"Report data unavailable");
   setResult(data as Result);
  }catch(e){setError(e instanceof Error?e.message:"Report data unavailable");}
  finally{setLoading(false);}
 },[getBearer,params,reportId]);

 // Load the opening report once, then load on report selection or View Report.
 useEffect(()=>{
  if(!catalog||requestVersion!==0)return;
  setRequestVersion(1);
  if(!catalog.reports.some(r=>r.id==="student-directory")){setCategory("mcq");setReportId("mcq-summary");}
  void load(catalog.reports.some(r=>r.id==="student-directory")?"student-directory":"mcq-summary",1);
 },[catalog,requestVersion,load]);

 function pickCategory(cat:ReportCategory){
  const next=reports.find(r=>r.category===cat);
  if(!next)return;
  setCategory(cat);setReportId(next.id);setSortField("");setStatus("");setUsage("");setReview("");setResult(null);setError("");
  void load(next.id,1);
 }
 function pickReport(id:string){setReportId(id);setSortField("");setStatus("");setUsage("");setReview("");setResult(null);setError("");void load(id,1);}

 async function exportCsv(){
  if(!chosen)return;
  setExportBusy(true);setExportedBytes(0);setError("");
  try{
   const token=await getBearer();
   const response=await fetch("/api/admin/reports?"+params(reportId,1,"csv"),{headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(!response.ok){
    let message="Unable to export matching rows";
    try{const data=await response.json();message=data.error||message;}catch{}
    throw Error(message);
   }
   if(!response.body)throw Error("CSV download stream unavailable");
   const reader=response.body.getReader();
   const chunks:Uint8Array<ArrayBuffer>[]=[];
   let bytes=0;
   while(true){
    const {done,value}=await reader.read();
    if(done)break;
    const copy=new Uint8Array(new ArrayBuffer(value.byteLength));
    copy.set(value);
    chunks.push(copy);
    bytes+=copy.byteLength;
    setExportedBytes(bytes);
   }
   const disposition=response.headers.get("content-disposition")||"";
   const filename=disposition.match(/filename="([^"]+)"/)?.[1]||reportId+"-"+new Date().toISOString().replace(/[:.]/g,"-")+".csv";
   const blob=new Blob(chunks,{type:"text/csv;charset=utf-8"});
   const url=URL.createObjectURL(blob);
   const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
   URL.revokeObjectURL(url);
  }catch(e){setError(e instanceof Error?e.message:"CSV export failed");}
  finally{setExportBusy(false);}
 }

 if(catalogLoading)return <main className="mx-auto max-w-7xl p-5 text-slate-700">Checking administrator permissions…</main>;
 return <main className="min-h-screen bg-slate-50 px-3 py-6 text-slate-900 sm:px-6 sm:py-9">
  <div className="mx-auto max-w-7xl space-y-6">
   <header className="flex flex-wrap items-center justify-between gap-3">
    <div><p className="text-xs font-extrabold uppercase tracking-widest text-indigo-600">Admin Control Panel</p>
     <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Reports &amp; Admin Insights</h1>
     <p className="mt-2 text-sm text-slate-600">Daily operations, student outcomes and technical reports in separate sections</p></div>
    <div className="flex flex-wrap gap-2"><Link href="/admin" className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-indigo-700">← Admin Dashboard</Link>
     <Link href="/admin/system-stats" className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-indigo-700">System Stats</Link></div>
   </header>
   {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}<button className="ml-4 underline" onClick={()=>void (catalog?load():window.location.reload())}>Retry</button></div>}
   {catalog&&<p className="rounded-xl border border-indigo-100 bg-white px-4 py-3 text-sm text-slate-700">Signed in as <strong>{catalog.role==="FULL_ADMIN"?"Full Admin":"Admin Viewer"}</strong>. {catalog.role==="FULL_ADMIN"?"Full report and export access.":"Only MCQ reports and aggregate student summaries are available. Individual student data and security audits are restricted."}</p>}
   {catalog&&<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" role="tablist" aria-label="Report categories">
    {categories.map(c=>{
     const allowed=reports.some(r=>r.category===c.id);
     return <button key={c.id} type="button" role="tab" aria-selected={activeCategory===c.id} disabled={!allowed} onClick={()=>pickCategory(c.id)} className={`rounded-2xl border p-4 text-left transition ${activeCategory===c.id?"border-indigo-600 bg-indigo-700 text-white shadow-lg":"border-slate-200 bg-white text-slate-900 hover:border-indigo-300"} disabled:cursor-not-allowed disabled:opacity-40`}>
      <strong className="block text-sm sm:text-base">{c.title}</strong><span className={`mt-1 block text-xs ${activeCategory===c.id?"text-indigo-100":"text-slate-500"}`}>{c.description}</span>
     </button>;
    })}
   </div>}
   {catalog&&<section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <div className="grid gap-4 sm:grid-cols-2">
     <label className="text-sm font-bold">Select report
      <select aria-label="Select report" value={reportId} onChange={e=>pickReport(e.target.value)} className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal">
       {categoryReports.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}
      </select></label>
     <p className="self-end rounded-xl bg-indigo-50 p-3 text-sm leading-6 text-indigo-900">{chosen?.description||"Choose a report."}</p>
     {chosen&&reportGuidance[chosen.id]&&<div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-800 sm:col-span-2" aria-label="About this report and recommended actions">
      <h2 className="font-bold text-indigo-950">About this report — {chosen.title}</h2>
      <p className="mt-2"><strong>What it shows:</strong> {reportGuidance[chosen.id][0]}</p>
      <p className="mt-2"><strong>Why it helps:</strong> {reportGuidance[chosen.id][1]}</p>
      <p className="mt-2"><strong>Admin insight &amp; recommended action:</strong> {reportGuidance[chosen.id][2]}</p>
      <p className="mt-2 text-xs text-slate-600">Guidance only. Review the actual filtered results before making changes.</p>
     </div>}
     {chosen?.source==="metadata"&&<p className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900 sm:col-span-2">Live public-schema security metadata. Full Admin only. The function audit includes all public tables and functions; RLS Policy Details includes exact policy roles and expressions. These are observations, not automatic security fixes.</p>}
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
     {showAcademic&&<label className="text-xs font-bold text-slate-700">Class
      <select aria-label="Filter by class" className="mt-1 block w-full rounded-lg border p-3 font-normal" value={classNumber} onChange={e=>{setClassNumber(e.target.value);setSubjectId("");setChapterId("");}}>
       <option value="">All school classes</option>{catalog.filters.classes.map(c=><option key={c.id} value={c.class_number}>{c.class_name}</option>)}
      </select></label>}
     {showSubject&&<label className="text-xs font-bold text-slate-700">Subject
      <select aria-label="Filter by subject" className="mt-1 block w-full rounded-lg border p-3 font-normal" value={subjectId} onChange={e=>{setSubjectId(e.target.value);setChapterId("");}}>
       <option value="">All subjects</option>{availableSubjects.map(s=><option key={s.id} value={s.id}>{s.subject_name}</option>)}
      </select></label>}
     {showChapter&&<label className="text-xs font-bold text-slate-700">Chapter
      <select aria-label="Filter by chapter" className="mt-1 block w-full rounded-lg border p-3 font-normal" value={chapterId} onChange={e=>setChapterId(e.target.value)}>
       <option value="">All chapters</option>{availableChapters.map(c=><option key={c.id} value={c.id}>{c.chapter_name}</option>)}
      </select></label>}
     {showStatus&&<label className="text-xs font-bold text-slate-700">Status
      <select aria-label="Filter by status" className="mt-1 block w-full rounded-lg border p-3 font-normal" value={status} onChange={e=>setStatus(e.target.value)}>
       <option value="">All statuses</option>
       {chosen?.source==="metadata"?(chosen.id==="function-audit"?<><option value="review">Requires review</option><option value="rls-disabled">RLS disabled</option><option value="public-execute">PUBLIC execute</option><option value="definer">SECURITY DEFINER</option></>:<><option value="permissive">Permissive</option><option value="restrictive">Restrictive</option><option value="rls-disabled">RLS disabled</option></>):chosen?.source==="quiz_attempts"?<><option value="COMPLETED">Completed</option><option value="STARTED">Started</option></>:chosen?.source==="subscriptions"?<><option value="ACTIVE">Active</option><option value="EXPIRED">Expired</option></>:<><option value="active">Active</option><option value="inactive">Inactive</option></>}
      </select></label>}
     {showQuestionFields&&<label className="text-xs font-bold text-slate-700">Question usage
      <select aria-label="Filter question usage" className="mt-1 block w-full rounded-lg border p-3 font-normal" value={usage} onChange={e=>setUsage(e.target.value)}>
       <option value="">All usage</option><option value="PRACTICE">PRACTICE</option><option value="MOCK">MOCK</option><option value="SHARED">SHARED</option>
      </select></label>}
     {showQuestionFields&&<label className="text-xs font-bold text-slate-700">Review status
      <select aria-label="Filter review status" className="mt-1 block w-full rounded-lg border p-3 font-normal" value={review} onChange={e=>setReview(e.target.value)}>
       <option value="">All review states</option>{["PENDING_REVIEW","HOLD","LEGACY","TEST_READY"].map(s=><option key={s}>{s}</option>)}
      </select></label>}
     {showDates&&<label className="text-xs font-bold text-slate-700">From date
      <input aria-label="From date" type="date" value={from} onChange={e=>setFrom(e.target.value)} className="mt-1 block w-full rounded-lg border p-3 font-normal"/></label>}
     {showDates&&<label className="text-xs font-bold text-slate-700">To date
      <input aria-label="To date" type="date" value={to} onChange={e=>setTo(e.target.value)} className="mt-1 block w-full rounded-lg border p-3 font-normal"/></label>}
     {showSearch&&<label className="text-xs font-bold text-slate-700 sm:col-span-2">Search
      <input aria-label="Search report" placeholder="Search matching report data" value={search} onChange={e=>setSearch(e.target.value)} maxLength={100} className="mt-1 block w-full rounded-lg border p-3 font-normal"/></label>}
     {sorts.length>0&&<label className="text-xs font-bold text-slate-700">Sort by
      <select aria-label="Sort by" value={sortField} onChange={e=>setSortField(e.target.value)} className="mt-1 block w-full rounded-lg border p-3 font-normal">
       <option value="">Default order</option>{sorts.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
      </select></label>}
     <label className="text-xs font-bold text-slate-700">Sort direction
      <select aria-label="Sort direction" value={direction} onChange={e=>setDirection(e.target.value)} className="mt-1 block w-full rounded-lg border p-3 font-normal">
       <option value="desc">Newest first</option><option value="asc">Oldest first</option>
      </select></label>
    </div>
    <div className="flex flex-wrap gap-2">
     <button type="button" onClick={()=>void load(reportId,1)} disabled={loading} className="inline-flex min-h-11 items-center rounded-xl bg-indigo-700 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50">{loading?"Loading…":result?"Refresh / View Report":"View Report"}</button>
     <button type="button" onClick={()=>{setClassNumber("");setSubjectId("");setChapterId("");setStatus("");setUsage("");setReview("");setSearch("");setFrom("");setTo("");setDirection("desc");setSortField("");setResult(null);}} className="inline-flex min-h-11 items-center rounded-xl border px-4 py-3 text-sm font-bold">Clear filters</button>
     <button type="button" onClick={()=>void exportCsv()} disabled={exportBusy||loading||!chosen} className="inline-flex min-h-11 items-center rounded-xl border border-indigo-600 px-4 py-3 text-sm font-bold text-indigo-700 disabled:opacity-50">{exportBusy?"Exporting "+(exportedBytes/1024).toFixed(0)+" KB…":"Export ALL matching rows (CSV)"}</button>
    </div>
    {result&&<div className="grid gap-3 sm:grid-cols-3" role="status">
     <div className="rounded-xl bg-indigo-50 p-4"><p className="text-xs font-bold text-indigo-700">Matching records</p><p className="mt-1 text-2xl font-black">{result.summary.matching_records.toLocaleString("en-IN")}</p></div>
     <div className="rounded-xl bg-slate-100 p-4"><p className="text-xs font-bold text-slate-700">Rows on this page</p><p className="mt-1 text-2xl font-black">{result.summary.page_records}</p></div>
     <div className="rounded-xl bg-slate-100 p-4"><p className="text-xs font-bold text-slate-700">Page / updated</p><p className="mt-1 text-sm font-black">{result.page} / {Math.max(1,Math.ceil(result.total/result.pageSize))}</p><p className="mt-1 text-xs text-slate-500">{new Date(result.asOf).toLocaleString("en-IN")}</p></div>
    </div>}
    {loading&&<p role="status" className="py-6 text-sm font-semibold text-indigo-700">Loading report records on demand…</p>}
    {result&&<div className="space-y-4">
     {["student-directory","admin-access","subscriptions","coupons","free-usage"].includes(reportId)&&<details className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><summary className="cursor-pointer font-semibold">Technical details</summary><p className="mt-2">Internal database IDs are hidden from the main table. Authorized administrators can still use the full CSV export for troubleshooting.</p></details>}
     <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[680px] text-left text-xs sm:text-sm">
       <thead className="sticky top-0 bg-slate-100"><tr>{businessColumns(reportId,result.columns).map(c=><th key={c} scope="col" className="whitespace-nowrap border-b p-3 font-black">{friendlyHeader(c)}</th>)}</tr></thead>
       <tbody>{result.rows.map((r,i)=><tr key={String(r.id??i)+"-"+i} className="border-b hover:bg-indigo-50/40">{businessColumns(reportId,result.columns).map(c=><td key={c} className="max-w-[320px] break-words p-3 align-top text-slate-700">{friendlyValue(reportId,c,r[c])}</td>)}</tr>)}</tbody>
      </table>
      {!result.rows.length&&<p className="p-6 text-center text-sm text-slate-600">No matching records for these filters.</p>}
     </div>
     <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-600">50 records per page · Export includes all matching rows</p>
      <div className="flex items-center gap-3"><button disabled={loading||result.page<=1} onClick={()=>void load(reportId,result.page-1)} className="min-h-10 rounded-lg border px-4 text-sm font-bold disabled:opacity-40">Previous</button>
       <span className="text-sm font-semibold">{result.page} / {Math.max(1,Math.ceil(result.total/result.pageSize))}</span>
       <button disabled={loading||result.page*result.pageSize>=result.total} onClick={()=>void load(reportId,result.page+1)} className="min-h-10 rounded-lg border px-4 text-sm font-bold disabled:opacity-40">Next</button></div>
     </div>
    </div>}
   </section>}
  </div>
 </main>;
}
