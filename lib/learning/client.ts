import {supabase} from "../supabase";
export async function learningApi(path:string,payload?:unknown){
 const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error("Please sign in to use your learning tools.");
 const r=await fetch(path,{method:payload===undefined?"GET":"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:payload===undefined?undefined:JSON.stringify(payload),cache:"no-store"});
 const data=await r.json();if(!r.ok)throw Error(data.error||"Unable to complete request. Please retry.");return data;
}
