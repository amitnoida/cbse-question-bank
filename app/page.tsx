"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type ClassRow = {
  id: number;
  class_name: string;
  is_active: boolean;
};

type SubjectRow = {
  id: number;
  class_id: number;
  subject_name: string;
  is_active: boolean;
};

type ChapterRow = {
  id: number;
  subject_id: number;
  chapter_number: number | null;
  chapter_name: string;
  is_active: boolean;
};

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

type StudentProfile = {
  full_name: string;
  class_id: number | null;
};

const ALL = "all";

export default function Home() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [questions, setQuestions] = useState<MCQ[]>([]);

  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [studentProfile, setStudentProfile] =
    useState<StudentProfile | null>(null);

  const [selectedClass, setSelectedClass] = useState(ALL);
  const [selectedSubject, setSelectedSubject] = useState(ALL);
  const [selectedChapter, setSelectedChapter] = useState(ALL);
  const [selectedDifficulty, setSelectedDifficulty] = useState(ALL);

  const [selectedOptions, setSelectedOptions] = useState<
    Record<number, string>
  >({});
  const [checkedAnswers, setCheckedAnswers] = useState<
    Record<number, boolean>
  >({});

  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceCount, setPracticeCount] = useState(5);
  const [practiceQuestions, setPracticeQuestions] = useState<MCQ[]>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceAnswers, setPracticeAnswers] = useState<
    Record<number, string>
  >({});
  const [practiceSubmitted, setPracticeSubmitted] = useState(false);

  /* =========================
     SIGNUP
  ========================= */

  const [showSignup, setShowSignup] = useState(false);
  const [signupFullName, setSignupFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] =
    useState("");
  const [signupClassId, setSignupClassId] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState("");

  /* =========================
     SIGN IN
  ========================= */

  const [showSignin, setShowSignin] = useState(false);
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [signinLoading, setSigninLoading] = useState(false);
  const [signinError, setSigninError] = useState("");

  /* =========================
     LOAD PUBLIC CLASSES
  ========================= */

  async function loadClasses() {
    const { data, error: classError } = await supabase
      .from("classes")
      .select("id,class_name,is_active")
      .eq("is_active", true)
      .order("id");

    if (classError) {
      setError(classError.message);
      return;
    }

    setClasses((data || []) as ClassRow[]);
  }

  /* =========================
     LOAD STUDENT PROFILE
  ========================= */

  async function loadStudentProfile(userId: string) {
    const { data, error: profileError } = await supabase
      .from("student_profiles")
      .select("full_name,class_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Student profile error:", profileError);
      setStudentProfile(null);
      return;
    }

    if (data) {
      setStudentProfile(data as StudentProfile);
    } else {
      setStudentProfile(null);
    }
  }

  /* =========================
     LOAD QUESTION BANK
  ========================= */

  async function loadQuestionData() {
    setLoading(true);
    setError("");

    const [
      subjectResult,
      chapterResult,
      questionResult,
    ] = await Promise.all([
      supabase
        .from("subjects")
        .select("id,class_id,subject_name,is_active")
        .eq("is_active", true)
        .order("display_order"),

      supabase
        .from("chapters")
        .select(
          "id,subject_id,chapter_number,chapter_name,is_active"
        )
        .eq("is_active", true)
        .order("display_order"),

      supabase
        .from("questions")
        .select(
          "id,chapter_id,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,difficulty,marks,question_type,is_active"
        )
        .eq("is_active", true)
        .eq("question_type", "MCQ")
        .order("id"),
    ]);

    const firstError =
      subjectResult.error ||
      chapterResult.error ||
      questionResult.error;

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const subjectRows = (subjectResult.data || []) as SubjectRow[];
    const chapterRows = (chapterResult.data || []) as ChapterRow[];
    const questionRows = (questionResult.data || []) as QuestionRow[];

    const classMap = new Map(
      classes.map((item) => [item.id, item])
    );

    const subjectMap = new Map(
      subjectRows.map((item) => [item.id, item])
    );

    const chapterMap = new Map(
      chapterRows.map((item) => [item.id, item])
    );

    const mcqs: MCQ[] = questionRows
      .map((q) => {
        const chapter = chapterMap.get(q.chapter_id);

        const subject = chapter
          ? subjectMap.get(chapter.subject_id)
          : undefined;

        const classRow = subject
          ? classMap.get(subject.class_id)
          : undefined;

        if (!chapter || !subject || !classRow) {
          return null;
        }

        return {
          ...q,
          classId: classRow.id,
          subjectId: subject.id,
          className: classRow.class_name,
          subjectName: subject.subject_name,
          chapterName: chapter.chapter_name,
          options: [
            q.option_a,
            q.option_b,
            q.option_c,
            q.option_d,
          ].filter(Boolean),
        };
      })
      .filter((q): q is MCQ => q !== null);

    setSubjects(subjectRows);
    setChapters(chapterRows);
    setQuestions(mcqs);
    setLoading(false);
  }

  /* =========================
     AUTH INITIALIZATION
  ========================= */

  useEffect(() => {
    let mounted = true;

    async function initializeApp() {
      setAuthLoading(true);

      await loadClasses();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (session?.user) {
        setCurrentUser(session.user);

        await loadStudentProfile(session.user.id);

        if (mounted) {
          await loadQuestionData();
        }
      } else {
        setCurrentUser(null);
        setStudentProfile(null);
        setLoading(false);
      }

      if (mounted) {
        setAuthLoading(false);
      }
    }

    initializeApp();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) {
          return;
        }

        if (session?.user) {
          setCurrentUser(session.user);

          await loadStudentProfile(session.user.id);

          if (mounted) {
            await loadQuestionData();
          }
        } else {
          setCurrentUser(null);
          setStudentProfile(null);
          setQuestions([]);
          setSubjects([]);
          setChapters([]);
          setLoading(false);
          setPracticeMode(false);
        }

        if (mounted) {
          setAuthLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /* =========================
     FILTER DATA
  ========================= */

  const availableSubjects = useMemo(() => {
    const rows =
      selectedClass === ALL
        ? subjects
        : subjects.filter(
            (s) => String(s.class_id) === selectedClass
          );

    const seen = new Set<string>();

    return rows.filter((s) => {
      const key = s.subject_name.trim().toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }, [subjects, selectedClass]);

  const availableChapters = useMemo(() => {
    const activeSubjectIds = new Set(
      subjects
        .filter((s) => {
          const classMatches =
            selectedClass === ALL ||
            String(s.class_id) === selectedClass;

          const subjectMatches =
            selectedSubject === ALL ||
            s.subject_name === selectedSubject;

          return classMatches && subjectMatches;
        })
        .map((s) => s.id)
    );

    const rows = chapters.filter((c) =>
      activeSubjectIds.has(c.subject_id)
    );

    const seen = new Set<string>();

    return rows.filter((c) => {
      const key = c.chapter_name.trim().toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }, [
    chapters,
    subjects,
    selectedSubject,
    selectedClass,
  ]);

  const difficulties = useMemo(() => {
    return Array.from(
      new Set(
        questions
          .map((q) => q.difficulty)
          .filter(Boolean)
      )
    ) as string[];
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchesClass =
        selectedClass === ALL ||
        String(q.classId) === selectedClass;

      const matchesSubject =
        selectedSubject === ALL ||
        q.subjectName === selectedSubject;

      const matchesChapter =
        selectedChapter === ALL ||
        q.chapterName === selectedChapter;

      const matchesDifficulty =
        selectedDifficulty === ALL ||
        q.difficulty === selectedDifficulty;

      return (
        matchesClass &&
        matchesSubject &&
        matchesChapter &&
        matchesDifficulty
      );
    });
  }, [
    questions,
    selectedClass,
    selectedSubject,
    selectedChapter,
    selectedDifficulty,
  ]);

  const practiceOptions = useMemo(() => {
    const count = filteredQuestions.length;

    if (count === 0) {
      return [];
    }

    const options = [3, 5, 10, count]
      .filter((value) => value <= count)
      .filter(
        (value, index, array) =>
          array.indexOf(value) === index
      );

    return options.sort((a, b) => a - b);
  }, [filteredQuestions.length]);

  useEffect(() => {
    const availableCount = filteredQuestions.length;

    if (availableCount === 0) {
      return;
    }

    if (practiceCount > availableCount) {
      setPracticeCount(availableCount);
    }
  }, [filteredQuestions.length, practiceCount]);

  /* =========================
     FILTER HANDLERS
  ========================= */

  function handleClassChange(value: string) {
    setSelectedClass(value);
    setSelectedSubject(ALL);
    setSelectedChapter(ALL);
  }

  function handleSubjectChange(value: string) {
    setSelectedSubject(value);
    setSelectedChapter(ALL);
  }

  function handleOptionChange(
    questionId: number,
    option: string
  ) {
    setSelectedOptions((prev) => ({
      ...prev,
      [questionId]: option,
    }));

    setCheckedAnswers((prev) => ({
      ...prev,
      [questionId]: false,
    }));
  }

  function checkAnswer(question: MCQ) {
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
  }

  /* =========================
     PRACTICE TEST
  ========================= */

  function startPracticeTest() {
    const mcqs = [...filteredQuestions];

    for (let i = mcqs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mcqs[i], mcqs[j]] = [mcqs[j], mcqs[i]];
    }

    setPracticeQuestions(
      mcqs.slice(
        0,
        Math.min(practiceCount, mcqs.length)
      )
    );

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

  /* =========================
     SIGNUP HANDLERS
  ========================= */

  function openSignup() {
    setSignupError("");
    setSignupSuccess("");
    setShowSignup(true);
    setShowSignin(false);
  }

  function closeSignup() {
    if (signupLoading) {
      return;
    }

    setShowSignup(false);
    setSignupError("");
    setSignupSuccess("");
  }

  async function handleSignup(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setSignupError("");
    setSignupSuccess("");

    const fullName = signupFullName.trim();
    const email = signupEmail.trim().toLowerCase();

    if (!fullName) {
      setSignupError("Please enter your full name.");
      return;
    }

    if (!email) {
      setSignupError("Please enter your email ID.");
      return;
    }

    if (!signupClassId) {
      setSignupError("Please select your class.");
      return;
    }

    if (signupPassword.length < 6) {
      setSignupError(
        "Password must be at least 6 characters."
      );
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setSignupError(
        "Password and Confirm Password do not match."
      );
      return;
    }

    setSignupLoading(true);

   const { data, error: authError } =
  await supabase.auth.signUp({
    email,
    password: signupPassword,
    options: {
      emailRedirectTo:
        "https://cbse-question-bank.vercel.app/auth/callback",
      data: {
        full_name: fullName,
        class_id: Number(signupClassId),
      },
    },
  });
    if (authError) {
      setSignupError(authError.message);
      setSignupLoading(false);
      return;
    }

    if (!data.user) {
      setSignupError(
        "Account could not be created. Please try again."
      );
      setSignupLoading(false);
      return;
    }

    if (data.session) {
      const { error: profileError } = await supabase
        .from("student_profiles")
        .insert({
          id: data.user.id,
          full_name: fullName,
          mobile_number: null,
          class_id: Number(signupClassId),
          is_active: true,
        });

      if (profileError) {
        setSignupError(
          `Account was created, but the student profile could not be saved: ${profileError.message}`
        );
        setSignupLoading(false);
        return;
      }

      setSignupSuccess(
        "Account created successfully. You can now start preparing for your CBSE exams."
      );
    } else {
      setSignupSuccess(
        "Account created successfully. Please check your email to confirm your account."
      );
    }

    setSignupFullName("");
    setSignupEmail("");
    setSignupPassword("");
    setSignupConfirmPassword("");
    setSignupClassId("");
    setSignupLoading(false);
  }

  /* =========================
     SIGN IN HANDLERS
  ========================= */

  function openSignin() {
    setSigninError("");
    setShowSignin(true);
    setShowSignup(false);
  }

  function closeSignin() {
    if (signinLoading) {
      return;
    }

    setShowSignin(false);
    setSigninError("");
  }

  async function handleSignin(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setSigninError("");

    const email = signinEmail.trim().toLowerCase();

    if (!email) {
      setSigninError("Please enter your email ID.");
      return;
    }

    if (!signinPassword) {
      setSigninError("Please enter your password.");
      return;
    }

    setSigninLoading(true);

    const { data, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password: signinPassword,
      });

    if (authError) {
      setSigninError(authError.message);
      setSigninLoading(false);
      return;
    }

    if (!data.user) {
      setSigninError(
        "Unable to sign in. Please try again."
      );
      setSigninLoading(false);
      return;
    }

    setCurrentUser(data.user);

    await loadStudentProfile(data.user.id);
    await loadQuestionData();

    setSigninEmail("");
    setSigninPassword("");
    setSigninLoading(false);
    setShowSignin(false);
  }

  /* =========================
     LOGOUT
  ========================= */

  async function handleLogout() {
    await supabase.auth.signOut();

    setCurrentUser(null);
    setStudentProfile(null);
    setQuestions([]);
    setSubjects([]);
    setChapters([]);
    setSelectedClass(ALL);
    setSelectedSubject(ALL);
    setSelectedChapter(ALL);
    setSelectedDifficulty(ALL);
    setSelectedOptions({});
    setCheckedAnswers({});
    setPracticeMode(false);
  }

  const practiceScore = practiceQuestions.filter(
    (q) =>
      practiceAnswers[q.id] ===
      q.correct_option.trim().toUpperCase()
  ).length;

  /* =========================
     AUTH LOADING
  ========================= */

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="flex min-h-screen items-center justify-center">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-700" />

            <p className="text-base font-semibold text-slate-900">
              Loading CBSE Question Bank
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Checking your account
            </p>
          </div>
        </div>
      </main>
    );
  }

  /* =========================
     PUBLIC HOME PAGE
  ========================= */

  if (!currentUser) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-slate-50">
        {/* HEADER */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-blue-700 sm:text-[11px] sm:tracking-[0.18em]">
                CBSE Exam Preparation
              </p>

              <h1 className="truncate text-base font-bold tracking-tight text-slate-950 sm:text-xl">
                CBSE Exam Question Bank
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={openSignup}
                className="min-h-10 rounded-lg border border-blue-700 bg-white px-3.5 py-2 text-xs font-bold text-blue-700 shadow-sm hover:bg-blue-50 sm:px-4 sm:text-sm"
              >
                Sign Up
              </button>

              <button
                onClick={openSignin}
                className="min-h-10 rounded-lg bg-slate-950 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 sm:px-4 sm:text-sm"
              >
                Sign In
              </button>
            </div>
          </div>
        </header>

        {/* SIGNUP MODAL */}
        {showSignup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
            <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
              <button
                type="button"
                onClick={closeSignup}
                disabled={signupLoading}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-lg font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
                aria-label="Close signup"
              >
                ×
              </button>

              <div className="pr-10">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
                  Student Account
                </p>

                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                  Create your account
                </h2>

                <p className="mt-1.5 text-sm leading-5 text-slate-500">
                  Sign up to continue your CBSE exam preparation.
                </p>
              </div>

              {signupError && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm leading-5 text-red-800">
                  {signupError}
                </div>
              )}

              {signupSuccess && (
                <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm leading-5 text-emerald-800">
                  {signupSuccess}
                </div>
              )}

              <form
                onSubmit={handleSignup}
                className="mt-5 space-y-4"
              >
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Full Name
                  </label>

                  <input
                    type="text"
                    value={signupFullName}
                    onChange={(e) =>
                      setSignupFullName(e.target.value)
                    }
                    placeholder="Enter your full name"
                    disabled={signupLoading}
                    autoComplete="name"
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Email ID
                  </label>

                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(e) =>
                      setSignupEmail(e.target.value)
                    }
                    placeholder="Enter your email"
                    disabled={signupLoading}
                    autoComplete="email"
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Password
                  </label>

                  <input
                    type="password"
                    value={signupPassword}
                    onChange={(e) =>
                      setSignupPassword(e.target.value)
                    }
                    placeholder="Minimum 6 characters"
                    disabled={signupLoading}
                    autoComplete="new-password"
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Confirm Password
                  </label>

                  <input
                    type="password"
                    value={signupConfirmPassword}
                    onChange={(e) =>
                      setSignupConfirmPassword(e.target.value)
                    }
                    placeholder="Re-enter your password"
                    disabled={signupLoading}
                    autoComplete="new-password"
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Class
                  </label>

                  <select
                    value={signupClassId}
                    onChange={(e) =>
                      setSignupClassId(e.target.value)
                    }
                    disabled={signupLoading}
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-100"
                  >
                    <option value="">
                      Select your class
                    </option>

                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.class_name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={signupLoading}
                  className="mt-2 min-h-12 w-full rounded-lg bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {signupLoading
                    ? "Creating Account..."
                    : "Create Account"}
                </button>
              </form>

              <div className="mt-4 text-center text-xs text-slate-500">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={openSignin}
                  className="font-bold text-blue-700 hover:text-blue-800"
                >
                  Sign In
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SIGN IN MODAL */}
        {showSignin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
            <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
              <button
                type="button"
                onClick={closeSignin}
                disabled={signinLoading}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-lg font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
                aria-label="Close sign in"
              >
                ×
              </button>

              <div className="pr-10">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
                  Student Login
                </p>

                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                  Sign in to continue
                </h2>

                <p className="mt-1.5 text-sm leading-5 text-slate-500">
                  Sign in to access your CBSE Question Bank.
                </p>
              </div>

              {signinError && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm leading-5 text-red-800">
                  {signinError}
                </div>
              )}

              <form
                onSubmit={handleSignin}
                className="mt-5 space-y-4"
              >
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Email ID
                  </label>

                  <input
                    type="email"
                    value={signinEmail}
                    onChange={(e) =>
                      setSigninEmail(e.target.value)
                    }
                    placeholder="Enter your email"
                    disabled={signinLoading}
                    autoComplete="email"
                    autoFocus
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Password
                  </label>

                  <input
                    type="password"
                    value={signinPassword}
                    onChange={(e) =>
                      setSigninPassword(e.target.value)
                    }
                    placeholder="Enter your password"
                    disabled={signinLoading}
                    autoComplete="current-password"
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={signinLoading}
                  className="mt-2 min-h-12 w-full rounded-lg bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {signinLoading
                    ? "Signing In..."
                    : "Sign In"}
                </button>
              </form>

              <div className="mt-4 text-center text-xs text-slate-500">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={openSignup}
                  className="font-bold text-blue-700 hover:text-blue-800"
                >
                  Sign Up
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HERO */}
        <section className="border-b border-slate-800 bg-slate-950 text-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-20">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-blue-300 sm:px-3 sm:text-[11px] sm:tracking-[0.12em]">
                Class 9 & 10 • CBSE
              </span>

              <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:mt-5 sm:text-5xl lg:text-6xl">
                Practice smarter.
                <br />
                Prepare better.
              </h2>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:mt-5 sm:text-lg sm:leading-7">
                Prepare for your CBSE exams with
                chapter-wise MCQ practice, subject-wise
                preparation and practice tests.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={openSignup}
                  className="min-h-12 rounded-lg bg-blue-700 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-800"
                >
                  Create Student Account
                </button>

                <button
                  onClick={openSignin}
                  className="min-h-12 rounded-lg border border-slate-600 bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800"
                >
                  Sign In
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-14">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg font-bold text-blue-700">
                01
              </div>

              <h3 className="mt-4 text-lg font-bold text-slate-950">
                Chapter-wise Practice
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Practice questions organized by subject,
                chapter and difficulty.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg font-bold text-blue-700">
                02
              </div>

              <h3 className="mt-4 text-lg font-bold text-slate-950">
                Instant Answers
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Select an answer and immediately check
                whether you are correct.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg font-bold text-blue-700">
                03
              </div>

              <h3 className="mt-4 text-lg font-bold text-slate-950">
                Practice Tests
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Take randomized practice tests using
                questions from your preparation area.
              </p>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-7 text-center sm:px-6 sm:py-8">
            <p className="font-bold text-slate-950">
              CBSE Question Bank
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Practice • Learn • Improve
            </p>
          </div>
        </footer>
      </main>
    );
  }

  /* =========================
     AUTHENTICATED LOADING
  ========================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="flex min-h-screen items-center justify-center">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-700" />

            <p className="text-base font-semibold text-slate-900">
              Loading questions
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Connecting to CBSE Question Bank
            </p>
          </div>
        </div>
      </main>
    );
  }

  /* =========================
     DATABASE ERROR
  ========================= */

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-5 sm:py-10">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-white p-5 shadow-sm sm:p-9">
          <div className="mb-4 inline-flex rounded-md bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">
            Connection Error
          </div>

          <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
            Unable to load questions
          </h1>

          <p className="mt-3 break-words text-sm leading-6 text-slate-600">
            {error}
          </p>

          <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            Check your Supabase URL/key and make sure the
            tables allow SELECT access.
          </p>
        </div>
      </main>
    );
  }

  /* =========================
     PRACTICE TEST
  ========================= */

  if (practiceMode) {
    const current = practiceQuestions[practiceIndex];

    if (!current) {
      return null;
    }

    if (practiceSubmitted) {
      const percentage = practiceQuestions.length
        ? Math.round(
            (practiceScore / practiceQuestions.length) * 100
          )
        : 0;

      return (
        <main className="min-h-screen overflow-x-hidden bg-slate-50">
          <header className="border-b border-slate-800 bg-slate-950 text-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 sm:text-[11px]">
                  Practice Mode
                </p>

                <h1 className="mt-0.5 truncate text-base font-bold sm:text-lg">
                  CBSE Question Bank
                </h1>
              </div>

              <button
                onClick={exitPracticeTest}
                className="min-h-10 shrink-0 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 sm:px-4 sm:text-sm"
              >
                Back to Questions
              </button>
            </div>
          </header>

          <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-12">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-9">
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-blue-100 bg-blue-50 text-xl font-bold text-blue-700">
                  {percentage}%
                </div>

                <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
                  Test Completed
                </p>

                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  Practice Test Result
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Here is your performance summary.
                </p>
              </div>

              <div className="mt-7 grid gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                  <p className="text-sm font-medium text-slate-500">
                    Total Questions
                  </p>

                  <p className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">
                    {practiceQuestions.length}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
                  <p className="text-sm font-medium text-emerald-800">
                    Correct
                  </p>

                  <p className="mt-2 text-2xl font-bold text-emerald-700 sm:text-3xl">
                    {practiceScore}
                  </p>
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
                  <p className="text-sm font-medium text-blue-800">
                    Percentage
                  </p>

                  <p className="mt-2 text-2xl font-bold text-blue-700 sm:text-3xl">
                    {percentage}%
                  </p>
                </div>
              </div>

              <div className="mt-7 space-y-4 sm:mt-9">
                {practiceQuestions.map((q, index) => {
                  const correct =
                    q.correct_option
                      .trim()
                      .toUpperCase();

                  const user = practiceAnswers[q.id];

                  return (
                    <div
                      key={q.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-100 text-xs font-bold text-blue-700">
                          {index + 1}
                        </span>

                        <p className="min-w-0 text-sm font-semibold leading-6 text-slate-900 sm:text-base">
                          {q.question_text}
                        </p>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600">
                          Your answer:{" "}
                          <strong className="text-slate-900">
                            {user || "Not answered"}
                          </strong>
                        </p>

                        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                          Correct answer:{" "}
                          <strong>{correct}</strong>
                        </p>
                      </div>

                      {q.explanation && (
                        <p className="mt-3 break-words rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-950">
                          <strong>Explanation:</strong>{" "}
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </main>
      );
    }

    const progress =
      ((practiceIndex + 1) /
        practiceQuestions.length) *
      100;

    return (
      <main className="min-h-screen overflow-x-hidden bg-slate-50">
        <header className="border-b border-slate-800 bg-slate-950 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 sm:text-[11px]">
                Practice Mode
              </p>

              <h1 className="mt-0.5 truncate text-base font-bold sm:text-lg">
                CBSE Question Bank
              </h1>
            </div>

            <button
              onClick={exitPracticeTest}
              className="min-h-10 shrink-0 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold hover:bg-slate-700 sm:px-4 sm:text-sm"
            >
              Exit Test
            </button>
          </div>
        </header>

        <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-12">
          <div className="mb-5">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-blue-700">
                  Practice Test
                </p>

                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                  Question {practiceIndex + 1} of{" "}
                  {practiceQuestions.length}
                </h2>
              </div>

              <span className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 sm:px-3 sm:text-xs">
                {current.difficulty || "Not set"}
              </span>
            </div>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200 sm:mt-5">
              <div
                className="h-full rounded-full bg-blue-700 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
            <p className="text-lg font-semibold leading-7 text-slate-950 sm:text-xl sm:leading-8">
              {current.question_text}
            </p>

            <div className="mt-6 space-y-3 sm:mt-7">
              {current.options.map((option, index) => {
                const letter = String.fromCharCode(
                  65 + index
                );

                const selected =
                  practiceAnswers[current.id] === letter;

                return (
                  <button
                    key={letter}
                    onClick={() =>
                      setPracticeAnswers((prev) => ({
                        ...prev,
                        [current.id]: letter,
                      }))
                    }
                    className={`group flex min-h-14 w-full items-start gap-3 rounded-xl border-2 p-3.5 text-left sm:gap-4 sm:p-4 ${
                      selected
                        ? "border-blue-700 bg-blue-50"
                        : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                        selected
                          ? "bg-blue-700 text-white"
                          : "bg-slate-100 text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-800"
                      }`}
                    >
                      {letter}
                    </span>

                    <span className="min-w-0 pt-0.5 text-sm leading-6 text-slate-800 sm:text-base">
                      {option}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-5">
            <button
              disabled={practiceIndex === 0}
              onClick={() =>
                setPracticeIndex((p) => p - 1)
              }
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
            >
              ← Previous
            </button>

            {practiceIndex <
            practiceQuestions.length - 1 ? (
              <button
                onClick={() =>
                  setPracticeIndex((p) => p + 1)
                }
                className="min-h-11 rounded-lg bg-blue-700 px-3 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-800 sm:px-6"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={() => setPracticeSubmitted(true)}
                className="min-h-11 rounded-lg bg-emerald-700 px-3 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 sm:px-6"
              >
                Submit Test
              </button>
            )}
          </div>
        </section>
      </main>
    );
  }

  /* =========================
     MAIN AUTHENTICATED QUESTION BANK
  ========================= */

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-blue-700 sm:text-[11px] sm:tracking-[0.18em]">
              CBSE Exam Preparation
            </p>

            <h1 className="truncate text-base font-bold tracking-tight text-slate-950 sm:text-xl">
              CBSE Exam Question Bank
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="max-w-32 truncate text-xs font-semibold text-slate-900">
                {studentProfile?.full_name ||
                  currentUser?.email}
              </p>

              <p className="text-[10px] text-emerald-700">
                Signed in
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 sm:px-4 sm:text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 sm:py-16">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-blue-300 sm:px-3 sm:text-[11px] sm:tracking-[0.12em]">
              Student Dashboard
            </span>

            <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:mt-5 sm:text-5xl lg:text-6xl">
              Welcome
              {studentProfile?.full_name
                ? `, ${studentProfile.full_name}`
                : ""}
              .
              <br />
              Let's prepare.
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:mt-5 sm:text-lg sm:leading-7">
              Practice CBSE MCQ questions by class,
              subject, chapter and difficulty.
            </p>
          </div>
        </div>
      </section>

      {/* QUESTION AREA */}
      <section
        id="questions"
        className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-12"
      >
        {/* FILTERS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
                Question Bank
              </p>

              <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                Find Questions
              </h3>

              <p className="mt-1 text-sm leading-5 text-slate-500">
                Filter by class, subject, chapter and
                difficulty.
              </p>
            </div>

            <div className="w-fit rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-bold text-blue-800">
              {filteredQuestions.length} MCQs
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Class
              </label>

              <select
                value={selectedClass}
                onChange={(e) =>
                  handleClassChange(e.target.value)
                }
                className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none hover:border-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 sm:min-h-11"
              >
                <option value={ALL}>All Classes</option>

                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Subject
              </label>

              <select
                value={selectedSubject}
                onChange={(e) =>
                  handleSubjectChange(e.target.value)
                }
                className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none hover:border-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 sm:min-h-11"
              >
                <option value={ALL}>All Subjects</option>

                {availableSubjects.map((s) => (
                  <option
                    key={`${s.class_id}-${s.id}`}
                    value={s.subject_name}
                  >
                    {s.subject_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Chapter
              </label>

              <select
                value={selectedChapter}
                onChange={(e) =>
                  setSelectedChapter(e.target.value)
                }
                disabled={availableChapters.length === 0}
                className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none hover:border-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-11"
              >
                <option value={ALL}>
                  {availableChapters.length
                    ? "All Chapters"
                    : "No Chapters Available"}
                </option>

                {availableChapters.map((c) => (
                  <option key={c.id} value={c.chapter_name}>
                    {c.chapter_number
                      ? `${c.chapter_number}. `
                      : ""}
                    {c.chapter_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Difficulty
              </label>

              <select
                value={selectedDifficulty}
                onChange={(e) =>
                  setSelectedDifficulty(e.target.value)
                }
                className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none hover:border-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 sm:min-h-11"
              >
                <option value={ALL}>All Levels</option>

                {difficulties.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-200 pt-4 sm:pt-5">
            <span className="text-xs text-slate-600 sm:text-sm">
              Subjects:{" "}
              <strong className="text-slate-900">
                {availableSubjects.length}
              </strong>
            </span>

            <span className="text-slate-300">•</span>

            <span className="text-xs text-slate-600 sm:text-sm">
              Chapters:{" "}
              <strong className="text-slate-900">
                {availableChapters.length}
              </strong>
            </span>

            <button
              onClick={clearFilters}
              className="ml-auto min-h-10 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:border-slate-400 hover:bg-slate-50 sm:text-sm"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* PRACTICE TEST */}
        <div className="mt-5 rounded-2xl border border-blue-800 bg-blue-900 p-4 text-white shadow-sm sm:mt-6 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="inline-flex rounded-md border border-blue-700 bg-blue-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-blue-100 sm:px-3 sm:text-[11px]">
                Test Yourself
              </span>

              <h3 className="mt-2.5 text-xl font-bold sm:mt-3 sm:text-2xl">
                Practice Test
              </h3>

              <p className="mt-1 max-w-xl text-sm leading-6 text-blue-100">
                Test yourself using questions from your
                current filters.
              </p>

              <p className="mt-3 text-sm font-semibold text-white">
                {filteredQuestions.length} questions available
              </p>
            </div>

            <div className="grid w-full gap-3 sm:flex sm:w-auto sm:flex-row">
              <select
                value={practiceCount}
                onChange={(e) =>
                  setPracticeCount(Number(e.target.value))
                }
                disabled={!filteredQuestions.length}
                className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-white/40 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-11 sm:w-auto"
              >
                {practiceOptions.map((count) => (
                  <option key={count} value={count}>
                    {count === filteredQuestions.length
                      ? `All ${count} Questions`
                      : `${count} Questions`}
                  </option>
                ))}
              </select>

              <button
                onClick={startPracticeTest}
                disabled={!filteredQuestions.length}
                className="min-h-12 w-full rounded-lg bg-white px-5 py-3 text-sm font-bold text-blue-900 shadow-sm hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-11 sm:w-auto"
              >
                Start Practice Test →
              </button>
            </div>
          </div>
        </div>

        {/* QUESTIONS */}
        <div className="mt-5 space-y-4 sm:mt-7 sm:space-y-5">
          {filteredQuestions.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-500">
                —
              </div>

              <h3 className="mt-4 text-lg font-bold text-slate-950 sm:text-xl">
                No questions found
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Try changing the selected filters.
              </p>

              <button
                onClick={clearFilters}
                className="mt-5 min-h-10 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-800"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            filteredQuestions.map((question, index) => {
              const selected =
                selectedOptions[question.id];

              const checked =
                checkedAnswers[question.id];

              const correct =
                question.correct_option
                  .trim()
                  .toUpperCase();

              const isCorrect =
                selected === correct;

              return (
                <div
                  key={question.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7"
                >
                  {/* QUESTION HEADER */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      <span className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800">
                        {question.className}
                      </span>

                      <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-800">
                        {question.subjectName}
                      </span>

                      <span className="max-w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                        {question.chapterName}
                      </span>
                    </div>

                    <span
                      className={`w-fit rounded-md border px-2.5 py-1 text-[11px] font-bold ${
                        question.difficulty === "Easy"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : question.difficulty ===
                            "Hard"
                          ? "border-red-200 bg-red-50 text-red-800"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                      }`}
                    >
                      {question.difficulty ||
                        "Not set"}
                    </span>
                  </div>

                  {/* QUESTION */}
                  <div className="mt-5 flex gap-3 sm:mt-6 sm:gap-4">
                    <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-xs font-bold text-white sm:flex">
                      {index + 1}
                    </div>

                    <h3 className="min-w-0 text-base font-bold leading-6 text-slate-950 sm:text-xl sm:leading-7">
                      {question.question_text}
                    </h3>
                  </div>

                  {/* OPTIONS */}
                  <div className="mt-5 grid gap-2.5 sm:mt-6 sm:gap-3">
                    {question.options.map(
                      (option, optionIndex) => {
                        const letter =
                          String.fromCharCode(
                            65 + optionIndex
                          );

                        const selectedOption =
                          selected === letter;

                        let cls =
                          "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50";

                        if (
                          checked &&
                          selectedOption &&
                          isCorrect
                        ) {
                          cls =
                            "border-emerald-600 bg-emerald-50";
                        } else if (
                          checked &&
                          selectedOption &&
                          !isCorrect
                        ) {
                          cls =
                            "border-red-600 bg-red-50";
                        } else if (selectedOption) {
                          cls =
                            "border-blue-700 bg-blue-50";
                        }

                        return (
                          <button
                            key={letter}
                            onClick={() =>
                              handleOptionChange(
                                question.id,
                                letter
                              )
                            }
                            className={`group flex min-h-14 w-full items-start gap-3 rounded-xl border-2 p-3.5 text-left sm:gap-4 sm:p-4 ${cls}`}
                          >
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                                checked &&
                                selectedOption &&
                                isCorrect
                                  ? "bg-emerald-700 text-white"
                                  : checked &&
                                      selectedOption &&
                                      !isCorrect
                                    ? "bg-red-700 text-white"
                                    : selectedOption
                                      ? "bg-blue-700 text-white"
                                      : "bg-slate-100 text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-800"
                              }`}
                            >
                              {letter}
                            </span>

                            <span className="min-w-0 pt-0.5 text-sm leading-6 text-slate-800 sm:text-base">
                              {option}
                            </span>
                          </button>
                        );
                      }
                    )}
                  </div>

                  {/* CHECK */}
                  <div className="mt-4 flex flex-col items-stretch gap-2 sm:mt-5 sm:flex-row sm:items-center">
                    <button
                      onClick={() =>
                        checkAnswer(question)
                      }
                      disabled={!selected}
                      className="min-h-11 rounded-lg bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Check Answer
                    </button>

                    {!selected && (
                      <span className="text-center text-xs text-slate-500 sm:text-left">
                        Select an option first
                      </span>
                    )}
                  </div>

                  {/* FEEDBACK */}
                  {checked && (
                    <div
                      className={`mt-4 rounded-xl border p-4 sm:mt-5 sm:p-5 ${
                        isCorrect
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-red-200 bg-red-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                            isCorrect
                              ? "bg-emerald-700 text-white"
                              : "bg-red-700 text-white"
                          }`}
                        >
                          {isCorrect ? "✓" : "!"}
                        </div>

                        <div className="min-w-0">
                          <p
                            className={`font-bold ${
                              isCorrect
                                ? "text-emerald-800"
                                : "text-red-800"
                            }`}
                          >
                            {isCorrect
                              ? "Correct Answer!"
                              : `Incorrect. Correct answer: ${correct}`}
                          </p>

                          {question.explanation && (
                            <p
                              className={`mt-2 break-words text-sm leading-6 ${
                                isCorrect
                                  ? "text-emerald-900"
                                  : "text-red-900"
                              }`}
                            >
                              <strong>
                                Explanation:
                              </strong>{" "}
                              {question.explanation}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-7 text-center sm:px-6 sm:py-8">
          <p className="font-bold text-slate-950">
            CBSE Question Bank
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Practice • Learn • Improve
          </p>
        </div>
      </footer>
    </main>
  );
}