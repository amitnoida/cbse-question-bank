"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {supabase} from "../../../lib/supabase";
const cls="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900";
export default function GuardianConsent(){
 const [form,setForm]=useState({guardianName:"",guardianEmail:"",method:"",verificationReference:"",relationshipBasis:"",consentReference:"",consentedAt:"",adultVerified:false,guardianAuthorityVerified:false,explicitConsentReceived:false});
 const [saved,setSaved]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [recent,setRecent]=useState<Array<{id:string;guardian_name:string;verified_at:string;student_id:string|null}>>([]);
 async function token(){const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error("Sign in as Full Admin first.");return session.access_token}
 async function list(){try{const t=await token();const r=await fetch("/api/admin/guardian-consents",{headers:{Authorization:"Bearer "+t},cache:"no-store"});const j=await r.json();if(r.ok)setRecent(j.consents||[])}catch{/* form reports failures on submit */}}
 useEffect(()=>{const t=window.setTimeout(()=>void list(),0);return()=>window.clearTimeout(t);},[]);
 const set=(k:string,v:string|boolean)=>setForm(p=>({...p,[k]:v}));
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");setSaved("");try{
  const t=await token(),r=await fetch("/api/admin/guardian-consents",{method:"POST",headers:{Authorization:"Bearer "+t,"Content-Type":"application/json"},body:JSON.stringify(form)});
  const j=await r.json();if(!r.ok)throw Error(j.error||"Verification record was not saved.");
  setSaved(j.id);await list();
 }catch(e){setError(e instanceof Error?e.message:"Unable to record verification")}finally{setBusy(false)}}
 return <main className="mx-auto max-w-3xl space-y-5 p-5 text-slate-900">
 <Link href="/admin/create-user" className="font-semibold text-indigo-700">← Create user</Link>
 <h1 className="text-3xl font-extrabold">Guardian identity and consent verification</h1>
 <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">Full Admin only. Do not mark a check unless an adult guardian has actually been verified using reliable identity and age evidence, relationship/authority checked, a privacy notice provided and informed consent recorded. An email OTP or an unchecked assertion is not proof of adulthood. Never upload Aadhaar, passports or raw identity documents into ExamShuru.</p>
 {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
 {saved&&<div role="status" className="rounded-lg bg-emerald-50 p-3"><p>Guardian verification audit saved. Use this ID once when creating the student account:</p><code className="break-all font-bold">{saved}</code></div>}
 <form onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-5">
 <label className="block font-semibold">Guardian full name<input required maxLength={120} className={cls} value={form.guardianName} onChange={e=>set("guardianName",e.target.value)}/></label>
 <label className="block font-semibold">Guardian contact email<input required type="email" maxLength={254} className={cls} value={form.guardianEmail} onChange={e=>set("guardianEmail",e.target.value)}/></label>
 <label className="block font-semibold">Reliable adult age and identity verification method<select required className={cls} value={form.method} onChange={e=>set("method",e.target.value)}><option value="">Select completed verification</option><option value="DIGILOCKER">Digital Locker identity/age token verified</option><option value="OFFLINE_GOVERNMENT_ID">Government-issued identity/age checked offline</option><option value="RELIABLE_EXISTING_RECORD">Reliable pre-existing verified adult identity record</option></select></label>
 <label className="block font-semibold">Non-sensitive verification reference<input required minLength={8} maxLength={120} className={cls} value={form.verificationReference} onChange={e=>set("verificationReference",e.target.value)} placeholder="Internal case reference only; never ID number"/></label>
 <label className="block font-semibold">How parental/legal guardian authority was checked<textarea required minLength={8} maxLength={300} className={cls} value={form.relationshipBasis} onChange={e=>set("relationshipBasis",e.target.value)} placeholder="Verification method and outcome, without sensitive documents"/></label>
 <label className="block font-semibold">Record of guardian's informed consent<input required minLength={8} maxLength={120} className={cls} value={form.consentReference} onChange={e=>set("consentReference",e.target.value)} placeholder="Case/ticket reference to signed or recorded consent"/></label>
 <label className="block font-semibold">Consent actually received at (local date/time)<input required type="datetime-local" className={cls} value={form.consentedAt} onChange={e=>set("consentedAt",e.target.value)}/></label>
 <label className="flex gap-2"><input type="checkbox" checked={form.adultVerified} onChange={e=>set("adultVerified",e.target.checked)}/> I personally verified the guardian is an identifiable adult aged 18+ using the selected reliable method.</label>
 <label className="flex gap-2"><input type="checkbox" checked={form.guardianAuthorityVerified} onChange={e=>set("guardianAuthorityVerified",e.target.checked)}/> I verified their parental or lawful guardian authority.</label>
 <label className="flex gap-2"><input type="checkbox" checked={form.explicitConsentReceived} onChange={e=>set("explicitConsentReceived",e.target.checked)}/> I gave the privacy notice and obtained the guardian's specific informed consent before collecting the child account details.</label>
 <button disabled={busy||!form.adultVerified||!form.guardianAuthorityVerified||!form.explicitConsentReceived} className="rounded-lg bg-indigo-700 px-5 py-3 font-bold text-white disabled:opacity-40">{busy?"Saving…":"Save verification audit"}</button>
 </form>
 <section className="space-y-2"><h2 className="text-xl font-bold">Recent verification records</h2><p className="text-xs text-slate-600">Only Full Admin can access this information.</p>{recent.slice(0,25).map(r=><article key={r.id} className="rounded-lg border p-3 text-sm"><strong>{r.guardian_name}</strong> · {r.student_id?"Used for account":"Unused"}<p className="break-all font-mono text-xs">{r.id}</p></article>)}</section>
 </main>
}
