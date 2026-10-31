"use client";
import Image from "next/image";
import { BrandLogo } from "../brand-logo";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { errorMessage } from "../../lib/error-message";

import type { User } from "@supabase/supabase-js";
import { useEffectEvent, useEffect, useMemo, useRef, useState } from "react";
import { DialogFocus } from "../dialog-focus";
import { QuestionNavigator } from "../question-navigator";
import { QuestionContent } from "../question-content";
import { supabase } from "../../lib/supabase";
import type { MembershipClass, MembershipState } from "../../lib/student-memberships";
import { fetchFeedbackInBatches } from "../../lib/question-feedback";

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
  description: string | null;
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

const MOCK_DURATION_SECONDS = 60 * 60;
// Prevent network requests from leaving the student on a loading screen forever.
const SERVICE_REQUEST_TIMEOUT_MS = 12000;
const AUTH_INITIALIZATION_TIMEOUT_MS = 15000;

// Message shown after successful signup when email confirmation is required.
const SIGNUP_EMAIL_VERIFICATION_MESSAGE =
  "Registration successful! Please check your inbox for a verification email and click the confirmation link to activate your account. " +
  "If you cannot find the email, check your Spam, Junk, or Promotions folder. " +
  "Look for an email from CBSE Exam Prep Guide (support.cbseexam@gmail.com). " +
  "If it is in Spam, mark it as Not Spam.";


function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Service connection timed out")), ms);
    Promise.resolve(promise).then(
      value => { window.clearTimeout(timer); resolve(value); },
      err => { window.clearTimeout(timer); reject(err); }
    );
  });
}




function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor(
    (safeSeconds % 3600) / 60
  );
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(
      minutes
    ).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0"
    )}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;
}

function achievementFor(correct: number, total: number) {
  const percent = total > 0 ? (100 * correct / total) : 0;
  if (percent === 100) return { icon: "🏆", title: "Perfect Champion!", message: "Outstanding! You answered every question correctly. You're a true CBSE Champion!" };
  if (percent >= 90) return { icon: "🌟", title: "Superstar Performer!", message: "Excellent work! You're very close to perfection. Keep shining!" };
  if (percent >= 80) return { icon: "🥇", title: "Brilliant Achiever!", message: "Great performance! A little more revision can take you to the top." };
  if (percent >= 70) return { icon: "🚀", title: "Rising Star!", message: "Well done! Keep practising and strengthen the topics you missed." };
  return { icon: "💪", title: "Keep Growing!", message: "Good effort! Review your chapters, learn from mistakes and practise more. You'll improve!" };
}

function Achievement({ correct, total }: { correct: number; total: number }) {
  const result = achievementFor(correct, total);
  return <div role="status" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center shadow-sm">
    <span className="text-4xl" aria-hidden="true">{result.icon}</span>
    <h3 className="mt-2 text-xl font-extrabold text-slate-900">{result.title}</h3>
    <p className="mt-2 text-sm leading-6 text-slate-700">{result.message}</p>
  </div>;
}

function ServiceUnavailable() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-violet-100 px-5 py-12">
      <section role="alert" className="w-full max-w-xl rounded-3xl border border-indigo-100 bg-white p-7 text-center shadow-xl sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-3xl" aria-hidden="true">📚</div>
        <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.2em] text-indigo-600">CBSE Exam Prep Guide</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">We&apos;ll Be Back Shortly</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">Our learning platform is temporarily unavailable. We&apos;re working to restore access as soon as possible.</p>
        <p className="mt-3 text-sm leading-6 text-slate-500">Please return in a little while. Thank you for your patience.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-indigo-600 px-7 py-3 font-bold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Try Again</button>
        <p className="mt-7 text-xs text-slate-400">CBSE Question Bank · Practice • Learn • Improve</p>
      </section>
    </main>
  );
}

export default function Home() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  // Registration options are class-scoped and numerically ordered, not sorted by database ID.
  // Competitive exam categories remain separate from the Class 8–12 signup list.
  const signupClasses = useMemo(() => classes
    .filter(c => /^Class\s+(8|9|10|11|12)$/i.test(c.class_name.trim()))
    .sort((a,b) => Number(a.class_name.match(/\d+/)?.[0] ?? 0) - Number(b.class_name.match(/\d+/)?.[0] ?? 0)),
  [classes]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<number[]>([]);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  // Dismiss the chapter multi-select on outside click or Escape, keeping selections.
  useEffect(() => {
    if (!chapterPickerOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const picker = document.getElementById("practice-chapter");
      if (picker && event.target instanceof Node && !picker.contains(event.target)) {
        setChapterPickerOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setChapterPickerOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [chapterPickerOpen]);
  const [selectionCounts, setSelectionCounts] = useState({practice:0,mock:0});
  const [selectionLoading, setSelectionLoading] = useState(false);
  const preferredSubjectApplied = useRef(false);

  const [loading, setLoading] = useState(true);
  const subjectQuestionsLoading = selectionLoading;
  const [selectionError, setSelectionError] = useState("");
  const [selectionReload, setSelectionReload] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const authUserIdRef = useRef<string | null>(null);
  const [studentProfile, setStudentProfile] =
    useState<StudentProfile | null>(null);

  // Durable per-subject Practice and Mock reservations.
  const [freeUsage, setFreeUsage] = useState<
    Record<number, {practice_session_id:string|null;mock_paper_id:string|null;test_type:string;completed_at:string|null}[]>
  >({});

  const [freeUsageLoading, setFreeUsageLoading] =
    useState(false);

  const [, setSelectedClass] = useState(ALL);
  const [selectedSubject, setSelectedSubject] = useState(ALL);
  const [, setSelectedChapter] = useState(ALL);

  /* =========================
     PRACTICE TEST
  ========================= */

  const [practiceMode, setPracticeMode] = useState(false);
  const [requestedPracticeSet, setPracticeSet] = useState(1);
  const [practiceQuestions, setPracticeQuestions] = useState<
    MCQ[]
  >([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceDraft, setPracticeDraft] = useState<Record<number, string>>({});
  const [practiceReviewFilter, setPracticeReviewFilter] = useState<"all" | "wrong">("all");
  const [practiceAnswers, setPracticeAnswers] = useState<
    Record<number, string>
  >({});
  const [practiceConfirmSubmit, setPracticeConfirmSubmit] = useState(false);
  const [practiceSkippedReview, setPracticeSkippedReview] = useState(false);
  const [mockSkippedReview, setMockSkippedReview] = useState(false);
  const [, setMockConfirmSubmit] = useState(false);
  const [practiceSubmitted, setPracticeSubmitted] =
    useState(false);
  const [practiceSubmitting, setPracticeSubmitting] =
    useState(false);
  const [practiceSubmitError, setPracticeSubmitError] =
    useState("");
  const [, setPracticeStartedAt] =
    useState<number | null>(null);
  const [practiceSessionId, setPracticeSessionId] = useState<string | null>(null);
  const [practiceSaving, setPracticeSaving] = useState(false);
  const [practiceStarting, setPracticeStarting] = useState(false);
  const [practiceSavedCount, setPracticeSavedCount] = useState(0);
  const practiceSaveLock = useRef(false);

  /* =========================
     REAL MOCK TEST
  ========================= */

  const [mockMode, setMockMode] = useState(false);
  const [, setMockDuration] = useState(MOCK_DURATION_SECONDS);
  const [mockReviewFilter, setMockReviewFilter] = useState<"all" | "wrong">("all");
  const [mockQuestions, setMockQuestions] = useState<MCQ[]>(
    []
  );
  const [mockIndex, setMockIndex] = useState(0);
  const [mockAnswers, setMockAnswers] = useState<
    Record<number, string>
  >({});
  const [mockSubmitted, setMockSubmitted] =
    useState(false);
  const [mockSubmitting, setMockSubmitting] =
    useState(false);
  const [mockSubmitError, setMockSubmitError] =
    useState("");
  const [mockSessionId, setMockSessionId] = useState<string | null>(null);
  const [mockDeadlineAt, setMockDeadlineAt] = useState<number | null>(null);
  const [mockClockOffsetMs, setMockClockOffsetMs] = useState(0);
  const [mockAnswerSaving, setMockAnswerSaving] = useState(false);
  const mockAnswerLock = useRef(false);
  const mockAutoSubmitAttempted = useRef(false);
  const [mockSyncRetry, setMockSyncRetry] = useState(0);
  const [mockTimeLeft, setMockTimeLeft] = useState(
    MOCK_DURATION_SECONDS
  );
  const [, setMockStartedAt] =
    useState<number | null>(null);
  type MockPaper = {
    id: string;
    subject_id: number;
    paper_number: number | null;
    retake_number: number | null;
    question_ids: number[];
    status: "STARTED" | "COMPLETED";
    started_at: string;
    completed_at: string | null;
    quiz_attempt_id: string | null;
  };
  const [mockPapers, setMockPapers] = useState<MockPaper[]>([]);
  const [completedMockAttemptId, setCompletedMockAttemptId] = useState<number | null>(null);
  const [mockFeedbackReady, setMockFeedbackReady] = useState(false);
  const [savedMockScore, setSavedMockScore] = useState<{
    correct_answers: number; total_questions: number; percentage: number;
  } | null>(null);
  const [activeMockPaperId, setActiveMockPaperId] = useState<string | null>(null);
  const [mockStarting, setMockStarting] = useState(false);
  const [mockHistoryLoading, setMockHistoryLoading] = useState(false);


  /* =========================
     SUBSCRIPTION / COUPON
  ========================= */

  const [isPaidMember, setIsPaidMember] = useState(false);
  const [membershipChecked, setMembershipChecked] = useState(false);
  const [membershipClasses, setMembershipClasses] = useState<MembershipClass[]>([]);
  function openSubscribe() { router.push("/memberships"); }
  const promotionText: string | null = null;

  /* =========================
     SIGNUP
  ========================= */

  const [showSignup, setShowSignup] = useState(false);
  const [signupAcknowledged, setSignupAcknowledged] = useState(false);
  const [signupFullName, setSignupFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);
  const [signupConfirmPassword, setSignupConfirmPassword] =
    useState("");
  const [signupClassId, setSignupClassId] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState("");

  // The public SEO homepage is /. Deep links open the original
  // authentication dialogs here without duplicating the marketing page.
  useEffect(() => {
    const timer = window.setTimeout(() => {
    const mode = new URLSearchParams(window.location.search).get("auth");
    if (mode === "signup") {
      setShowSignup(true);
      setShowSignin(false);
    } else if (mode === "signin") {
      setShowSignin(true);
      setShowSignup(false);
    }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);


  /* =========================
     SIGN IN
  ========================= */

  const [showSignin, setShowSignin] = useState(false);
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [signinLoading, setSigninLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signinError, setSigninError] = useState("");

  /* =========================
     FORGOT / RESET PASSWORD
  ========================= */

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState("");
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState("");
  const [showUpdatePassword, setShowUpdatePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [updatePasswordLoading, setUpdatePasswordLoading] = useState(false);
  const [updatePasswordError, setUpdatePasswordError] = useState("");
  const [updatePasswordSuccess, setUpdatePasswordSuccess] = useState("");

  // Explicit, read-only public homepage preview from the admin panel.
  const isWebsitePreview = typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("website") === "public";

  /* =========================
     LOAD PUBLIC CLASSES
  ========================= */

  async function loadClasses(): Promise<ClassRow[]> {
    let result;
    try {
      result = await withTimeout(supabase
        .from("classes")
        .select("id,class_name,is_active")
        .eq("is_active", true)
        .order("id"), SERVICE_REQUEST_TIMEOUT_MS);
    } catch (connectionError) {
      console.error("Class request timed out or failed:", connectionError);
      setError("Unable to connect to the learning platform.");
      return [];
    }
    const { data, error: classError } = result;

    if (classError) {
      console.error("Class data unavailable:", classError);
      setError("Unable to connect to the learning platform.");
      return [];
    }

    const classRows = (data || []) as ClassRow[];

    setClasses(classRows);

    return classRows;
  }

  /* =========================
     GET ENROLLED CLASS
  ========================= */

  function getMetadataClassId(user: User | null | undefined): number | null {
    const metadataValue = user?.user_metadata?.class_id;

    if (
      metadataValue === null ||
      metadataValue === undefined ||
      metadataValue === ""
    ) {
      return null;
    }

    const parsed = Number(metadataValue);

    return Number.isFinite(parsed) ? parsed : null;
  }

  const enrolledClassId = useMemo(() => {
    if (
      studentProfile?.class_id !== null &&
      studentProfile?.class_id !== undefined
    ) {
      return studentProfile.class_id;
    }

    return getMetadataClassId(currentUser);
  }, [studentProfile, currentUser]);

  const enrolledClass = useMemo(() => {
    if (enrolledClassId === null) {
      return null;
    }

    return (
      classes.find(
        (item) => item.id === enrolledClassId
      ) || null
    );
  }, [classes, enrolledClassId]);

  /* =========================
     LOAD STUDENT PROFILE
  ========================= */

  async function loadStudentProfile(
    userId: string,
    authUser?: User
  ) {
    const {data: membershipData,error: profileError} = await supabase.rpc("cbse_student_memberships_v1");
    if (authUserIdRef.current !== userId) return null;
    const state = membershipData as MembershipState | null;
    const data = state?.profile;
    if (state) setMembershipClasses(state.classes);

    if (profileError) {
      console.error(
        "Student profile error:",
        profileError
      );

      const metadataClassId =
        getMetadataClassId(authUser);

      const metadataName =
        authUser?.user_metadata?.full_name || "";

      if (metadataClassId !== null) {
        const fallbackProfile: StudentProfile = {
          full_name: metadataName,
          class_id: metadataClassId,
        };

        setStudentProfile(fallbackProfile);
        setSelectedClass(
          String(metadataClassId)
        );
      } else {
        setStudentProfile(null);
        setSelectedClass(ALL);
      }

      return null;
    }

    if (data) {
      const profileData = data as StudentProfile;

      const finalClassId =
        profileData.class_id !== null
          ? profileData.class_id
          : getMetadataClassId(authUser);

      const profile: StudentProfile = {
        full_name:
          profileData.full_name ||
          authUser?.user_metadata?.full_name ||
          "",
        class_id: finalClassId,
      };

      setStudentProfile(profile);

      if (finalClassId !== null) {
        setSelectedClass(String(finalClassId));
      } else {
        setSelectedClass(ALL);
      }

      setSelectedSubject(ALL);
      setSelectedChapter(ALL);
    setSelectedChapterIds([]);

      return profile;
    }

    const metadataClassId =
      getMetadataClassId(authUser);

    if (metadataClassId !== null) {
      const fallbackProfile: StudentProfile = {
        full_name:
          authUser?.user_metadata?.full_name || "",
        class_id: metadataClassId,
      };

      setStudentProfile(fallbackProfile);
      setSelectedClass(
        String(metadataClassId)
      );
      setSelectedSubject(ALL);
      setSelectedChapter(ALL);
    setSelectedChapterIds([]);

      return fallbackProfile;
    }

    setStudentProfile(null);
    setSelectedClass(ALL);

    return null;
  }

  /* =========================
     LOAD FREE USAGE
  ========================= */

  async function loadFreeUsage(userId: string) {
    setFreeUsageLoading(true);

    const { data, error: usageError } = await supabase.from("free_test_sets")
      .select("subject_id,test_type,practice_session_id,mock_paper_id,completed_at").eq("student_id",userId);
    if (authUserIdRef.current !== userId) return;
    if (usageError) { setFreeUsageLoading(false); throw usageError; }
    const usageMap: typeof freeUsage = {};
    for (const row of data || []) (usageMap[row.subject_id] ||= []).push(row);
    setFreeUsage(usageMap);
    setFreeUsageLoading(false);
  }

  /* =========================
     LOAD PAID MEMBERSHIP
  ========================= */

  async function loadPaidMembership(userId: string): Promise<boolean> {
    setMembershipChecked(false);
    const {data,error} = await supabase.rpc("cbse_student_memberships_v1");
    if (authUserIdRef.current !== userId) return false;
    if (error) { setMembershipChecked(false); return isPaidMember; }
    const state = data as MembershipState;
    setMembershipClasses(state.classes);
    setIsPaidMember(state.paid_current_class);
    setMembershipChecked(true);
    return state.paid_current_class;
  }

  /* =========================
     FREE USAGE HELPERS
  ========================= */

  /* =========================
     LOAD QUESTION BANK
  ========================= */

  // Supabase normally returns at most 1,000 rows per request.
  // Fetch all pages so newly imported subjects and questions are visible.
  async function fetchAllRows<T>(
    table: string,
    columns: string
  ): Promise<T[]> {
    const pageSize = 1000;
    const results: T[] = [];

    for (let offset = 0; ; offset += pageSize) {
      const query = supabase
        .from(table)
        .select(columns)
        .eq("is_active", true);


      const { data, error: fetchError } = await withTimeout(query
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1), SERVICE_REQUEST_TIMEOUT_MS);

      if (fetchError) {
        throw new Error(`${table}: ${fetchError.message}`);
      }

      const batch = (data || []) as unknown as T[];
      results.push(...batch);
      if (batch.length < pageSize) break;
    }

    return results;
  }

  async function loadQuestionData(
    classRowsOverride?: ClassRow[],
    manageLoading = true,
    activeUserId?: string
  ) {
    if (manageLoading) {
      setLoading(true);
      setError("");
    }

    try {
      const [loadedClasses, subjectRows, chapterRows] =
        await Promise.all([
          classRowsOverride
            ? Promise.resolve(classRowsOverride)
            : fetchAllRows<ClassRow>(
                "classes",
                "id,class_name,is_active"
              ),
          fetchAllRows<SubjectRow>(
            "subjects",
            "id,class_id,subject_name,is_active"
          ),
          fetchAllRows<ChapterRow>(
            "chapters",
            "id,subject_id,chapter_number,chapter_name,description,is_active"
          ),

        ]);

      const classRows = loadedClasses;

      // Discard metadata returned for an account that has since signed out.
      if (activeUserId && authUserIdRef.current !== activeUserId) return;
      // Question bodies are delivered only after assigning a set (at most 60).
      setClasses(classRows);
      setSubjects(subjectRows);
      setChapters(chapterRows);
    } catch (loadError: unknown) {
      console.error("Question bank loading failed:", loadError);
      if (!activeUserId || authUserIdRef.current === activeUserId) {
        setError(errorMessage(loadError) || "Unable to load questions.");
      }
    } finally {
      if (manageLoading && (!activeUserId || authUserIdRef.current === activeUserId)) {
        setLoading(false);
      }
    }
  }

  // Administrator access is handled on /admin, where the protected RPC
  // is called only within the administrator workflow. Do not probe admin
  // permissions from the public/student homepage.

  /* =========================
     AUTH INITIALIZATION
  ========================= */

  const loadAuthResources = useEffectEvent(async (user: User, classRowsOverride: ClassRow[] | undefined, isCurrent: () => boolean) => {
    // All four requests depend on the authenticated user, but not on each other.
    // Await them together rather than adding four network round-trip delays.
    // Keep the loading view until membership and navigation data are consistent.
    setError("");
    try {
      const results = await Promise.allSettled([
        loadStudentProfile(user.id, user),
        loadFreeUsage(user.id),
        loadPaidMembership(user.id),
        loadQuestionData(classRowsOverride, false, user.id),
      ]);
      if (!isCurrent() || authUserIdRef.current !== user.id) return;
      const failure = results.find(result => result.status === "rejected");
      if (failure && failure.status === "rejected") {
        console.error("Student initialization failed:", failure.reason);
        setError("Unable to load your student account. Please refresh and try again.");
      }
    } finally {
      if (isCurrent() && authUserIdRef.current === user.id) setLoading(false);
    }
  });
  useEffect(() => {
    let mounted = true;
    let authRevision = 0;

    function clearAuthenticatedState() {
      authUserIdRef.current = null;

      setCurrentUser(null);
      setStudentProfile(null);
      setFreeUsage({});
      setFreeUsageLoading(false);
      setIsPaidMember(false);
      setMembershipClasses([]);
      setMembershipChecked(false);
      setSubjects([]);
      setChapters([]);

      setSelectedClass(ALL);
      setSelectedSubject(ALL);
      setSelectedChapter(ALL);
    setSelectedChapterIds([]);

      setPracticeConfirmSubmit(false);
      setPracticeSkippedReview(false);
      setMockConfirmSubmit(false);
      setMockSkippedReview(false);
      setPracticeMode(false);
      setPracticeQuestions([]);
      setPracticeAnswers({});
       setPracticeDraft({});
      setPracticeIndex(0);
      setPracticeSubmitted(false);
      setPracticeSubmitting(false);
      setPracticeSubmitError("");
      setPracticeStartedAt(null);
      setPracticeSessionId(null);
      setPracticeSavedCount(0);
      practiceSaveLock.current = false;

      setMockConfirmSubmit(false);
    setMockMode(false);
      setMockQuestions([]);
      setMockAnswers({});
      setMockIndex(0);
      setMockSubmitted(false);
      setMockSubmitting(false);
      setMockSubmitError("");
      setMockTimeLeft(MOCK_DURATION_SECONDS);
      setMockStartedAt(null);
      setMockSessionId(null);
      setMockDeadlineAt(null);
    setMockClockOffsetMs(0);

    }

    async function loadAuthenticatedUser(
      user: User | null,
      classRowsOverride?: ClassRow[]
    ) {
      if (!mounted || !user) {
        return;
      }

      const userId = user.id;
      // INITIAL_SESSION and the explicit session read may resolve together.
      // Reserve this user before the first await so only one metadata load runs.
      if (authUserIdRef.current === userId) return;
      authUserIdRef.current = userId;
      setCurrentUser(user);
      setLoading(true);
      const revision = authRevision;

      // Do not load student-only data for an admin viewing the public homepage.
      if (isWebsitePreview) {
        authUserIdRef.current = userId;
        setCurrentUser(user);
        setLoading(false);
        return;
      }

      // Routing hint only. Teacher API verifies the server-owned role and native session.
      try {
        const {data:{session}}=await supabase.auth.getSession();
        if(session){const r=await fetch('/api/teacher?action=identity',{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'});
          if(!mounted||revision!==authRevision)return;
          if(r.ok&&(await r.json()).teacher){window.location.replace('/teacher');return;}}
      }catch{/* Normal student/admin loading can retry through its existing controls. */}

      // Detect admin accounts using the existing role mapping. The admin page
      // remains responsible for enforcing permissions; this is routing only.
      // Use a short deadline so an unavailable role lookup cannot block students.
      try {
        const { data: adminRow, error: roleError } = await withTimeout(
          supabase.from("admin_users").select("user_id").eq("user_id", userId).maybeSingle(),
          3000
        );
        if (!mounted || revision !== authRevision) return;
        if (!roleError && adminRow) {
          window.location.replace("/admin");
          return;
        }
        if (roleError) {
          console.warn("Admin role lookup unavailable; continuing with student login:", roleError.message);
        }
      } catch (roleError) {
        console.warn("Admin role lookup timed out; continuing with student login:", roleError);
      }

      // Covers both fresh logins and previously authenticated sessions.
      if (!mounted || revision !== authRevision || authUserIdRef.current !== null && authUserIdRef.current !== userId) return;

      /*
       * Prevent duplicate loads caused by signInWithPassword()
       * and Supabase's SIGNED_IN / INITIAL_SESSION events.
       */
      authUserIdRef.current = userId;
      setCurrentUser(user);

      await loadAuthResources(user, classRowsOverride, () => mounted && revision === authRevision);
    }

    async function initializeApp() {
      const revision = authRevision;
      setAuthLoading(true);
      try {
        // Class metadata and auth session are independent. Both have a deadline.
        const [classRows, sessionResult] = await Promise.all([
          loadClasses(),
          withTimeout(supabase.auth.getSession(), AUTH_INITIALIZATION_TIMEOUT_MS),
        ]);
        // A quick sign-in can finish while initial class metadata is loading.
        // Its newer auth event must win over the earlier anonymous snapshot.
        if (!mounted || revision !== authRevision) return;
        const { data: { session }, error: sessionError } = sessionResult;
        if (sessionError) throw sessionError;
        if (session?.user) {
          await withTimeout(loadAuthenticatedUser(session.user, classRows), AUTH_INITIALIZATION_TIMEOUT_MS);
        } else {
          clearAuthenticatedState();
          setLoading(false);
        }
      } catch (initializationError) {
        console.error("Application initialization failed:", initializationError);
        if (mounted && revision === authRevision) setError("Unable to connect to the learning platform.");
      } finally {
        if (mounted && revision === authRevision) setAuthLoading(false);
      }
    }

    /*
     * Subscribe first so a login/logout event cannot be missed.
     * Database work is scheduled outside the auth callback to avoid
     * doing long async Supabase queries while the auth lock is held.
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) {
          return;
        }
        if (event === "INITIAL_SESSION" && authRevision > 0) return;
        if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && authUserIdRef.current !== session?.user?.id)) authRevision++;

        if (event === "PASSWORD_RECOVERY") {
          setUpdatePasswordError("");
          setUpdatePasswordSuccess("");
          setNewPassword("");
          setConfirmNewPassword("");
          setShowUpdatePassword(true);
        }

        if (!session?.user) {
          clearAuthenticatedState();
          setAuthLoading(false);
          return;
        }

        const userId = session.user.id;

        /*
         * initializeApp() may already have loaded this exact user.
         * Do not run the complete membership/profile/question load twice.
         */
        if (authUserIdRef.current === userId) {
          setCurrentUser(session.user);
          setAuthLoading(false);
          return;
        }

        /*
         * Defer the database calls until the auth callback finishes.
         */
        const scheduledRevision = authRevision;
        window.setTimeout(() => {
          if (!mounted || scheduledRevision !== authRevision) {
            return;
          }

          void (async () => {
            await loadAuthenticatedUser(session.user);

            if (mounted) {
              setAuthLoading(false);
            }
          })();
        }, 0);
      }
    );

    void initializeApp();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [isWebsitePreview]);

  /* =========================
      SERVER-DEADLINE MOCK TIMER
     ========================= */
  useEffect(() => {
    if (!mockMode || mockSubmitted || !mockDeadlineAt) return;
    const tick = () => setMockTimeLeft(Math.max(0, Math.ceil((mockDeadlineAt - (Date.now() + mockClockOffsetMs)) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [mockMode, mockSubmitted, mockDeadlineAt, mockClockOffsetMs]);

  const submitExpiredMock = useEffectEvent(() => submitMockTest(true));
  useEffect(() => {
    if (mockMode && !mockSubmitted && !mockSubmitting && !mockAnswerSaving && mockSessionId && !mockAutoSubmitAttempted.current && mockTimeLeft === 0) {
      mockAutoSubmitAttempted.current = true;
      void submitExpiredMock();
    }
  }, [mockMode, mockSubmitted, mockSubmitting, mockAnswerSaving, mockSessionId, mockTimeLeft, mockSyncRetry]);

  // Retry synchronization after expiry when connectivity returns or the tab reopens.
  // Server deadline remains authoritative; a retry never extends the exam.
  useEffect(() => {
    if (!mockMode || mockSubmitted || !mockSessionId || mockTimeLeft > 0) return;
    const retry = () => { mockAutoSubmitAttempted.current = false; setMockSyncRetry(n => n + 1); };
    const onVisible = () => { if (document.visibilityState === "visible") retry(); };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(retry, 15000);
    return () => { window.removeEventListener("online", retry); document.removeEventListener("visibilitychange", onVisible); window.clearInterval(timer); };
  }, [mockMode, mockSubmitted, mockSessionId, mockTimeLeft]);

  /* =========================
     FILTER DATA
  ========================= */

  const availableSubjects = useMemo(() => {
    if (enrolledClassId === null) {
      return [];
    }

    const rows = subjects.filter(
      (s) => s.class_id === enrolledClassId
    );

    const seen = new Set<string>();

    return rows.filter((s) => {
      const key = s.subject_name
        .trim()
        .toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }, [subjects, enrolledClassId]);

  const availableChapters = useMemo(() => {
    if (enrolledClassId === null) {
      return [];
    }

    const activeSubjectIds = new Set(
      subjects
        .filter((s) => {
          const classMatches =
            s.class_id === enrolledClassId;

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

    return rows
      .filter((c) => {
        const key = `${c.subject_id}:${c.chapter_name.trim().toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) =>
        (Number(a.chapter_number) || 9999) -
          (Number(b.chapter_number) || 9999) ||
        a.id - b.id
      );
  }, [
    chapters,
    subjects,
    selectedSubject,
    enrolledClassId,
  ]);

  useEffect(() => {
    if (!currentUser || !availableSubjects.length || preferredSubjectApplied.current) return;
    const preferred = new URLSearchParams(window.location.search).get("subject");
    const timer = window.setTimeout(() => {
      preferredSubjectApplied.current = true;
      if (preferred && availableSubjects.some(s => s.subject_name === preferred)) {
        setSelectedSubject(preferred);
        setSelectedChapter(ALL);
    setSelectedChapterIds([]);
        setPracticeSet(1);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentUser, availableSubjects]);

  const unfinishedMock = mockPapers.find(p => p.status === "STARTED");
  const mockCanStart = selectedSubject !== ALL && !selectionLoading &&
    (Boolean(unfinishedMock) || selectionCounts.mock > 0) && !mockStarting && !mockHistoryLoading && !subjectQuestionsLoading;
  const mockActionLabel = unfinishedMock ? "Resume Mock Test →" : "Start Next Mock Test →";

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Cancel stale history initialization when the selected subject changes.
      await Promise.resolve();
      if (cancelled) return;
      setMockPapers([]);
      if (!currentUser?.id || !availableSubjects.find(s => s.subject_name === selectedSubject)?.id) { setMockHistoryLoading(false); return; }

      setMockHistoryLoading(true);
      const { data, error: historyError } = await supabase
        .from("mock_papers")
        .select("id,subject_id,paper_number,retake_number,question_ids,status,started_at,completed_at,quiz_attempt_id")
        .eq("student_id", currentUser.id)
        .eq("subject_id", availableSubjects.find(s => s.subject_name === selectedSubject)!.id)
        .order("started_at", { ascending: true });
      if (!cancelled) {
        if (historyError) setMockSubmitError(`Mock history: ${historyError.message}`);
        else setMockPapers((data || []) as MockPaper[]);
        setMockHistoryLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [currentUser?.id, selectedSubject, availableSubjects]);


  const selectedSubjectObject = useMemo(() => {
    if (selectedSubject === ALL) {
      return null;
    }

    return (
      availableSubjects.find(
        (subject) =>
          subject.subject_name ===
          selectedSubject
      ) || null
    );
  }, [
    availableSubjects,
    selectedSubject,
  ]);

  const PRACTICE_SET_SIZE = 60;
  const chapterSelected = selectedChapterIds.length > 0;

  const questionCountForSelection = selectionCounts.practice;
  const totalPracticeSets = isPaidMember ? Math.ceil(questionCountForSelection/60) : (questionCountForSelection>0?1:0);
  const practiceSet = Math.min(requestedPracticeSet,Math.max(1,totalPracticeSets));
  const practiceReservation = selectedSubjectObject ? freeUsage[selectedSubjectObject.id]?.find(r=>r.test_type==="PRACTICE") : undefined;
  const mockReservation = selectedSubjectObject ? freeUsage[selectedSubjectObject.id]?.find(r=>r.test_type==="MOCK") : undefined;
  useEffect(() => {
    let cancelled=false;
    const load=async()=>{
      await Promise.resolve(); if(cancelled)return;
      setSelectionLoading(true);
      setSelectionError("");
      if(!selectedSubjectObject){setSelectionCounts({practice:0,mock:0});setSelectionLoading(false);return;}
      let response=await supabase.rpc("cbse_selection_counts_v1",{p_subject_id:selectedSubjectObject.id,p_chapter_ids:selectedChapterIds});
      if(!cancelled && response.error && (response.status===0 || response.status>=500)){
        await new Promise(resolve=>window.setTimeout(resolve,200));
        if(cancelled)return;
        response=await supabase.rpc("cbse_selection_counts_v1",{p_subject_id:selectedSubjectObject.id,p_chapter_ids:selectedChapterIds});
      }
      const {data,error}=response;
      if(cancelled)return;
      if(error){setSelectionError("Test availability could not be loaded. Please retry.");setSelectionCounts({practice:0,mock:0});}
      else {const row=data?.[0];setSelectionCounts({practice:Number(row?.practice_count||0),mock:Number(row?.mock_count||0)});}
      setSelectionLoading(false);
    };void load();return()=>{cancelled=true;};
  },[selectedSubjectObject,selectedChapterIds,selectionReload]);

  /* =========================
     FILTER HANDLERS
  ========================= */

  async function handleClassChange(value: string) {
    const id = Number(value);
    if (!membershipClasses.some(c => c.id === id)) return;
    const {data,error} = await supabase.rpc("cbse_switch_class_v1", {p_class_id:id});
    if (error) { setError(error.message); return; }
    const state = data as MembershipState;
    setStudentProfile({full_name:state.profile.full_name,class_id:state.profile.class_id});
    setMembershipClasses(state.classes);
    setIsPaidMember(state.paid_current_class);
    setMembershipChecked(true);
    setSelectedClass(String(id));
    setSelectedSubject(ALL);
    setSelectedChapter(ALL);
    setSelectedChapterIds([]);
    setPracticeSet(1);
  }

  function handleSubjectChange(value: string) {
    setChapterPickerOpen(false);
    setSelectedSubject(value);
    setSelectedChapter(ALL);
    setSelectedChapterIds([]);
    setPracticeSet(1);
  }

  function clearFilters() {
    setPracticeSet(1);
    if (enrolledClassId !== null) {
      setSelectedClass(
        String(enrolledClassId)
      );
    } else {
      setSelectedClass(ALL);
    }

    setSelectedSubject(ALL);
    setSelectedChapter(ALL);
    setSelectedChapterIds([]);
  }

  /* =========================
     PRACTICE TEST
  ========================= */

  // Each practice set has a persistent Supabase session. Never rely only on
  // localStorage: it would not survive switching devices or clearing storage.
  async function startPracticeTest() {
    if (!currentUser || !selectedSubjectObject || practiceStarting) return;
    if (freeUsageLoading && !isPaidMember) return;
    setPracticeStarting(true);
    setPracticeSubmitError("");
    try {
      const { data: session, error: sessionError } = await supabase.rpc("cbse_start_practice_v2", {
        p_subject_id: selectedSubjectObject.id,
        p_chapter_ids: selectedChapterIds,
        p_set_number: practiceSet,
      });
      if (sessionError || !session) throw sessionError || new Error("Could not start practice.");
      // Secure, session-scoped delivery is necessary for free chapter selection and
      // for resuming assignments that are not in the current subject listing.
      const { data: delivered, error: deliveryError } = await supabase.rpc("cbse_practice_session_questions_v1", {
        p_session_id: session.id,
      });
      if (deliveryError) throw deliveryError;
      const byChapterId = new Map(availableChapters.map(ch => [ch.id, ch.chapter_name]));
      const className = enrolledClass?.class_name || "";
      let assigned: MCQ[] = ((delivered || []) as QuestionRow[]).map(q => ({
        ...q,
        classId: enrolledClassId!, subjectId: selectedSubjectObject.id,
        className, subjectName: selectedSubjectObject.subject_name,
        chapterName: byChapterId.get(q.chapter_id) || "",
        options: [q.option_a,q.option_b,q.option_c,q.option_d].filter(Boolean),
      }));
      if (!assigned.length || assigned.length !== (session.question_ids as number[]).length) {
        throw new Error("Saved practice questions could not be loaded. Contact support.");
      }
      const answers = (session.answers || {}) as Record<number,string>;
      let index = Math.min(Math.max(0,session.current_index ?? 0),assigned.length-1);
      if (answers[assigned[index]?.id] && index < assigned.length-1) index++;
      const answeredIds = assigned.filter(q => answers[q.id] != null).map(q => q.id);
      if (answeredIds.length) {
        const feedback = await fetchFeedbackInBatches(answeredIds, async (ids) => {
          const { data, error } = await supabase.rpc("cbse_question_feedback_v1", { p_ids: ids });
          if (error) throw error;
          return (data || []) as Array<{id:number,correct_option:string,explanation:string|null}>;
        });
        const byFeedback = new Map(((feedback || []) as Array<{id:number,correct_option:string,explanation:string|null}>).map(q => [Number(q.id),q]));
        assigned = assigned.map(q => {
          const item = byFeedback.get(q.id);
          return item ? {...q,correct_option:item.correct_option,explanation:item.explanation} : q;
        });
      }
      setPracticeSessionId(session.id);
      setPracticeQuestions(assigned);
      setPracticeIndex(index);
      setPracticeAnswers(answers);
      setPracticeDraft({});
      setPracticeSavedCount(Object.keys(answers).length);
      setPracticeSubmitted(false);
      setPracticeConfirmSubmit(false);
      setPracticeSubmitting(false);
      setPracticeStartedAt(new Date(session.started_at).getTime());
      setPracticeMode(true);
      setMockMode(false);
    } catch (err: unknown) {
      setPracticeSubmitError(errorMessage(err) || "Could not load or resume practice.");
    } finally {
      setPracticeStarting(false);
    }
  }

  async function persistPracticeProgress(_nextAnswers: Record<number, string>, nextIndex: number) {
    if (!currentUser || !practiceSessionId) throw new Error("Practice session is missing.");
    const { data, error: saveError } = await supabase.rpc("cbse_save_practice_progress_v1", {
      p_session_id: practiceSessionId, p_index: nextIndex,
    });
    if (saveError || !data) throw saveError || new Error("Unable to save practice progress.");
  }

  async function choosePracticeAnswer(questionId: number, letter: string | null) {
    if (practiceSaveLock.current || practiceSubmitting || Object.prototype.hasOwnProperty.call(practiceAnswers, questionId)) return;
    if (!currentUser || !practiceSessionId) return;
    practiceSaveLock.current = true;
    setPracticeSaving(true);
    setPracticeSubmitError("");
    try {
      const { data, error: lockError } = await supabase.rpc("submit_practice_answer_locked", {
        p_session_id: practiceSessionId, p_question_id: questionId, p_answer: letter,
      });
      if (lockError) throw lockError;
      const saved = (data || {}) as Record<string, string | null>;
      // Reload authoritative answers; a second tab cannot overwrite a submitted choice.
      setPracticeAnswers(saved as Record<number, string>);
      // Answer feedback is returned only after the server has locked the answer.
      const { data: feedback, error: feedbackError } = await supabase.rpc("cbse_question_feedback_v1", { p_ids: [questionId] });
      if (feedbackError) throw feedbackError;
      const item = ((feedback || []) as Array<{ id: number; correct_option: string; explanation: string | null }>).find(q => Number(q.id) === questionId);
      if (item) {
        setPracticeQuestions(prev => prev.map(q => q.id === questionId ? { ...q, correct_option: item.correct_option, explanation: item.explanation } : q));
      }
      setPracticeDraft(prev => { const next = { ...prev }; delete next[questionId]; return next; });
      setPracticeSavedCount(Object.keys(saved).length);
      if (practiceSkippedReview) {
        const next = practiceQuestions.findIndex((q, i) => i > practiceIndex && !Object.prototype.hasOwnProperty.call(saved, q.id));
        if (next >= 0) {
          await persistPracticeProgress(saved as Record<number,string>, next);
          setPracticeIndex(next);
        } else {
          setPracticeSkippedReview(false);
          setPracticeConfirmSubmit(true);
        }
      }
    } catch (err: unknown) {
      setPracticeSubmitError("Could not lock this answer. Please retry. " + (errorMessage(err) || ""));
    } finally {
      practiceSaveLock.current = false;
      setPracticeSaving(false);
    }
  }

  async function navigatePractice(nextIndex: number) {
    if (practiceSaveLock.current || practiceSubmitting) return;
    practiceSaveLock.current = true;
    setPracticeSaving(true);
    setPracticeSubmitError("");
    try {
      await persistPracticeProgress(practiceAnswers, nextIndex);
      setPracticeIndex(nextIndex);
    } catch (err: unknown) {
      setPracticeSubmitError("Unable to save your position. Please retry. " + (errorMessage(err) || ""));
    } finally {
      practiceSaveLock.current = false;
      setPracticeSaving(false);
    }
  }

  /*
   * Records one free-question usage for every
   * question included in the completed practice test.
   *
   * Database usage is stored at:
   *
   *     student_id + subject_id
   *
   * chapter_id is passed for compatibility with the
   * existing RPC, but the allowance is subject-level.
   */
  /* =========================
     SAVE QUIZ HISTORY
  ========================= */

  // Trusted grading: answers are taken from locked practice_sessions on the server.
  // Do not deploy this client change before installing and testing the matching RPC.
  async function submitPracticeTest() {
    setPracticeConfirmSubmit(false);
    if (!currentUser || !practiceSessionId) {
      setPracticeSubmitError("Your practice session is missing. Please sign in again.");
      return;
    }
    if (practiceSubmitting || practiceSubmitted || practiceSaveLock.current) return;
    if (!practiceQuestions.length) {
      setPracticeSubmitError("There are no questions to submit.");
      return;
    }
    setPracticeSubmitting(true);
    setPracticeSubmitError("");
    try {
      const { data: attemptId, error: submitError } = await supabase.rpc(
        "cbse_finish_practice_secure_v1", { p_session_id: practiceSessionId }
      );
      if (submitError) throw submitError;
      if (!attemptId) throw new Error("No quiz attempt was returned.");
      await loadFreeUsage(currentUser.id);
      const resultFeedback = await fetchFeedbackInBatches(practiceQuestions.map(q => q.id), async (ids) => {
        const { data, error } = await supabase.rpc("cbse_question_feedback_v1", { p_ids: ids });
        if (error) throw error;
        return (data || []) as Array<{id:number,correct_option:string,explanation:string|null}>;
      });
      const resultById = new Map((resultFeedback || []).map((item: {id:number,correct_option:string,explanation:string|null}) => [Number(item.id),item]));
      setPracticeQuestions(prev => prev.map(q => {
        const item = resultById.get(q.id) as { id: number; correct_option: string; explanation: string | null } | undefined;
        return item ? { ...q, correct_option: item.correct_option, explanation: item.explanation } : q;
      }));
      setPracticeSubmitted(true);
    } catch (err: unknown) {
      console.error("Secure practice submission error:", err);
      setPracticeSubmitError(errorMessage(err) || "Unable to submit practice test. Please retry.");
    } finally {
      setPracticeSubmitting(false);
    }
  }

  function exitPracticeTest() {
    setPracticeMode(false);
    setPracticeConfirmSubmit(false);
    setPracticeSubmitted(false);
    setPracticeSubmitting(false);
    setPracticeSubmitError("");
    setPracticeQuestions([]);
    setPracticeAnswers({});
    setPracticeIndex(0);
    setPracticeStartedAt(null);
    setPracticeSessionId(null);
    setPracticeSavedCount(0);
  }

  /* =========================
     REAL MOCK TEST
  ========================= */

  async function refreshMockPapers(subjectId: number) {
    if (!currentUser) return;
    const { data, error: historyError } = await supabase
      .from("mock_papers")
      .select("id,subject_id,paper_number,retake_number,question_ids,status,started_at,completed_at,quiz_attempt_id")
      .eq("student_id", currentUser.id)
      .eq("subject_id", subjectId)
      .order("started_at", { ascending: true });
    if (historyError) throw historyError;
    setMockPapers((data || []) as MockPaper[]);
  }

  async function loadSavedMockScore(attemptId: number) {
    // A completed attempt's stored score is authoritative, even when
    // per-question feedback is temporarily unavailable.
    const { data, error } = await supabase.from("quiz_attempts")
      .select("correct_answers,total_questions,percentage")
      .eq("id", attemptId).maybeSingle();
    if (!error && data) setSavedMockScore({
      correct_answers: Number(data.correct_answers ?? 0),
      total_questions: Number(data.total_questions ?? 0),
      percentage: Number(data.percentage ?? 0),
    });
  }

  async function openSavedMock(kind: "full" | "chapters", paperId: string, assigned: MCQ[]) {
    const { data, error } = await supabase.rpc("mock_open_exam", { p_kind: kind, p_paper_id: paperId });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("Could not load the exam session.");
    const deadline = new Date(row.deadline_at).getTime();
    const serverOffset = new Date(row.server_now).getTime() - Date.now();
    setMockClockOffsetMs(serverOffset);
    const duration = Math.round((deadline - new Date(row.started_at).getTime()) / 1000);
    mockAutoSubmitAttempted.current = false;
    setMockSyncRetry(0);
    setMockSessionId(row.session_id);
    setMockDeadlineAt(deadline);
    setMockDuration(duration);
    setMockStartedAt(new Date(row.started_at).getTime());
    setMockTimeLeft(Math.max(0, Math.ceil((deadline - (Date.now() + serverOffset)) / 1000)));
    setMockQuestions(assigned);
    setMockFeedbackReady(false);
    setSavedMockScore(null);
    setCompletedMockAttemptId(row.quiz_attempt_id ? Number(row.quiz_attempt_id) : null);
    if (row.status === "COMPLETED" && row.quiz_attempt_id) {
      void loadSavedMockScore(Number(row.quiz_attempt_id));
    }
    const saved = (row.answers || {}) as Record<number, string>;
    setMockAnswers(saved);
    const firstUnanswered = assigned.findIndex(q => !saved[q.id]);
    setMockIndex(firstUnanswered < 0 ? 0 : firstUnanswered);
    setMockConfirmSubmit(false);
    setMockSubmitted(row.status === "COMPLETED");
    setMockSubmitting(false);
    setPracticeMode(false);
    setMockMode(true);
    if (row.status === "COMPLETED") {
      // A previously expired exam is already final on the server.
      // Load authorized feedback before displaying a numeric score.
      try {
        const { data: feedback, error: feedbackError } = await supabase.rpc(
          "cbse_question_feedback_v1", { p_ids: assigned.map(q => q.id) }
        );
        if (feedbackError) throw feedbackError;
        const details = new Map(((feedback || []) as Array<{
          id: number; correct_option: string; explanation: string | null;
        }>).map(item => [Number(item.id), item]));
        if (assigned.some(q => !details.has(q.id))) {
          throw new Error("Saved answer feedback is incomplete.");
        }
        setMockQuestions(assigned.map(q => {
          const detail = details.get(q.id);
          return detail ? { ...q, correct_option: detail.correct_option, explanation: detail.explanation } : q;
        }));
        setMockFeedbackReady(true);
        setMockSubmitError("");
      } catch {
        setMockSubmitError("Your mock was completed and saved. Detailed review is temporarily unavailable. Use Download Complete Report PDF or your dashboard to view the saved result.");
      }
    }
  }

  async function startMockTest() {
    setMockSubmitError("");
    if (!currentUser || !selectedSubjectObject || mockStarting) return;
    if (subjectQuestionsLoading || mockHistoryLoading) {
      setMockSubmitError("Wait for mock availability to load."); return;
    }
    setMockStarting(true);
    try {
      // The server resumes an unfinished assignment or allocates the next 48/12 paper.
      const { data, error } = await supabase.rpc("start_next_mock_paper_v3", {
        p_subject_id: selectedSubjectObject.id,
        p_chapter_ids: selectedChapterIds,
      });
      if (error || !data) throw error || new Error("Unable to start the next mock.");
      const paper = data as MockPaper;
      const { data: assignedRows, error: deliveryError } = await supabase.rpc(
        "cbse_assigned_mock_questions_v2", { p_paper_id: paper.id }
      );
      if (deliveryError) throw deliveryError;
      const className = enrolledClass?.class_name || "";
      const chapterMap = new Map(availableChapters.map(ch => [ch.id,ch.chapter_name]));
      const assigned = ((assignedRows||[]) as QuestionRow[]).map(q => ({
        ...q, classId: enrolledClassId || 0, subjectId: selectedSubjectObject.id,
        className, subjectName: selectedSubjectObject.subject_name,
        chapterName: chapterMap.get(q.chapter_id) || "",
        options: [q.option_a,q.option_b,q.option_c,q.option_d].filter(Boolean),
      })) as MCQ[];
      if (!assigned.length || assigned.length !== paper.question_ids.length) {
        throw new Error("Assigned mock questions are incomplete. Contact support.");
      }
      setCompletedMockAttemptId(null);
      setActiveMockPaperId(paper.id);
      await openSavedMock("full", paper.id, assigned);
      await refreshMockPapers(selectedSubjectObject.id);
      await loadFreeUsage(currentUser.id);
    } catch (err: unknown) {
      setMockSubmitError(errorMessage(err) || "Unable to resume mock test.");
    } finally {
      setMockStarting(false);
    }
  }

  async function chooseMockAnswer(questionId: number, letter: string) {
    if (!mockSessionId || mockSubmitted || mockSubmitting || mockAnswerLock.current || !mockDeadlineAt) return;
    if (Date.now() + mockClockOffsetMs >= mockDeadlineAt) { setMockTimeLeft(0); return; }
    mockAnswerLock.current = true;
    setMockAnswerSaving(true);
    setMockSubmitError("");
    try {
      const { data: saveResult, error } = await supabase.rpc("mock_save_answer", {
        p_session_id: mockSessionId, p_question_id: questionId, p_answer: letter,
      });
      if (error) throw error;
      if (!saveResult?.saved) {
        setMockTimeLeft(0);
        throw new Error("The exam deadline has passed. This answer was not counted.");
      }
      const updated = { ...mockAnswers, [questionId]: String(saveResult.answer || letter) };
      setMockAnswers(updated);
      if (mockSkippedReview) {
        const next = mockQuestions.findIndex((q,i) => i > mockIndex && !updated[q.id]);
        if (next >= 0) setMockIndex(next);
        else { setMockSkippedReview(false); setMockConfirmSubmit(true); }
      }
    } catch (err: unknown) {
      setMockSubmitError("Answer was not saved. Please reconnect and select it again. " + (errorMessage(err) || ""));
    } finally { mockAnswerLock.current = false; setMockAnswerSaving(false); }
  }

  async function submitMockTest(automaticSubmit = false) {
    setMockConfirmSubmit(false);
    if (mockSubmitted || mockSubmitting || mockAnswerLock.current || !mockSessionId) return;
    if (!automaticSubmit && mockQuestions.some(q=>!mockAnswers[q.id])) return;
    setMockSubmitting(true);
    setMockSubmitError("");
    try {
      const { data: completedAttemptId, error } = await supabase.rpc("mock_finish_exam", {
        p_session_id: mockSessionId,
      });
      if (error) throw error;
      // The database is authoritative. A later optional feedback failure must
      // not cause the completed exam to appear unfinished in the UI.
      setMockSubmitted(true);
      setMockFeedbackReady(false);
      setMockTimeLeft(0);
      if (completedAttemptId) {
        setCompletedMockAttemptId(Number(completedAttemptId));
        void loadSavedMockScore(Number(completedAttemptId));
      }
    } catch (err: unknown) {
      setMockSubmitError(
        (automaticSubmit ? "Time is over. " : "") +
        "Unable to confirm submission. Reconnect and retry. " + (errorMessage(err) || "")
      );
      if (automaticSubmit) mockAutoSubmitAttempted.current = false;
      setMockSubmitting(false);
      return;
    }

    try {
      if (activeMockPaperId) {
        const { data: completedData, error: completedError } = await supabase.rpc(
          "mock_open_exam", { p_kind: "full", p_paper_id: activeMockPaperId }
        );
        if (!completedError && completedData) {
          const completed = Array.isArray(completedData) ? completedData[0] : completedData;
          if (completed?.answers) setMockAnswers(completed.answers as Record<number, string>);
        }
      }
      const { data: feedback, error: feedbackError } = await supabase.rpc(
        "cbse_question_feedback_v1", { p_ids: mockQuestions.map(q => q.id) }
      );
      if (feedbackError) throw feedbackError;
      const details = new Map(((feedback || []) as Array<{
        id: number; correct_option: string; explanation: string | null;
      }>).map(item => [Number(item.id), item]));
      if (mockQuestions.some(q => !details.has(q.id))) throw new Error("Some answers are unavailable.");
      setMockQuestions(previous => previous.map(q => {
        const detail = details.get(q.id);
        return detail ? { ...q, correct_option: detail.correct_option, explanation: detail.explanation } : q;
      }));
      setMockFeedbackReady(true);
    } catch {
      setMockSubmitError("Your mock was successfully submitted and saved. Answer review could not be loaded; your full report is available from the PDF link or dashboard.");
    } finally {
      setMockSubmitting(false);
      if (selectedSubjectObject) {
        void refreshMockPapers(selectedSubjectObject.id).catch(() => {
          // A history-refresh issue does not change the committed result.
        });
      }
    }
  }

  function exitMockTest() {
    setMockConfirmSubmit(false);
    setMockMode(false);
    setMockSubmitted(false);
    setMockSubmitting(false);
    setCompletedMockAttemptId(null);
    setMockFeedbackReady(false);
    setSavedMockScore(null);
    setMockSubmitError("");
    setMockQuestions([]);
    setMockAnswers({});
    setMockIndex(0);
    setMockTimeLeft(
      MOCK_DURATION_SECONDS
    );
    setMockStartedAt(null);
    setMockSessionId(null);
    setMockDeadlineAt(null);
    setMockClockOffsetMs(0);
  }

  /* =========================
     SIGNUP HANDLERS
  ========================= */

  function openSignup() {
    setSignupAcknowledged(false);
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
    if (!signupAcknowledged) {
      setSignupError("Please accept the Terms of Use, acknowledge the Privacy Policy and confirm parent or guardian permission and supervision if you are under 18.");
      return;
    }

    const fullName =
      signupFullName.trim();

    const email =
      signupEmail.trim().toLowerCase();

    if (!fullName) {
      setSignupError(
        "Please enter your full name."
      );
      return;
    }

    if (!email) {
      setSignupError(
        "Please enter your email ID."
      );
      return;
    }

    if (!signupClassId) {
      setSignupError(
        "Please select your class."
      );
      return;
    }

    if (signupPassword.length < 12 || signupPassword.length > 128) {
      setSignupError(
        "Password must contain 12–128 characters."
      );
      return;
    }

    if (
      signupPassword !==
      signupConfirmPassword
    ) {
      setSignupError(
        "Password and Confirm Password do not match."
      );
      return;
    }

    setSignupLoading(true);

    const {
      data,
      error: authError,
    } = await supabase.auth.signUp({
      email,
      password: signupPassword,
      options: {
        emailRedirectTo:
          "https://cbse-question-bank.vercel.app/auth/callback",
        data: {
          full_name: fullName,
          class_id: Number(signupClassId),
          registration_acknowledgement: "terms-privacy-parent-supervision-v1-2026-10-30",
          registration_acknowledged: true,
          registration_acknowledged_at: new Date().toISOString(),
        },
      },
    });

    if (authError) {
      setSignupError(
        authError.message
      );
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
      const {
        error: profileError,
      } = await supabase
        .from("student_profiles")
        .insert({
          id: data.user.id,
          full_name: fullName,
          mobile_number: null,
          class_id: Number(
            signupClassId
          ),
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
      setSignupSuccess(SIGNUP_EMAIL_VERIFICATION_MESSAGE);
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

  function openForgotPassword() {
    setSigninError("");
    setForgotPasswordEmail(signinEmail.trim().toLowerCase());
    setForgotPasswordError("");
    setForgotPasswordSuccess("");
    setShowSignin(false);
    setShowForgotPassword(true);
  }

  function closeForgotPassword() {
    if (forgotPasswordLoading) {
      return;
    }

    setShowForgotPassword(false);
    setForgotPasswordError("");
    setForgotPasswordSuccess("");
  }

  async function handleForgotPassword(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    setForgotPasswordError("");
    setForgotPasswordSuccess("");

    const email = forgotPasswordEmail.trim().toLowerCase();
    if (!email) {
      setForgotPasswordError("Please enter your email ID.");
      return;
    }

    setForgotPasswordLoading(true);
    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

      if (resetError) {
        setForgotPasswordError(resetError.message);
        return;
      }

      setForgotPasswordSuccess(
        "Password reset link sent. Please check your email and open the link to create a new password."
      );
    } catch (resetError: unknown) {
      console.error("Password reset error:", resetError);
      setForgotPasswordError(
        errorMessage(resetError) ||
          "Unable to send the password reset email. Please try again."
      );
    } finally {
      setForgotPasswordLoading(false);
    }
  }

  async function handleUpdatePassword(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    setUpdatePasswordError("");
    setUpdatePasswordSuccess("");

    if (newPassword.length < 12 || newPassword.length > 128) {
      setUpdatePasswordError("Password must contain 12–128 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setUpdatePasswordError(
        "Passwords do not match. Please enter the same password in both fields."
      );
      return;
    }

    setUpdatePasswordLoading(true);
    try {
      const { error: updateError } =
        await supabase.auth.updateUser({ password: newPassword });

      if (updateError) {
        setUpdatePasswordError(updateError.message);
        return;
      }

      setUpdatePasswordSuccess(
        "Your password has been updated successfully. You can continue using CBSE Question Bank."
      );
      setNewPassword("");
      setConfirmNewPassword("");

      window.setTimeout(() => {
        setShowUpdatePassword(false);
        setUpdatePasswordSuccess("");
      }, 1800);
    } catch (updateError: unknown) {
      console.error("Password update error:", updateError);
      setUpdatePasswordError(
        errorMessage(updateError) ||
          "Unable to update your password. Please try again."
      );
    } finally {
      setUpdatePasswordLoading(false);
    }
  }

  async function handleSignin(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setSigninError("");

    const email =
      signinEmail.trim().toLowerCase();

    if (!email) {
      setSigninError(
        "Please enter your email ID."
      );
      return;
    }

    if (!signinPassword) {
      setSigninError(
        "Please enter your password."
      );
      return;
    }

    setSigninLoading(true);

    const {
      data,
      error: authError,
    } =
      await supabase.auth.signInWithPassword({
        email,
        password: signinPassword,
      });

    if (authError) {
      setSigninError(
        authError.message
      );
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

    /*
     * Do not load profile/subscription/question data here.
     * Supabase's auth state listener is now the single source
     * of truth for post-login initialization.
     */

    // Public-preview mode intentionally hides the authenticated dashboard.
    // Once sign-in succeeds, leave preview mode with a fresh session-aware load.
    if (new URLSearchParams(window.location.search).get("website") === "public") {
      window.location.replace("/app");
      return;
    }

    // Role-aware routing is handled by loadAuthenticatedUser().

    // The auth-state listener performs role routing before showing a dashboard.

    setSigninEmail("");
    setSigninPassword("");
    setSigninLoading(false);
    setShowSignin(false);
  }

  /* =========================
     LOGOUT
  ========================= */

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);

    // Keep the premium state unchanged until Supabase confirms sign-out,
    // preventing a transient "Subscribe ₹99" button.
    const { error: signOutError } = await supabase.auth.signOut({scope:"local"});
    if (signOutError) {
      console.error("Sign out failed:", signOutError);
      setSigningOut(false);
      return;
    }

    authUserIdRef.current = null;

    setCurrentUser(null);
    setStudentProfile(null);
    setFreeUsage({});
    setIsPaidMember(false);
    setSubjects([]);
    setChapters([]);

    setSelectedClass(ALL);
    setSelectedSubject(ALL);
    setSelectedChapter(ALL);
    setSelectedChapterIds([]);

    setPracticeMode(false);
    setPracticeQuestions([]);
    setPracticeAnswers({});
    setPracticeIndex(0);
    setPracticeSubmitted(false);
    setPracticeSubmitting(false);
    setPracticeSubmitError("");

    setMockMode(false);
    setMockQuestions([]);
    setMockAnswers({});
    setMockIndex(0);
    setMockSubmitted(false);
    setMockSubmitting(false);
    setMockSubmitError("");
    setMockTimeLeft(
      MOCK_DURATION_SECONDS
    );
    setMockStartedAt(null);
    setPracticeStartedAt(null);
    setSigningOut(false);
  }

  const practiceScore =
    practiceQuestions.filter(
      (q) =>
        practiceAnswers[q.id] ===
        q.correct_option
          .trim()
          .toUpperCase()
    ).length;

  const mockScore =
    mockQuestions.filter(
      (q) =>
        mockAnswers[q.id] ===
        q.correct_option
          .trim()
          .toUpperCase()
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

  if (error && !practiceMode && !mockMode) {
    return <ServiceUnavailable />;
  }

  /* =========================
     PUBLIC HOME PAGE
  ========================= */

  if (!currentUser || isWebsitePreview) {
    return (
      <main className="min-h-screen w-full min-w-0 overflow-x-hidden bg-[#f8f7ff] text-slate-950">
        {showSignup && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-6">
            <div role="dialog" aria-modal="true" aria-label="Create student account" tabIndex={-1} className="relative my-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-7"><DialogFocus />
              <button
                type="button"
                onClick={closeSignup}
                disabled={signupLoading}
                className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-2xl font-extrabold text-slate-950 shadow-md hover:bg-slate-100 disabled:opacity-40"
                aria-label="Close signup"
              >
                ×
              </button>

              <div className="mb-5 hidden overflow-hidden rounded-xl bg-gradient-to-br from-indigo-50 to-violet-100 sm:block">
                <Image width={775} height={655} sizes="(max-width: 640px) 100vw, 440px" src="/images/examyari-students.webp" alt="Indian students preparing for CBSE Classes 8 to 12" className="h-auto max-h-44 w-full object-cover object-[center_30%] sm:max-h-52" />
              </div>
              <div className="pr-10">
                <div className="mb-3"><BrandLogo compact /></div>
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
                  <p className="font-bold">Please verify your email address</p>
                  <p className="mt-2">{signupSuccess}</p>
                </div>
              )}

              {!signupSuccess && <form
                onSubmit={handleSignup}
                className="mt-5 space-y-4"
              >
                <div>
                  <label htmlFor="student-field-1" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Full Name
                  </label>

                  <input id="student-field-1"
                    type="text"
                    value={signupFullName}
                    onChange={(e) =>
                      setSignupFullName(
                        e.target.value
                      )
                    }
                    placeholder="Enter your full name"
                    disabled={signupLoading}
                    autoComplete="name"
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-100 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="student-field-2" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Email ID
                  </label>

                  <input id="student-field-2"
                    type="email"
                    value={signupEmail}
                    onChange={(e) =>
                      setSignupEmail(
                        e.target.value
                      )
                    }
                    placeholder="Enter your email"
                    disabled={signupLoading}
                    autoComplete="email"
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-100 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="student-field-3" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Password
                  </label>

                  <div className="relative"><input id="student-field-3"
                    type={showSignupPassword ? "text" : "password"}
                    value={signupPassword}
                    onChange={(e) =>
                      setSignupPassword(
                        e.target.value
                      )
                    }
                    placeholder="12–128 characters"
                    disabled={signupLoading}
                    autoComplete="new-password"
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-3.5 pr-14 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-100 sm:text-sm"
                  /><button type="button" aria-label={showSignupPassword ? "Hide password" : "Show password"} aria-pressed={showSignupPassword} onClick={() => setShowSignupPassword(v => !v)} className="absolute inset-y-0 right-1 flex min-h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600">{showSignupPassword ? "🙈" : "👁️"}</button></div>
                </div>

                <div>
                  <label htmlFor="student-field-4" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Confirm Password
                  </label>

                  <div className="relative"><input id="student-field-4"
                    type={showSignupConfirm ? "text" : "password"}
                    value={signupConfirmPassword}
                    onChange={(e) =>
                      setSignupConfirmPassword(
                        e.target.value
                      )
                    }
                    placeholder="Re-enter your password"
                    disabled={signupLoading}
                    autoComplete="new-password"
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-3.5 pr-14 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-100 sm:text-sm"
                  /><button type="button" aria-label={showSignupConfirm ? "Hide password" : "Show password"} aria-pressed={showSignupConfirm} onClick={() => setShowSignupConfirm(v => !v)} className="absolute inset-y-0 right-1 flex min-h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600">{showSignupConfirm ? "🙈" : "👁️"}</button></div>
                </div>

                <div>
                  <label htmlFor="student-field-5" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Class
                  </label>

                  <select id="student-field-5"
                    value={signupClassId}
                    onChange={(e) =>
                      setSignupClassId(
                        e.target.value
                      )
                    }
                    disabled={signupLoading}
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-100 sm:text-sm"
                  >
                    <option value="">
                      Select your class
                    </option>

                    {signupClasses.map((c) => (
                      <option
                        key={c.id}
                        value={c.id}
                      >
                        {c.class_name}
                      </option>
                    ))}
                  </select>
                </div>


                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm leading-6 text-slate-700">
                  <label htmlFor="registration-acknowledgement" className="flex cursor-pointer items-start gap-3">
                    <input id="registration-acknowledgement" type="checkbox" required checked={signupAcknowledged} onChange={e => setSignupAcknowledged(e.target.checked)} disabled={signupLoading} aria-describedby="registration-policy-links" className="mt-1 h-5 w-5 shrink-0 accent-indigo-700" />
                    <span>I agree to the Terms of Use and acknowledge the Privacy Policy. If I am under 18, I confirm that I am registering with the permission and under the supervision of my parent or legal guardian.</span>
                  </label>
                  <p id="registration-policy-links" className="mt-3 text-xs"><a href="/terms" target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-700 underline">Terms of Use</a> · <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-700 underline">Privacy Policy</a> · <a href="/parent-consent" target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-700 underline">Guidance for parents</a></p>
                </div>

                <button
                  type="submit"
                  disabled={signupLoading||!signupAcknowledged}
                  className="mt-2 min-h-12 w-full rounded-lg bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {signupLoading
                    ? "Creating Account..."
                    : "Create Account"}
                </button>
              </form>}

              <div className="mt-4 text-center text-sm font-semibold text-slate-700">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={openSignin}
                  className="inline-flex min-h-11 items-center rounded-lg px-2 font-extrabold text-indigo-700 underline underline-offset-4 hover:bg-indigo-50 hover:text-indigo-900"
                >
                  Sign In
                </button>
              </div>
            </div>
          </div>
        )}

        {showSignin && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-6">
            <div role="dialog" aria-modal="true" aria-label="Student sign in" tabIndex={-1} className="relative my-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-7"><DialogFocus />
              <button
                type="button"
                onClick={closeSignin}
                disabled={signinLoading}
                className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-2xl font-extrabold text-slate-950 shadow-md hover:bg-slate-100 disabled:opacity-40"
                aria-label="Close sign in"
              >
                ×
              </button>

              <div className="mb-5 hidden overflow-hidden rounded-xl bg-sky-50 sm:block">
                <Image width={775} height={655} sizes="(max-width: 640px) 100vw, 440px" src="/images/examyari-students.webp" alt="Indian students preparing for CBSE Classes 8 to 12" className="h-auto max-h-44 w-full object-cover object-[center_30%] sm:max-h-52" />
              </div>
              <div className="pr-10">
                <div className="mb-3"><BrandLogo compact /></div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
                  Student Login
                </p>

                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                  Sign in to continue
                </h2>

                <p className="mt-1.5 text-sm leading-5 text-slate-500">
                  Sign in to access your CBSE Question Bank.
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Administrator? <Link href="/admin" className="font-bold text-indigo-700 underline underline-offset-2">Open Admin Login</Link>
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
                  <label htmlFor="student-field-6" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Email ID
                  </label>

                  <input id="student-field-6"
                    type="email"
                    value={signinEmail}
                    onChange={(e) =>
                      setSigninEmail(
                        e.target.value
                      )
                    }
                    placeholder="Enter your email"
                    disabled={signinLoading}
                    autoComplete="email"
                    autoFocus
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-100 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="student-field-7" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Password
                  </label>

                  <input id="student-field-7"
                    type="password"
                    value={signinPassword}
                    onChange={(e) =>
                      setSigninPassword(
                        e.target.value
                      )
                    }
                    placeholder="Enter your password"
                    disabled={signinLoading}
                    autoComplete="current-password"
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-100 sm:text-sm"
                  />
                </div>

                <div className="-mt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={openForgotPassword}
                    disabled={signinLoading}
                    className="min-h-11 px-1 text-sm font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={signinLoading}
                  className="mt-1 min-h-12 w-full rounded-lg bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {signinLoading
                    ? "Signing In..."
                    : "Sign In"}
                </button>
              </form>

              <div className="mt-4 text-center text-xs text-slate-500">
                Don&apos;t have an account?{" "}
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


        {showForgotPassword && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/70 px-4 py-5 backdrop-blur-sm sm:py-8">
            <div role="dialog" aria-modal="true" aria-label="Request reset email" tabIndex={-1} className="relative my-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7"><DialogFocus />
              <button
                type="button"
                onClick={closeForgotPassword}
                disabled={forgotPasswordLoading}
                className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl text-xl font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 sm:right-4 sm:top-4"
                aria-label="Close forgot password"
              >
                ×
              </button>

              <div className="pr-10">
                <div className="mb-3"><BrandLogo compact /></div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
                  Account Recovery
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                  Forgot your password?
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Enter your registered email and we will send you a secure password reset link.
                </p>
              </div>

              {forgotPasswordError && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm leading-5 text-red-800">
                  {forgotPasswordError}
                </div>
              )}

              {forgotPasswordSuccess && (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm leading-6 text-emerald-800">
                  {forgotPasswordSuccess}
                </div>
              )}

              <form onSubmit={handleForgotPassword} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="student-field-8" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Email ID
                  </label>
                  <input id="student-field-8"
                    type="email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    placeholder="Enter your registered email"
                    disabled={forgotPasswordLoading || !!forgotPasswordSuccess}
                    autoComplete="email"
                    autoFocus
                    className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 disabled:bg-slate-100 sm:text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotPasswordLoading || !!forgotPasswordSuccess}
                  className="min-h-12 w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {forgotPasswordLoading ? "Sending Reset Link..." : "Send Reset Link"}
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotPasswordError("");
                  setForgotPasswordSuccess("");
                  setSigninEmail(forgotPasswordEmail);
                  setShowSignin(true);
                }}
                disabled={forgotPasswordLoading}
                className="mt-4 min-h-11 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                ← Back to Sign In
              </button>
            </div>
          </div>
        )}

        {showUpdatePassword && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/70 px-4 py-5 backdrop-blur-sm sm:py-8">
            <div role="dialog" aria-modal="true" aria-label="Create new password" tabIndex={-1} className="relative my-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7"><DialogFocus />
              <div className="pr-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
                  Secure Password Reset
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                  Create a new password
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Choose a new password for your CBSE Question Bank account.
                </p>
              </div>

              {updatePasswordError && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm leading-5 text-red-800">
                  {updatePasswordError}
                </div>
              )}

              {updatePasswordSuccess && (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm leading-6 text-emerald-800">
                  {updatePasswordSuccess}
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="student-field-9" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    New Password
                  </label>
                  <input id="student-field-9"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="12–128 characters"
                    disabled={updatePasswordLoading || !!updatePasswordSuccess}
                    autoComplete="new-password"
                    autoFocus
                    className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 disabled:bg-slate-100 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="student-field-10" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Confirm New Password
                  </label>
                  <input id="student-field-10"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Enter the password again"
                    disabled={updatePasswordLoading || !!updatePasswordSuccess}
                    autoComplete="new-password"
                    className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 disabled:bg-slate-100 sm:text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={updatePasswordLoading || !!updatePasswordSuccess}
                  className="min-h-12 w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updatePasswordLoading ? "Updating Password..." : "Update Password"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Authentication dialogs above remain unchanged. Public SEO marketing lives only on /. */}
        <header className="border-b border-indigo-100 bg-white/95 shadow-sm">
          <nav aria-label="Student portal navigation" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
            <Link href="/" className="flex items-center gap-3 font-black tracking-tight text-slate-950">
              <BrandLogo />
            </Link>
            <div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:gap-3">
              <Link href="/" className="inline-flex min-h-11 items-center rounded-xl px-2 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 sm:text-sm">← Public Homepage</Link>
              <button onClick={openSignin} className="min-h-11 rounded-xl px-3 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-50">Sign In</button>
              <button onClick={openSignup} className="min-h-11 rounded-xl bg-indigo-700 px-3 py-2 text-sm font-bold text-white">Sign Up</button>
            </div>
          </nav>
        </header>
        <section className="relative overflow-hidden bg-gradient-to-br from-indigo-800 via-indigo-600 to-violet-700 px-5 py-14 text-white sm:py-20">
          <div aria-hidden="true" className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="relative mx-auto max-w-5xl">
            <p className="inline-flex rounded-full border border-amber-300/40 bg-amber-300/15 px-3 py-1.5 text-xs font-extrabold uppercase tracking-widest text-amber-200">CBSE CLASSES 8–12 · STUDENT PORTAL</p>
            <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">Welcome to your learning space.</h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-indigo-100 sm:text-lg">Sign in to continue practice or mock tests, or create a free account to get started. Your saved results and membership remain in your student account.</p>
            <div className="mt-9 grid gap-5 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/20 bg-white p-6 text-slate-950 shadow-xl sm:p-8">
                <div className="text-3xl" aria-hidden="true">🔐</div>
                <h2 className="mt-4 text-2xl font-black">Existing Student</h2>
                <p className="mt-3 min-h-14 text-sm leading-6 text-slate-600">Resume saved practice, view test history and continue available mock tests.</p>
                <button type="button" onClick={openSignin} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-indigo-700 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-indigo-800">Continue to Sign In</button>
              </div>
              <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-100 to-white p-6 text-slate-950 shadow-xl sm:p-8">
                <div className="text-3xl" aria-hidden="true">🎓</div>
                <h2 className="mt-4 text-2xl font-black">New Student</h2>
                <p className="mt-3 min-h-14 text-sm leading-6 text-slate-600">Choose Class 8, 9, 10, 11 or 12. Try one free Practice set and one free Mock set per subject.</p>
                <button type="button" onClick={openSignup} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-amber-400 px-5 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-amber-300">Start Free · Create Account</button>
              </div>
            </div>
            <p className="mt-7 text-sm text-indigo-100">Administrator? <Link href="/admin" className="font-bold text-white underline underline-offset-4">Go to Admin Login</Link></p>
          </div>
        </section>
        <footer className="border-t border-slate-200 bg-white px-5 py-7 text-center text-sm text-slate-600">
          Independent CBSE practice platform · <a href="mailto:support.cbseexam@gmail.com" className="font-bold text-indigo-700 underline">Contact Support</a>
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
     DATABASE / CONNECTION ERROR
  ========================= */
  if (error && !practiceMode && !mockMode) {
    return <ServiceUnavailable />;
  }

  /* =========================
     REAL MOCK TEST
  ========================= */

  if (mockMode) {
    const current =
      mockQuestions[mockIndex];

    if (!current) {
      return null;
    }

    if (mockSubmitted) {
      const correctAnswers = savedMockScore
        ? savedMockScore.correct_answers
        : mockFeedbackReady ? mockScore : null;
      const percentage = savedMockScore
        ? Number(savedMockScore.percentage).toFixed(1)
        : mockFeedbackReady && mockQuestions.length
          ? ((mockScore / mockQuestions.length) * 100).toFixed(1)
          : null;

      return (
        <main className="min-h-screen overflow-x-hidden bg-slate-50">
          <header className="border-b border-slate-800 bg-slate-950 text-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300 sm:text-[11px]">
                  Real Mock Test
                </p>

                <h1 className="mt-0.5 truncate text-base font-bold sm:text-lg">
                  CBSE Question Bank
                </h1>
              </div>

              <button
                onClick={exitMockTest}
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
                  {percentage === null ? "Saved" : percentage + "%"}
                </div>

                <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
                  Mock Test Completed
                </p>

                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  Real Mock Test Result
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Your {mockQuestions.length}-question mock test has been completed.
                </p>
              </div>

              {correctAnswers !== null ? <Achievement correct={correctAnswers} total={mockQuestions.length} /> :
                <p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  Your exam has been saved. Open the complete report for your scores and answers.
                </p>}
              {completedMockAttemptId && <Link href={"/report/mock/"+completedMockAttemptId} className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-indigo-700 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-800">Download Complete Report PDF</Link>}
              <div className="mt-7 grid gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                  <p className="text-sm font-medium text-slate-500">
                    Total Questions
                  </p>

                  <p className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">
                    {mockQuestions.length}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
                  <p className="text-sm font-medium text-emerald-800">
                    Correct
                  </p>

                  <p className="mt-2 text-2xl font-bold text-emerald-700 sm:text-3xl">
                    {correctAnswers === null ? "—" : correctAnswers}
                  </p>
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
                  <p className="text-sm font-medium text-blue-800">
                    Percentage
                  </p>

                  <p className="mt-2 text-2xl font-bold text-blue-700 sm:text-3xl">
                    {percentage === null ? "—" : percentage + "%"}
                  </p>
                </div>
              </div>

                {mockSubmitError && <p role="alert" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{mockSubmitError}</p>}
                {mockFeedbackReady && <>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <label className="text-sm font-bold" htmlFor="mock-review-filter">Review:</label>
                  <select id="mock-review-filter" value={mockReviewFilter} onChange={e => setMockReviewFilter(e.target.value as "all" | "wrong")} className="rounded-lg border border-slate-300 p-2 text-sm">
                    <option value="all">All questions</option><option value="wrong">Wrong / skipped only</option>
                  </select>
                </div>
                <div className="mt-7 space-y-4 sm:mt-9">
                {mockQuestions.filter(q => mockReviewFilter === "all" || mockAnswers[q.id] !== q.correct_option.trim().toUpperCase()).map(
                  (q) => {
                    const correct =
                      q.correct_option
                        .trim()
                        .toUpperCase();

                    const user =
                      mockAnswers[q.id];

                    return (
                      <div
                        key={q.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-100 text-xs font-bold text-blue-700">
                            {mockQuestions.findIndex(item => item.id === q.id) + 1}
                          </span>

                          <p className="min-w-0 text-sm font-semibold leading-6 text-slate-900 sm:text-base">
                            <QuestionContent text={q.question_text} />
                          </p>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {[q.option_a, q.option_b, q.option_c, q.option_d].map((option, optionIndex) => {
                            const letter = String.fromCharCode(65 + optionIndex);
                            return <div key={letter} className={`rounded-lg border px-3 py-2 text-sm ${letter === correct ? "border-emerald-300 bg-emerald-50" : letter === user ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}>
                              <strong>{letter}.</strong> <QuestionContent text={option} /> {letter === correct ? "✓ Correct" : letter === user ? "• Your answer" : ""}
                            </div>;
                          })}
                        </div>
                        {!user && <p className="mt-2 text-xs font-semibold text-amber-800">○ Question skipped</p>}

                        {q.explanation && (
                          <p className="mt-3 break-words rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-950">
                            <strong>
                              Explanation:
                            </strong>{" "}
                            <QuestionContent text={q.explanation} />
                          </p>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
              </>}

              <div className="mt-7 flex justify-center sm:mt-9">
                <button
                  onClick={exitMockTest}
                  className="min-h-11 rounded-lg bg-blue-700 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-800"
                >
                  Back to Questions
                </button>
              </div>
            </div>
          </section>
        </main>
      );
    }

    const progress =
      ((mockIndex + 1) /
        mockQuestions.length) *
      100;

    const timerWarning =
      mockTimeLeft <= 300;

    return (
      <main className="min-h-screen overflow-x-hidden bg-slate-50">
        <header className="border-b border-slate-800 bg-slate-950 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300 sm:text-[11px]">
                Real Mock Test
              </p>

              <h1 className="mt-0.5 truncate text-base font-bold sm:text-lg">
                CBSE Question Bank
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div
                className={`rounded-lg border px-3 py-2 text-center ${
                  timerWarning
                    ? "border-red-400 bg-red-500/20 text-red-200"
                    : "border-slate-600 bg-slate-800 text-white"
                }`}
              >
                <p className="text-[9px] font-bold uppercase tracking-wide opacity-80">
                  Time Left
                </p>

                <p className="mt-0.5 text-sm font-extrabold tabular-nums sm:text-base">
                  {formatTime(mockTimeLeft)}
                </p>
              </div>

              <button
                onClick={exitMockTest}
                disabled={mockSubmitting}
                className="min-h-10 shrink-0 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-sm"
              >
                Exit Test
              </button>
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-12">
          <div className="mb-5">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-amber-700">
                  Real Mock Test
                </p>

                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                  Question{" "}
                  {mockIndex + 1} of{" "}
                  {mockQuestions.length}
                </h2>
              </div>

              <span className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 sm:px-3 sm:text-xs">
                {mockQuestions.length} Questions
              </span>
            </div>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200 sm:mt-5">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-300"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>

          {mockSubmitError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
              <strong>Unable to complete this request.</strong> Your current question remains visible. Check your connection and retry the action. Avoid refreshing while you have unsaved answers.
              <p className="mt-2">{mockSubmitError}</p>
            </div>
          )}

          {mockTimeLeft <= 60 && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-800">
              Time is almost over. The test will be
              submitted automatically when the timer
              reaches zero.
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
            <p className="text-lg font-semibold leading-7 text-slate-950 sm:text-xl sm:leading-8">
              <QuestionContent text={current.question_text} />
            </p>

            <div className="mt-6 space-y-3 sm:mt-7">
              {current.options.map(
                (option, index) => {
                  const letter =
                    String.fromCharCode(
                      65 + index
                    );

                  const selected =
                    mockAnswers[
                      current.id
                    ] === letter;

                  return (
                    <button
                      key={letter}
                      aria-pressed={selected}
                      onClick={() => { void chooseMockAnswer(current.id, letter); }}
                      disabled={mockSubmitting || mockAnswerSaving || mockTimeLeft <= 0 || mockSubmitted}
                      className={`group flex min-h-14 w-full items-start gap-3 rounded-xl border-2 p-3.5 text-left sm:gap-4 sm:p-4 ${
                        selected
                          ? "border-blue-700 bg-blue-50"
                          : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
                      } disabled:cursor-not-allowed`}
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

                      <span className="min-w-0 flex-1 pt-0.5 text-sm leading-6 text-slate-800 sm:text-base">
                        <QuestionContent text={option} />
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <div className="mt-4 text-sm font-semibold text-slate-700" aria-live="polite">
            Answered: {mockQuestions.filter(q => Boolean(mockAnswers[q.id])).length} / {mockQuestions.length} · Unanswered: {mockQuestions.filter(q => !mockAnswers[q.id]).length}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button disabled={mockIndex===0 || mockSubmitting || mockAnswerSaving} onClick={()=>setMockIndex(p=>p-1)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold disabled:opacity-40">← Previous</button>
            <button disabled={mockIndex===mockQuestions.length-1 || mockSubmitting || mockAnswerSaving} onClick={()=>setMockIndex(p=>p+1)} className="min-h-11 rounded-lg bg-blue-700 px-4 py-3 font-bold text-white disabled:opacity-40">Next →</button>
            <button disabled={!mockQuestions.some(q=>!mockAnswers[q.id]) || mockSubmitting || mockAnswerSaving} onClick={()=>{
              const next=mockQuestions.findIndex((q,i)=>i>mockIndex&&!mockAnswers[q.id]);
              setMockIndex(next>=0?next:mockQuestions.findIndex(q=>!mockAnswers[q.id]));
            }} className="min-h-11 rounded-lg border border-blue-700 bg-white px-3 py-3 text-sm font-bold text-blue-800 disabled:opacity-40">Review Unanswered</button>
            <button disabled={mockQuestions.some(q=>!mockAnswers[q.id]) || mockSubmitting || mockAnswerSaving} onClick={()=>void submitMockTest(false)} className="min-h-11 rounded-lg bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-40">{mockSubmitting?"Submitting...":"Submit Test"}</button>
          </div>
        </section>
      </main>
    );
  }

  /* =========================
     PRACTICE TEST
  ========================= */

  if (practiceMode) {
    const current =
      practiceQuestions[practiceIndex];

    if (!current) {
      return null;
    }

    if (practiceSubmitted) {
      const percentage =
        practiceQuestions.length
          ? Math.round(
              (practiceScore /
                practiceQuestions.length) *
                100
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

              <Achievement correct={practiceScore} total={practiceQuestions.length} />
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

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <label className="text-sm font-bold" htmlFor="practice-review-filter">Review:</label>
                  <select id="practice-review-filter" value={practiceReviewFilter} onChange={e => setPracticeReviewFilter(e.target.value as "all" | "wrong")} className="rounded-lg border border-slate-300 p-2 text-sm">
                    <option value="all">All questions</option><option value="wrong">Wrong / skipped only</option>
                  </select>
                </div>
                <div className="mt-7 space-y-4 sm:mt-9">
                {practiceQuestions.filter(q => practiceReviewFilter === "all" || practiceAnswers[q.id] !== q.correct_option.trim().toUpperCase()).map(
                  (q, index) => {
                    const correct =
                      q.correct_option
                        .trim()
                        .toUpperCase();

                    const user =
                      practiceAnswers[q.id];

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
                            <QuestionContent text={q.question_text} />
                          </p>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {[q.option_a, q.option_b, q.option_c, q.option_d].map((option, optionIndex) => {
                            const letter = String.fromCharCode(65 + optionIndex);
                            return <div key={letter} className={`rounded-lg border px-3 py-2 text-sm ${letter === correct ? "border-emerald-300 bg-emerald-50" : letter === user ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}>
                              <strong>{letter}.</strong> <QuestionContent text={option} /> {letter === correct ? "✓ Correct" : letter === user ? "• Your answer" : ""}
                            </div>;
                          })}
                        </div>
                        {!user && <p className="mt-2 text-xs font-semibold text-amber-800">○ Question skipped</p>}

                        {q.explanation && (
                          <p className="mt-3 break-words rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-950">
                            <strong>
                              Explanation:
                            </strong>{" "}
                            <QuestionContent text={q.explanation} />
                          </p>
                        )}
                      </div>
                    );
                  }
                )}
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
              disabled={practiceSubmitting}
              className="min-h-10 shrink-0 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-sm"
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
                  Question{" "}
                  {practiceIndex + 1} of{" "}
                  {practiceQuestions.length}
                </h2>
              </div>
            </div>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200 sm:mt-5">
              <div
                className="h-full rounded-full bg-blue-700 transition-all duration-300"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>

          {practiceSubmitError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
              <strong>Answer or progress not saved.</strong> Your current question remains visible. Check your connection and retry the action. Avoid refreshing while you have unsaved answers.
              <p className="mt-2">{practiceSubmitError}</p>
            </div>
          )}

          <div className="mb-3 text-sm font-semibold text-slate-700" aria-live="polite">
            {practiceSaving ? "Saving progress..." : `Saved answers: ${practiceSavedCount} / ${practiceQuestions.length}`}
            {practiceSubmitError && <p className="mt-2 text-red-700">{practiceSubmitError}</p>}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
            <p className="text-lg font-semibold leading-7 text-slate-950 sm:text-xl sm:leading-8">
              <QuestionContent text={current.question_text} />
            </p>

            <div className="mt-6 space-y-3 sm:mt-7">
              {current.options.map(
                (option, index) => {
                  const letter =
                    String.fromCharCode(
                      65 + index
                    );

                  const hasSavedAnswer = Object.prototype.hasOwnProperty.call(practiceAnswers, current.id);
                  const selected = (practiceAnswers[current.id] ?? practiceDraft[current.id]) === letter;
                  const correct = current.correct_option.trim().toUpperCase() === letter;
                  const showCorrect = hasSavedAnswer && correct;
                  const showWrong = hasSavedAnswer && selected && !correct;

                  return (
                    <button
                      key={letter}
                      aria-pressed={selected}
                      onClick={() => setPracticeDraft(prev => ({ ...prev, [current.id]: letter }))}
                      disabled={practiceSubmitting || practiceSaving || Object.prototype.hasOwnProperty.call(practiceAnswers, current.id)}
                      className={`group flex min-h-14 w-full items-start gap-3 rounded-xl border-2 p-3.5 text-left sm:gap-4 sm:p-4 ${
                        showCorrect
                          ? "border-emerald-600 bg-emerald-50"
                          : showWrong
                            ? "border-red-600 bg-red-50"
                            : selected
                              ? "border-blue-700 bg-blue-50"
                              : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
                      } disabled:cursor-not-allowed`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                          showCorrect
                            ? "bg-emerald-600 text-white"
                            : showWrong
                              ? "bg-red-600 text-white"
                              : selected
                                ? "bg-blue-700 text-white"
                                : "bg-slate-100 text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-800"
                        }`}
                      >
                        {letter}
                      </span>

                      <span className="min-w-0 flex-1 pt-0.5 text-sm leading-6 text-slate-800 sm:text-base">
                        <QuestionContent text={option} />
                      </span>
                      {showCorrect && <span className="shrink-0 text-xs font-bold text-emerald-800">✓ Correct</span>}
                      {showWrong && <span className="shrink-0 text-xs font-bold text-red-800">✕ Your answer</span>}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {Object.prototype.hasOwnProperty.call(practiceAnswers, current.id) ? (
            <div role="status" className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-slate-900">
              <p className="font-extrabold">{practiceAnswers[current.id] === current.correct_option.trim().toUpperCase() ? "✅ Correct answer!" : practiceAnswers[current.id] ? "❌ Incorrect answer" : "⏭️ Question skipped"}</p>
              <p>Correct answer: <strong>{current.correct_option.toUpperCase()} — <QuestionContent text={current.options[current.correct_option.toUpperCase().charCodeAt(0) - 65]} /></strong></p>
              {current.explanation && <p className="mt-2"><QuestionContent text={current.explanation} /></p>}
            </div>
          ) : (
            <div className="mt-4">
              <button type="button" disabled={practiceSaving || !practiceDraft[current.id]} onClick={() => void choosePracticeAnswer(current.id, practiceDraft[current.id])} className="min-h-12 w-full rounded-xl bg-emerald-700 px-3 py-3 text-sm font-bold text-white disabled:opacity-40">Submit Answer</button>
              <p className="mt-2 text-center text-xs text-slate-600">Select an option, then Submit Answer to save and lock it. Use Next to leave a question unanswered and return later.</p>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-5">
            <button
              disabled={
                practiceIndex === 0 ||
                practiceSubmitting || practiceSaving
              }
              onClick={() => void navigatePractice(practiceIndex - 1)}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
            >
              ← Previous
            </button>

            {practiceIndex <
            practiceQuestions.length - 1 ? (
              <button
                disabled={practiceSubmitting || practiceSaving}
                onClick={() => { if (practiceSkippedReview) { const next = practiceQuestions.findIndex((q,i) => i > practiceIndex && !Object.prototype.hasOwnProperty.call(practiceAnswers,q.id)); if(next < 0){setPracticeSkippedReview(false);setPracticeConfirmSubmit(true);} else void navigatePractice(next); } else void navigatePractice(practiceIndex + 1); }}
                className="min-h-11 rounded-lg bg-blue-700 px-3 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
              >
                Next →
              </button>
            ) : (
              <button
                disabled={practiceSubmitting || practiceSaving}
                onClick={() => { if (practiceQuestions.some(q => !Object.prototype.hasOwnProperty.call(practiceAnswers, q.id))) setPracticeConfirmSubmit(true); else void submitPracticeTest(); }}
                className="min-h-11 rounded-lg bg-emerald-700 px-3 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
              >
                {practiceSubmitting
                  ? "Submitting..."
                  : "Submit Test"}
              </button>
            )}
          </div>
          <QuestionNavigator questions={practiceQuestions} current={practiceIndex} answers={practiceAnswers} disabled={practiceSubmitting || practiceSaving} onNavigate={index=>{setPracticeSkippedReview(false); void navigatePractice(index);}} />
          {practiceQuestions.length > 0 && practiceIndex < practiceQuestions.length - 1 && (
            <button type="button" disabled={practiceSubmitting || practiceSaving} onClick={() => { if (practiceQuestions.every(q => Object.prototype.hasOwnProperty.call(practiceAnswers, q.id))) void submitPracticeTest(); else setPracticeConfirmSubmit(true); }} className="mt-3 w-full rounded-lg border border-emerald-600 bg-white px-4 py-2 text-sm font-bold text-emerald-800 disabled:opacity-50">Finish / Review Practice Test</button>
          )}
          {practiceConfirmSubmit && practiceQuestions.some(q => !Object.prototype.hasOwnProperty.call(practiceAnswers, q.id)) && (
            <div role="region" aria-label="Confirm practice submission" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="font-bold text-slate-900">Ready to submit your Practice Test?</p>
              <p className="mt-1 text-sm text-slate-700">Answered: {practiceQuestions.filter(q => Object.prototype.hasOwnProperty.call(practiceAnswers, q.id)).length} / {practiceQuestions.length}. Unanswered: {practiceQuestions.filter(q => !Object.prototype.hasOwnProperty.call(practiceAnswers, q.id)).length}.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {practiceQuestions.some(q => !Object.prototype.hasOwnProperty.call(practiceAnswers, q.id)) && <button type="button" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white" onClick={() => { setPracticeConfirmSubmit(false); setPracticeSkippedReview(true); void navigatePractice(practiceQuestions.findIndex(q => !Object.prototype.hasOwnProperty.call(practiceAnswers, q.id))); }}>Answer Skipped Questions</button>}
                <button type="button" disabled={practiceSubmitting || practiceSaving} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" onClick={() => void submitPracticeTest()}>Submit Anyway</button>
                <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm" onClick={() => setPracticeConfirmSubmit(false)}>Continue Test</button>
              </div>
            </div>
          )}

        </section>
      </main>
    );
  }

  /* =========================
     MAIN AUTHENTICATED PAGE
  ========================= */

  const subscribeButton = (extraClass = "") => (
    <button
      type="button"
      onClick={openSubscribe}
      disabled={signingOut || !membershipChecked}
      className={`inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-lg border border-amber-300 bg-amber-400 px-3 py-2 text-xs font-extrabold text-slate-950 shadow-sm transition hover:bg-amber-300 disabled:cursor-default disabled:border-emerald-300 disabled:bg-emerald-100 disabled:text-emerald-800 sm:px-3 sm:text-xs ${extraClass}`}
    >
      {signingOut ? "Signing out…" : !membershipChecked ? "Checking membership…" : isPaidMember ? "✓ Manage membership" : "⭐ Membership plans"}
    </button>
  );

  return (
    <>
      <main className="min-h-screen overflow-x-hidden bg-slate-50">
      <style>{`@keyframes welcome10-scroll { from { transform: translateX(100vw); } to { transform: translateX(-100%); } } @media (prefers-reduced-motion: reduce) { .welcome10-scroll { animation: none !important; transform: none !important; } }`}</style>
      {promotionText && <div className="w-full overflow-hidden border-b border-amber-300 bg-amber-100 py-2 text-amber-950" role="note" aria-label="Current membership offer">
        <div className="welcome10-scroll inline-block whitespace-nowrap text-xs font-extrabold sm:text-sm" style={{ animation: "welcome10-scroll 16s linear infinite", whiteSpace: "nowrap", width: "max-content" }}>
          {promotionText}
        </div>
      </div>}
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
          <div className="min-w-0">
            <Link href="/" aria-label="ExamYari home"><BrandLogo compact /></Link>
            <h1 className="mt-1 text-xs font-semibold text-slate-600">Your learning space</h1>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
            <div className="hidden text-right sm:block">
              <p className="max-w-32 truncate text-xs font-semibold text-slate-900">{studentProfile?.full_name || currentUser?.email}</p>
              <p className="text-[10px] text-emerald-700">Signed in</p>
            </div>
            <div className="col-span-1 flex min-w-0">{subscribeButton("w-full sm:w-auto")}</div>
            <div className="col-span-1 flex flex-col gap-1.5 sm:gap-1">
              <Link href="/dashboard" className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700">📊 Dashboard</Link>
              <button type="button" onClick={handleLogout} disabled={signingOut} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">{signingOut ? "Signing out…" : "Logout"}</button>
            </div>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-indigo-200 bg-gradient-to-br from-indigo-950 via-indigo-800 to-violet-700 text-white">
        <div className="relative mx-auto grid max-w-7xl items-center gap-7 px-4 py-9 sm:px-6 sm:py-14 lg:grid-cols-[1.2fr_.8fr]">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-blue-300 sm:px-3 sm:text-[11px] sm:tracking-[0.12em]">
              {enrolledClass
                ? enrolledClass.class_name
                : "Student Dashboard"}
            </span>

            <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:mt-5 sm:text-4xl lg:text-5xl">
              Welcome
              {studentProfile?.full_name
                ? `, ${studentProfile.full_name}`
                : ""}
              .
              <br />
              What will you learn today?
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-indigo-100 sm:mt-5 sm:text-base sm:leading-7">
              Your{" "}
              {enrolledClass?.class_name ||
                "enrolled class"}{" "}
              is ready to explore. Practice by subject and chapter, or take
              a 60-question Real Mock Test.
            </p>
          </div>
          <div className="mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/20 bg-indigo-50 shadow-2xl shadow-indigo-950/30 lg:max-w-md">
            <Image width={775} height={655} sizes="(max-width: 640px) 100vw, 440px" src="/images/examyari-students.webp" alt="Two students ready to learn" className="h-auto max-h-[220px] sm:max-h-[300px] w-full object-cover" />
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
                Choose a subject, then a chapter to focus your practice.
              </p>
            </div>

            <div className="w-fit rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-bold text-blue-800">
              {questionCountForSelection} MCQs
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* CLASS */}
            <div>
              <label htmlFor="student-field-12" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Your Class
              </label>

              <select id="student-field-12" value={enrolledClassId === null ? "" : String(enrolledClassId)}
                onChange={e => void handleClassChange(e.target.value)} disabled={membershipClasses.length < 2}
                className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm font-bold text-slate-700 disabled:bg-slate-100">
                {membershipClasses.length ? membershipClasses.map(c => <option key={c.id} value={c.id}>{c.name}{c.paid ? " · Premium" : ""}</option>) : <option value="">Class not assigned</option>}
              </select>
              <Link href="/memberships" className="mt-1.5 inline-block text-xs font-semibold text-indigo-700">Manage plans and class access →</Link>
            </div>

            {/* SUBJECT */}
            <div>
              <label htmlFor="practice-subject" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Subject
              </label>

              <select
                id="practice-subject"
                value={selectedSubject}
                aria-busy={subjectQuestionsLoading}
                onChange={(e) =>
                  { handleSubjectChange(e.target.value); }
                }
                className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none hover:border-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 sm:min-h-11"
              >
                <option value={ALL}>
                  Select Subject
                </option>

                {availableSubjects.map((s) => (
                  <option
                    key={`${s.class_id}-${s.id}`}
                    value={s.subject_name}
                  >
                    {s.subject_name}
                  </option>
                ))}
              </select>

              {subjectQuestionsLoading && (
                <p role="status" className="mt-1.5 text-[11px] font-semibold text-blue-700">
                  Checking test availability… You can choose chapters now.
                </p>
              )}

              {selectedSubject === ALL && (
                <p className="mt-1.5 text-[11px] font-semibold text-amber-700">
                  Select a subject to start a paper.
                </p>
              )}
            </div>

            {/* CHAPTER */}
            <div>
              <label htmlFor="practice-chapter" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Chapter
              </label>

              <details id="practice-chapter" open={chapterPickerOpen} onToggle={e=>setChapterPickerOpen(e.currentTarget.open)} className="rounded-lg border border-slate-300 bg-white">
                <summary className="min-h-12 cursor-pointer px-3.5 py-3 text-sm font-medium text-slate-900">{selectedSubject===ALL?"Select Subject First":chapterSelected?`${selectedChapterIds.length} chapters selected`:"All Chapters"}</summary>
                {selectedSubject!==ALL && <fieldset className="max-h-72 space-y-1 overflow-y-auto border-t p-3" aria-label="Select chapters">
                  <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={!chapterSelected} onChange={()=>{setSelectedChapterIds([]);setPracticeSet(1);}}/>All Chapters</label>
                  {availableChapters.map(c=><label key={c.id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" value={c.id} checked={selectedChapterIds.includes(c.id)} onChange={e=>{setSelectedChapterIds(ids=>(e.target.checked?[...ids,c.id]:ids.filter(id=>id!==c.id)).sort((a,b)=>a-b));setPracticeSet(1);}}/>{c.chapter_number?`${c.chapter_number}. `:""}{c.chapter_name}</label>)}
                </fieldset>}
              </details>
            </div>
          </div>

          {selectionError && <div role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{selectionError}<button type="button" onClick={()=>setSelectionReload(n=>n+1)} className="ml-3 min-h-11 font-bold underline">Retry availability</button></div>}

          {!isPaidMember && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">One free Practice set and one free Mock set per subject</p>
            <p className="mt-1">Each set includes up to 60 questions. A shorter chapter test uses the full set allowance. You can resume an unfinished set.</p>
            {selectedSubjectObject && <p className="mt-2 font-semibold">{freeUsageLoading?"Loading allowance…":`Practice: ${practiceReservation?.completed_at?"Completed":practiceReservation?"In progress":"Available"} · Mock: ${mockReservation?.completed_at?"Completed":mockReservation?"In progress":"Available"}`}</p>}
          </div>}

          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-200 pt-4 sm:pt-5">
            <span className="text-xs text-slate-600 sm:text-sm">
              Class:{" "}
              <strong className="text-slate-900">
                {enrolledClass?.class_name ||
                  "Not assigned"}
              </strong>
            </span>

            <span className="text-slate-300">
              •
            </span>

            <span className="text-xs text-slate-600 sm:text-sm">
              Subjects:{" "}
              <strong className="text-slate-900">
                {availableSubjects.length}
              </strong>
            </span>

            <span className="text-slate-300">
              •
            </span>

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

        {/* PAPER OPTIONS */}
        {selectedSubject !== ALL && !subjectQuestionsLoading && !selectionError &&
          questionCountForSelection === 0 && selectionCounts.mock === 0 && (
          <p role="status" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium leading-6 text-amber-950">
            Questions for this subject are still being prepared. New practice and real mock
            tests will become available when questions are published. Existing saved sessions
            can still be resumed where supported.
          </p>
        )}
        <div className="mt-5 grid gap-5 lg:grid-cols-2 sm:mt-6">
          {/* PRACTICE PAPER */}
          <div className="rounded-2xl border border-blue-800 bg-blue-900 p-4 text-white shadow-sm sm:p-7">
            <div className="flex h-full flex-col justify-between gap-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex min-h-10 items-center rounded-lg border border-blue-700 bg-blue-800 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-blue-100 sm:px-3 sm:text-[11px]">
                  Practice Paper
                </span>
                  {isPaidMember ? <span className="rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800">✓ Premium Active</span> : subscribeButton()}
                </div>

                <h3 className="mt-2.5 text-xl font-bold sm:mt-3 sm:text-2xl">
                  Practice Test
                </h3>

                <p className="mt-3 text-sm text-blue-100">{Math.min(60,Math.max(0,questionCountForSelection-(practiceSet-1)*60))} questions · Immediate answer feedback</p>
              </div>

              <div className="grid w-full min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                {selectedSubject !== ALL && isPaidMember && totalPracticeSets > 1 && (
                  <select
                    aria-label="Select practice set"
                    value={practiceSet}
                    onChange={(e) => setPracticeSet(Number(e.target.value))}
                    className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-white/40 sm:min-h-11"
                  >
                    {Array.from({ length: totalPracticeSets }, (_, index) => {
                      const from = index * PRACTICE_SET_SIZE + 1;
                      const to = Math.min((index + 1) * PRACTICE_SET_SIZE, questionCountForSelection);
                      return (
                        <option key={index + 1} value={index + 1}>
                          {`Set ${index + 1} — Questions ${from}–${to}`}
                        </option>
                      );
                    })}
                  </select>
                )}
                {selectedSubject !== ALL && chapterSelected && totalPracticeSets <= 1 && (
                  <div className="flex min-h-11 items-center rounded-lg bg-white px-4 py-3 text-sm font-semibold text-blue-900">
                    {questionCountForSelection} chapter questions
                  </div>
                )}

                <p className="mb-3 text-xs font-semibold text-white">Your test history is saved for 2 weeks only.</p>
                {practiceSubmitError && (
                  <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800 sm:col-span-2">
                    {practiceSubmitError}
                  </p>
                )}
                <button
                  onClick={() => void startPracticeTest()}
                  disabled={practiceStarting ||
                    selectedSubject === ALL ||
                    selectionLoading || (!isPaidMember && (freeUsageLoading || Boolean(practiceReservation?.completed_at)))
                  }
                  className="min-h-12 w-full rounded-lg bg-white px-5 py-3 text-sm font-bold text-blue-900 shadow-sm hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-11"
                >
                  {selectedSubject === ALL
                    ? "Select Subject First"
                    : (!isPaidMember && freeUsageLoading)
                    ? "Checking Free Usage..."
                    : practiceReservation?.completed_at && !isPaidMember ? "Free Practice set completed" : practiceStarting ? "Loading saved practice..." : "Start / Resume Practice →"}
                </button>
              </div>
            </div>
          </div>

          {/* REAL MOCK TEST */}
          <div className="rounded-2xl border border-orange-300 bg-orange-100 p-4 text-slate-900 shadow-sm sm:p-7">
            <div className="flex h-full flex-col justify-between gap-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold uppercase text-orange-900">Real Mock Test</span>
                  {isPaidMember && <span className="rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800">✓ Premium Active</span>}
                </div>
                <h3 className="mt-3 text-xl font-bold sm:text-2xl">{chapterSelected?"Chapter Mock Test":"Full Syllabus Mock Test"}</h3>
                <p className="mt-3 text-sm font-semibold">{unfinishedMock?unfinishedMock.question_ids.length:Math.min(60,selectionCounts.mock)} questions · 60 minutes</p>
              </div>
              <div>
                {mockSubmitError && <p role="alert" className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{mockSubmitError}</p>}
                <p className="mb-3 text-xs font-semibold text-slate-700">Your test history is saved for 2 weeks only.</p>
                <button onClick={()=>void startMockTest()} disabled={!mockCanStart || (!isPaidMember&&(freeUsageLoading || Boolean(mockReservation?.completed_at)))} className="min-h-12 w-full rounded-lg bg-orange-600 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-40">
                  {selectedSubject===ALL?"Select Subject First":mockStarting?"Preparing your mock...":mockHistoryLoading||subjectQuestionsLoading||selectionLoading?"Loading availability...":!isPaidMember&&mockReservation?.completed_at?"Free Mock set completed":mockActionLabel}
                </button>
              </div>
            </div>
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
    </>
  );
}

