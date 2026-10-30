import {NextRequest} from 'next/server';
import {requireStatsAdmin} from '../../../../lib/system-stats-server';
import {teacherReply as reply,uuid,positiveId,bucket} from '../../../../lib/teacher-server';
import {parseMcqDocument,MAX_IMPORT_TEXT} from '../../../../lib/mcq-document-parser';
const fileSelect='id,file_name,file_size,mime_type,uploaded,source_deleted_at,submission_id,teacher_mcq_submissions!inner(id,teacher_id,subject_id,chapter_id,status,note,teacher_profiles(full_name),subjects(subject_name),chapters(chapter_name)),teacher_mcq_imports(*)';
export async function GET(req:NextRequest){try{
 const a=await requireStatsAdmin(req);if(!a||a.role!=='FULL_ADMIN')return reply({error:'Full Admin access required.'},403);
 const page=Number(req.nextUrl.searchParams.get('page')||0);if(!Number.isSafeInteger(page)||page<0)return reply({error:'Invalid page.'},400);
 const fileId=req.nextUrl.searchParams.get('fileId');
 if(fileId){
 if(!uuid(fileId))return reply({error:'Invalid file.'},400);
 const {data:b,error:be}=await a.db.from('teacher_mcq_imports').select('question_ids').eq('file_id',fileId).maybeSingle();if(be)throw be;if(!b)return reply({error:'Import not found.'},404);
 const ids=b.question_ids.slice(page*30,page*30+30);if(!ids.length)return reply({questions:[],total:b.question_ids.length});
 const {data:q,error:qe}=await a.db.from('questions').select('id,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,is_active,chapter_id,question_usage,difficulty').in('id',ids);if(qe)throw qe;
 return reply({questions:(q||[]).sort((x,y)=>ids.indexOf(x.id)-ids.indexOf(y.id)),total:b.question_ids.length});
 }
 const {data,error,count}=await a.db.from('teacher_mcq_files').select(fileSelect,{count:'exact'}).eq('uploaded',true).neq('teacher_mcq_submissions.status','DRAFT').order('created_at',{ascending:false}).range(page*30,page*30+29);
 if(error)throw error;return reply({files:data,total:count});
}catch{return reply({error:'Unable to load teacher MCQ imports.'},503);}}
export async function POST(req:NextRequest){try{
 const a=await requireStatsAdmin(req);if(!a||a.role!=='FULL_ADMIN')return reply({error:'Full Admin access required.'},403);
 if(Number(req.headers.get('content-length')||0)>3_000_000)return reply({error:'Document text is too large. Split the file.'},413);
 let b;try{b=await req.json();}catch{return reply({error:'Invalid request.'},400);}
 if(!b||!uuid(b.fileId))return reply({error:'Choose a submitted file.'},400);
 const {data:f,error:fe}=await a.db.from('teacher_mcq_files').select('*,teacher_mcq_submissions!inner(id,teacher_id,subject_id,chapter_id,status)').eq('id',b.fileId).eq('uploaded',true).maybeSingle();
 if(fe)throw fe;if(!f||f.teacher_mcq_submissions.status==='DRAFT')return reply({error:'Submitted file not found.'},404);
 const {data:batch,error:be}=await a.db.from('teacher_mcq_imports').select('*').eq('file_id',f.id).maybeSingle();if(be)throw be;
 async function cleanup(committed:NonNullable<typeof batch>){
 if(committed.source_deleted_at)return reply({batch:committed,complete:true});
 const {data:verified,error:ve}=await a!.db.rpc('cbse_teacher_import_verified_v1',{p_file:f!.id});if(ve||!verified)return reply({error:'Import verification is pending. Source retained; retry cleanup.'},409);
 if(!f!.object_path.startsWith(`${f!.teacher_mcq_submissions.teacher_id}/${f!.submission_id}/`))throw Error('Invalid source path');
 const {error:removeError}=await a!.db.storage.from(bucket).remove([f!.object_path]);
 if(removeError)return reply({batch:committed,complete:false,message:'MCQs imported. Source cleanup pending; use Retry cleanup.'},202);
 const {data:saved,error}=await a!.db.rpc('cbse_teacher_import_cleanup_v1',{p_actor:a!.user.id,p_file:f!.id});
 if(error)return reply({batch:committed,complete:false,message:'Import saved. Retry cleanup to confirm source deletion.'},202);
 return reply({batch:saved,complete:true});
 }
 if(b.action==='cleanup'){if(!batch)return reply({error:'Complete an import before deleting its source.'},409);return await cleanup(batch);}
 if(b.action==='prepare'){
 if(batch)return reply({batch,complete:Boolean(batch.source_deleted_at)});
 if(f.source_deleted_at)return reply({error:'Source file has already been deleted.'},409);
 if(!/\.(pdf|docx)$/i.test(f.file_name)||!['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(f.mime_type))return reply({error:'This POC supports selectable-text PDFs and Word .docx files only.'},400);
 const {data:chapters,error:ce}=await a.db.from('chapters').select('id,chapter_name').eq('subject_id',f.teacher_mcq_submissions.subject_id).eq('is_active',true).order('chapter_number');if(ce)throw ce;
 const {data:signed,error}=await a.db.storage.from(bucket).createSignedUrl(f.object_path,120);if(error)throw error;
 return reply({url:signed.signedUrl,fileName:f.file_name,fileSize:f.file_size,chapters,chapterId:f.teacher_mcq_submissions.chapter_id});
 }
 if(b.action==='import'){
 if(batch)return await cleanup(batch);
 if(!positiveId(b.chapterId)||typeof b.text!=='string'||b.text.length>MAX_IMPORT_TEXT||typeof b.sha256!=='string'||!/^[a-f0-9]{64}$/.test(b.sha256))return reply({error:'Choose a chapter and check the extracted document.'},400);
 const parsed=parseMcqDocument(b.text);if(parsed.total===0)return reply({error:'No numbered MCQs recognized. Source retained. Use numbered questions, options A–D, Answer and Explanation.'},422);
 const {data,error}=await a.db.rpc('cbse_import_teacher_mcqs_v1',{p_actor:a.user.id,p_file:f.id,p_chapter:b.chapterId,p_sha256:b.sha256,p_total:parsed.total,p_skipped:parsed.skipped,p_reasons:parsed.reasons,p_questions:parsed.questions});
 if(error)return reply({error:error.code==='22023'?error.message:'Import could not be confirmed. Source retained; retry safely.'},409);
 return await cleanup(data);
 }
 return reply({error:'Unknown action.'},400);
}catch{return reply({error:'Processing could not be confirmed. Refresh to check import history, then retry safely.'},503);}}
