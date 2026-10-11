"use client";
import { useEffect, useState } from "react";
export default function AnnouncementBanner(){
 const [message,setMessage]=useState("");
 useEffect(()=>{let alive=true;const load=async()=>{try{const r=await fetch("/api/public/announcement",{cache:"no-store"});if(r.ok){const j=await r.json();if(alive)setMessage(j.message||"");}}catch{}};void load();const timer=setInterval(load,60000);return()=>{alive=false;clearInterval(timer);};},[]);
 if(!message)return null;
 return <div role="status" className="sticky top-0 z-40 overflow-hidden bg-indigo-800 py-2 text-sm font-semibold text-white"><div className="animate-[marquee_18s_linear_infinite] whitespace-nowrap text-center">📢 {message}</div><style>{`@keyframes marquee{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}`}</style></div>;
}
