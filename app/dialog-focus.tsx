"use client";
import { useEffect, useRef } from "react";

// Mounted inside a modal. Existing close/submit handlers retain all authorization rules.
export function DialogFocus() {
 const marker=useRef<HTMLSpanElement>(null);
 useEffect(()=>{
  const dialog=marker.current?.closest<HTMLElement>('[role="dialog"]');
  if(!dialog)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const oldOverflow=document.body.style.overflow;
  document.body.style.overflow="hidden";
  const controls=()=>Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')).filter(el=>el.getClientRects().length>0);
  const initial=dialog.querySelector<HTMLElement>('input:not(:disabled),select:not(:disabled)')||controls()[0]||dialog;
  initial.focus();
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){
    const close=dialog.querySelector<HTMLButtonElement>('button[aria-label^="Close"]:not(:disabled)');
    if(close){event.preventDefault();close.click();}return;
   }
   if(event.key!=="Tab")return;
   const list=controls(),first=list[0],last=list[list.length-1];
   if(!first){event.preventDefault();dialog.focus();return;}
   if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus();}
  };
  document.addEventListener("keydown",onKey);
  return()=>{document.removeEventListener("keydown",onKey);document.body.style.overflow=oldOverflow;previous?.focus();};
 },[]);
 return <span ref={marker} aria-hidden="true"/>;
}
