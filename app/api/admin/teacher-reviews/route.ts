import {NextRequest} from 'next/server';
import {requireStatsAdmin} from '../../../../lib/system-stats-server';
import {teacherReply as reply,uuid,bucket} from '../../../../lib/teacher-server';
export async function GET(req:NextRequest){try{
 const a=await requireStatsAdmin(req);if(!a||a.role!=='FULL_ADMIN')return reply({error:'Full Admin access required.'},403);
 const page=Math.max(0,Number(req.nextUrl.searchParams.get('page')||0));if(!Number.isSafeInteger(page))return reply({error:'Invalid page.'},400);
 const decision=req.nextUrl.searchParams.get('decision')||'DELETE',resolution=req.nextUrl.searchParams.get('resolution')||'PENDING';
 if(!['APPROVE','DELETE','CORRECT'].includes(decision)||!['PENDING','APPROVED','KEPT','REMOVED','CORRECTED'].includes(resolution))return reply({error:'Invalid filter.'},400);
 const [teachers,reviews,submissions]=await Promise.all([
 a.db.from('teacher_profiles').select('*,classes(class_name)').order('created_at',{ascending:false}).limit(200),
 a.db.from('teacher_question_reviews').select('*,teacher_profiles(full_name,class_id,classes(class_name)),questions(question_text,correct_option,explanation,chapters(chapter_name,subjects(subject_name)))',{count:'exact'}).eq('decision',decision).eq('resolution',resolution).order('updated_at',{ascending:false}).range(page*30,page*30+29),
 a.db.from('teacher_mcq_submissions').select('*,teacher_profiles(full_name),subjects(subject_name),chapters(chapter_name),teacher_mcq_files(id,file_name,file_size,uploaded,source_deleted_at)').neq('status','DRAFT').order('created_at',{ascending:false}).limit(100)]);
 if(teachers.error||reviews.error||submissions.error)throw Error('Load failed');return reply({teachers:teachers.data,reviews:reviews.data,total:reviews.count,submissions:submissions.data});
}catch{return reply({error:'Unable to load teacher review queue.'},503);}}
export async function POST(req:NextRequest){try{
 const a=await requireStatsAdmin(req);if(!a||a.role!=='FULL_ADMIN')return reply({error:'Full Admin access required.'},403);const b=await req.json();
 if(b.action==='download'){
 if(!uuid(b.fileId))return reply({error:'Choose a file.'},400);const {data:f}=await a.db.from('teacher_mcq_files').select('*').eq('id',b.fileId).eq('uploaded',true).is('source_deleted_at',null).maybeSingle();if(!f)return reply({error:'File not found.'},404);
 const {data,error}=await a.db.storage.from(bucket).createSignedUrl(f.object_path,60,{download:f.file_name});if(error)throw error;return reply({url:data.signedUrl});
 }
 if(b.action==='delete_submission'){
 if(!uuid(b.id))return reply({error:'Choose a submission.'},400);
 const {count:processed,error:pe}=await a.db.from('teacher_mcq_imports').select('file_id',{count:'exact',head:true}).eq('submission_id',b.id);if(pe)throw pe;if(processed)return reply({error:'Processed submissions retain import history. Use Teacher MCQ Imports to retry source cleanup.'},409);
 const {data:submission}=await a.db.from('teacher_mcq_submissions').select('id,teacher_id').eq('id',b.id).maybeSingle();if(!submission)return reply({error:'Submission not found.'},404);
 const {data:files,error:fe}=await a.db.from('teacher_mcq_files').select('object_path').eq('submission_id',b.id);if(fe)throw fe;
 const paths=(files||[]).map(f=>f.object_path);if(paths.some(p=>!p.startsWith(`${submission.teacher_id}/${submission.id}/`)))throw Error('Invalid file scope');
 if(paths.length){const {error}=await a.db.storage.from(bucket).remove(paths);if(error)throw error;}
 const {error}=await a.db.from('teacher_mcq_submissions').delete().eq('id',b.id);if(error)throw error;
 await a.db.from('teacher_review_audit').insert({actor_id:a.user.id,action:'SUBMISSION_DELETED',details:{submission_id:b.id,teacher_id:submission.teacher_id}});return reply({saved:true});
 }
 if(b.action==='submission'){
 if(!uuid(b.id)||!['UNDER_REVIEW','ADDED','NOT_USED'].includes(b.status)||typeof b.note!=='string'||b.note.length>4000)return reply({error:'Invalid submission update.'},400);
 const {data,error}=await a.db.from('teacher_mcq_submissions').update({status:b.status,admin_note:b.note,updated_by:a.user.id,updated_at:new Date().toISOString()}).eq('id',b.id).neq('status','DRAFT').select('id').single();if(error||!data)return reply({error:'Submission not found.'},404);return reply({saved:true});
 }
 if(b.action==='teacher'){
 if(!uuid(b.id)||!['SUSPEND','ENABLE','RENEW'].includes(b.operation))return reply({error:'Invalid teacher update.'},400);
 const {data,error}=await a.db.rpc('cbse_admin_teacher_access_v1',{p_actor:a.user.id,p_teacher:b.id,p_action:b.operation});if(error)return reply({error:'Unable to update teacher access.'},409);return reply({saved:true,teacher:data});
 }
 if(b.action==='resolve'){
 if(!uuid(b.id)||!['KEEP','REMOVE','CORRECT'].includes(b.resolution)||typeof b.note!=='string'||b.note.length>4000||typeof b.version!=='string'||!Number.isFinite(Date.parse(b.version)))return reply({error:'Invalid review action.'},400);
 const {error}=await a.db.rpc('cbse_admin_resolve_teacher_review_v1',{p_actor:a.user.id,p_review:b.id,p_action:b.resolution,p_note:b.note,p_option:b.option||null,p_explanation:b.explanation||'',p_review_version:b.version});
 if(error)return reply({error:error.code==='40001'?error.message:'Unable to apply this decision. Check the answer and explanation.'},409);return reply({saved:true});
 }
 return reply({error:'Unknown action.'},400);
}catch{return reply({error:'Unable to save admin decision.'},503);}}
