import {createClient} from '@supabase/supabase-js';
import {NextRequest,NextResponse} from 'next/server';
import {adminDb,noStore} from './system-stats-server';
import {sessionClaims} from './student-session-policy';
export const teacherReply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:noStore});
export async function teacherIdentity(req:NextRequest){
 const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];if(!token)return null;
 const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await c.auth.getUser(token);if(error||!user)return null;
 const claims=sessionClaims(token);if(!claims)return null;
 const db=adminDb();const {data:teacher,error:e}=await db.rpc('cbse_teacher_context_v1',{p_user:user.id,p_session:claims.session_id});
 if(e)throw Error('Unable to verify teacher access.');
 return teacher?{db,user,teacher}:null;
}
export async function requireTeacher(req:NextRequest){const a=await teacherIdentity(req);if(!a||!a.teacher.is_active||new Date(a.teacher.starts_at)>new Date()||new Date(a.teacher.expires_at)<=new Date())return null;return a;}
export const positiveId=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
export const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const bucket='teacher-mcq-submissions';
export const fileTypes:Record<string,string>={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png'};
