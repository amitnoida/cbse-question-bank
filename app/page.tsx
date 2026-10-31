import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { PublicHeader, PublicFooter } from "./public-navigation";
import {
  CLASS_NUMBERS, chapters, classPath, getSubjectsForClass, subjectPath,
} from "@/lib/seo-catalog";

export const metadata: Metadata = {
  title: "CBSE Classes 8–12 MCQ Practice and Mock Tests",
  description: "Practice CBSE Class 8, 9, 10, 11 and 12 chapter-wise MCQs with answers and explanations. Explore subject guides, one free Practice set and one free Mock set per subject and 60-question timed mock tests.",
  alternates: { canonical: "/" },
};

const subjectStyles: Record<string, { icon: string; gradient: string }> = {
  english: { icon: "📖", gradient: "from-emerald-500 to-teal-600" },
  hindi: { icon: "अ", gradient: "from-pink-500 to-rose-600" },
  mathematics: { icon: "📐", gradient: "from-violet-500 to-purple-600" },
  science: { icon: "🔬", gradient: "from-sky-500 to-cyan-600" },
  "social-science": { icon: "🌍", gradient: "from-orange-500 to-amber-600" },
  physics: { icon: "⚛️", gradient: "from-blue-500 to-indigo-600" },
  chemistry: { icon: "⚗️", gradient: "from-teal-500 to-emerald-700" },
  biology: { icon: "🧬", gradient: "from-green-500 to-lime-600" },
};

const faqs = [
  { q: "Which classes can register?", a: "Classes 8, 9 and 10 offer English, Hindi, Mathematics, Science and Social Science. Classes 11 and 12 offer Physics, Chemistry, Mathematics and Biology." },
  { q: "What is included in the free plan?", a: "Each registered student gets one free Practice set and one free Mock set per subject, with up to 60 questions in each set. Selecting fewer chapters may create a shorter set, which still uses the full allowance." },
  { q: "What is the difference between practice and a real mock test?", a: "Practice displays answer feedback and explanations as you work. Real mock tests have up to 60 questions, a 60-minute timer and results after submission. Free students receive one set per subject; membership unlocks more sets." },
  { q: "Can I resume my practice?", a: "Saved practice sessions can be resumed where supported. Review and test history is available for 14 days." },
  { q: "Are all questions officially CBSE-certified?", a: "No. This is an independent practice platform, not affiliated with or endorsed by CBSE. Questions are provided for educational practice and are not independently certified or guaranteed error-free. Parents and teachers may report errors to support." },
  { q: "How do I get support or request account deletion?", a: "Visit the Contact page or email support.cbseexam@gmail.com from your registered email; parent/guardian identity may need verification for account requests." },
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8f7ff] text-slate-950">
      <PublicHeader />
      <main id="main-content" tabIndex={-1}>
        <section id="home" className="ey-home-hero">
          <div className="ey-hero-grid">
            <div className="ey-hero-copy">
              <p className="ey-eyebrow">YOUR STUDY COMPANION · CBSE CLASSES 8–12</p>
              <h1>Practice today.<br />A <span>brighter</span> tomorrow.</h1>
              <p className="ey-hero-description">Try a short quiz, understand your mistakes, and find what to revise next. Start with our Class 8–12 Maths and Science demo, then explore available practice for Classes 8–12.</p>
              <div className="ey-hero-actions">
                <Link href="/app?auth=signup" className="ey-primary-action">Start learning free <span aria-hidden="true">→</span></Link>
                <Link href="/try" className="ey-secondary-action">Try 10 questions · No signup</Link>
              </div>
              <p className="ey-free-note">One free Practice + Mock set per subject. No payment needed to begin.</p>
              <p className="ey-tagline">Har Exam Ki Pakki Yaari!</p>
            </div>
            <div className="ey-hero-art">
              <Image src="/images/examyari-students.webp" alt="Two students smiling while studying together" width={775} height={655} sizes="(max-width: 767px) 100vw, 50vw" className="ey-student-photo" preload />
              <div className="ey-photo-caption"><span aria-hidden="true">✦</span> Practice. Learn. Improve. Grow.</div>
            </div>
          </div>
          <div className="ey-benefits" aria-label="Learning features">
            {[
              { icon: "📚", title: "Chapter-wise practice", text: "Focus on one topic at a time" },
              { icon: "⏱", title: "Timed mock tests", text: "Build your exam rhythm" },
              { icon: "💡", title: "Answer explanations", text: "Understand the why" },
              { icon: "↗", title: "Review your progress", text: "Find your next learning goal" },
            ].map(item => <div key={item.title}><span aria-hidden="true" className="ey-benefit-icon">{item.icon}</span><div><p>{item.title}</p><small>{item.text}</small></div></div>)}
          </div>
        </section>

        <section id="classes" className="mx-auto max-w-7xl scroll-mt-6 px-5 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-widest text-indigo-600">CBSE question bank</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Choose your class. Find your focus.</h2>
            <p className="mt-3 leading-7 text-slate-600">Explore the subjects and chapters available for your class before registering. Your enrolled class determines your question bank after sign-in.</p>
          </div>
          <div className="mt-9 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {CLASS_NUMBERS.map(n => {
              const subjects = getSubjectsForClass(n);
              const practiceCount = chapters.filter(c => c.classNumber === n).reduce((sum,c) => sum + c.activeQuestionCount,0);
              return <article key={n} className="overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <div className="bg-gradient-to-r from-indigo-700 to-violet-600 px-6 py-5 text-white">
                  <p className="text-xs font-bold uppercase tracking-widest text-indigo-200">Explore the curriculum</p>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <h3 className="text-3xl font-black">Class {n}</h3>
                    <Link href={classPath(n)} className="rounded-xl bg-white/15 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-white/25">All chapters →</Link>
                  </div>
                </div>
                <div className="p-5 sm:p-6">
                  <p className="mb-4 text-sm font-semibold text-slate-600">{subjects.length} subjects · {practiceCount} active practice MCQs</p>
                  <ul className="space-y-2">{subjects.map(s => {
                    const style=subjectStyles[s.slug];
                    return <li key={s.slug}><Link href={subjectPath(n,s.slug)} className="group flex min-h-12 items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 transition hover:bg-indigo-50 hover:text-indigo-700">
                      <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${style.gradient} text-lg text-white`}>{style.icon}</span>
                      {s.name}<span aria-hidden="true" className="ml-auto text-indigo-500">→</span>
                    </Link></li>;
                  })}</ul>
                </div>
              </article>;
            })}
          </div>
        </section>

        <section id="how-it-works" className="bg-white px-5 py-14 sm:py-20">
          <div className="mx-auto max-w-7xl">
            <p className="text-center text-xs font-extrabold uppercase tracking-widest text-indigo-600">Simple learning journey</p>
            <h2 className="mt-2 text-center text-3xl font-black tracking-tight sm:text-4xl">How It Works</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                {number:"01",icon:"🎓",title:"Pick Your Class",description:"Select Class 8, 9, 10, 11 or 12. Registration connects your account to the right subject and chapter choices."},
                {number:"02",icon:"📚",title:"Choose a Subject",description:"Study English, Hindi, Science and Social Science in Classes 8–10, or Physics, Chemistry and Biology in Classes 11–12, with Mathematics across all classes."},
                {number:"03",icon:"🎯",title:"Practise and Review",description:"Attempt MCQs, understand mistakes from feedback and use eligible timed mock tests to prepare for exams."},
              ].map(item => <article key={item.number} className="rounded-3xl border border-indigo-100 bg-[#f8f7ff] p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-2xl">{item.icon}</span>
                  <span className="text-4xl font-black text-indigo-100">{item.number}</span>
                </div>
                <h3 className="mt-6 text-xl font-black">{item.title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
              </article>)}
            </div>
          </div>
        </section>

        <section id="features" className="px-5 py-14 sm:py-20">
          <div className="mx-auto max-w-7xl">
            <p className="text-center text-xs font-extrabold uppercase tracking-widest text-indigo-600">Practice your way</p>
            <h2 className="mt-2 text-center text-3xl font-black tracking-tight sm:text-4xl">Everything you need to keep improving</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <article className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-7 sm:p-9">
                <div className="text-3xl">📖</div><h3 className="mt-4 text-2xl font-black">Chapter-wise Practice</h3>
                <p className="mt-3 leading-7 text-slate-600">Focus on specific topics, get immediate answer feedback and explanations, and resume saved progress where supported.</p>
                <p className="mt-4 text-sm font-bold text-indigo-700">One free Practice + Mock set per subject · More with premium</p>
                <Link href="/app?auth=signup" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700">Start practicing →</Link>
              </article>
              <article className="rounded-3xl bg-gradient-to-br from-slate-950 to-indigo-950 p-7 text-white sm:p-9">
                <div className="text-3xl">🏆</div><h3 className="mt-4 text-2xl font-black">Real Mock Tests</h3>
                <p className="mt-3 leading-7 text-indigo-100">Take a timed 60-question paper with results after submission. Premium membership unlocks available numbered papers and eligible retakes.</p>
                <p className="mt-4 text-sm font-bold text-amber-300">60 questions · 60 minutes · Paid membership</p>
                <Link href="/app?auth=signin" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950 hover:bg-amber-300">Open student portal →</Link>
              </article>
            </div>
            <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Practice and mock-test history is currently retained for 14 days. Newly activated Class 8, 11 and 12 questions remain in preliminary testing until academic review.</p>
          </div>
        </section>

        <section id="pricing" className="bg-white px-5 py-14 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <p className="text-center text-xs font-extrabold uppercase tracking-widest text-indigo-600">Simple and affordable</p>
            <h2 className="mt-2 text-center text-3xl font-black tracking-tight sm:text-4xl">Start Free. Upgrade When Ready.</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <article className="rounded-3xl border border-indigo-200 bg-white p-7 shadow-sm sm:p-9">
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-600">Free plan</p>
                <h3 className="mt-4 text-2xl font-black">Try before subscribing</h3><p className="mt-4 text-4xl font-black">₹0</p>
                <ul className="mt-7 space-y-3 text-sm font-semibold text-slate-600"><li>✓ One free Practice + Mock set per subject</li><li>✓ Available subjects and chapters</li><li>✓ Answer explanations</li><li>✓ No payment needed to begin</li></ul>
                <Link href="/app?auth=signup" className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-indigo-50 px-5 py-3 font-extrabold text-indigo-700 hover:bg-indigo-100">Create Free Account</Link>
              </article>
              <article className="rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-800 p-7 text-white shadow-xl sm:p-9">
                <p className="text-xs font-extrabold uppercase tracking-wider text-amber-300">Premium</p>
                <h3 className="mt-4 text-2xl font-black">13-Month Membership</h3><p className="mt-3 text-sm text-indigo-100">Online payments are coming soon. Eligible 100% coupons can activate membership free. Check available class and combo prices before activation.</p>
                <p className="mt-4 text-4xl font-black"><span className="text-lg">Starting at </span>₹99 <span className="text-sm font-semibold text-indigo-200">eligible single-class plan · 13 months</span></p>
                <ul className="mt-7 space-y-3 text-sm font-semibold text-indigo-100"><li>✓ Full access to available practice questions</li><li>✓ All available chapters unlocked</li><li>✓ Answer explanations and practice</li><li>✓ 60-minute mock tests and eligible retakes</li></ul>
                <Link href="/memberships" className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-amber-400 px-5 py-3 font-extrabold text-slate-950 hover:bg-amber-300">View membership options</Link>
              </article>
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-4xl px-5 py-14 sm:py-20">
          <p className="text-center text-xs font-extrabold uppercase tracking-widest text-indigo-600">Help centre</p>
          <h2 className="mt-2 text-center text-3xl font-black tracking-tight sm:text-4xl">Frequently Asked Questions</h2>
          <div className="mt-8 space-y-3">
            {faqs.map(item => <details key={item.q} className="rounded-2xl border border-slate-200 bg-white p-5 open:border-indigo-200 open:bg-indigo-50/50">
              <summary className="cursor-pointer pr-4 text-base font-bold text-slate-900">{item.q}</summary>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.a}</p>
            </details>)}
          </div>
        </section>

        <section className="bg-slate-950 px-5 py-14 text-center text-white sm:py-20">
          <div className="mx-auto max-w-3xl"><p className="text-xs font-extrabold uppercase tracking-widest text-indigo-300">Ready for your next practice session?</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Make today&apos;s learning count.</h2>
            <p className="mt-3 leading-7 text-slate-300">Create your account, choose your class and start practising available MCQs.</p>
            <Link href="/app?auth=signup" className="mt-7 inline-flex min-h-12 items-center rounded-xl bg-amber-400 px-7 py-3 font-extrabold text-slate-950 hover:bg-amber-300">Create Student Account →</Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
