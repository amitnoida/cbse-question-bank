import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CLASS_NUMBERS, chapters, classPath, getClass, getSubjectsForClass, subjectPath } from "@/lib/seo-catalog";

type Props = { params: Promise<{ classSlug: string }> };

export function generateStaticParams() {
  return CLASS_NUMBERS.map(n => ({ classSlug: `class-${n}` }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const n = getClass((await params).classSlug);
  if (!n) return {};
  const subjectNames = getSubjectsForClass(n).map(s => s.name).join(", ");
  return {
    title: `CBSE Class ${n} MCQ Practice by Subject`,
    description: `Explore Class ${n} chapter-wise MCQ practice and mock tests in ${subjectNames}. Start with one free Practice set and one free Mock set per subject.`,
    alternates: { canonical: classPath(n) },
  };
}
export default async function ClassPage({ params }: Props) {
  const n = getClass((await params).classSlug);
  if (!n) notFound();
  const subjects = getSubjectsForClass(n);
  return <main className="mx-auto max-w-6xl px-5 py-12">
    <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1 text-sm text-slate-600"><Link href="/">Home</Link> / Class {n}</nav>
    <h1 className="text-3xl font-black tracking-tight sm:text-4xl">CBSE Class {n} MCQ practice</h1>
    <p className="mt-4 max-w-3xl text-lg text-slate-700">
      Choose a subject to explore available chapters. Practice questions with explanations and use 60-question timed mock tests with an eligible membership.
    </p>
    <div className="mt-9 grid gap-5 md:grid-cols-2">{subjects.map(s => {
      const matching = chapters.filter(c => c.classNumber === n && c.subjectSlug === s.slug);
      const practiceCount = matching.reduce((sum,c) => sum + c.activeQuestionCount, 0);
      return <article key={s.slug} className="rounded-xl border bg-white p-6">
        <h2 className="text-2xl font-bold"><Link className="text-indigo-700 underline" href={subjectPath(n,s.slug)}>{s.name}</Link></h2>
        <p className="mt-2 text-slate-700">{matching.length} available chapters · {practiceCount} active practice MCQs in our catalog.</p>
        <Link className="mt-4 inline-block font-semibold text-indigo-700" href={subjectPath(n,s.slug)}>Browse chapters →</Link>
      </article>;
    })}</div>
    <p className="mt-10 text-sm text-slate-600">Chapter names and preliminary question availability describe our independent question bank, not an official CBSE syllabus certification. Some new questions are still awaiting academic review.</p>
  </main>;
}
