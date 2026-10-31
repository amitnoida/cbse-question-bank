import {NextRequest}from "next/server";
import {requireStatsAdmin}from "@/lib/system-stats-server";
import {reply,body,must}from "@/lib/learning/server";
import {uuid}from "@/lib/teacher-server";
export async function GET(req:NextRequest){try{const a=await requireStatsAdmin(req);if(!a||a.role!=="FULL_ADMIN")return reply({error:"Full Admin access required."},403);
 const [metrics,reports,feedback]=await Promise.all([a.db.rpc("ey_growth_metrics"),a.db.from("ey_reports").select("id,question_id,reason,status,admin_note,created_at,questions(question_text,chapters(chapter_name))").order("created_at",{ascending:false}).limit(100),a.db.from("ey_feedback").select("id,confusing,stopped,return_reason,created_at").order("created_at",{ascending:false}).limit(50)]);return reply({metrics:must(metrics),reports:must(reports),feedback:must(feedback)});
 }catch{return reply({error:"Unable to load pilot dashboard."},503);}}
export async function POST(req:NextRequest){try{const a=await requireStatsAdmin(req);if(!a||a.role!=="FULL_ADMIN")return reply({error:"Full Admin access required."},403);const b=await body(req);if(!uuid(b.id)||!["OPEN","ACKNOWLEDGED","RESOLVED"].includes(b.status)||typeof b.note!=="string"||b.note.length>1000)return reply({error:"Check report status and note."},400);must(await a.db.from("ey_reports").update({status:b.status,admin_note:b.note.trim()}).eq("id",b.id));return reply({saved:true});}catch{return reply({error:"Unable to update report."},503);}}
