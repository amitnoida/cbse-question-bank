import {cacheLife} from "next/cache";
import {NextRequest,NextResponse} from "next/server";
import {adminDb} from "@/lib/system-stats-server";
import {body,must} from "@/lib/learning/server";
import {isOption,positiveId,type LearningQuestion} from "@/lib/learning/core";
const reply=(v:unknown,s=200)=>NextResponse.json(v,{status:s,headers:{"Cache-Control":"no-store"}});
async function samples(){"use cache";cacheLife({stale:60,revalidate:300,expire:600});const db=adminDb();const allow=must(await db.from("ey_demo_samples").select("id,class_number,subject_name"))||[];const qs=must(await db.rpc("ey_snapshot",{p_ids:allow.map(x=>x.id)}))as LearningQuestion[];return qs.map(q=>({...q,class_number:allow.find(x=>x.id===q.id)?.class_number,demo_subject:allow.find(x=>x.id===q.id)?.subject_name}));}
export async function GET(req:NextRequest){try{const cls=Number(req.nextUrl.searchParams.get("class")||9),subject=req.nextUrl.searchParams.get("subject")||"Mathematics";if(![8,9,10,11,12].includes(cls)||!["Mathematics","Science"].includes(subject))return reply({error:"Choose Class 8–12, Maths or Science."},400);const qs=(await samples()).filter(q=>q.class_number===cls&&q.demo_subject===subject).map(({correct_option,explanation,...q})=>{void correct_option;void explanation;return q;});return reply({questions:qs.slice(0,10)});}catch{return reply({error:"Demo is temporarily unavailable. Please retry."},503);}}
export async function POST(req:NextRequest){try{const b=await body(req);if(b.action==="answer"){if(!positiveId(b.questionId)||!isOption(b.answer))return reply({error:"Choose an answer"},400);const q=(await samples()).find(x=>x.id===b.questionId);if(!q)return reply({error:"Sample unavailable"},404);return reply({id:q.id,correct_option:q.correct_option,explanation:q.explanation});}
 if(b.action==="event"&&["demo_started","demo_completed"].includes(b.event)&&["direct","teacher","social","search"].includes(b.channel)&&b.consent===true){must(await adminDb().rpc("ey_public_event",{p_event:b.event,p_channel:b.channel}));return reply({saved:true});}return reply({error:"Invalid request"},400);
 }catch{return reply({error:"Unable to complete demo request."},503);}}
