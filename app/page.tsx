"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type ClassRow = { id: number; class_name: string; is_active: boolean };
type SubjectRow = { id: number; class_id: number; subject_name: string; is_active: boolean };
type ChapterRow = { id: number; subject_id: number; chapter_number: number | null; chapter_name: string; is_active: boolean };
type QuestionRow = {
  id: number;
  chapter_id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation: string | null;
  difficulty: string | null;
  marks: number | null;
  question_type: string;
  is_active: boolean;
};

type MCQ = QuestionRow & {
  classId: number;
  subjectId: number;
  className: string;
  subjectName: string;
  chapterName: string;
  options: string[];
};

const ALL = "all";

export default function Home() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [questions, setQuestions] = useState<MCQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedClass, setSelectedClass] = useState(ALL);
  const [selectedSubject, setSelectedSubject] = useState(ALL);
  const [selectedChapter, setSelectedChapter] = useState(ALL);
  const [selectedDifficulty, setSelectedDifficulty] = useState(ALL);
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedOptions, setSelectedOptions] = useState<Record<number, string>>({});
  const [checkedAnswers, setCheckedAnswers] = useState<Record<number, boolean>>({});

  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceCount, setPracticeCount] = useState(5);
  const [practiceQuestions, setPracticeQuestions] = useState<MCQ[]>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<number, string>>({});
  const [practiceSubmitted, setPracticeSubmitted] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [classResult, subjectResult, chapterResult, questionResult] = await Promise.all([
        supabase.from("classes").select("id,class_name,is_active").eq("is_active", true).order("id"),
        supabase.from("subjects").select("id,class_id,subject_name,is_active").eq("is_active", true).order("display_order"),
        supabase.from("chapters").select("id,subject_id,chapter_number,chapter_name,is_active").eq("is_active", true).order("display_order"),
        supabase.from("questions").select("id,chapter_id,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,difficulty,marks,question_type,is_active").eq("is_active", true).eq("question_type", "MCQ").order("id"),
      ]);

      const firstError = classResult.error || subjectResult.error || chapterResult.error || questionResult.error;
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const classRows = (classResult.data || []) as ClassRow[];
      const subjectRows = (subjectResult.data || []) as SubjectRow[];
      const chapterRows = (chapterResult.data || []) as ChapterRow[];
      const questionRows = (questionResult.data || []) as QuestionRow[];

      const classMap = new Map(classRows.map((item) => [item.id, item]));
      const subjectMap = new Map(subjectRows.map((item) => [item.id, item]));
      const chapterMap = new Map(chapterRows.map((item) => [item.id, item]));

      const mcqs: MCQ[] = questionRows
        .map((q) => {
          const chapter = chapterMap.get(q.chapter_id);
          const subject = chapter ? subjectMap.get(chapter.subject_id) : undefined;
          const classRow = subject ? classMap.get(subject.class_id) : undefined;
          if (!chapter || !subject || !classRow) return null;

          return {
            ...q,
            classId: classRow.id,
            subjectId: subject.id,
            className: classRow.class_name,
            subjectName: subject.subject_name,
            chapterName: chapter.chapter_name,
            options: [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean),
          };
        })
        .filter((q): q is MCQ => q !== null);

      setClasses(classRows);
      setSubjects(subjectRows);
      setChapters(chapterRows);
      setQuestions(mcqs);
      setLoading(false);
    }

    loadData();
  }, []);

  // When All Classes is selected, the same subject exists once per class in
  // Supabase. Show each subject name only once in the dropdown.
  const availableSubjects = useMemo(() => {
    const rows = selectedClass === ALL
      ? subjects
      : subjects.filter((s) => String(s.class_id) === selectedClass);

    const seen = new Set<string>();
    return rows.filter((s) => {
      const key = s.subject_name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [subjects, selectedClass]);

  // selectedSubject stores the SUBJECT NAME, not a subject id. This is
  // important because Class 9 and Class 10 have separate subject rows.
  const availableChapters = useMemo(() => {
    const activeSubjectIds = new Set(
      subjects
        .filter((s) => {
          const classMatches = selectedClass === ALL || String(s.class_id) === selectedClass;
          const subjectMatches = selectedSubject === ALL || s.subject_name === selectedSubject;
          return classMatches && subjectMatches;
        })
        .map((s) => s.id)
    );

    const rows = chapters.filter((c) => activeSubjectIds.has(c.subject_id));

    // Avoid duplicate chapter names when the same subject is selected across
    // multiple classes.
    const seen = new Set<string>();
    return rows.filter((c) => {
      const key = c.chapter_name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [chapters, subjects, selectedSubject, selectedClass]);

  const difficulties = useMemo(() => {
    return Array.from(new Set(questions.map((q) => q.difficulty).filter(Boolean))) as string[];
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return questions.filter((q) => {
      const matchesClass = selectedClass === ALL || String(q.classId) === selectedClass;
      const matchesSubject = selectedSubject === ALL || q.subjectName === selectedSubject;
      const matchesChapter = selectedChapter === ALL || q.chapterName === selectedChapter;
      const matchesDifficulty = selectedDifficulty === ALL || q.difficulty === selectedDifficulty;
      const matchesSearch = !search || q.question_text.toLowerCase().includes(search);
      return matchesClass && matchesSubject && matchesChapter && matchesDifficulty && matchesSearch;
    });
  }, [questions, selectedClass, selectedSubject, selectedChapter, selectedDifficulty, searchTerm]);

  function handleClassChange(value: string) {
    setSelectedClass(value);
    setSelectedSubject(ALL);
    setSelectedChapter(ALL);
  }

  function handleSubjectChange(value: string) {
    setSelectedSubject(value);
    setSelectedChapter(ALL);
  }

  function handleOptionChange(questionId: number, option: string) {
    setSelectedOptions((prev) => ({ ...prev, [questionId]: option }));
    setCheckedAnswers((prev) => ({ ...prev, [questionId]: false }));
  }

  function checkAnswer(question: MCQ) {
    // Mark this question as checked. The UI then compares the selected
    // option (A/B/C/D) with the database correct_option value.
    setCheckedAnswers((prev) => ({
      ...prev,
      [question.id]: true,
    }));
  }

  function clearFilters() {
    setSelectedClass(ALL);
    setSelectedSubject(ALL);
    setSelectedChapter(ALL);
    setSelectedDifficulty(ALL);
    setSearchTerm("");
  }

  function startPracticeTest() {
    const mcqs = [...filteredQuestions];
    for (let i = mcqs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mcqs[i], mcqs[j]] = [mcqs[j], mcqs[i]];
    }
    setPracticeQuestions(mcqs.slice(0, Math.min(practiceCount, mcqs.length)));
    setPracticeIndex(0);
    setPracticeAnswers({});
    setPracticeSubmitted(false);
    setPracticeMode(true);
  }

  function exitPracticeTest() {
    setPracticeMode(false);
    setPracticeSubmitted(false);
    setPracticeQuestions([]);
    setPracticeAnswers({});
    setPracticeIndex(0);
  }

  const practiceScore = practiceQuestions.filter(
    (q) => practiceAnswers[q.id] === q.correct_option.trim().toUpperCase()
  ).length;

  if (loading) {
    return <main className="min-h-screen bg-gray-50 p-10 text-center text-gray-600">Loading questions from Supabase...</main>;
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 p-10">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-red-600">Unable to load questions</h1>
          <p className="mt-3 text-sm text-gray-700">{error}</p>
          <p className="mt-4 text-sm text-gray-500">Check your Supabase URL/key and make sure the tables allow SELECT access.</p>
        </div>
      </main>
    );
  }

  if (practiceMode) {
    const current = practiceQuestions[practiceIndex];
    if (!current) return null;

    if (practiceSubmitted) {
      return (
        <main className="min-h-screen bg-gray-50">
          <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl justify-between px-6 py-4"><h1 className="text-xl font-bold">CBSE Question Bank</h1><button onClick={exitPracticeTest} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white">Back to Questions</button></div></header>
          <section className="mx-auto max-w-4xl px-6 py-10">
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <h2 className="text-3xl font-bold">Practice Test Result</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-gray-50 p-5"><p className="text-sm text-gray-500">Total Questions</p><p className="mt-1 text-3xl font-bold">{practiceQuestions.length}</p></div>
                <div className="rounded-xl bg-gray-50 p-5"><p className="text-sm text-gray-500">Correct</p><p className="mt-1 text-3xl font-bold text-green-600">{practiceScore}</p></div>
                <div className="rounded-xl bg-gray-50 p-5"><p className="text-sm text-gray-500">Percentage</p><p className="mt-1 text-3xl font-bold">{practiceQuestions.length ? Math.round((practiceScore / practiceQuestions.length) * 100) : 0}%</p></div>
              </div>
              <div className="mt-8 space-y-4">
                {practiceQuestions.map((q, index) => {
                  const correct = q.correct_option.trim().toUpperCase();
                  const user = practiceAnswers[q.id];
                  return <div key={q.id} className="rounded-xl border p-5"><p className="font-medium">Q{index + 1}. {q.question_text}</p><p className="mt-2 text-sm">Your answer: {user || "Not answered"}</p><p className="mt-1 text-sm text-green-700">Correct answer: {correct}</p>{q.explanation && <p className="mt-2 text-sm text-gray-600">Explanation: {q.explanation}</p>}</div>;
                })}
              </div>
            </div>
          </section>
        </main>
      );
    }

    return (
      <main className="min-h-screen bg-gray-50">
        <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl justify-between px-6 py-4"><h1 className="text-xl font-bold">CBSE Question Bank</h1><button onClick={exitPracticeTest} className="rounded-lg border px-4 py-2 text-sm">Exit Test</button></div></header>
        <section className="mx-auto max-w-3xl px-6 py-10">
          <div className="mb-6 flex justify-between"><div><p className="text-sm text-gray-500">Practice Test</p><h2 className="text-xl font-bold">Question {practiceIndex + 1} of {practiceQuestions.length}</h2></div><span className="rounded-full bg-gray-100 px-3 py-1 text-sm">{current.difficulty || "Not set"}</span></div>
          <div className="rounded-2xl bg-white p-6 shadow-sm"><p className="text-lg font-semibold">{current.question_text}</p><div className="mt-6 space-y-3">{current.options.map((option, index) => { const letter = String.fromCharCode(65 + index); const selected = practiceAnswers[current.id] === letter; return <button key={letter} onClick={() => setPracticeAnswers((prev) => ({ ...prev, [current.id]: letter }))} className={`w-full rounded-xl border p-4 text-left ${selected ? "border-gray-900 bg-gray-100" : "border-gray-200 hover:bg-gray-50"}`}><span className="font-medium">{letter}.</span> {option}</button>; })}</div></div>
          <div className="mt-6 flex justify-between"><button disabled={practiceIndex === 0} onClick={() => setPracticeIndex((p) => p - 1)} className="rounded-lg border px-5 py-2 disabled:opacity-40">Previous</button>{practiceIndex < practiceQuestions.length - 1 ? <button onClick={() => setPracticeIndex((p) => p + 1)} className="rounded-lg bg-gray-900 px-5 py-2 text-white">Next</button> : <button onClick={() => setPracticeSubmitted(true)} className="rounded-lg bg-green-600 px-5 py-2 text-white">Submit Test</button>}</div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"><h1 className="text-xl font-bold">CBSE Question Bank</h1><button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white">Login</button></div></header>
      <section className="bg-white"><div className="mx-auto max-w-6xl px-6 py-14"><div className="max-w-3xl"><p className="text-sm font-semibold uppercase tracking-wide text-gray-500">CBSE Preparation</p><h2 className="mt-3 text-4xl font-bold tracking-tight">Practice questions for better exam preparation</h2><p className="mt-4 text-lg text-gray-600">Find active MCQ questions by class, subject, chapter and difficulty.</p><div className="mt-7 flex gap-3"><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search questions..." className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"/><button onClick={() => document.getElementById("questions")?.scrollIntoView({ behavior: "smooth" })} className="rounded-xl bg-gray-900 px-6 py-3 font-medium text-white">Search</button></div></div></div></section>

      <section id="questions" className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold">Find Questions</h3>
          <p className="mt-1 text-sm text-gray-500">All filters are loaded from your Supabase database.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <select value={selectedClass} onChange={(e) => handleClassChange(e.target.value)} className="rounded-xl border border-gray-300 bg-white px-4 py-3"><option value={ALL}>All Classes</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.class_name}</option>)}</select>
            <select value={selectedSubject} onChange={(e) => handleSubjectChange(e.target.value)} className="rounded-xl border border-gray-300 bg-white px-4 py-3"><option value={ALL}>All Subjects</option>{availableSubjects.map((s) => <option key={`${s.class_id}-${s.id}`} value={s.subject_name}>{s.subject_name}</option>)}</select>
            <select value={selectedChapter} onChange={(e) => setSelectedChapter(e.target.value)} disabled={availableChapters.length === 0} className="rounded-xl border border-gray-300 bg-white px-4 py-3 disabled:bg-gray-100"><option value={ALL}>{availableChapters.length ? "All Chapters" : "No Chapters Available"}</option>{availableChapters.map((c) => <option key={c.id} value={c.chapter_name}>{c.chapter_number ? `${c.chapter_number}. ` : ""}{c.chapter_name}</option>)}</select>
            <select value={selectedDifficulty} onChange={(e) => setSelectedDifficulty(e.target.value)} className="rounded-xl border border-gray-300 bg-white px-4 py-3"><option value={ALL}>All Levels</option>{difficulties.map((d) => <option key={d}>{d}</option>)}</select>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3"><span className="text-sm text-gray-500">Subjects: {availableSubjects.length} · Chapters: {availableChapters.length}</span><button onClick={clearFilters} className="rounded-lg border px-4 py-2 text-sm font-medium">Clear Filters</button><span className="text-sm text-gray-500">{filteredQuestions.length} MCQ questions found</span></div>
        </div>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-xl font-bold">Practice Test</h3><p className="mt-1 text-sm text-gray-500">Test yourself using the current filters.</p><p className="mt-2 text-sm font-medium">Available MCQs: {filteredQuestions.length}</p></div><div className="flex gap-3"><select value={practiceCount} onChange={(e) => setPracticeCount(Number(e.target.value))} className="rounded-lg border px-3 py-2"><option value={3}>3 Questions</option><option value={5}>5 Questions</option><option value={10}>10 Questions</option></select><button onClick={startPracticeTest} disabled={!filteredQuestions.length} className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40">Start Practice Test</button></div></div></div>

        <div className="mt-6 space-y-5">
          {filteredQuestions.length === 0 ? <div className="rounded-2xl bg-white p-8 text-center shadow-sm"><h3 className="text-lg font-semibold">No questions found</h3><p className="mt-2 text-sm text-gray-500">Try changing the filters or search term.</p></div> : filteredQuestions.map((question) => {
            const selected = selectedOptions[question.id];
            const checked = checkedAnswers[question.id];
            const correct = question.correct_option.trim().toUpperCase();
            const isCorrect = selected === correct;
            return <div key={question.id} className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">{question.className}</span><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">{question.subjectName}</span><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">{question.chapterName}</span><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">{question.difficulty || "Not set"}</span></div>
              <h3 className="mt-4 text-lg font-semibold">{question.question_text}</h3>
              <div className="mt-5 space-y-3">{question.options.map((option, index) => { const letter = String.fromCharCode(65 + index); const selectedOption = selected === letter; let cls = "border-gray-200 hover:bg-gray-50"; if (checked && selectedOption && isCorrect) cls = "border-green-500 bg-green-50"; else if (checked && selectedOption && !isCorrect) cls = "border-red-500 bg-red-50"; else if (selectedOption) cls = "border-gray-900 bg-gray-100"; return <button key={letter} onClick={() => handleOptionChange(question.id, letter)} className={`w-full rounded-xl border p-4 text-left transition ${cls}`}><span className="font-semibold">{letter}.</span> {option}</button>; })}</div>
              <div className="mt-4"><button onClick={() => checkAnswer(question)} disabled={!selected} className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">Check Answer</button></div>
              {checked && <div className={`mt-4 rounded-xl p-4 text-sm ${isCorrect ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}><p className="font-semibold">{isCorrect ? "Correct Answer!" : `Incorrect. Correct answer: ${correct}`}</p>{!isCorrect && question.explanation && <p className="mt-2">Explanation: {question.explanation}</p>}</div>}
            </div>;
          })}
        </div>
      </section>
    </main>
  );
}
