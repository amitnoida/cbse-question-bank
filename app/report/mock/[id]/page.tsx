"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import { QuestionContent } from "../../../question-content";
import "../report.css";

type ReportQuestion = {
  number: number; id: number; question: string;
  options: { A: string; B: string; C: string; D: string };
  answer: string | null; correct: string; isCorrect: boolean;
  obtainedMarks: number; explanation: string | null;
};
type MockReport = {
  student: string; subject: string;
  attempt: {
    id: number; submittedAt: string; total: number; answered: number;
    correct: number; wrong: number; unanswered: number;
    totalMarks: number; obtainedMarks: number; percentage: number;
    durationSeconds: number;
  };
  items: ReportQuestion[];
};

export default function CompleteMockReport() {
  return <Suspense fallback={<main className="p-6">Preparing your report…</main>}>
    <CompleteMockReportContent />
  </Suspense>;
}
function CompleteMockReportContent() {
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<MockReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [preparingPdf, setPreparingPdf] = useState(false);
  const [printWarning, setPrintWarning] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) throw new Error("Please sign in to view your own report.");
        const response = await fetch("/api/reports/mock?attemptId=" + encodeURIComponent(params.id), {
          headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store",
        });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || "Report unavailable");
        if (active) setReport(value as MockReport);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to retrieve your report.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [params.id]);

  async function downloadReportPdf() {
    if (!report || preparingPdf) return;
    setPreparingPdf(true);
    setPrintWarning("");
    try {
      // Print-to-PDF preserves Hindi, Unicode, illustrations and page breaks.
      // Eager print diagrams must finish loading before the print dialog opens.
      await Promise.race([
        document.fonts.ready.catch(() => undefined),
        new Promise<void>(resolve => window.setTimeout(resolve, 10000)),
      ]);
      const images = Array.from(document.querySelectorAll<HTMLImageElement>(".report-document img"));
      await Promise.race([
        Promise.all(images.map(image => image.decode().catch(() => undefined))),
        new Promise<void>(resolve => window.setTimeout(resolve, 12000)),
      ]);
      const incomplete = images.filter(image => !image.complete || image.naturalWidth === 0);
      if (incomplete.length) {
        setPrintWarning(incomplete.length + " diagram(s) are not loaded. Reload and retry to ensure every diagram is included in the PDF.");
        return;
      }
      const oldTitle = document.title;
      document.title = "CBSE-Mock-Report-" + report.attempt.id;
      let restored = false;
      const restore = () => {
        if (restored) return;
        restored = true;
        document.title = oldTitle;
        window.removeEventListener("afterprint", restore);
      };
      window.addEventListener("afterprint", restore, { once: true });
      window.print();
      window.setTimeout(restore, 10000);
    } catch {
      setPrintWarning("Could not open the PDF dialog. Use your browser menu → Print → Save as PDF.");
    } finally {
      setPreparingPdf(false);
    }
  }

  const button = "rounded-lg bg-indigo-700 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-800";
  const answerLabel = (q: ReportQuestion, choice: string | null) => {
    if (!choice) return "Not answered";
    const key = choice.trim().toUpperCase() as keyof ReportQuestion["options"];
    return /^[ABCD]$/.test(key) ? key + ". " + q.options[key] : "Unrecognized answer";
  };
  return <main className="report-document mx-auto min-h-screen max-w-4xl bg-white px-4 py-6 text-slate-900 sm:px-8 sm:py-10">
    <div className="report-toolbar mb-7 flex flex-wrap items-center justify-between gap-3 border-b pb-5">
      <Link href="/dashboard" className="text-sm font-bold text-indigo-700">← Back to dashboard</Link>
      {report && <button type="button" className={button} disabled={preparingPdf}
        onClick={() => void downloadReportPdf()}>
        {preparingPdf ? "Preparing diagrams…" : "Download Complete Report PDF"}
      </button>}
    </div>
    {loading && <p role="status">Loading your completed mock report…</p>}
    {printWarning && <p role="alert" className="report-toolbar mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{printWarning}</p>}
    {error && <section role="alert" className="rounded-xl border border-red-300 p-5 text-red-700">
      <p>{error}</p><Link href="/dashboard" className="mt-3 inline-block font-bold underline">Return to dashboard</Link>
    </section>}
    {report && <>
      <header className="border-b-2 border-slate-900 pb-5">
        <p className="text-sm font-extrabold uppercase tracking-wider text-indigo-700">CBSE Question Bank</p>
        <h1 className="mt-2 text-3xl font-black">Complete Mock Exam Report</h1>
        <p className="mt-3 text-sm"><strong>Student:</strong> {report.student}</p>
        <p className="mt-1 text-sm"><strong>Subject:</strong> {report.subject}</p>
        <p className="mt-1 text-sm"><strong>Submitted:</strong> {new Date(report.attempt.submittedAt).toLocaleString("en-IN")}</p>
      </header>
      <section aria-label="Score summary" className="my-6 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4">
        <div><p className="text-xs text-slate-500">Score</p><strong className="text-xl">{report.attempt.obtainedMarks} / {report.attempt.totalMarks}</strong></div>
        <div><p className="text-xs text-slate-500">Correct</p><strong className="text-xl text-emerald-700">{report.attempt.correct}</strong></div>
        <div><p className="text-xs text-slate-500">Incorrect</p><strong className="text-xl text-red-700">{report.attempt.wrong}</strong></div>
        <div><p className="text-xs text-slate-500">Unanswered</p><strong className="text-xl">{report.attempt.unanswered}</strong></div>
      </section>
      <p className="report-toolbar mb-5 text-sm text-slate-600">Tap Download Complete Report PDF, then select Save as PDF in the browser print dialog. On Android Chrome, choose Save as PDF under printer selection. Available for 14 days after submission.</p>
      <h2 className="mb-5 text-xl font-black">All {report.items.length} questions and explanations</h2>
      <div className="space-y-5">
        {report.items.map(q => <article key={q.id} className="report-question rounded-xl border border-slate-200 p-4">
          <div className="mb-2 flex flex-wrap justify-between gap-2">
            <h3 className="font-extrabold">Question {q.number}</h3>
            <span className={"text-sm font-bold " + (!q.answer ? "text-slate-600" : q.isCorrect ? "text-emerald-700" : "text-red-700")}>
              {!q.answer ? "Unanswered" : q.isCorrect ? "Correct" : "Incorrect"}
            </span>
          </div>
          <div className="my-3 whitespace-pre-wrap text-sm leading-6"><QuestionContent text={q.question} printFriendly/></div>
          <div className="space-y-2">
            {(["A","B","C","D"] as const).map(choice => <div key={choice} className={"rounded-md px-3 py-2 text-sm " + (choice===q.correct ? "bg-emerald-50 text-emerald-900" : choice===q.answer && !q.isCorrect ? "bg-red-50 text-red-900" : "bg-slate-50")}>
              <strong>{choice}. </strong><QuestionContent text={q.options[choice]} printFriendly/>
            </div>)}
          </div>
          <p className={"mt-4 text-sm " + (q.isCorrect ? "text-emerald-700" : q.answer ? "text-red-700" : "text-slate-700")}>
            <strong>Your answer: </strong><QuestionContent text={answerLabel(q,q.answer)} printFriendly/>
          </p>
          <p className="mt-2 text-sm text-emerald-700"><strong>Correct answer: </strong><QuestionContent text={answerLabel(q,q.correct)} printFriendly/></p>
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6"><strong>Explanation:</strong>
            <div className="mt-1"><QuestionContent text={q.explanation || "No explanation available."} printFriendly/></div>
          </div>
        </article>)}
      </div>
      <footer className="mt-8 border-t pt-3 text-center text-xs text-slate-500">Personal educational report · CBSE Question Bank · Attempt #{report.attempt.id}</footer>
    </>}
  </main>;
}
