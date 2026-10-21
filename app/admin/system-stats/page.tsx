"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "../../../lib/supabase";
type Usage={provider:string;metric_key:string;used:number;quota:number;unit:string;scope:string;period_label:string;created_at:string};
type Stats={database:Record<string,unknown>;usage:Usage[];as_of:string};
const defaults:[string,string,string,number,string][]=[
 ["supabase","database_size","Database storage",500,"MB"],
 ["supabase","monthly_active_users","Monthly active users",50000,"count"],
 ["supabase","egress","Uncached egress",5,"GB"],
 ["supabase","cached_egress","Cached egress",5,"GB"],
 ["supabase","file_storage","File storage",1,"GB"],
 ["supabase","log_ingestion","Log ingestion",1,"GB"],
 ["supabase","log_query","Log query",100,"GB"],
 ["supabase","edge_function_invocations","Edge functions",500000,"count"],
 ["supabase","realtime_messages","Realtime messages",2000000,"count"],
 ["supabase","realtime_peak_connections","Realtime peak connections",200,"count"],
 ["vercel","fast_data_transfer","Fast Data Transfer",0,"MB"],
 ["vercel","fast_origin_transfer","Fast Origin Transfer",0,"MB"],
 ["vercel","cdn_requests","CDN Requests",0,"count"],
 ["vercel","function_invocations","Function Invocations",0,"count"],
 ["vercel","function_cpu","Function CPU",0,"seconds"],
 ["vercel","isr_reads","ISR Reads",0,"count"]
];
export default function SystemStats(){
 const [data,setData]=useState<Stats|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[tab,setTab]=useState("supabase");
 const [metric,setMetric]=useState("supabase:database_size"),[used,setUsed]=useState(""),[quota,setQuota]=useState("500"),[unit,setUnit]=useState("MB"),[period,setPeriod]=useState("07 Oct 2026 - 07 Nov 2026"),[saving,setSaving]=useState(false);
 const fetchData=useCallback(async()=>{setLoading(true);setError("");try{const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error("Sign in as an administrator first");const r=await fetch("/api/admin/system-stats",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});const j=await r.json();if(!r.ok)throw Error(j.error||"Unable to load");setData(j);}catch(e){setError(e instanceof Error?e.message:"Unexpected error")}finally{setLoading(false)}},[]);
 useEffect(()=>{void fetchData()},[fetchData]);
 const chosen=defaults.find(x=>`${x[0]}:${x[1]}`===metric);
 const selectMetric=(v:string)=>{setMetric(v);const row=defaults.find(x=>`${x[0]}:${x[1]}`===v);if(row){setQuota(row[3]?String(row[3]):"");setUnit(row[4]);setUsed("")}};
 const save=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);setError("");try{const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error("Not signed in");const [provider,metric_key]=metric.split(":");const r=await fetch("/api/admin/system-stats",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({provider,metric_key,used:Number(used),quota:Number(quota),unit,period_label:period,scope:provider==="supabase"?"organization / all projects":"vercel account / selected range"})});const j=await r.json();if(!r.ok)throw Error(j.error||"Save failed");setUsed("");await fetchData();}catch(e){setError(e instanceof Error?e.message:"Save failed")}finally{setSaving(false)}};
 const cards=defaults.filter(x=>x[0]===tab);
 return <main style={{maxWidth:1150,margin:"30px auto",padding:20,fontFamily:"Arial,sans-serif",color:"#172554"}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><div><Link href="/admin">← Admin Panel</Link><h1 style={{fontSize:30,fontWeight:800,margin:"12px 0 4px"}}>System Stats</h1><p>Supabase + Vercel usage and operational statistics</p></div><button onClick={()=>void fetchData()} style={button}>Refresh</button></div>
 <p style={{background:"#fef3c7",padding:12,borderRadius:8}}>Billing usage cards use administrator-recorded snapshots from official dashboards. They are <b>not automatically synced</b>. Live database data is shown separately. Never treat missing or old readings as healthy.</p>
 {error&&<p role="alert" style={{background:"#fee2e2",padding:12,color:"#991b1b"}}>{error}</p>}
 {loading&&<p>Loading…</p>}
 {data&&<>
  <h2 style={{fontSize:21,fontWeight:700,marginTop:25}}>Live PostgreSQL statistics</h2>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
   {Object.entries(data.database||{}).filter(([k])=>k!=="largest_tables").map(([k,v])=><div key={k} style={card}><small style={{textTransform:"capitalize",color:"#475569"}}>{k.replaceAll("_"," ")}</small><div style={{fontSize:25,fontWeight:700,marginTop:6}}>{String(v)}</div></div>)}
  </div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:12,marginTop:14}}>
   {Number.isFinite(Number(data.database?.total_mcqs))&&Number(data.database?.total_mcqs)>0&&<div style={card}>
    <b>MCQ activation</b>
    <UsageBar used={Number(data.database?.active_mcqs||0)} quota={Number(data.database?.total_mcqs)} unit="MCQs" label="Active" remainderLabel="Inactive" mode="composition" />
    <small style={{color:"#64748b"}}>Green = active questions; dark = inactive questions. Higher activation is positive.</small>
   </div>}
   {Number.isFinite(Number(data.database?.database_mb))&&<div style={card}>
    <b>Database storage</b>
    <div style={{marginTop:8,fontSize:24,fontWeight:800}}>{formatNumber(Number(data.database?.database_mb))} MB</div>
    <small style={{color:"#64748b"}}>Live PostgreSQL database size. A quota comparison is shown below only when an official usage snapshot has been recorded.</small>
    {(()=>{const dbUsage=data.usage.find(x=>x.provider==="supabase"&&x.metric_key==="database_size");return dbUsage?<UsageBar used={Number(dbUsage.used)} quota={Number(dbUsage.quota)} unit={dbUsage.unit} label="Used" remainderLabel="Available"/>:<p style={{fontSize:13,color:"#92400e"}}>Quota graph pending an official usage snapshot.</p>})()}
   </div>}
  </div>
  <h3 style={{marginTop:20}}>Largest database tables</h3>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>{(Array.isArray(data.database?.largest_tables)?data.database.largest_tables:[]).map((x:any)=>{const max=Math.max(0,...(Array.isArray(data.database?.largest_tables)?data.database.largest_tables:[]).map((t:any)=>Number(t.mb)||0));const size=Number(x.mb)||0;return <div key={x.name} style={card}><div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"baseline"}}><b style={{overflowWrap:"anywhere"}}>{x.name}</b><strong>{formatNumber(size)} MB</strong></div><div role="img" aria-label={`${x.name}: ${formatNumber(size)} MB; ${max?formatNumber(100*size/max):0}% of largest table`} style={{background:"#1f2937",borderRadius:20,height:13,overflow:"hidden",marginTop:12}}><div style={{height:"100%",width:`${max?Math.min(100,100*size/max):0}%`,background:"#16a34a"}}/></div><small style={{color:"#64748b"}}>Compared with largest table (not a storage quota)</small></div>})}</div>
 </>}
 <div style={{display:"flex",gap:10,marginTop:28,flexWrap:"wrap"}}>{["supabase","vercel","alerts"].map(t=><button key={t} onClick={()=>setTab(t)} style={{...button,background:tab===t?"#4338ca":"white",color:tab===t?"white":"#172554"}}>{t==="alerts"?"Alerts & history":t==="supabase"?"Supabase":"Vercel"}</button>)}</div>
 {tab!=="alerts"&&<>
  <h2 style={{fontSize:21,fontWeight:700,margin:"20px 0"}}>{tab==="supabase"?"Supabase Free Plan":"Vercel Hobby"} usage</h2>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>
   {cards.map(([provider,key,label,reference,referenceUnit])=>{
    const row=data?.usage.find(x=>x.provider===provider&&x.metric_key===key);
    const stale=row?Date.now()-new Date(row.created_at).getTime()>48*3600*1000:false;
    return <div key={key} style={card}>
     <b>{label}</b>
     {row?<>
      <UsageBar used={Number(row.used)} quota={Number(row.quota)} unit={row.unit} label="Used" remainderLabel="Available" />
      <small style={{color:stale?"#b45309":"#64748b"}}>{stale?"STALE · ":""}Recorded: {new Date(row.created_at).toLocaleString()} · {row.scope}</small>
     </>:<>
      <div style={{margin:"12px 0",fontWeight:700,color:"#92400e"}}>Not recorded</div>
      <div style={{height:16,background:"#e2e8f0",borderRadius:20}} aria-label="No recorded usage data"/>
      <p style={{fontSize:12,color:"#64748b"}}>{reference?`Reference quota: ${reference} ${referenceUnit} — verify in provider dashboard before recording.`:"No verified quota supplied. Add a current limit."}</p>
     </>}
    </div>;
   })}
  </div>
 </>}
 {tab==="alerts"&&<section style={card}><h2 style={{fontSize:21,fontWeight:700}}>Alerts & history</h2><p>Red at ≥85%, amber at ≥70%. A daily cron sends one email per metric and period when a recent recorded snapshot is ≥85% and email settings are configured. This does not automatically fetch provider usage.</p><p>Only the most recent 400 snapshots are considered. Email alerts require a snapshot no older than 48 hours.</p><ul>{(data?.usage||[]).filter(x=>100*x.used/x.quota>=70).map(x=><li key={x.provider+x.metric_key}>{x.provider} · {x.metric_key}: {(100*x.used/x.quota).toFixed(1)}%</li>)}</ul></section>}
 <section style={{...card,marginTop:25}}><h2 style={{fontSize:21,fontWeight:700}}>Record official usage snapshot</h2><p>Copy values from Supabase Organization → Usage or Vercel Account → Usage. Use the same unit for used and limit. Requires FULL_ADMIN role.</p><form onSubmit={save} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}><label>Metric<select value={metric} onChange={e=>selectMetric(e.target.value)} style={input}>{defaults.map(x=><option key={x[0]+x[1]} value={`${x[0]}:${x[1]}`}>{x[0]} · {x[2]}</option>)}</select></label><label>Used<input type="number" min="0" step="any" required value={used} onChange={e=>setUsed(e.target.value)} style={input}/></label><label>Free quota<input type="number" min="0.000001" step="any" required value={quota} onChange={e=>setQuota(e.target.value)} style={input}/></label><label>Unit<select value={unit} onChange={e=>setUnit(e.target.value)} style={input}>{["MB","GB","count","seconds"].map(x=><option key={x}>{x}</option>)}</select></label><label>Billing period / range<input value={period} onChange={e=>setPeriod(e.target.value)} style={input}/></label><button disabled={saving||!chosen} style={{...button,background:"#4338ca",color:"white",alignSelf:"end"}}>{saving?"Saving…":"Save snapshot"}</button></form></section>
 <p style={{marginTop:20,fontSize:13,color:"#64748b"}}>Provider billing measurements may differ from PostgreSQL pg_database_size(). Supabase figures can be organization-wide; Vercel usage range may differ. Last page refresh: {data?.as_of?new Date(data.as_of).toLocaleString():"—"}.</p>
 </main>;
}
const button:React.CSSProperties={border:"1px solid #cbd5e1",borderRadius:8,padding:"10px 15px",fontWeight:700,cursor:"pointer"};
const card:React.CSSProperties={border:"1px solid #e2e8f0",background:"#fff",borderRadius:12,padding:16};
const input:React.CSSProperties={display:"block",width:"100%",border:"1px solid #cbd5e1",borderRadius:6,padding:9,marginTop:5};

function formatNumber(n:number){return Number.isFinite(n)?new Intl.NumberFormat("en-IN",{maximumFractionDigits:2}).format(n):"—";}
function UsageBar({used,quota,unit,label="Used",remainderLabel="Available",mode="quota"}:{used:number;quota:number;unit:string;label?:string;remainderLabel?:string;mode?:"quota"|"composition"}){
 if(!Number.isFinite(used)||!Number.isFinite(quota)||quota<=0)return <p style={{color:"#b45309"}}>Usage graph unavailable — invalid quota.</p>;
 const pct=100*used/quota;
 const safePct=Math.max(0,Math.min(100,pct));
 const remaining=Math.max(0,quota-used);
 const status=mode==="composition"?"ACTIVE":pct>=85?"CRITICAL":pct>=70?"WARNING":"Within recorded quota";
 const statusColor=mode==="composition"?"#166534":pct>=85?"#b91c1c":pct>=70?"#92400e":"#166534";
 return <div style={{marginTop:12}}>
  <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap",fontSize:13,marginBottom:8}}>
   <strong>{formatNumber(used)} {unit} {label.toLowerCase()}</strong>
   <span>{formatNumber(remaining)} {unit} {remainderLabel.toLowerCase()}</span>
  </div>
  <div role="img" aria-label={`${formatNumber(pct)} percent ${label.toLowerCase()}, ${formatNumber(remaining)} ${unit} ${remainderLabel.toLowerCase()}`} style={{height:18,display:"flex",overflow:"hidden",background:"#1f2937",borderRadius:20}}>
   <div style={{width:`${safePct}%`,height:"100%",background:"#16a34a",transition:"width 0.2s"}}/>
  </div>
  <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:8}}>
   <span style={{fontSize:13,fontWeight:700,color:statusColor}}>{formatNumber(pct)}% · {status}</span>
   <span style={{fontSize:12,color:"#64748b"}}>Total {formatNumber(quota)} {unit}</span>
  </div>
  <div style={{display:"flex",gap:14,flexWrap:"wrap",fontSize:12,marginTop:8,color:"#475569"}}>
   <span><span style={{display:"inline-block",height:9,width:9,borderRadius:2,background:"#16a34a",marginRight:5}}/>{label}</span>
   <span><span style={{display:"inline-block",height:9,width:9,borderRadius:2,background:"#1f2937",marginRight:5}}/>{remainderLabel}</span>
  </div>
  {pct>100&&mode==="quota"&&<p style={{color:"#b91c1c",fontSize:12}}>Recorded usage exceeds the quota by {formatNumber(used-quota)} {unit}.</p>}
 </div>;
}
