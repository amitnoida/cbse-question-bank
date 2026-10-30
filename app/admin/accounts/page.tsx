"use client";
import Link from "next/link";
import {useCallback,useEffect,useState} from "react";
import {supabase} from "../../../lib/supabase";
type Account={id:string;name:string;email:string;role:"STUDENT"|"TEACHER"|"ADMIN";className:string;status:string;created:string};
type Result={users:Account[];total:number;page:number;pageSize:number;authComplete:boolean;profileTruncated:boolean};
export default function Accounts(){
 const [data,setData]=useState<Result|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(true);
 const [search,setSearch]=useState(""),[role,setRole]=useState("ALL"),[page,setPage]=useState(1);
 const load=useCallback(async()=>{setBusy(true);setError("");try{
  const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error("Sign in as Full Admin first.");
  const params=new URLSearchParams({page:String(page),role,search});
  const response=await fetch("/api/admin/accounts?"+params,{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
  const json=await response.json();if(!response.ok)throw Error(json.error||"Directory unavailable.");
  setData(json);
 }catch(e){setError(e instanceof Error?e.message:"Directory unavailable.");setData(null);}finally{setBusy(false);}},[page,role,search]);
 useEffect(()=>{const t=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(t);},[load]);
 return <main className="mx-auto max-w-6xl space-y-5 p-5 text-slate-900">
  <nav className="flex flex-wrap items-center justify-between gap-4"><Link className="font-semibold text-indigo-700" href="/admin">← Admin</Link><Link className="rounded-lg bg-indigo-700 px-4 py-3 font-semibold text-white" href="/admin/create-user">Create student or teacher</Link></nav>
  <header><h1 className="text-3xl font-extrabold">Unified user directory</h1><p className="mt-2 text-slate-600">One read-only list for students, teachers and administrators. Accounts are not duplicated here. Only Full Admin can see identities.</p></header>
  <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-4"><label className="flex-1 text-sm font-semibold">Search name, email or class<input className="mt-1 w-full rounded-lg border p-3" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} maxLength={100}/></label><label className="text-sm font-semibold">Account type<select className="mt-1 block rounded-lg border p-3" value={role} onChange={e=>{setRole(e.target.value);setPage(1);}}><option value="ALL">All roles</option><option value="STUDENT">Students</option><option value="TEACHER">Teachers</option><option value="ADMIN">Administrators</option></select></label><button className="self-end rounded-lg border px-4 py-3" onClick={()=>void load()} disabled={busy}>Refresh</button></div>
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
  {data&&<><p className="text-sm font-semibold">{data.total} accounts match</p>{(!data.authComplete||data.profileTruncated)&&<p role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-900">Large directory: results may be incomplete. Narrow your search or extend pagination before treating counts as final.</p>}<div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{["Name","Email","Role","Class","Status","Created"].map(h=><th key={h} scope="col" className="p-3">{h}</th>)}</tr></thead><tbody>{data.users.map(u=><tr key={u.id} className="border-t"><td className="p-3 font-semibold">{u.name}</td><td className="break-all p-3">{u.email||"—"}</td><td className="p-3">{u.role}</td><td className="p-3">{u.className}</td><td className="p-3">{u.status}</td><td className="p-3">{u.created?new Date(u.created).toLocaleDateString("en-IN"):"—"}</td></tr>)}</tbody></table>{!data.users.length&&<p className="p-5">No matching accounts.</p>}</div><div className="flex justify-between"><button disabled={busy||page===1} onClick={()=>setPage(p=>p-1)} className="rounded border px-4 py-2 disabled:opacity-40">Previous</button><span>Page {page}</span><button disabled={busy||page*50>=data.total} onClick={()=>setPage(p=>p+1)} className="rounded border px-4 py-2 disabled:opacity-40">Next</button></div></>}
  {busy&&<p aria-live="polite">Loading accounts…</p>}
 </main>;
}
