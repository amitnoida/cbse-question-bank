import {NextRequest} from 'next/server';
import {requireTeacher,teacherReply as reply,positiveId,uuid,bucket,fileTypes} from '../../../../lib/teacher-server';
export async function POST(req:NextRequest){try{
 const a=await requireTeacher(req);if(!a)return reply({error:'Active teacher access required.'},403);
 const b=await req.json();
 if(b.action==='create'){
 if(!positiveId(b.subjectId)||typeof b.note!=='string'||b.note.length>4000||(b.chapterId!=null&&!positiveId(b.chapterId)))return reply({error:'Choose a subject and check your note.'},400);
 const {data:s}=await a.db.from('subjects').select('id').eq('id',b.subjectId).eq('class_id',a.teacher.class_id).eq('is_active',true).maybeSingle();if(!s)return reply({error:'Subject not available.'},403);
 if(b.chapterId){const {data:c}=await a.db.from('chapters').select('id').eq('id',b.chapterId).eq('subject_id',s.id).eq('is_active',true).maybeSingle();if(!c)return reply({error:'Chapter not available.'},400);}
 const {data,error}=await a.db.from('teacher_mcq_submissions').insert({teacher_id:a.user.id,subject_id:s.id,chapter_id:b.chapterId||null,note:b.note}).select('id').single();if(error)throw error;return reply(data,201);
 }
 if(!uuid(b.submissionId))return reply({error:'Choose a submission.'},400);
 const {data:s}=await a.db.from('teacher_mcq_submissions').select('id,status').eq('id',b.submissionId).eq('teacher_id',a.user.id).maybeSingle();if(!s)return reply({error:'Submission not found.'},404);
 if(b.action==='download'){
 if(!uuid(b.fileId))return reply({error:'Choose a file.'},400);
 const {data:f}=await a.db.from('teacher_mcq_files').select('*').eq('id',b.fileId).eq('submission_id',s.id).eq('uploaded',true).is('source_deleted_at',null).maybeSingle();if(!f)return reply({error:'File not found.'},404);
 const {data,error}=await a.db.storage.from(bucket).createSignedUrl(f.object_path,60,{download:f.file_name});if(error)throw error;return reply({url:data.signedUrl});
 }
 if(s.status!=='DRAFT')return reply({error:'This submission has already been sent.'},409);
 if(b.action==='upload'){
 const ext=typeof b.name==='string'?b.name.split('.').pop()?.toLowerCase():'';const mime=fileTypes[ext||''];
 if(!mime||b.name.length>200||typeof b.size!=='number'||!Number.isSafeInteger(b.size)||b.size<1||b.size>10485760)return reply({error:'Use text-based PDF or Word .docx files, up to 10 MB each.'},400);
 const id=crypto.randomUUID(),path=`${a.user.id}/${s.id}/${id}.${ext}`;
 const {data:count,error:ce}=await a.db.from('teacher_mcq_files').select('id').eq('submission_id',s.id);if(ce)throw ce;
 const previous=(await a.db.from('teacher_mcq_files').select('*').eq('submission_id',s.id).eq('file_name',b.name).eq('file_size',b.size).maybeSingle()).data;
 if(previous){
 const {data:info}=await a.db.storage.from(bucket).info(previous.object_path);
 if(info&&info.size===previous.file_size&&info.contentType===previous.mime_type)return reply({id:previous.id,alreadyUploaded:true});
 const {data:retry,error:re}=await a.db.storage.from(bucket).createSignedUploadUrl(previous.object_path,{upsert:false});if(re)throw re;return reply({id:previous.id,path:previous.object_path,token:retry.token,mime:previous.mime_type});
 }
 if((count||[]).length>=10)return reply({error:'Maximum 10 files per submission.'},400);
 const {error:e}=await a.db.from('teacher_mcq_files').insert({id,submission_id:s.id,file_name:b.name,object_path:path,mime_type:mime,file_size:b.size});if(e)throw e;
 const {data,error}=await a.db.storage.from(bucket).createSignedUploadUrl(path,{upsert:false});if(error)throw error;return reply({id,path,token:data.token,mime});
 }
 if(b.action==='finish'){
 const {data:files,error}=await a.db.from('teacher_mcq_files').select('*').eq('submission_id',s.id);if(error)throw error;if(!files?.length)return reply({error:'Upload at least one file.'},400);
 // Confirm stored size and type; client claims alone never finalize a submission.
 for(const f of files){const {data:info,error:e}=await a.db.storage.from(bucket).info(f.object_path);if(e||!info||info.size!==f.file_size||info.contentType!==f.mime_type)return reply({error:'A file has not finished uploading. Retry the upload before submitting.'},400);}
 const {error:fe}=await a.db.from('teacher_mcq_files').update({uploaded:true}).eq('submission_id',s.id);if(fe)throw fe;
 const {error:se}=await a.db.from('teacher_mcq_submissions').update({status:'SUBMITTED',submitted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',s.id).eq('status','DRAFT');if(se)throw se;return reply({saved:true});
 }
 return reply({error:'Unknown request.'},400);
}catch{return reply({error:'Unable to save submission. Your uploaded files remain in the draft; retry shortly.'},503);}}
