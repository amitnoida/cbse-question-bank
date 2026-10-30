import {supabase} from './supabase';
export async function teacherApi(path:string,body?:unknown){
 const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error('Sign in through the application first.');
 const r=await fetch(path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},cache:'no-store',...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Request failed.');return data;
}
export type ReviewQuestion={id:number;chapter_id:number;question_text:string;option_a:string;option_b:string;option_c:string;option_d:string;correct_option:string;explanation:string;is_active:boolean;question_media:unknown;chapters:{chapter_name:string}};
export function reviewSnapshot(q:ReviewQuestion){return {question_text:q.question_text,option_a:q.option_a,option_b:q.option_b,option_c:q.option_c,option_d:q.option_d,correct_option:q.correct_option,explanation:q.explanation,chapter_id:q.chapter_id,question_media:q.question_media,is_active:q.is_active};}
export const teacherField='mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white p-3';
export const teacherButton='min-h-11 rounded-lg bg-indigo-700 px-4 py-3 font-semibold text-white disabled:opacity-50';

export function sameSnapshot(a:unknown,b:unknown):boolean{
 const canonical=(v:unknown):string=>v&&typeof v==='object'?(Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>JSON.stringify(k)+':'+canonical(x)).join(',')+'}'):JSON.stringify(v);
 return canonical(a)===canonical(b);
}
