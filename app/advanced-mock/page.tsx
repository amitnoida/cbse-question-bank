"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { QuestionContent } from "../question-content";

type Subject = { id: number; subject_name: string };
type Question = {
 id: number; chapter_id: number; question_text: string;
 option_a: string; option_b: string; option_c: string; option_d: string;
 selected_answer: string | null; correct_option: string | null; explanation: string | null;
};
type Paper = {
 id: string; status: "STARTED" | "COMPLETED"; subject_id: number;
 paper_number: number | null; retake_number: number | null;
 deadline_at: string; correct_count: number | null; answered_count: number | null;
 score_percent: number | null; questions: Question[];
};
type History = {
 id: string; paper_number: number | null; retake_number: number | null;
 status: string; started_at: string; correct_count: number | null; score_percent: number | null;
};
type Overview = {
 subject_name: string; class_name: string; released_questions: number; ready_for_60: boolean;
 paid: boolean; active_paper: { id: string } | null; history: History[];
};

const btn = "rounded-xl px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40";
function secondsLeft(deadline: string) {
 return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
}
function fmt(seconds: number) {
 return String(Math.floor(seconds / 60)).padStart(2,"0") + ":" + String(seconds % 60).padStart(2,"0");
}
function message(error: unknown) {
 return error instanceof Error ? error.message : String(error ?? "Something went wrong");
}

export default function AdvancedMockPage() {
 const [subjects,setSubjects] = useState<Subject[]>([]);
 const [selected,setSelected] = useState<number | null>(null);
 const [overview,setOverview] = useState<Overview | null>(null);
 const [paper,setPaper] = useState<Paper | null>(null);
 const [index,setIndex] = useState(0);
 const [left,setLeft] = useState(3600);
 const [busy,setBusy] = useState(false);
 const [loading,setLoading] = useState(true);
 const [saving,setSaving] = useState(false);
 const [error,setError] = useState("");
 const [notice,setNotice] = useState("");
 const [permitted,setPermitted] = useState(false);

 const refreshOverview = useCallback(async (id: number) => {
  const { data,error: rpcError } = await supabase.rpc("advanced_mock_overview_v1",{p_subject_id:id});
  if(rpcError) throw rpcError;
  setOverview(data as Overview);
 },[]);

 const openPaper = useCallback(async (paperId: string) => {
  const {data,error: rpcError} = await supabase.rpc("advanced_mock_get_v1",{p_paper_id:paperId});
  if(rpcError) throw rpcError;
  const loaded = data as Paper;
  if(!Array.isArray(loaded.questions) || loaded.questions.length!==60)
   throw new Error("Assigned Advanced Mock is incomplete. Contact support.");
  setPaper(loaded);
  setIndex(0);
  setLeft(secondsLeft(loaded.deadline_at));
 },[]);

 useEffect(() => {
  let alive=true;
  (async () => {
   try {
    const {data: auth,error:authError} = await supabase.auth.getUser();
    if(authError || !auth.user) throw new Error("Please sign in to access Advanced Mock Tests.");
    const {data: profile,error:pError} = await supabase.from("student_profiles")
      .select("class_id").eq("id",auth.user.id).single();
    if(pError || !profile?.class_id) throw new Error("Student enrollment could not be verified.");
    const {data: cl,error:clError} = await supabase.from("classes")
      .select("class_name").eq("id",profile.class_id).single();
    if(clError || !["Class 11","Class 12"].includes(cl?.class_name ?? ""))
      throw new Error("Advanced Mock Tests are available for Class 11 and Class 12 students only.");
    const {data: sub,error:sError} = await supabase.from("subjects")
      .select("id,subject_name").eq("class_id",profile.class_id).eq("is_active",true)
      .order("subject_name");
    if(sError) throw sError;
    if(!alive)return;
    const list=(sub ?? []) as Subject[];
    setSubjects(list);
    setPermitted(true);
    const requested=new URLSearchParams(window.location.search).get("subject");
    const initial=list.find(s=>s.subject_name===requested) ?? list[0];
    if(initial) setSelected(initial.id);
   } catch(e) {
    if(alive)setError(message(e));
   } finally {if(alive)setLoading(false);}
  })();
  return ()=>{alive=false};
 },[]);

 useEffect(() => {
  if(!selected)return;
  let alive=true;
  setOverview(null);setPaper(null);setError("");setNotice("");
  supabase.rpc("advanced_mock_overview_v1",{p_subject_id:selected}).then(({data,error:rpcError})=>{
   if(!alive)return;
   if(rpcError)setError(rpcError.message);
   else setOverview(data as Overview);
  });
  return ()=>{alive=false};
 },[selected]);

 useEffect(()=>{
  if(!paper || paper.status!=="STARTED")return;
  const tick=()=>setLeft(secondsLeft(paper.deadline_at));
  tick();
  const timer=window.setInterval(tick,1000);
  return ()=>window.clearInterval(timer);
 },[paper]);

 useEffect(()=>{
  if(left!==0 || !paper || paper.status!=="STARTED" || busy || saving)return;
  const id=paper.id;
  let alive=true;
  (async()=>{
   setBusy(true);
   try {
    const {error:finishError}=await supabase.rpc("advanced_mock_finish_v1",{p_paper_id:id});
    if(finishError)throw finishError;
    if(alive){await openPaper(id);if(selected)await refreshOverview(selected);}
   }catch(e){if(alive)setError(message(e));}
   finally{if(alive)setBusy(false);}
  })();
  return ()=>{alive=false};
 },[left,paper,busy,saving,selected,openPaper,refreshOverview]);

 async function start() {
  if(!selected || busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const {data,error:rpcError}=await supabase.rpc("advanced_mock_start_v1",{p_subject_id:selected});
   if(rpcError)throw rpcError;
   await openPaper((data as {paper_id:string}).paper_id);
   await refreshOverview(selected);
  }catch(e){setError(message(e));}finally{setBusy(false);}
 }

 async function answer(value:string) {
  if(!paper || paper.status!=="STARTED" || saving || busy || left===0)return;
  const question=paper.questions[index];if(!question)return;
  setSaving(true);setError("");
  try{
   const {data,error:rpcError}=await supabase.rpc("advanced_mock_answer_v1",{
    p_paper_id:paper.id,p_question_id:question.id,p_answer:value
   });
   if(rpcError)throw rpcError;
   if(!(data as {saved:boolean}).saved){await openPaper(paper.id);return;}
   setPaper(current=>current ? {...current,questions:current.questions.map(q=>
    q.id===question.id ? {...q,selected_answer:value} : q)} : current);
   setNotice("Answer saved");
  }catch(e){setError(message(e));}finally{setSaving(false);}
 }

 async function finish() {
  if(!paper || busy || saving || paper.status!=="STARTED")return;
  if(!window.confirm("Submit your Advanced Mock Test? Unanswered questions will count as incorrect."))return;
  setBusy(true);setError("");
  try{
   const {error:rpcError}=await supabase.rpc("advanced_mock_finish_v1",{p_paper_id:paper.id});
   if(rpcError)throw rpcError;
   await openPaper(paper.id);
   if(selected)await refreshOverview(selected);
   setNotice("Advanced Mock Test completed. Your result is saved.");
  }catch(e){setError(message(e));}finally{setBusy(false);}
 }

 function paperName(p: {paper_number:number|null;retake_number:number|null}) {
  return p.paper_number!==null ? "Advanced Mock " + p.paper_number : "Advanced Retake " + p.retake_number;
 }

 const q=paper?.questions[index];
 const answered=paper?.questions.filter(x=>x.selected_answer).length??0;

 return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
  <div className="mx-auto max-w-4xl">
   <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
    <div><p className="text-xs font-extrabold uppercase tracking-wider text-indigo-700">CBSE • Class 11 and 12</p>
     <h1 className="mt-1 text-2xl font-extrabold">Advanced Mock Test</h1>
     <p className="mt-1 text-sm text-slate-600">Separate 60-question, 60-minute tests. Standard Mock Tests remain unchanged.</p></div>
    <Link href="/app" className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-bold">Back to Dashboard</Link>
   </div>
   {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
   {notice && <p role="status" className="mb-4 text-sm font-semibold text-emerald-700">{notice}</p>}
   {loading ? <p>Checking your enrollment…</p> : !permitted ? <p className="rounded-xl bg-white p-6">Please return to your Class 11/12 student dashboard.</p> : <>
    {!paper && <>
     <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <label htmlFor="advanced-subject" className="block text-sm font-bold">Subject</label>
      <select id="advanced-subject" className="mt-2 w-full rounded-lg border border-slate-300 p-3" value={selected??""}
       onChange={e=>setSelected(Number(e.target.value))}>
       {subjects.map(s=><option value={s.id} key={s.id}>{s.subject_name}</option>)}
      </select>
      {overview ? <>
       <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
        <div><p className="text-xs text-slate-500">Released questions</p><p className="text-xl font-bold">{overview.released_questions}</p></div>
        <div><p className="text-xs text-slate-500">Test length</p><p className="text-xl font-bold">60 questions</p></div>
        <div><p className="text-xs text-slate-500">Duration</p><p className="text-xl font-bold">60 min</p></div>
       </div>
       {!overview.ready_for_60 && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
        Advanced Mock questions are being academically reviewed. Tests unlock when at least 60 questions in this subject have been approved. No unverified questions will be served.
       </p>}
       {overview.ready_for_60 && !overview.paid && <p className="mt-4 rounded-xl bg-blue-50 p-4 text-sm">An active paid membership is required.</p>}
       {overview.active_paper
        ? <button type="button" onClick={()=>{setBusy(true);openPaper(overview.active_paper!.id).catch(e=>setError(message(e))).finally(()=>setBusy(false));}}
           disabled={busy} className={btn+" mt-5 bg-indigo-700 text-white"}>Resume Advanced Mock</button>
        : <button type="button" onClick={start} disabled={busy || !overview.ready_for_60 || !overview.paid}
           className={btn+" mt-5 bg-indigo-700 text-white"}>Start Next Advanced Mock</button>}
      </>:<p className="mt-4 text-sm text-slate-600">Loading subject eligibility…</p>}
     </section>
     {overview && overview.history.length>0 && <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-lg font-bold">Your Advanced Mock history</h2>
      <div className="space-y-2">{overview.history.map(p=><button key={p.id} type="button"
        className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-left text-sm hover:bg-slate-50"
        onClick={()=>{setBusy(true);openPaper(p.id).catch(e=>setError(message(e))).finally(()=>setBusy(false));}} disabled={busy}>
        <span>{paperName(p)} — {p.status}</span><span>{p.status==="COMPLETED" ? String(p.score_percent)+"%" : "Resume"}</span>
       </button>)}</div>
     </section>}
    </>}
    {paper && q && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
     <div className="flex flex-wrap justify-between gap-3">
      <div><p className="text-sm font-bold text-indigo-700">{paperName(paper)}</p>
       <p className="text-sm text-slate-600">Question {index+1} of {paper.questions.length} · {answered} answered</p></div>
      {paper.status==="STARTED" ? <div className="rounded-lg bg-slate-900 px-4 py-2 font-mono font-bold text-white" role="timer">{fmt(left)}</div>
       : <div className="text-lg font-bold text-green-700">{paper.score_percent}% · {paper.correct_count}/60 correct</div>}
     </div>
     <div className="my-5 flex flex-wrap gap-2" aria-label="Question navigation">
      {paper.questions.map((item,i)=><button type="button" key={item.id} onClick={()=>setIndex(i)}
       aria-label={"Question "+(i+1)} aria-current={i===index?"step":undefined}
       className={(i===index?"bg-indigo-700 text-white":item.selected_answer?"bg-green-100 text-green-900":"bg-slate-100 text-slate-700")+" h-9 w-9 rounded-lg text-xs font-bold"}>{i+1}</button>)}
     </div>
     <h2 className="mb-5 text-lg font-bold"><QuestionContent text={q.question_text}/></h2>
     <div className="space-y-3">{(["A","B","C","D"] as const).map(letter=><button type="button" key={letter}
       onClick={()=>answer(letter)} disabled={paper.status==="COMPLETED" || saving || busy || left===0}
       className={(q.selected_answer===letter?"border-indigo-600 bg-indigo-50":"border-slate-200 bg-white")+" flex w-full gap-3 rounded-xl border p-4 text-left text-sm disabled:cursor-default"}>
       <strong>{letter}.</strong><QuestionContent text={q[("option_"+letter.toLowerCase()) as "option_a"|"option_b"|"option_c"|"option_d"]}/></button>)}</div>
     {paper.status==="COMPLETED" && <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm">
       <p><strong>Correct answer:</strong> {q.correct_option}</p>
       <p className="mt-2"><strong>Explanation:</strong> <QuestionContent text={q.explanation}/></p>
      </div>}
     <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
      <button type="button" className={btn+" bg-slate-100"} onClick={()=>setIndex(Math.max(0,index-1))} disabled={index===0}>Previous</button>
      <div className="flex gap-2"><button type="button" className={btn+" bg-slate-100"} onClick={()=>{setPaper(null);if(selected)refreshOverview(selected).catch(e=>setError(message(e)));}}>Back to history</button>
       {index<59 && <button type="button" className={btn+" bg-slate-900 text-white"} onClick={()=>setIndex(index+1)}>Next</button>}
       {paper.status==="STARTED" && <button type="button" className={btn+" bg-indigo-700 text-white"} disabled={busy||saving} onClick={finish}>Submit test</button>}
      </div>
     </div>
     {paper.status==="COMPLETED" && <button type="button" className={btn+" mt-6 border border-slate-300 bg-white print:hidden"} onClick={()=>window.print()}>Print / Save results as PDF</button>}
    </section>}
   </>}
  </div>
 </main>;
}
