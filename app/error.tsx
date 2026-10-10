"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Application error:", error); }, [error]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-violet-100 px-5 py-12">
      <section role="alert" className="w-full max-w-xl rounded-3xl border border-indigo-100 bg-white p-8 text-center shadow-xl sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-3xl" aria-hidden="true">📚</div>
        <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.2em] text-indigo-600">CBSE Exam Prep Guide</p>
        <h1 className="mt-3 text-3xl font-black text-slate-950">We're Having a Temporary Issue</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">We couldn't load this page right now. Please try again shortly.</p>
        <button type="button" onClick={reset} className="mt-8 rounded-xl bg-indigo-600 px-7 py-3 font-bold text-white hover:bg-indigo-700">Try Again</button>
        <p className="mt-7 text-xs text-slate-400">CBSE Question Bank · Practice • Learn • Improve</p>
      </section>
    </main>
  );
}
