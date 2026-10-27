"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";

// A small, deliberately constrained format: text plus ![accessible label](trusted image URL).
// No HTML, arbitrary Markdown, event handlers or executable URLs are interpreted.
function safeImageSource(source: string): boolean {
  if (/^\/question-images\/[a-zA-Z0-9/_\.\-]+\.(png|jpe?g|webp|svg)$/i.test(source)) return true;
  try {
    const url = new URL(source);
    return url.protocol === "https:" && url.hostname === "darfsuqfmmunxqiyqlvn.supabase.co" &&
      url.pathname.startsWith("/storage/v1/object/public/question-images/") && !url.username && !url.password;
  } catch { return false; }
}

function Diagram({ source, label }: { source: string; label: string }) {
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (expanded) node?.showModal();
    return () => { node?.close(); };
  }, [expanded]);
  const close = () => { setExpanded(false); trigger.current?.focus(); };
  return <span className="my-3 block max-w-full rounded-xl border border-slate-200 bg-white p-2 text-slate-700">
    {failed ? <span role="alert" className="block p-3 text-sm">Diagram could not load. Please reload before answering this question.</span> :
      <Image unoptimized width={1200} height={800} ref={trigger} src={source} alt={label || "Question diagram"} role="button" tabIndex={0} aria-label={`Enlarge diagram: ${label || "Question diagram"}`} loading="lazy" decoding="async" onError={() => setFailed(true)} onClick={e => {e.stopPropagation(); setExpanded(true);}} onKeyDown={e => {if (e.key === "Enter" || e.key === " ") {e.preventDefault(); e.stopPropagation(); setExpanded(true);}}} className="mx-auto block h-auto max-h-[36rem] max-w-full cursor-zoom-in object-contain" />}
    {!failed && <span className="mt-1 block text-center text-xs font-normal text-slate-500">Tap diagram to enlarge</span>}
    {expanded && createPortal(<dialog ref={dialog} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} onCancel={e => {e.preventDefault(); close();}} onClose={() => setExpanded(false)} className="fixed inset-0 m-auto max-h-[95dvh] w-[95vw] max-w-5xl overflow-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl backdrop:bg-slate-950/70">
      <div className="mb-3 flex items-center justify-between gap-4"><p className="text-sm font-bold text-slate-700">Question diagram</p><button type="button" autoFocus onClick={close} className="min-h-11 rounded-lg bg-slate-100 px-4 font-bold text-slate-800">Close ✕</button></div>
      <Image unoptimized width={1200} height={800} src={source} alt={label || "Question diagram"} className="mx-auto h-auto max-w-none" />
      <p className="mt-3 text-xs text-slate-500">Scroll to explore the full-size diagram. Press Escape to close.</p>
    </dialog>, document.body)}
  </span>;
}

export function QuestionContent({ text }: { text: string | null | undefined }) {
  const value = text || "";
  const imagePattern = /!\[([^\]\r\n]*)\]\(([^\s)]+)\)/g;
  const parts: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = imagePattern.exec(value))) {
    parts.push(value.slice(cursor, match.index));
    parts.push(safeImageSource(match[2]) ? <Diagram key={match.index} source={match[2]} label={match[1]} /> : <span key={match.index}>[Diagram unavailable: unsupported image location]</span>);
    cursor = imagePattern.lastIndex;
  }
  parts.push(value.slice(cursor));
  return <span className="whitespace-pre-wrap break-words">{parts}</span>;
}
