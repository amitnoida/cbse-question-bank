import Link from "next/link";
import { CLASS_NUMBERS, classPath } from "@/lib/seo-catalog";

export function PublicHeader() {
  return <>
    <a href="#main-content" className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-xl bg-indigo-700 px-5 py-3 font-bold text-white focus:translate-y-0">Skip to content</a>
    <header className="border-b border-slate-200 bg-white">
      <nav aria-label="Main navigation" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Link className="flex items-center gap-2 text-lg font-black tracking-tight text-slate-950" href="/">
          <span aria-hidden="true" className="rounded-xl bg-indigo-600 px-2.5 py-1.5 text-white">Q</span>CBSE Question Bank
        </Link>
        <div className="flex flex-wrap items-center gap-1 text-sm font-bold">
          {CLASS_NUMBERS.map(n => <Link key={n} className="rounded-xl px-2.5 py-2.5 text-slate-600 hover:bg-slate-100 sm:px-3" href={classPath(n)}>Class {n}</Link>)}
          <Link className="rounded-xl bg-indigo-600 px-4 py-3 text-white hover:bg-indigo-700" href="/app">Sign in / Join free</Link>
        </div>
      </nav>
    </header>
  </>;
}
export function PublicFooter() {
  return <footer className="border-t border-slate-200 bg-white">
    <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-6 px-5 py-9 text-sm text-slate-600">
      <div><p className="font-extrabold text-slate-900">A little practice. A clearer understanding.</p><p className="mt-2">Independent learning platform. Not affiliated with CBSE.</p></div>
      <nav aria-label="Help and resources" className="flex flex-wrap gap-5">
        <Link className="py-2 font-semibold hover:text-indigo-700" href="/install">Install app</Link>
        <a className="py-2 font-semibold hover:text-indigo-700" href="mailto:support.cbseexam@gmail.com">Contact support</a>
        <Link className="py-2 font-semibold hover:text-indigo-700" href="/app">Student app →</Link>
      </nav>
    </div>
  </footer>;
}
