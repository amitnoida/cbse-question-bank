import {NextRequest} from 'next/server';
import {requireTeacher,teacherIdentity,teacherReply as reply,positiveId,uuid} from '../../../lib/teacher-server';
export async function GET(req:NextRequest){try{
 if(req.nextUrl.searchParams.get('action')==='identity')return reply({teacher:Boolean(await teacherIdentity(req))});
 const a=await requireTeacher(req);if(!a)return reply({error:'Teacher access is unavailable or expired. Contact your administrator.'},403);
 const action=req.nextUrl.searchParams.get('action')||'home';
 if(action==='home'){
 const [subjects,submissions,school]=await Promise.all([a.db.from('subjects').select('id,subject_name').eq('class_id',a.teacher.class_id).eq('is_active',true).order('display_order'),a.db.from('teacher_mcq_submissions').select('id,subject_id,note,status,admin_note,created_at,teacher_mcq_files(id,file_name,uploaded)').eq('teacher_id',a.user.id).order('created_at',{ascending:false}).limit(100),a.db.from('classes').select('class_name').eq('id',a.teacher.class_id).single()]);
 if(subjects.error||submissions.error||school.error)throw Error('Unable to load teacher dashboard.');return reply({teacher:a.teacher,className:school.data.class_name,subjects:subjects.data,submissions:submissions.data});
 }
 if(action==='sets'){
 const subject=Number(req.nextUrl.searchParams.get('subject')),chapter=Number(req.nextUrl.searchParams.get('chapter')||0);if(!positiveId(subject)||!Number.isSafeInteger(chapter)||chapter<0)return reply({error:'Choose a subject.'},400);
 const {data:sets,error}=await a.db.rpc('cbse_teacher_sets_v1',{p_teacher:a.user.id,p_subject:subject,p_chapter:chapter});if(error)return reply({error:'Subject or chapter is unavailable.'},403);
 const {data:chapters,error:ce}=await a.db.from('chapters').select('id,chapter_name').eq('subject_id',subject).eq('is_active',true).order('chapter_number');if(ce)throw ce;return reply({sets,chapters});
 }
 if(action==='questions'){
 const set=req.nextUrl.searchParams.get('set');if(!uuid(set))return reply({error:'Choose a review set.'},400);
 const {data:s,error}=await a.db.from('teacher_review_sets').select('question_ids,subject_id').eq('id',set).eq('teacher_id',a.user.id).maybeSingle();if(error||!s)return reply({error:'Set not found.'},404);
 const {data:scope}=await a.db.from('subjects').select('id').eq('id',s.subject_id).eq('class_id',a.teacher.class_id).eq('is_active',true).maybeSingle();if(!scope)return reply({error:'Set no longer available.'},403);
 const [q,r]=await Promise.all([a.db.from('questions').select('id,chapter_id,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,question_media,is_active,chapters!inner(chapter_name,subject_id,is_active)').in('id',s.question_ids).eq('is_active',true).eq('question_type','MCQ').eq('chapters.is_active',true).eq('chapters.subject_id',s.subject_id),a.db.from('teacher_question_reviews').select('*').eq('teacher_id',a.user.id).in('question_id',s.question_ids)]);if(q.error||r.error)throw Error('Unable to load questions.');
 const questions=(q.data||[]).sort((x,y)=>s.question_ids.indexOf(x.id)-s.question_ids.indexOf(y.id));return reply({questions,reviews:r.data});
 }
 return reply({error:'Unknown request.'},400);
}catch{return reply({error:'Unable to load teacher workspace. Please retry.'},503);}}
export async function POST(req:NextRequest){try{
 const a=await requireTeacher(req);if(!a)return reply({error:'Active teacher access required.'},403);
 const b=await req.json();if(!positiveId(b.questionId)||!['APPROVE','DELETE','CORRECT'].includes(b.decision)||typeof b.comment!=='string'||b.comment.length>4000||typeof b.explanation!=='string'||b.explanation.length>8000||!b.snapshot)return reply({error:'Check your review details.'},400);
 const {data,error}=await a.db.rpc('cbse_teacher_save_review_v1',{p_teacher:a.user.id,p_question:b.questionId,p_decision:b.decision,p_comment:b.comment,p_option:b.option||null,p_explanation:b.explanation,p_snapshot:b.snapshot});
 return error?reply({error:error.code==='40001'?'This question changed. Reload the set before reviewing it.':error.code==='22023'?error.message:'This question is unavailable for review.'},error.code==='40001'?409:400):reply({id:data});
}catch{return reply({error:'Unable to save review. Please retry.'},503);}}
