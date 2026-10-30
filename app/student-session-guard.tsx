"use client";
import {useEffect,useRef,useState} from "react";
import {supabase,supabaseStorageKey} from "../lib/supabase";
import {sessionClaims,SESSION_REVOKED_EVENT,SESSION_REVOKED_MESSAGE} from "../lib/student-session-policy";

export default function StudentSessionGuard(){
 const [notice,setNotice]=useState(false);const kicking=useRef(false);
 useEffect(()=>{
  let alive=true;let busy=false;let exemptSession:string|null=null;
  const noticeTimer=window.setTimeout(()=>{if(new URLSearchParams(window.location.search).get('session')==='limit')setNotice(true);},0);
  async function kick(expectedSession:string){
   if(kicking.current)return;
   const {data:{session}}=await supabase.auth.getSession();
   if(!alive||!session||sessionClaims(session.access_token)?.session_id!==expectedSession)return;
   kicking.current=true;setNotice(true);
   // Local scope revokes only this browser's Auth session, preserving the other two.
   try{await supabase.auth.signOut({scope:"local"});}finally{
    window.localStorage.removeItem(supabaseStorageKey);
    window.location.replace('/app?session=limit');
   }
  }
  async function check(){
   if(!alive||busy||kicking.current||!navigator.onLine)return;
   busy=true;
   try{
    const {data:{session}}=await supabase.auth.getSession();
    const sid=session?sessionClaims(session.access_token)?.session_id:null;
    if(!sid||sid===exemptSession)return;
    const {data,error}=await supabase.rpc('cbse_claim_student_session_v1');
    if(!alive)return;
    if(!error&&data?.exempt)exemptSession=sid;
    if(!error&&data?.allowed===false)await kick(sid);
    // Temporary network/server errors do not sign out students.
   }catch{/* Retry on the next poll/focus instead of logging out on a transient failure. */}
   finally{busy=false;}
  }
  const onRevoked=(event:Event)=>{const sid=(event as CustomEvent<{sessionId?:string}>).detail?.sessionId;if(sid)void kick(sid);};
  const onVisible=()=>{if(document.visibilityState==='visible')void check();};
  const schedule=()=>window.setTimeout(()=>void check(),0);
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'&&session)setNotice(false);if(event==='SIGNED_IN'||event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED')schedule();});
  const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void check();},20000);
  const first=schedule();
  window.addEventListener(SESSION_REVOKED_EVENT,onRevoked);window.addEventListener('focus',onVisible);window.addEventListener('online',onVisible);document.addEventListener('visibilitychange',onVisible);
  return()=>{alive=false;window.clearTimeout(noticeTimer);window.clearTimeout(first);window.clearInterval(timer);subscription.unsubscribe();window.removeEventListener(SESSION_REVOKED_EVENT,onRevoked);window.removeEventListener('focus',onVisible);window.removeEventListener('online',onVisible);document.removeEventListener('visibilitychange',onVisible);};
 },[]);
 return notice?<div role="alert" className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-950">{SESSION_REVOKED_MESSAGE}</div>:null;
}
