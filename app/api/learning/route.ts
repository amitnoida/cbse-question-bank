import {NextRequest} from "next/server";
import {learningUser,reply,body,must} from "@/lib/learning/server";
import {isOption,positiveId,publicSession} from "@/lib/learning/core";
import {uuid} from "@/lib/teacher-server";
export async function GET(req:NextRequest){try{
 const a=await learningUser(req);if(!a)return reply({error:"Please sign in with an active student account."},401);
 const cls=Number(req.nextUrl.searchParams.get("class")||a.membership.profile.class_id);if(!a.membership.classes.some(c=>c.id===cls))return reply({error:"Choose an available class."},403);
 const session=req.nextUrl.searchParams.get("session");
 if(session){if(!uuid(session))return reply({error:"Invalid session"},400);const r=must(await a.db.from("ey_sessions").select("id,mode,title,questions,answers,completed_at,class_id").eq("id",session).eq("student_id",a.user.id).gte("created_at",new Date(Date.now()-14*86400000).toISOString()).maybeSingle());if(!r||!a.membership.classes.some(c=>c.id===r.class_id))return reply({error:"Session unavailable"},404);return reply({session:publicSession(r)});}
 const [monthly,recommendations,recent]=await Promise.all([
 a.db.from("ey_monthly_progress").select("month,source,subject_id,sessions,answered,correct,subjects(subject_name)").eq("student_id",a.user.id).order("month",{ascending:false}).limit(300),
 a.db.rpc("ey_recommendations",{p_user:a.user.id,p_class:cls}),
 a.db.from("ey_sessions").select("id,title,mode,day,completed_at").eq("student_id",a.user.id).eq("class_id",cls).gte("created_at",new Date(Date.now()-14*86400000).toISOString()).order("created_at",{ascending:false}).limit(20)
 ]);return reply({classes:a.membership.classes,currentClass:cls,monthly:must(monthly),recommendations:must(recommendations),recent:must(recent)});
 }catch{return reply({error:"Learning tools could not load. Please retry."},503);}}
export async function POST(req:NextRequest){try{
 const a=await learningUser(req);if(!a)return reply({error:"Please sign in with an active student account."},401);const b=await body(req);
 if(b.action==="start"){
 const cls=Number(b.classId||a.membership.profile.class_id);if(!a.membership.classes.some(c=>c.id===cls))return reply({error:"Choose an available class."},403);
 if(!["DAILY","MISTAKES","ASSIGNMENT"].includes(b.mode)||(b.chapterId!=null&&!positiveId(b.chapterId))||(b.mode==="ASSIGNMENT"&&!uuid(b.assignmentId)))return reply({error:"Check learning selection."},400);
 const r=await a.db.rpc("ey_start",{p_user:a.user.id,p_class:cls,p_mode:b.mode,p_chapter:b.chapterId||null,p_assignment:b.assignmentId||null});
 if(r.error)return reply({error:r.error.code==="42501"?"This assignment or class is unavailable.":r.error.message?.includes("No eligible")?"No eligible questions yet. Complete some practice or choose another activity.":"Unable to start. You may have reached today's revision limit."},400);
 return reply({session:publicSession(r.data)});
 }
 if(b.action==="answer"){
 if(!uuid(b.sessionId)||!positiveId(b.questionId)||!isOption(b.answer))return reply({error:"Choose a valid answer."},400);
 const r=await a.db.rpc("ey_answer",{p_user:a.user.id,p_session:b.sessionId,p_question:b.questionId,p_answer:b.answer});if(r.error)return reply({error:"This session is unavailable or has closed. Reload your learning tools."},400);return reply({session:publicSession(r.data)});
 }
 if(b.action==="report"){
 if(!positiveId(b.questionId)||typeof b.reason!=="string"||b.reason.trim().length<10||b.reason.length>1000)return reply({error:"Describe the issue in 10–1000 characters."},400);
 const r=await a.db.rpc("ey_report",{p_user:a.user.id,p_question:b.questionId,p_reason:b.reason.trim()});return r.error?reply({error:"Question unavailable for reporting or daily limit reached."},400):reply({saved:true});
 }
 if(b.action==="feedback"){
 if([b.confusing,b.stopped,b.returnReason].some(v=>typeof v!=="string"||v.length>1000)||b.returnReason.trim().length<3)return reply({error:"Please complete the feedback, up to 1000 characters per answer."},400);
 const r=await a.db.from("ey_feedback").upsert({student_id:a.user.id,confusing:b.confusing.trim(),stopped:b.stopped.trim(),return_reason:b.returnReason.trim()},{onConflict:"student_id,day"});must(r);return reply({saved:true});
 }
 return reply({error:"Unknown action"},400);
 }catch{return reply({error:"Unable to save. Please retry."},503);}}
