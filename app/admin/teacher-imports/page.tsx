'use client';
import Link from 'next/link';
import {useCallback,useEffect,useState} from 'react';
import {teacherApi,teacherButton as button,teacherField as field} from '../../../lib/teacher-client';
type Batch={imported_count:number;skipped_count:number;duplicate_count:number;total_count:number;source_deleted_at:string|null;completed_at:string};
type ImportFile={id:string;file_name:string;file_size:number;mime_type:string;source_deleted_at:string|null;teacher_mcq_imports:Batch|Batch[]|null;teacher_mcq_submissions:{subject_id:number;chapter_id:number|null;note:string;teacher_profiles:{full_name:string};subjects:{subject_name:string};chapters:{chapter_name:string}|null}};
type PreviewQuestion={id:number;question_text:string;option_a:string;option_b:string;option_c:string;option_d:string;correct_option:string;explanation:string};
type Chapter={id:number;chapter_name:string};
export default function TeacherImports(){
 const [autoBusy,setAutoBusy]=useState(false),[batchOutcome,setBatchOutcome]=useState('');
 const [files,setFiles]=useState<ImportFile[]>([]),[page,setPage]=useState(0),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [targets,setTargets]=useState<Record<string,{chapters:Chapter[];chapterId:string}>>({});
 const [preview,setPreview]=useState<{file:string;questions:PreviewQuestion[];page:number;total:number}|null>(null);
 async function viewQuestions(id:string,p=0){try{const d=await teacherApi(`/api/admin/teacher-imports?fileId=${id}&page=${p}`);setPreview({file:id,questions:d.questions,page:p,total:d.total});}catch(e){setError((e as Error).message);}}
 const load=useCallback(async()=>{setLoading(true);try{const d=await teacherApi(`/api/admin/teacher-imports?page=${page}`);setFiles(d.files);setTotal(d.total);}catch(e){setError((e as Error).message);}finally{setLoading(false);}},[page]);
 useEffect(()=>{const t=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(t);},[load]);
 async function chooseChapter(f:ImportFile){setBusy(f.id);setError('');try{const d=await teacherApi('/api/admin/teacher-imports',{action:'prepare',fileId:f.id});if(d.batch){await load();return;}setTargets(t=>({...t,[f.id]:{chapters:d.chapters,chapterId:String(d.chapterId||d.chapters[0]?.id||'')}}));}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 async function process(f:ImportFile){setBusy(f.id);setError('');setMessage('Preparing file…');try{
 const prepared=await teacherApi('/api/admin/teacher-imports',{action:'prepare',fileId:f.id});let result;
 if(prepared.batch){result=await teacherApi('/api/admin/teacher-imports',{action:'cleanup',fileId:f.id});}
 else{
 const chapterId=targets[f.id]?.chapterId||prepared.chapterId;
 if(!chapterId){setTargets(t=>({...t,[f.id]:{chapters:prepared.chapters,chapterId:''}}));throw Error('Choose the destination chapter for this file, then click Process & Import.');}
 setMessage('Downloading source…');const response=await fetch(prepared.url,{cache:'no-store'});if(!response.ok)throw Error('Source download failed. The original file is retained; retry.');const bytes=await response.arrayBuffer();
 if(bytes.byteLength!==prepared.fileSize)throw Error('Incomplete download. The original file is retained; retry.');
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
 const {readMcqDocument}=await import('../../../lib/read-mcq-document');
 const text=await readMcqDocument(bytes,prepared.fileName,setMessage);
 setMessage('Checking MCQs, importing complete questions and deleting the source…');
 result=await teacherApi('/api/admin/teacher-imports',{action:'import',fileId:f.id,chapterId:Number(chapterId),sha256,text});
 }
 setMessage(`${result.batch.imported_count} imported · ${result.batch.skipped_count} skipped · ${result.complete?'Source file deleted':'Import saved; source cleanup pending'}`);await load();
  return true;
 }catch(e){setError((e as Error).message);setMessage('');await load();return false;}finally{setBusy('');}}
 async function autoImport(){
  // The teacher-assigned chapter is essential. Never guess one, and never
  // silently convert an ambiguous submission into a different chapter.
  setAutoBusy(true);setBatchOutcome('');
  let imported=0,failed=0,skipped=0;
  const eligible=files.filter(f=>!f.source_deleted_at&&/\\.(pdf|docx)$/i.test(f.file_name));
  for(const f of eligible){
   const prior=Array.isArray(f.teacher_mcq_imports)?f.teacher_mcq_imports[0]:f.teacher_mcq_imports;
   if(!prior&&!f.teacher_mcq_submissions.chapter_id&&!targets[f.id]?.chapterId){skipped++;continue;}
   const ok=await process(f);if(ok)imported++;else failed++;
  }
  setBatchOutcome('Files completed: '+imported+' · Manual chapter mapping needed: '+skipped+' · Failed/retained for retry: '+failed+'.');
  setAutoBusy(false);await load();
 }
 return <main className="mx-auto min-h-screen max-w-5xl space-y-6 bg-slate-50 p-4 text-slate-900 sm:p-8"><header><Link href="/admin" className="font-semibold text-indigo-700">← Admin dashboard</Link><h1 className="mt-4 text-3xl font-bold">Teacher MCQ Imports</h1><p className="mt-2 text-sm text-slate-600">Process text-based PDF and Word .docx files. Clear, chapter-matched, nonduplicate MCQs are imported as active (without academic review). Incomplete, unclear or image-dependent questions are skipped; teachers handle academic review separately. The original file is automatically deleted after a verified import.</p><Link href="/admin/teacher-reviews" className="mt-3 inline-block font-semibold text-indigo-700 underline">Teacher reviews &amp; accounts →</Link></header>
 <section className="rounded-xl border bg-white p-4 text-sm"><p>One chapter per file. Include numbered questions, options A–D, Answer and Explanation. No AI academic review, no AI charges, and no manual repair of unclear questions. Keep this page open while processing.</p></section>
 {error&&<p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}{message&&<p role="status" className="rounded-lg bg-indigo-50 p-4 text-indigo-900">{message}</p>}
 <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-4"><h2 className="font-bold">Automatic batch import</h2><p className="mt-1 text-sm">One click processes all eligible files on this page, one by one. Only documents with a known destination chapter are imported. Incomplete, duplicate or unclear MCQs are ignored. Sources are deleted only after an import is verified; failures are retained for retry. PDFs must contain selectable text and Word files must be .docx.</p><button type="button" className={button+" mt-3"} disabled={Boolean(busy)||autoBusy||!files.length} onClick={()=>void autoImport()}>{autoBusy?"Processing batch…":"Auto-process eligible files on this page"}</button>{batchOutcome&&<p role="status" className="mt-2 text-sm font-semibold">{batchOutcome}</p>}</section>
 <div className="flex justify-between"><p className="font-semibold">{total} uploaded files</p><button className="min-h-11 rounded border px-4" disabled={Boolean(busy)||autoBusy} onClick={()=>void load()}>Refresh</button></div>
 {loading?<p>Loading imports…</p>:files.map(f=>{
 const batch=Array.isArray(f.teacher_mcq_imports)?f.teacher_mcq_imports[0]:f.teacher_mcq_imports;const s=f.teacher_mcq_submissions;const supported=/\.(pdf|docx)$/i.test(f.file_name);
 return <article key={f.id} className="space-y-3 rounded-xl border bg-white p-5"><h2 className="break-words text-lg font-bold">{f.file_name}</h2><p>{s.teacher_profiles.full_name} · {s.subjects.subject_name}{s.chapters&&` · ${s.chapters.chapter_name}`}</p>{s.note&&<p className="whitespace-pre-wrap text-sm text-slate-600">{s.note}</p>}
 {batch?<><p className="font-semibold">{batch.imported_count} imported · {batch.skipped_count} skipped · {batch.duplicate_count} duplicates included in skipped</p><p className={batch.source_deleted_at?'text-green-800':'text-amber-800'}>{batch.source_deleted_at?'Completed — source file deleted':'Imported — source cleanup pending'}</p><button className="min-h-11 rounded border px-4" onClick={()=>void viewQuestions(f.id)}>View imported MCQs</button>{preview?.file===f.id&&<div className="space-y-3">{preview.questions.map(q=><details key={q.id} className="rounded border p-3"><summary className="whitespace-pre-wrap font-semibold">{q.question_text}</summary><div className="mt-3 space-y-2">{(['A','B','C','D'] as const).map(o=><p key={o}>{o}. {q[`option_${o.toLowerCase()}` as 'option_a']}</p>)}<p>Answer: {q.correct_option}</p><p className="whitespace-pre-wrap">Explanation: {q.explanation}</p></div></details>)}<div className="flex gap-3"><button className="min-h-11 rounded border px-3" disabled={preview.page===0} onClick={()=>void viewQuestions(f.id,preview.page-1)}>Previous questions</button><button className="min-h-11 rounded border px-3" disabled={(preview.page+1)*30>=preview.total} onClick={()=>void viewQuestions(f.id,preview.page+1)}>Next questions</button><button className="min-h-11 rounded border px-3" onClick={()=>setPreview(null)}>Close questions</button></div></div>}{!batch.source_deleted_at&&<button className={button} disabled={Boolean(busy)} onClick={()=>void process(f)}>Retry source cleanup</button>}</>:f.source_deleted_at?<p>Source file deleted.</p>:<><p className="text-sm">Ready to process · {Math.ceil(f.file_size/1024)} KB</p>{!supported?<p>Legacy upload: download or delete it from Teacher reviews. New uploads support PDF and .docx only.</p>:<>
 {targets[f.id]&&<label className="block">Destination chapter<select aria-label="Destination chapter" className={field} disabled={Boolean(busy)} value={targets[f.id].chapterId} onChange={e=>setTargets(t=>({...t,[f.id]:{...t[f.id],chapterId:e.target.value}}))}><option value="">Choose chapter</option>{targets[f.id].chapters.map(c=><option key={c.id} value={c.id}>{c.chapter_name}</option>)}</select></label>}
 <div className="flex flex-wrap gap-3"><button className={button} disabled={Boolean(busy)} onClick={()=>void process(f)}>{busy===f.id?'Processing…':'Process & Import'}</button><button className="min-h-11 rounded border px-4" disabled={Boolean(busy)} onClick={()=>void chooseChapter(f)}>Choose chapter</button></div></>}</>}
 </article>;
 })}
 {!loading&&!files.length&&<p>No teacher files submitted yet.</p>}<div className="flex justify-between"><button className="min-h-11 rounded border px-4" disabled={Boolean(busy)||page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><button className="min-h-11 rounded border px-4" disabled={Boolean(busy)||(page+1)*30>=total} onClick={()=>setPage(p=>p+1)}>Next</button></div></main>;
}
