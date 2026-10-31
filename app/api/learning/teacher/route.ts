import {NextRequest}from "next/server";
import {requireTeacher,uuid,positiveId}from "@/lib/teacher-server";
import {reply,body,must}from "@/lib/learning/server";
export async function GET(req:NextRequest){try{const a=await requireTeacher(req);if(!a)return reply({error:"Active teacher account required."},403);
 const [subjects,chapters,quizzes]=await Promise.all([a.db.from("subjects").select("id,subject_name").eq("class_id",a.teacher.class_id).eq("is_active",true),a.db.from("chapters").select("id,subject_id,chapter_name,subjects!inner(class_id)").eq("subjects.class_id",a.teacher.class_id).eq("is_active",true).order("chapter_number"),a.db.rpc("ey_assignment_results",{p_teacher:a.user.id})]);return reply({subjects:must(subjects),chapters:must(chapters),quizzes:must(quizzes)});
 }catch{return reply({error:"Unable to load teacher quizzes."},503);}}
export async function POST(req:NextRequest){try{const a=await requireTeacher(req);if(!a)return reply({error:"Active teacher account required."},403);const b=await body(req);
 if(b.action==="close"&&uuid(b.id)){must(await a.db.from("ey_assignments").update({is_active:false}).eq("id",b.id).eq("teacher_id",a.user.id));return reply({saved:true});}
 if(b.action!=="create"||!positiveId(b.subjectId)||!positiveId(b.chapterId)||typeof b.title!=="string"||b.title.trim().length<3||b.title.length>100||!Number.isInteger(b.days)||b.days<1||b.days>30)return reply({error:"Check quiz title, chapter and expiry."},400);
 const r=await a.db.rpc("ey_create_assignment",{p_teacher:a.user.id,p_subject:b.subjectId,p_chapter:b.chapterId,p_title:b.title.trim(),p_days:b.days});return r.error?reply({error:"Could not create quiz. Check chapter availability and daily limit (10)."},400):reply({id:r.data});
 }catch{return reply({error:"Unable to save quiz."},503);}}
