"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

type InstallEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
const DISMISSED_UNTIL = "cbse-install-dismissed-until-v1";

export default function InstallPrompt() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);
  const [ios, setIos] = useState(false);
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const deferred = useRef<InstallEvent | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const isInstalled = () => standalone.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone;
    const frame = requestAnimationFrame(() => {
      setInstalled(isInstalled());
      setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
      let dismissed = false;
      try { dismissed = Number(localStorage.getItem(DISMISSED_UNTIL)) > Date.now(); } catch { /* Storage can be unavailable in private mode. */ }
      setOpen(!isInstalled() && !dismissed);
      setReady(true);
    });
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      deferred.current = event as InstallEvent;
      setNativeAvailable(true);
    };
    const didInstall = () => { deferred.current = null; setInstalled(true); setOpen(false); };
    const changed = () => setInstalled(isInstalled());
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", didInstall);
    standalone.addEventListener("change", changed);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", didInstall);
      standalone.removeEventListener("change", changed);
    };
  }, []);

  function dismiss() {
    setOpen(false);
    try { localStorage.setItem(DISMISSED_UNTIL, String(Date.now() + 7 * 24 * 60 * 60 * 1000)); } catch { /* Dismiss still works for this visit. */ }
  }
  async function install() {
    const event = deferred.current;
    if (!event || busy) return;
    setBusy(true);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === "accepted") { setInstalled(true); setOpen(false); }
    } catch {
      // Keep browser-menu installation instructions available if native prompting fails.
      setOpen(true);
    } finally {
      deferred.current = null;
      setNativeAvailable(false);
      setBusy(false);
    }
  }

  if (!ready || installed || !["/", "/app", "/dashboard", "/install"].includes(pathname)) return null;
  // Student controls must remain clickable, including shorter chapter papers.
  // Keep installation available below the content instead of overlaying tests.
  const placement = pathname === "/app" || pathname === "/dashboard"
    ? "mx-auto my-6 w-fit"
    : "fixed bottom-3 right-3 z-40 sm:bottom-5 sm:right-5";
  return <aside className={`${placement} max-w-[calc(100vw-1.5rem)] text-slate-900`} aria-label="Install CBSE app">
    {open ? <section className="w-80 rounded-2xl border border-indigo-200 bg-white p-4 shadow-xl" aria-labelledby="install-app-title">
      <div className="flex items-start justify-between gap-3"><h2 id="install-app-title" className="font-extrabold">📲 Install ExamShuru</h2><button type="button" onClick={dismiss} aria-label="Dismiss install suggestion" className="min-h-10 min-w-10 rounded-lg border">✕</button></div>
      <p className="mt-2 text-sm">Open your quizzes quickly from your home screen. Internet is required for tests and sign-in.</p>
      {ios ? <ol className="mt-3 list-inside list-decimal space-y-1 text-sm"><li>Open this website in Safari.</li><li>Tap Share, then Add to Home Screen.</li><li>Tap Add to confirm.</li></ol> : nativeAvailable ? <button type="button" disabled={busy} onClick={() => void install()} className="mt-3 min-h-11 w-full rounded-lg bg-indigo-700 px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? "Opening install prompt…" : "Install app"}</button> : <p className="mt-3 text-sm">In Chrome or Edge, open the browser menu (⋮ or …) and choose Install app or Add to Home screen. If unavailable, use a supported browser.</p>}
      <div className="mt-3 flex items-center justify-between gap-3 text-sm"><Link href="/install" className="font-semibold text-indigo-700 underline">Installation help</Link><button type="button" onClick={dismiss} className="min-h-10 rounded-lg px-3 font-semibold">Not now</button></div>
    </section> : <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-full bg-indigo-700 px-4 py-2 text-sm font-bold text-white shadow-lg">📲 Install app</button>}
  </aside>;
}
