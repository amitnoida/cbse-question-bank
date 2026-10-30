"use client";
import Link from "next/link";
import {useCallback,useEffect,useState} from "react";
import {supabase} from "../../../lib/supabase";
type Row={className:string;subject:string;used:number;allowance:number;remaining:number;students:number;records:number};
type Data={summary:{used:number;allowance:number;remaining:number;students:number;usageRecords:number;exhaustedRecords:number};bySubject:Row[];asOf:string;complete:boolean;definition:string};
export default function UsageDashboard(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(true);
 const load=useCallback(async()=>{setBusy(true);setError("");try{const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error("Sign in as Full Admin first.");
 const response=await fetch("/api/admin/usage",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
 const json=await response.json();if(!response.ok)throw Error(json.error||"Usage unavailable");setData(json);
 }catch(e){setError(e instanceof Error?e.message:"Usage unavailable");setData(null);}finally{setBusy(false);}},[]);
 useEffect(()=>{const t=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(t);},[load]);
 const cards=data?[["Questions consumed",data.summary.used],["Recorded allowance",data.summary.allowance],["Allowance remaining",data.summary.remaining],["Students with recorded usage",data.summary.students],["Exhausted usage records",data.summary.exhaustedRecords]]:[];
 return <main className="mx-auto max-w-6xl space-y-5 p-5 text-slate-900"><header><Link className="font-semibold text-indigo-700" href="/admin">← Admin</Link><h1 className="mt-3 text-3xl font-extrabold">Student usage and allowances</h1><p className="mt-2 text-slate-600">Real free-question usage compared with the recorded allowance, grouped by class and subject. This is not a payment or analytics report.</p></header>
 <button onClick={()=>void load()} className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white" disabled={busy}>Refresh live usage</button>
 {error&&<p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
 {busy&&<p>Reading usage data…</p>}
 {data&&<><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{cards.map(([name,value])=><article key={String(name)} className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-600">{name}</p><p className="mt-2 text-3xl font-extrabold">{value}</p></article>)}</div>
 {!data.complete&&<p role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-900">Usage exceeds the live report limit; totals are partial.</p>}
 <section className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{["Class","Subject","Used","Allowed","Remaining","Students","Records"].map(x=><th key={x} scope="col" className="p-3">{x}</th>)}</tr></thead><tbody>{data.bySubject.map(x=><tr className="border-t" key={x.className+"-"+x.subject}><td className="p-3">{x.className}</td><td className="p-3 font-semibold">{x.subject}</td><td className="p-3">{x.used}</td><td className="p-3">{x.allowance}</td><td className="p-3">{x.remaining}</td><td className="p-3">{x.students}</td><td className="p-3">{x.records}</td></tr>)}</tbody></table>{!data.bySubject.length&&<p className="p-4">No recorded free usage.</p>}</section>
 <p className="text-sm text-slate-600">{data.definition} Last refreshed {new Date(data.asOf).toLocaleString("en-IN")}.</p>
 </>}
 </main>;
}
