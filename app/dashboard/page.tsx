"use client";







import { useEffect, useMemo, useState } from "react";



import { supabase } from "../../lib/supabase";







type Attempt = { id:number; subject_id:number|null; chapter_id:number|null; quiz_type:string|null; status:string|null; total_questions:number|null; answered_questions:number|null; correct_answers:number|null; wrong_answers:number|null; unanswered_questions:number|null; obtained_marks:number|null; total_marks:number|null; percentage:number|null; time_taken_seconds:number|null; started_at:string|null; submitted_at:string|null; created_at:string|null };







type Answer = {id:number;attempt_id:number;question_id:number;selected_answer:string|null;correct_answer:string|null;is_correct:boolean;marks_obtained:number|null};



type Subject = {id:number;subject_name:string;class_id:number};



type Chapter = {id:number;chapter_name:string;subject_id:number};



const number = (n:number|null|undefined) => Number(n ?? 0);



const fmtDate = (s:string|null|undefined) => s ? new Date(s).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}) : "—";



const fmtTime = (seconds:number) => `${Math.floor(seconds/3600)}h ${Math.floor((seconds%3600)/60)}m`;



const badge = (status:string) => status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";







export default function StudentDashboard() {



  const [user,setUser] = useState<{id:string;email?:string;user_metadata?:Record<string,any>}|null>(null);



  const [name,setName] = useState("");



  const [classId,setClassId] = useState<number|null>(null);



  const [className,setClassName] = useState("Not assigned");



  const [subjects,setSubjects] = useState<Subject[]>([]);



  const [chapters,setChapters] = useState<Chapter[]>([]);



  const [attempts,setAttempts] = useState<Attempt[]>([]);







  const [plan,setPlan] = useState("Free plan");



  const [expiry,setExpiry] = useState<string|null>(null);



  const [loading,setLoading] = useState(true);



  const [error,setError] = useState("");



  const [filter,setFilter] = useState("ALL");



  const [selectedAttempt,setSelectedAttempt] = useState<number|null>(null);



  const [answers,setAnswers] = useState<Answer[]>([]);



  const [answerLoading,setAnswerLoading] = useState(false);







  useEffect(()=>{



    let alive=true;



    async function load(){



      try {



        const {data:{user:authUser},error:authError}=await supabase.auth.getUser();



        if(authError) throw authError;



        if(!alive) return;



        if(!authUser){setLoading(false);return;}



        setUser(authUser);



        const [profileRes,classesRes,subjectsRes,chaptersRes,attemptsRes,subsRes]=await Promise.all([



          supabase.from("student_profiles").select("full_name,class_id").eq("id",authUser.id).maybeSingle(),



          supabase.from("classes").select("id,class_name"),



          supabase.from("subjects").select("id,subject_name,class_id").eq("is_active",true),



          supabase.from("chapters").select("id,chapter_name,subject_id").eq("is_active",true),



          supabase.from("quiz_attempts").select("id,subject_id,chapter_id,quiz_type,status,total_questions,answered_questions,correct_answers,wrong_answers,unanswered_questions,obtained_marks,total_marks,percentage,time_taken_seconds,started_at,submitted_at,created_at").eq("student_id",authUser.id).order("created_at",{ascending:false}).limit(1000),







          supabase.from("subscriptions").select("status,start_date,end_date").eq("student_id",authUser.id).eq("status","ACTIVE").order("end_date",{ascending:false}).limit(1),



        ]);



        if(!alive)return;



        for(const [label,res] of [["Profile",profileRes],["Classes",classesRes],["Subjects",subjectsRes],["Chapters",chaptersRes],["Test history",attemptsRes],["Subscription",subsRes]] as const){if(res.error) throw new Error(`${label}: ${res.error.message}`);}



        const cid=profileRes.data?.class_id ?? authUser.user_metadata?.class_id ?? null;



        setClassId(cid===null?null:Number(cid));



        setName(profileRes.data?.full_name || authUser.user_metadata?.full_name || "Student");



        setClassName((classesRes.data||[]).find(c=>Number(c.id)===Number(cid))?.class_name || "Not assigned");



        setSubjects((subjectsRes.data||[]) as Subject[]);



        setChapters((chaptersRes.data||[]) as Chapter[]);



        setAttempts((attemptsRes.data||[]) as Attempt[]);







        const active=(subsRes.data||[]).find(s=>!s.end_date||new Date(s.end_date).getTime()>=Date.now());



        setPlan(active?"Paid membership":"Free plan");setExpiry(active?.end_date||null);



      }catch(e:any){if(alive)setError(e?.message||"Unable to load dashboard");}



      finally{if(alive)setLoading(false);}



    }



    void load();return()=>{alive=false;};



  },[]);







  const subjectName=(id:number|null)=>subjects.find(s=>s.id===id)?.subject_name||"Unknown subject";



  const chapterName=(id:number|null)=>id===null?"Mixed chapters":chapters.find(c=>c.id===id)?.chapter_name||"Chapter";



  const completed=useMemo(()=>attempts.filter(a=>a.status==="COMPLETED"),[attempts]);



  const stats=useMemo(()=>{



    const questions=completed.reduce((sum,a)=>sum+number(a.total_questions),0);



    const answered=completed.reduce((sum,a)=>sum+number(a.answered_questions),0);



    const correct=completed.reduce((sum,a)=>sum+number(a.correct_answers),0);



    const time=completed.reduce((sum,a)=>sum+number(a.time_taken_seconds),0);



    return {questions,answered,correct,time,accuracy:answered?Math.round(100*correct/answered):0};



  },[completed]);



    const summarize = (type: "PRACTICE" | "MOCK") => {

    const rows = completed.filter(a => (a.quiz_type || "PRACTICE").toUpperCase() === type);

    const count = rows.length;

    const answered = rows.reduce((sum, a) => sum + number(a.answered_questions), 0);

    const correct = rows.reduce((sum, a) => sum + number(a.correct_answers), 0);

    const wrong = rows.reduce((sum, a) => sum + number(a.wrong_answers), 0);

    const avgScore = count ? Math.round(rows.reduce((sum, a) => sum + (number(a.total_marks) > 0 ? 100 * number(a.obtained_marks) / number(a.total_marks) : number(a.percentage)), 0) / count) : 0;

    const highestScore = count ? Math.round(Math.max(...rows.map(a => number(a.total_marks) > 0 ? 100 * number(a.obtained_marks) / number(a.total_marks) : number(a.percentage)))) : 0;

    const avgTime = count ? Math.round(rows.reduce((sum, a) => sum + number(a.time_taken_seconds), 0) / count) : 0;

    return { count, answered, correct, wrong, accuracy: answered ? Math.round(100 * correct / answered) : 0, avgScore, highestScore, avgTime };

  };

  const practiceSummary = summarize("PRACTICE");

  const mockSummary = summarize("MOCK");



const subjectProgress=useMemo(()=>subjects.filter(s=>s.class_id===classId).map(s=>{



    const a=completed.filter(x=>x.subject_id===s.id);



    const answered=a.reduce((sum,x)=>sum+number(x.answered_questions),0);



    const correct=a.reduce((sum,x)=>sum+number(x.correct_answers),0);



    return {name:s.subject_name,count:a.length,accuracy:answered?Math.round(100*correct/answered):null};



  }),[subjects,classId,completed]);



  const filtered=filter==="ALL"?attempts:attempts.filter(a=>a.quiz_type===filter);



  async function showAnswers(id:number){



    if(selectedAttempt===id){setSelectedAttempt(null);return;}



    setSelectedAttempt(id);setAnswerLoading(true);setAnswers([]);



    const {data,error:err}=await supabase.from("quiz_attempt_answers").select("id,attempt_id,question_id,selected_answer,correct_answer,is_correct,marks_obtained").eq("attempt_id",id).order("id");



    if(err)setError(err.message);else setAnswers((data||[]) as Answer[]);



    setAnswerLoading(false);



  }



  const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 sm:p-6";
  const recommendations = subjectProgress.filter(s=>s.accuracy!==null&&s.accuracy<70).sort((a,b)=>(a.accuracy??0)-(b.accuracy??0)).slice(0,3);
  const metricCards = [{label:"Completed tests",value:String(completed.length),icon:"🏆"},{label:"Answer accuracy",value:`${stats.accuracy}%`,icon:"🎯"},{label:"Questions answered",value:String(stats.answered),icon:"📚"},{label:"Study time",value:fmtTime(stats.time),icon:"⏱️"}];
  if(loading)return <main className="min-h-screen bg-slate-50 p-8 text-slate-700">Loading your dashboard...</main>;
  if(!user)return <main className="min-h-screen bg-slate-50 p-8"><div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-bold">Sign in required</h1><p className="mt-2 text-slate-600">Please sign in to view your learning dashboard.</p><a href="/" className="mt-5 inline-block rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white">Go to sign in</a></div></main>;
  return <main className="min-h-screen bg-[#f5f7fc] pb-16 text-slate-900">
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4"><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-indigo-600 sm:text-xs">CBSE Question Bank</p><h1 className="text-lg font-extrabold tracking-tight sm:text-xl">My Learning</h1></div><a href="/" className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 sm:px-5 sm:text-sm">← Back to Practice</a></div></header>
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-8">
      {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-700 to-violet-600 p-5 text-white shadow-lg shadow-indigo-200/60 sm:p-8"><div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full border-[28px] border-white/10"/><div className="relative"><p className="text-xs font-semibold text-indigo-100 sm:text-sm">Welcome back 👋</p><h2 className="mt-2 break-words text-2xl font-black tracking-tight sm:text-4xl">{name}</h2><p className="mt-2 text-sm text-indigo-100">Your preparation, all in one place.</p><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">🎓 {className}</span><span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">{plan === "Free plan" ? "✨ Free plan" : "👑 Premium"}</span>{expiry&&<span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">Until {fmtDate(expiry)}</span>}</div><p className="mt-3 break-all text-xs text-indigo-100">{user.email||"No email available"}</p></div></section>
      <section aria-label="Start learning"><div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-extrabold tracking-tight sm:text-xl">Start learning</h3><span className="text-xs text-slate-500">Choose your mode</span></div><div className="grid gap-3 sm:grid-cols-2"><a href="/" className="group flex min-h-32 items-center gap-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-5 transition hover:border-indigo-300 hover:shadow-md"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-2xl text-white">📚</span><span className="min-w-0 flex-1"><strong className="block text-base font-extrabold text-slate-900">Practice Test</strong><span className="mt-1 block text-sm text-slate-600">Practice MCQs chapter by chapter</span></span><span className="font-bold text-indigo-700">→</span></a><a href="/" className="group flex min-h-32 items-center gap-4 rounded-2xl border border-violet-100 bg-violet-50 p-5 transition hover:border-violet-300 hover:shadow-md"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-2xl text-white">⏱️</span><span className="min-w-0 flex-1"><strong className="block text-base font-extrabold text-slate-900">Real Mock Test</strong><span className="mt-1 block text-sm text-slate-600">60 questions · 60 minutes</span></span><span className="font-bold text-violet-700">→</span></a></div></section>
      <section aria-label="Learning overview"><h3 className="mb-3 text-lg font-extrabold tracking-tight sm:text-xl">Your progress</h3><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{metricCards.map(x=><article key={x.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 sm:p-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-xl">{x.icon}</span><p className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{x.value}</p><p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">{x.label}</p></article>)}</div></section>
      <section className="grid gap-4 lg:grid-cols-2">{(["PRACTICE","MOCK"] as const).map(type=>{const s=type==="PRACTICE"?practiceSummary:mockSummary;return <article key={type} className={card}><div className="flex items-start gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${type==="PRACTICE"?"bg-indigo-50":"bg-violet-50"}`}>{type==="PRACTICE"?"📖":"📝"}</span><div><h3 className="text-base font-extrabold sm:text-lg">{type==="PRACTICE"?"Practice Test Summary":"Real Mock Test Summary"}</h3><p className="mt-1 text-xs text-slate-500">Successfully completed tests only</p></div></div><div className="mt-5 grid grid-cols-2 gap-3">{[{label:"Tests completed",value:s.count},{label:"Questions answered",value:s.answered},{label:"Correct answers",value:s.correct},{label:"Wrong answers",value:s.wrong},{label:"Accuracy",value:`${s.accuracy}%`},{label:"Average score",value:s.count?`${s.avgScore}%`:"—"},{label:"Highest score",value:s.count?`${s.highestScore}%`:"—"},{label:"Average time",value:s.count?fmtTime(s.avgTime):"—"}].map(m=><div key={m.label} className="rounded-xl bg-slate-50 p-3 sm:p-4"><p className="text-xs text-slate-500">{m.label}</p><p className="mt-1 text-xl font-black tracking-tight">{m.value}</p></div>)}</div></article>})}</section>
      <section className="grid gap-4 lg:grid-cols-2"><article className={card}><h3 className="text-lg font-extrabold">📈 Subject-wise performance</h3><p className="mt-1 text-xs text-slate-500">Accuracy across completed tests</p><div className="mt-5 space-y-4">{subjectProgress.map(s=><div key={s.name}><div className="mb-2 flex items-center justify-between gap-2 text-sm"><span className="min-w-0 font-semibold">{s.name} <span className="font-normal text-slate-400">({s.count})</span></span><span className="shrink-0 font-bold">{s.accuracy===null?"Not attempted":`${s.accuracy}%`}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{width:`${s.accuracy??0}%`}}/></div></div>)}{!subjectProgress.length&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No subjects found for your class.</p>}</div></article><article className={card}><h3 className="text-lg font-extrabold">💡 What to study next</h3><p className="mt-1 text-xs text-slate-500">Recommendations based on test accuracy</p><div className="mt-4 space-y-3">{recommendations.map(s=><div key={s.name} className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm"><strong>{s.name}</strong><p className="mt-1 text-amber-900">{s.accuracy}% accuracy · Review incorrect answers and try again.</p></div>)}{!recommendations.length&&<p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{completed.length?"No subject is currently below 70% accuracy. Keep practicing!":"Complete your first test to receive personalized suggestions."}</p>}</div><a href="/" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700">Start practicing →</a></article></section>
      <section className={card}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-extrabold">📋 Test history</h3><p className="mt-1 text-xs text-slate-500">Practice and real mock attempts</p></div><select aria-label="Filter test history" value={filter} onChange={e=>setFilter(e.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="ALL">All tests</option><option value="PRACTICE">Practice</option><option value="MOCK">Real mock</option></select></div><div className="mt-4 space-y-3">{filtered.map(a=><article key={a.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="break-words font-bold">{subjectName(a.subject_id)} — {chapterName(a.chapter_id)}</p><p className="mt-1 text-xs text-slate-500">{a.quiz_type==="MOCK"?"Real Mock":"Practice"} · {fmtDate(a.submitted_at||a.started_at||a.created_at)} · {fmtTime(number(a.time_taken_seconds))}</p></div><div className="text-left sm:text-right"><p className="font-extrabold">{number(a.obtained_marks)}/{number(a.total_marks)} <span className="text-sm font-normal text-slate-500">({Math.round(number(a.percentage))}%)</span></p><span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-bold ${badge(a.status||"")}`}>{a.status||"Unknown"}</span></div></div><div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600"><span>✓ {number(a.correct_answers)} correct</span><span>✕ {number(a.wrong_answers)} wrong</span><span>○ {number(a.unanswered_questions)} unanswered</span><button type="button" onClick={()=>void showAnswers(a.id)} className="min-h-10 rounded-lg px-2 font-bold text-indigo-700 hover:bg-indigo-50 sm:ml-auto">{selectedAttempt===a.id?"Hide answers":"View answers"}</button></div>{selectedAttempt===a.id&&<div className="mt-3 border-t border-slate-100 pt-3">{answerLoading?<p className="text-sm text-slate-500">Loading answers...</p>:answers.length?<div className="max-h-72 space-y-2 overflow-auto">{answers.map((ans,i)=><p key={ans.id} className="break-words rounded-lg bg-slate-50 p-3 text-sm">Question {i+1} (ID {ans.question_id}): <strong className={ans.is_correct?"text-emerald-700":"text-rose-700"}>{ans.selected_answer||"Unanswered"}</strong> · Correct: <strong>{ans.correct_answer}</strong></p>)}</div>:<p className="text-sm text-slate-500">No saved answer details found.</p>}</div>}</article>)}{!filtered.length&&<div className="rounded-xl bg-slate-50 p-8 text-center text-slate-500"><p className="text-3xl">📝</p><p className="mt-2 font-semibold">No test attempts yet</p><p className="mt-1 text-sm">Complete and submit a test to see your progress here.</p></div>}</div></section>
      <p className="text-center text-xs text-slate-500">Dashboard data is read from your Supabase account. Test history shows up to 1,000 recent attempts.</p>
    </div>
  </main>;
}
