import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CLASS_NUMBERS, chapters, chapterPath, classPath, getClass, getSubject, getSubjectsForClass, subjectPath } from "@/lib/seo-catalog";

type Props = { params: Promise<{ classSlug: string; subjectSlug: string }> };

export function generateStaticParams() {
  return CLASS_NUMBERS.flatMap(n => getSubjectsForClass(n).map(s => ({classSlug: `class-${n}`, subjectSlug: s.slug})));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params, n = getClass(p.classSlug);
  const s = n ? getSubject(p.subjectSlug,n) : undefined;
  if (!n || !s) return {};
  return {
    title: `Class ${n} ${s.name} MCQ Practice and Chapters`,
    description: `Browse Class ${n} ${s.name} chapters, practice MCQs with explanations, and prepare for timed subject mock tests.`,
    alternates: { canonical: subjectPath(n,s.slug) },
  };
}
export default async function SubjectPage({ params }: Props) {
  const p = await params, n = getClass(p.classSlug);
  const s = n ? getSubject(p.subjectSlug,n) : undefined;
  if (!n || !s) notFound();
  const list = chapters.filter(c => c.classNumber === n && c.subjectSlug === s.slug)
    .sort((a,b) => a.chapterNumber - b.chapterNumber || a.chapterId - b.chapterId);
  const totalPractice = list.reduce((sum,c) => sum + c.activeQuestionCount, 0);
  return <main className="mx-auto max-w-6xl px-5 py-12">
    <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1 text-sm text-slate-600"><Link href="/">Home</Link> / <Link href={classPath(n)}>Class {n}</Link> / {s.name}</nav>
    <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Class {n} {s.name}: chapter-wise MCQ practice</h1>
    <p className="mt-4 max-w-3xl text-lg text-slate-700">Explore the {list.length} available chapters and {totalPractice} active practice MCQs in our {s.name} question bank. Select a chapter for a revision checklist and a link to interactive practice.</p>
    <h2 className="mt-10 text-2xl font-bold">Available chapters ({list.length})</h2>
    <ol className="mt-5 grid gap-3 md:grid-cols-2">{list.map(c => <li key={c.chapterId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md">
      <Link className="text-lg font-bold text-indigo-700 underline" href={chapterPath(c)}>{c.title}</Link>
      {c.description?.startsWith("Assessment scope:") && <p className="mt-2 text-xs text-indigo-800">{c.description}</p>}
      <p className="mt-2 text-sm text-slate-600">{c.activeQuestionCount} active practice MCQs in this chapter</p>
    </li>)}</ol>
    <section className="mt-10 rounded-xl bg-indigo-50 p-6"><h2 className="text-xl font-bold">How to prepare</h2>
      <p className="mt-2 text-slate-700">Read your prescribed textbook, write down important concepts, and use practice questions to identify what needs revision. Check explanations after each attempt.</p>
      <Link className="mt-4 inline-block font-bold text-indigo-700 underline" href="/app">Start interactive practice →</Link>
    </section>
    <p className="mt-8 text-sm text-slate-600">This independent catalog includes preliminary-testing content that is not yet individually academically verified. Check your school's current CBSE syllabus for examination scope.</p>
  </main>;
}
