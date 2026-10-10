"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type FreeUsageRow = {
  id: number;
  student_id: string;
  subject_id: number;
  chapter_id: number | null;
  questions_used: number;
  questions_allowed: number;
};

const ALL = "all";
const DEFAULT_FREE_QUESTIONS = 10;
const MOCK_QUESTION_COUNT = 60;
const MOCK_DURATION_SECONDS = 60 * 60;
const ANNUAL_PLAN_PRICE = 99;
// Prevent network requests from leaving the student on a loading screen forever.
const SERVICE_REQUEST_TIMEOUT_MS = 12000;
const AUTH_INITIALIZATION_TIMEOUT_MS = 15000;

// Message shown after successful signup when email confirmation is required.
const SIGNUP_EMAIL_VERIFICATION_MESSAGE =
  "Registration successful! Please check your inbox for a verification email and click the confirmation link to activate your account. " +
  "If you cannot find the email, check your Spam, Junk, or Promotions folder. " +
  "Look for an email from CBSE Exam Prep Guide (cbse.exam.prep.guide@gmail.com). " +
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


function shuffleQuestions<T>(items: T[]): T[] {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[j]] = [
      shuffled[j],
      shuffled[i],
    ];
  }

  return shuffled;
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
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [questions, setQuestions] = useState<MCQ[]>([]);

  const [loading, setLoading] = useState(true);
  const [subjectQuestionsLoading, setSubjectQuestionsLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentUser, setCurrentUser] = useState<any>(null);
  const authUserIdRef = useRef<string | null>(null);
  const [studentProfile, setStudentProfile] =
    useState<StudentProfile | null>(null);

  /*
   * FREE TRIAL
   *
   * Key:
   *     subject_id
   *
   * Value:
   *     questions_used
   *
   * Free usage is tracked at SUBJECT level.
   *
   * Example:
   *
   * Mathematics:
   *   Chapter 1 -> 4 questions
   *   Chapter 2 -> 3 questions
   *   Chapter 3 -> 3 questions
   *   Total Math -> 10 / 10
   *
   * Science has its own separate 10-question allowance.
   */
  const [freeUsage, setFreeUsage] = useState<
    Record<number, number>
  >({});

  const [freeUsageLoading, setFreeUsageLoading] =
    useState(false);

  const [selectedClass, setSelectedClass] = useState(ALL);
  const [selectedSubject, setSelectedSubject] = useState(ALL);
  const [selectedChapter, setSelectedChapter] = useState(ALL);

  /* =========================
     PRACTICE TEST
  ========================= */

  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceSet, setPracticeSet] = useState(1);
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
  const [mockConfirmSubmit, setMockConfirmSubmit] = useState(false);
  const [practiceSubmitted, setPracticeSubmitted] =
    useState(false);
  const [practiceSubmitting, setPracticeSubmitting] =
    useState(false);
  const [practiceSubmitError, setPracticeSubmitError] =
    useState("");
  const [practiceStartedAt, setPracticeStartedAt] =
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
  const [mockScope, setMockScope] = useState<"full" | "chapters">("full");
  const [mockChapterIds, setMockChapterIds] = useState<number[]>([]);
  const [mockDuration, setMockDuration] = useState(MOCK_DURATION_SECONDS);
  const [chapterMockId, setChapterMockId] = useState<string | null>(null);
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
  const [mockTimeLeft, setMockTimeLeft] = useState(
    MOCK_DURATION_SECONDS
  );
  const [mockStartedAt, setMockStartedAt] =
    useState<number | null>(null);
  type MockPaper = {
    id: string;
    subject_id: number;
    paper_number: number | null;
    retake_number: number | null;
    question_ids: number[];
    status: "STARTED" | "COMPLETED";
    started_at: string;
    quiz_attempt_id: string | null;
  };
  const [mockPapers, setMockPapers] = useState<MockPaper[]>([]);
  const [selectedMockPaper, setSelectedMockPaper] = useState("1");
  const [activeMockPaperId, setActiveMockPaperId] = useState<string | null>(null);
  const [mockStarting, setMockStarting] = useState(false);
  const [mockHistoryLoading, setMockHistoryLoading] = useState(false);


  /* =========================
     SUBSCRIPTION / COUPON
  ========================= */

  const [showSubscribeModal, setShowSubscribeModal] =
    useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] =
    useState(0);
  const [couponMessage, setCouponMessage] =
    useState("");
  const [couponLoading, setCouponLoading] =
    useState(false);
  const [isPaidMember, setIsPaidMember] =
    useState(false);

  function openSubscribe() {
    setCouponCode("");
    setCouponDiscount(0);
    setCouponMessage("");
    setShowSubscribeModal(true);
  }

  function closeSubscribe() {
    if (couponLoading) {
      return;
    }

    setShowSubscribeModal(false);
    setCouponCode("");
    setCouponDiscount(0);
    setCouponMessage("");
  }

  async function applyCoupon() {
    const code = couponCode.trim().toUpperCase();

    setCouponMessage("");
    setCouponDiscount(0);

    if (!code) {
      setCouponMessage("Please enter a coupon code.");
      return;
    }

    setCouponLoading(true);

    const { data, error: couponError } = await supabase
      .from("coupons")
      .select("coupon_code,discount_percentage,is_active,valid_from,valid_until,usage_limit,usage_count")
      .eq("coupon_code", code)
      .maybeSingle();

    if (couponError) {
      console.error("Coupon lookup error:", couponError);
      setCouponMessage(
        couponError.message ||
          "Unable to validate the coupon. Please try again."
      );
      setCouponLoading(false);
      return;
    }

    if (!data) {
      setCouponMessage("Invalid coupon code.");
      setCouponLoading(false);
      return;
    }

    const now = new Date();
    const validFrom = data.valid_from
      ? new Date(data.valid_from)
      : null;
    const validUntil = data.valid_until
      ? new Date(data.valid_until)
      : null;

    if (!data.is_active) {
      setCouponMessage("This coupon is inactive.");
      setCouponLoading(false);
      return;
    }

    if (validFrom && now < validFrom) {
      setCouponMessage("This coupon is not active yet.");
      setCouponLoading(false);
      return;
    }

    if (validUntil && now > validUntil) {
      setCouponMessage("This coupon has expired.");
      setCouponLoading(false);
      return;
    }

    if (
      data.usage_limit !== null &&
      data.usage_count >= data.usage_limit
    ) {
      setCouponMessage("This coupon has reached its usage limit.");
      setCouponLoading(false);
      return;
    }

    const discount = Number(data.discount_percentage);

    if (!Number.isFinite(discount) || discount < 10 || discount > 100) {
      setCouponMessage("This coupon has an invalid discount.");
      setCouponLoading(false);
      return;
    }

    setCouponDiscount(discount);
    setCouponMessage(`${discount}% coupon validated for preview. Final eligibility and redemption require server verification.`);
    setCouponLoading(false);
  }

  const couponDiscountAmount =
    Math.round(ANNUAL_PLAN_PRICE * couponDiscount) / 100;

  const finalSubscriptionPrice =
    Math.max(0, ANNUAL_PLAN_PRICE - couponDiscountAmount);

  async function activateFreeMembership() {
    if (
      !currentUser ||
      finalSubscriptionPrice !== 0 ||
      couponDiscount <= 0
    ) {
      return;
    }

    setCouponLoading(true);
    setCouponMessage("");

    try {
      const { data, error: activationError } =
        await supabase.rpc(
          "activate_paid_membership_with_coupon",
          {
            p_coupon_code: couponCode.trim().toUpperCase(),
          }
        );

      if (activationError) {
        console.error(
          "Membership activation error:",
          activationError
        );

        setCouponMessage(
          activationError.message ||
            "Unable to activate membership. Please try again."
        );
        return;
      }

      const result = Array.isArray(data) ? data[0] : data;

      if (!result?.success) {
        setCouponMessage(
          result?.message ||
            "Unable to activate membership. Please try again."
        );
        return;
      }

      /*
       * The RPC has already written the subscription to Supabase.
       * Re-read the database instead of relying only on local React state.
       */
      const membershipActive =
        await loadPaidMembership(currentUser.id);

      if (!membershipActive) {
        setCouponMessage(
          "Membership was activated, but the saved subscription could not be verified. Please refresh and try again."
        );
        return;
      }

      setShowSubscribeModal(false);
    } catch (activationError: any) {
      console.error(
        "Unexpected membership activation error:",
        activationError
      );

      setCouponMessage(
        activationError?.message ||
          "Unable to activate membership. Please try again."
      );
    } finally {
      setCouponLoading(false);
    }
  }

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

  const [showMobileMenu, setShowMobileMenu] = useState(false);

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

  function getMetadataClassId(user: any): number | null {
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
    authUser?: any
  ) {
    const { data, error: profileError } = await supabase
      .from("student_profiles")
      .select("full_name,class_id")
      .eq("id", userId)
      .maybeSingle();

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

    const { data, error: usageError } = await supabase
      .from("free_usage")
      .select(
        "id,student_id,subject_id,chapter_id,questions_used,questions_allowed"
      )
      .eq("student_id", userId)
      .is("chapter_id", null);

    if (usageError) {
      console.error(
        "Free usage error:",
        usageError
      );

      setFreeUsage({});
      setFreeUsageLoading(false);
      return;
    }

    const usageMap: Record<number, number> = {};

    ((data || []) as FreeUsageRow[]).forEach(
      (row) => {
        usageMap[row.subject_id] =
          row.questions_used;
      }
    );

    setFreeUsage(usageMap);
    setFreeUsageLoading(false);
  }

  /* =========================
     LOAD PAID MEMBERSHIP
  ========================= */

  async function loadPaidMembership(
    userId: string
  ): Promise<boolean> {
    console.log(
      "Checking membership for user:",
      userId
    );

    const { data, error: subscriptionError } =
      await supabase
        .from("subscriptions")
        .select(
          "id,student_id,status,start_date,end_date,payment_reference"
        )
        .eq("student_id", userId)
        .eq("status", "ACTIVE")
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (subscriptionError) {
      /*
       * Do not overwrite an already-known membership with false
       * because of a temporary/network/database read error.
       */
      console.error(
        "Subscription lookup error:",
        subscriptionError
      );
      return isPaidMember;
    }

    const membershipActive =
      !!data &&
      (!data.end_date ||
        new Date(data.end_date).getTime() >= Date.now());

    console.log(
      "Subscription query result:",
      {
        data,
        error: subscriptionError,
        membershipActive,
      }
    );

    setIsPaidMember(membershipActive);

    return membershipActive;
  }

  /* =========================
     FREE USAGE HELPERS
  ========================= */

  function getSubjectUsage(subjectId: number) {
    return freeUsage[subjectId] || 0;
  }

  function getSubjectAllowed(subjectId: number) {
    return DEFAULT_FREE_QUESTIONS;
  }

  function getSubjectRemaining(subjectId: number) {
    return Math.max(
      0,
      getSubjectAllowed(subjectId) -
        getSubjectUsage(subjectId)
    );
  }

  function isSubjectFreeLimitReached(
    subjectId: number
  ) {
    return (
      getSubjectUsage(subjectId) >=
      getSubjectAllowed(subjectId)
    );
  }

  /*
   * A question is available for the free trial only
   * when its SUBJECT still has at least one question
   * remaining.
   */
  function isQuestionFreeAvailable(q: MCQ) {
    return getSubjectRemaining(q.subjectId) > 0;
  }

  /* =========================
     LOAD QUESTION BANK
  ========================= */

  // Supabase normally returns at most 1,000 rows per request.
  // Fetch all pages so newly imported subjects and questions are visible.
  async function fetchAllRows<T>(
    table: string,
    columns: string,
    configure?: (query: any) => any
  ): Promise<T[]> {
    const pageSize = 1000;
    const results: T[] = [];

    for (let offset = 0; ; offset += pageSize) {
      let query: any = supabase
        .from(table)
        .select(columns)
        .eq("is_active", true);

      if (configure) query = configure(query);

      const { data, error: fetchError } = await withTimeout<{ data: T[] | null; error: { message: string } | null }>(query
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1), SERVICE_REQUEST_TIMEOUT_MS);

      if (fetchError) {
        throw new Error(`${table}: ${fetchError.message}`);
      }

      const batch = (data || []) as T[];
      results.push(...batch);
      if (batch.length < pageSize) break;
    }

    return results;
  }

  async function loadQuestionData(
    classRowsOverride?: ClassRow[]
  ) {
    setLoading(true);
    setError("");

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
            "id,subject_id,chapter_number,chapter_name,is_active"
          ),

        ]);

      const classRows = loadedClasses;
      const classMap = new Map(classRows.map((item) => [item.id, item]));
      const subjectMap = new Map(subjectRows.map((item) => [item.id, item]));
      const chapterMap = new Map(chapterRows.map((item) => [item.id, item]));

      // Load subject metadata first; question text is fetched only for the selected subject.
      const mcqs: MCQ[] = [];

      setClasses(classRows);
      setSubjects(subjectRows);
      setChapters(chapterRows);
      setQuestions(mcqs);

      console.info("Question bank loaded:", {
        classes: classRows.length,
        subjects: subjectRows.length,
        chapters: chapterRows.length,
        activeMCQs: mcqs.length,
      });
    } catch (loadError: any) {
      console.error("Question bank loading failed:", loadError);
      setError(loadError?.message || "Unable to load questions.");
    } finally {
      setLoading(false);
    }
  }

  // Lazy-load MCQs for one subject at a time. Avoid downloading both classes' entire question bank at login.
  useEffect(() => {
    if (!currentUser || selectedSubject === ALL || !subjects.length || !chapters.length || !classes.length) {
      setQuestions([]);
      setSubjectQuestionsLoading(false);
      return;
    }
    let cancelled = false;
    const classId = studentProfile?.class_id ?? getMetadataClassId(currentUser);
    const subject = subjects.find(row => row.class_id === classId && row.subject_name === selectedSubject);
    if (!subject) { setQuestions([]); setSubjectQuestionsLoading(false); return; }
    const chapterRows = chapters.filter(c => c.subject_id === subject.id);
    const chapterIds = chapterRows.map(c => c.id);
    if (!chapterIds.length) { setQuestions([]); setSubjectQuestionsLoading(false); return; }
    setSubjectQuestionsLoading(true);
    setQuestions([]);
    (async () => {
      try {
        const rows = await fetchAllRows<QuestionRow>("questions",
          "id,chapter_id,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,difficulty,marks,question_type,is_active",
          query => query.eq("question_type", "MCQ").in("chapter_id", chapterIds));
        if (cancelled) return;
        const chapterMap = new Map(chapterRows.map(c => [c.id, c]));
        const className = classes.find(c => c.id === classId)?.class_name || "";
        setQuestions(rows.map(q => ({ ...q, classId: classId!, subjectId: subject.id, className,
          subjectName: subject.subject_name, chapterName: chapterMap.get(q.chapter_id)?.chapter_name || "",
          options: [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean) })));
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Unable to load selected subject questions.");
      } finally { if (!cancelled) setSubjectQuestionsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id, selectedSubject, subjects, chapters, classes, studentProfile?.class_id]);

  // The existing admin RPC verifies permissions on the server.
  // Never determine admin access from an email address or client metadata.
  async function redirectAdminIfAuthorized(): Promise<boolean> {
    try {
      const { error: adminError } = await supabase.rpc("admin_dashboard_summary");
      if (adminError) {
        // Ordinary students are not permitted to call the admin RPC.
        // Keep them on the student website.
        return false;
      }
      window.location.replace("/admin");
      return true;
    } catch (adminCheckError) {
      console.error("Unable to verify admin redirect:", adminCheckError);
      return false;
    }
  }

  /* =========================
     AUTH INITIALIZATION
  ========================= */

  useEffect(() => {
    let mounted = true;

    function clearAuthenticatedState() {
      authUserIdRef.current = null;

      setCurrentUser(null);
      setStudentProfile(null);
      setFreeUsage({});
      setIsPaidMember(false);
      setQuestions([]);
      setSubjects([]);
      setChapters([]);

      setSelectedClass(ALL);
      setSelectedSubject(ALL);
      setSelectedChapter(ALL);

      setPracticeConfirmSubmit(false);
      setMockConfirmSubmit(false);
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

      setShowSubscribeModal(false);
      setCouponCode("");
      setCouponDiscount(0);
      setCouponMessage("");
      setCouponLoading(false);
    }

    async function loadAuthenticatedUser(
      user: any,
      classRowsOverride?: ClassRow[]
    ) {
      if (!mounted || !user) {
        return;
      }

      const userId = user.id;

      // Covers both fresh logins and previously authenticated sessions.
      if (await redirectAdminIfAuthorized()) return;
      if (!mounted || authUserIdRef.current !== null && authUserIdRef.current !== userId) return;

      /*
       * Prevent duplicate loads caused by signInWithPassword()
       * and Supabase's SIGNED_IN / INITIAL_SESSION events.
       */
      authUserIdRef.current = userId;
      setCurrentUser(user);

      await loadStudentProfile(userId, user);

      if (!mounted || authUserIdRef.current !== userId) {
        return;
      }

      await loadFreeUsage(userId);

      if (!mounted || authUserIdRef.current !== userId) {
        return;
      }

      await loadPaidMembership(userId);

      if (!mounted || authUserIdRef.current !== userId) {
        return;
      }

      await loadQuestionData(classRowsOverride);
    }

    async function initializeApp() {
      setAuthLoading(true);
      try {
        // Class metadata and auth session are independent. Both have a deadline.
        const [classRows, sessionResult] = await Promise.all([
          loadClasses(),
          withTimeout(supabase.auth.getSession(), AUTH_INITIALIZATION_TIMEOUT_MS),
        ]);
        if (!mounted) return;
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
        if (mounted) setError("Unable to connect to the learning platform.");
      } finally {
        if (mounted) setAuthLoading(false);
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
        window.setTimeout(() => {
          if (!mounted) {
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
  }, []);

  /* =========================
     MOCK TIMER
  ========================= */

  useEffect(() => {
    if (
      !mockMode ||
      mockSubmitted ||
      mockSubmitting
    ) {
      return;
    }

    if (mockTimeLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setMockTimeLeft((previous) => {
        if (previous <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    mockMode,
    mockSubmitted,
    mockSubmitting,
    mockTimeLeft,
  ]);

  /*
   * Automatically submit the mock when the timer
   * reaches zero.
   */
  useEffect(() => {
    if (
      !mockMode ||
      mockSubmitted ||
      mockSubmitting ||
      mockTimeLeft > 0
    ) {
      return;
    }

    submitMockTest(true);
  }, [
    mockMode,
    mockSubmitted,
    mockSubmitting,
    mockTimeLeft,
  ]);

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

  const filteredQuestions = useMemo(() => {
    if (enrolledClassId === null) {
      return [];
    }

    return questions.filter((q) => {
      const matchesStudentClass =
        q.classId === enrolledClassId;

      if (!matchesStudentClass) {
        return false;
      }

      const matchesSubject =
        selectedSubject === ALL ||
        q.subjectName === selectedSubject;

      const matchesChapter =
        selectedChapter === ALL ||
        q.chapterName === selectedChapter;

      return (
        matchesSubject &&
        matchesChapter
      );
    });
  }, [
    questions,
    selectedSubject,
    selectedChapter,
    enrolledClassId,
  ]);

  /*
   * Questions belonging to the selected subject.
   *
   * This is intentionally NOT affected by chapter selection.
   *
   * Real Mock Test requires a minimum of 60 active
   * questions across the complete selected subject.
   */
  const selectedSubjectQuestions = useMemo(() => {
    if (
      enrolledClassId === null ||
      selectedSubject === ALL
    ) {
      return [];
    }

    return questions.filter(
      (q) =>
        q.classId === enrolledClassId &&
        q.subjectName === selectedSubject
    );
  }, [
    questions,
    selectedSubject,
    enrolledClassId,
  ]);

  const selectedSubjectQuestionCount =
    selectedSubjectQuestions.length;

  const numberedMockCount = Math.floor(selectedSubjectQuestionCount / MOCK_QUESTION_COUNT);
  const completedNumberedMocks = mockPapers.filter(
    (p) => p.paper_number !== null && p.status === "COMPLETED"
  ).length;
  const mockCanStart =
    selectedSubject !== ALL &&
    selectedSubjectQuestionCount >= MOCK_QUESTION_COUNT &&
    !mockStarting && !mockHistoryLoading;
  const selectedMockRecord = mockPapers.find(
    (p) => p.paper_number === Number(selectedMockPaper)
  );
  const allNumberedCompleted =
    numberedMockCount > 0 && completedNumberedMocks >= numberedMockCount;

  useEffect(() => {
    let cancelled = false;
    setMockPapers([]);
    setSelectedMockPaper("1");
    if (!currentUser?.id || !availableSubjects.find(s => s.subject_name === selectedSubject)?.id) return;

    const load = async () => {
      setMockHistoryLoading(true);
      const { data, error: historyError } = await supabase
        .from("mock_papers")
        .select("id,subject_id,paper_number,retake_number,question_ids,status,started_at,quiz_attempt_id")
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


  /*
   * FREE AVAILABLE QUESTIONS
   *
   * Subject-level allowance is enforced here.
   */
  const freeAvailableQuestions = useMemo(() => {
    const subjectRemaining = new Map<
      number,
      number
    >();

    const result: MCQ[] = [];

    const shuffledQuestions =
      shuffleQuestions(filteredQuestions);

    for (const question of shuffledQuestions) {
      let remaining =
        subjectRemaining.get(
          question.subjectId
        );

      if (remaining === undefined) {
        remaining =
          getSubjectRemaining(
            question.subjectId
          );
      }

      if (remaining <= 0) {
        continue;
      }

      result.push(question);

      subjectRemaining.set(
        question.subjectId,
        remaining - 1
      );
    }

    return result;
  }, [filteredQuestions, freeUsage]);

  const availablePracticeQuestions = isPaidMember
    ? filteredQuestions
    : freeAvailableQuestions;

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

  const selectedSubjectUsage =
    selectedSubjectObject
      ? getSubjectUsage(
          selectedSubjectObject.id
        )
      : 0;

  const selectedSubjectRemaining =
    selectedSubjectObject
      ? getSubjectRemaining(
          selectedSubjectObject.id
        )
      : 0;

  const selectedSubjectLimitReached =
    selectedSubjectObject
      ? isSubjectFreeLimitReached(
          selectedSubjectObject.id
        )
      : false;

  const PRACTICE_SET_SIZE = 60;

  // Stable order keeps each question in exactly one subject-wide set.
  const orderedPracticeQuestions = useMemo(
    () => [...filteredQuestions].sort((a, b) => a.id - b.id),
    [filteredQuestions]
  );

  const chapterSelected = selectedChapter !== ALL;
  const totalPracticeSets = Math.ceil(orderedPracticeQuestions.length / PRACTICE_SET_SIZE);

  // Free members retain their 10-question subject allowance. They can
  // access eligible questions within the selected set, not the entire bank.
  const selectedSetQuestions = useMemo(() => {
    const start = (practiceSet - 1) * PRACTICE_SET_SIZE;
    return orderedPracticeQuestions.slice(start, start + PRACTICE_SET_SIZE);
  }, [orderedPracticeQuestions, chapterSelected, practiceSet]);

  const eligibleSetQuestions = useMemo(() => {
    if (isPaidMember) return selectedSetQuestions;
    const remaining = selectedSetQuestions[0]
      ? getSubjectRemaining(selectedSetQuestions[0].subjectId)
      : 0;
    return selectedSetQuestions.slice(0, remaining);
  }, [selectedSetQuestions, isPaidMember, freeUsage]);

  useEffect(() => {
    if (practiceSet > Math.max(1, totalPracticeSets)) setPracticeSet(1);
  }, [practiceSet, totalPracticeSets]);

  /* =========================
     FILTER HANDLERS
  ========================= */

  function handleClassChange(value: string) {
    if (enrolledClassId === null) {
      return;
    }

    if (
      String(enrolledClassId) !== value
    ) {
      return;
    }

    setSelectedClass(
      String(enrolledClassId)
    );

    setSelectedSubject(ALL);
    setSelectedChapter(ALL);
    setPracticeSet(1);
  }

  function handleSubjectChange(value: string) {
    setSelectedSubject(value);
    setSelectedChapter(ALL);
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
      const chapterId = chapterSelected
        ? availableChapters.find(c => c.chapter_name === selectedChapter)?.id ?? null
        : null;
      const findSession = () => {
        let query = supabase.from("practice_sessions")
          .select("id,question_ids,answers,current_index,started_at")
          .eq("student_id", currentUser.id)
          .eq("subject_id", selectedSubjectObject.id)
          .eq("set_number", practiceSet)
          .eq("status", "IN_PROGRESS");
        query = chapterId === null ? query.is("chapter_id", null) : query.eq("chapter_id", chapterId);
        return query.order("created_at", { ascending: false }).limit(1).maybeSingle();
      };
      let { data: existing, error: readError } = await findSession();
      if (readError) throw readError;
      let assigned: MCQ[];
      let answers: Record<number, string> = {};
      let index = 0;
      let started = Date.now();
      let sessionId: string;
      if (existing) {
        const byId = new Map(questions.map(q => [q.id, q]));
        assigned = (existing.question_ids as number[]).map(id => byId.get(Number(id))).filter((q): q is MCQ => !!q);
        if (assigned.length !== existing.question_ids.length) {
          throw new Error("Some saved questions are no longer available. Please contact support.");
        }
        answers = (existing.answers || {}) as Record<number, string>;
        index = Math.min(Math.max(0, existing.current_index ?? 0), assigned.length - 1);
        if (answers[assigned[index]?.id] && index < assigned.length - 1) index += 1;
        started = new Date(existing.started_at).getTime();
        sessionId = existing.id;
      } else {
        assigned = eligibleSetQuestions;
        if (!assigned.length) throw new Error(isPaidMember ? "No questions available for this set." : "No free questions remain for this subject.");
        const { data: created, error: createError } = await supabase.from("practice_sessions")
          .insert({ student_id: currentUser.id, subject_id: selectedSubjectObject.id,
            chapter_id: chapterId, set_number: practiceSet,
            question_ids: assigned.map(q => q.id), answers: {}, current_index: 0 })
          .select("id,started_at").single();
        if (createError || !created) {
          // If another tab created the session concurrently, load that session.
          const retry = await findSession();
          if (retry.error || !retry.data) throw createError || retry.error || new Error("Unable to create practice session.");
          const row = retry.data;
          const byId = new Map(questions.map(q => [q.id, q]));
          assigned = (row.question_ids as number[]).map(id => byId.get(Number(id))).filter((q): q is MCQ => !!q);
          if (assigned.length !== row.question_ids.length) throw new Error("Saved questions are unavailable.");
          answers = (row.answers || {}) as Record<number, string>;
          index = Math.min(Math.max(0, row.current_index ?? 0), assigned.length - 1);
          if (answers[assigned[index]?.id] && index < assigned.length - 1) index += 1;
          started = new Date(row.started_at).getTime();
          sessionId = row.id;
        } else {
          sessionId = created.id;
          started = new Date(created.started_at).getTime();
        }
      }
      setPracticeSessionId(sessionId);
      setPracticeQuestions(assigned);
      setPracticeIndex(index);
      setPracticeAnswers(answers);
      setPracticeDraft({});
      setPracticeSavedCount(Object.keys(answers).length);
      setPracticeSubmitted(false);
      setPracticeConfirmSubmit(false);
      setPracticeSubmitting(false);
      setPracticeStartedAt(started);
      setPracticeMode(true);
      setMockMode(false);
    } catch (err: any) {
      setPracticeSubmitError(err?.message || "Could not load or save practice progress.");
    } finally {
      setPracticeStarting(false);
    }
  }

  async function persistPracticeProgress(nextAnswers: Record<number, string>, nextIndex: number) {
    if (!currentUser || !practiceSessionId) throw new Error("Practice session is missing.");
    const { data, error: saveError } = await supabase.from("practice_sessions")
      .update({ current_index: nextIndex, updated_at: new Date().toISOString() })
      .eq("id", practiceSessionId).eq("student_id", currentUser.id)
      .eq("status", "IN_PROGRESS").select("id").single();
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
      setPracticeDraft(prev => { const next = { ...prev }; delete next[questionId]; return next; });
      setPracticeSavedCount(Object.keys(saved).length);
    } catch (err: any) {
      setPracticeSubmitError("Could not lock this answer. Please retry. " + (err?.message || ""));
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
    } catch (err: any) {
      setPracticeSubmitError("Unable to save your position. Please retry. " + (err?.message || ""));
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

  async function saveQuizAttempt({
    quizType,
    questions,
    answers,
    startedAt,
    timeTakenSeconds,
  }: {
    quizType: "PRACTICE" | "MOCK";
    questions: MCQ[];
    answers: Record<number, string>;
    startedAt: number | null;
    timeTakenSeconds?: number;
  }) {
    if (!currentUser || questions.length === 0) {
      return false;
    }

    const submittedAt = new Date();
    const startedAtDate = new Date(
      startedAt || submittedAt.getTime()
    );

    const correctAnswers = questions.filter(
      (q) =>
        answers[q.id] ===
        q.correct_option.trim().toUpperCase()
    ).length;

    const answeredQuestions = questions.filter(
      (q) => Boolean(answers[q.id])
    ).length;

    const unansweredQuestions =
      questions.length - answeredQuestions;

    const wrongAnswers =
      answeredQuestions - correctAnswers;

    const totalMarks = questions.reduce(
      (sum, q) => sum + Number(q.marks ?? 1),
      0
    );

    const obtainedMarks = questions.reduce(
      (sum, q) => {
        const isCorrect =
          answers[q.id] ===
          q.correct_option.trim().toUpperCase();

        return isCorrect
          ? sum + Number(q.marks ?? 1)
          : sum;
      },
      0
    );

    const percentage = totalMarks > 0
      ? Number(((obtainedMarks / totalMarks) * 100).toFixed(2))
      : 0;

    const calculatedTimeTaken =
      timeTakenSeconds ??
      Math.max(0, Math.round((submittedAt.getTime() - startedAtDate.getTime()) / 1000));

    // Practice/mock tests can contain multiple chapters, so chapter_id
    // is only stored when every question belongs to the same chapter.
    const uniqueChapterIds = Array.from(
      new Set(questions.map((q) => q.chapter_id))
    );

    const subjectId = questions[0]?.subjectId ?? null;
    const chapterId =
      uniqueChapterIds.length === 1
        ? uniqueChapterIds[0]
        : null;

    const { data: attempt, error: attemptError } =
      await supabase
        .from("quiz_attempts")
        .insert({
          student_id: currentUser.id,
          subject_id: subjectId,
          chapter_id: chapterId,
          quiz_type: quizType,
          total_questions: questions.length,
          answered_questions: answeredQuestions,
          correct_answers: correctAnswers,
          wrong_answers: wrongAnswers,
          unanswered_questions: unansweredQuestions,
          total_marks: totalMarks,
          obtained_marks: obtainedMarks,
          percentage,
          status: "COMPLETED",
          started_at: startedAtDate.toISOString(),
          submitted_at: submittedAt.toISOString(),
          time_taken_seconds: calculatedTimeTaken,
        })
        .select("id")
        .single();

    if (attemptError || !attempt) {
      const details = attemptError
        ? [
            attemptError.message,
            attemptError.code,
            attemptError.details,
            attemptError.hint,
          ]
            .filter(Boolean)
            .join(" | ")
        : "Supabase returned no quiz attempt record.";

      console.error("QUIZ DATABASE ERROR:", details);
      throw new Error(`Quiz database error: ${details}`);
    }

    const answerRows = questions.map((q) => {
      const selectedAnswer = answers[q.id] || null;
      const isCorrect =
        selectedAnswer ===
        q.correct_option.trim().toUpperCase();

      return {
        attempt_id: attempt.id,
        question_id: q.id,
        selected_answer: selectedAnswer,
        correct_answer: q.correct_option.trim().toUpperCase(),
        is_correct: Boolean(selectedAnswer) && isCorrect,
        marks_obtained: isCorrect ? Number(q.marks ?? 1) : 0,
        answered_at: selectedAnswer ? submittedAt.toISOString() : null,
      };
    });

    const { error: answerError } = await supabase
      .from("quiz_attempt_answers")
      .insert(answerRows);

    if (answerError) {
      console.error(
        "Quiz answer history save error:",
        answerError
      );

      // Remove the parent attempt so we never leave a partial history record.
      await supabase
        .from("quiz_attempts")
        .delete()
        .eq("id", attempt.id)
        .eq("student_id", currentUser.id);

      return false;
    }

    return attempt.id;
  }

  async function submitPracticeTest() {
    setPracticeConfirmSubmit(false);
    if (!currentUser) {
      setPracticeSubmitError(
        "Your session has expired. Please sign in again."
      );
      return;
    }

    if (practiceSubmitting || practiceSubmitted) {
      return;
    }

    if (practiceQuestions.length === 0) {
      setPracticeSubmitError(
        "There are no questions to submit."
      );
      return;
    }

    setPracticeSubmitting(true);
    setPracticeSubmitError("");

    try {
      if (!isPaidMember) {
        for (const question of practiceQuestions) {
          const { error: usageError } =
            await supabase.rpc(
              "record_free_question_usage",
              {
                p_student_id: currentUser.id,
                p_subject_id: question.subjectId,
                p_chapter_id: question.chapter_id,
              }
            );

          if (usageError) {
            console.error(
              "Free usage RPC error:",
              usageError
            );

            throw new Error(
              usageError.message ||
                "Unable to record free question usage."
            );
          }
        }

        await loadFreeUsage(currentUser.id);
      }

      const historySaved = await saveQuizAttempt({
        quizType: "PRACTICE",
        questions: practiceQuestions,
        answers: practiceAnswers,
        startedAt: practiceStartedAt,
      });

      if (!historySaved) {
        setPracticeSubmitError(
          "Test completed, but the quiz history could not be saved. Please contact support if this continues."
        );
      }

      if (!historySaved) {
        throw new Error("Could not save quiz history. Please retry submission.");
      }
      if (practiceSessionId) {
        const { error: completionError } = await supabase.from("practice_sessions")
          .update({ status: "COMPLETED", updated_at: new Date().toISOString() })
          .eq("id", practiceSessionId).eq("student_id", currentUser.id);
        if (completionError) throw completionError;
      }
      setPracticeSubmitted(true);
    } catch (submitError: any) {
      console.error(
        "Practice test submission error:",
        submitError
      );

      setPracticeSubmitError(
        submitError?.message ||
          "Unable to submit the practice test. Please try again."
      );
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
      .select("id,subject_id,paper_number,retake_number,question_ids,status,started_at,quiz_attempt_id")
      .eq("student_id", currentUser.id)
      .eq("subject_id", subjectId)
      .order("started_at", { ascending: true });
    if (historyError) throw historyError;
    setMockPapers((data || []) as MockPaper[]);
  }

  async function startMockTest() {
    setMockSubmitError("");
    if (!currentUser || !selectedSubjectObject) return;
    if (!isPaidMember) { openSubscribe(); return; }
    if (mockScope === "full" && selectedSubjectQuestionCount < MOCK_QUESTION_COUNT) return;
    if (mockScope === "chapters" && mockChapterIds.length === 0) { setMockSubmitError("Select at least one chapter."); return; }
    if (mockScope === "full" && selectedMockPaper !== "retake" && selectedMockRecord?.status === "COMPLETED") {
      setMockSubmitError("This paper is completed. Choose another paper or a retake.");
      return;
    }

    setMockStarting(true);
    try {
      if (mockScope === "chapters") {
        const { data, error: chapterError } = await supabase.rpc("start_chapter_mock", {
          p_subject_id: selectedSubjectObject.id, p_chapter_ids: mockChapterIds,
        });
        if (chapterError || !data) throw chapterError || new Error("Unable to start chapter mock.");
        const paper = data as { id: string; question_ids: number[]; started_at: string };
        const byId = new Map(selectedSubjectQuestions.map(q => [q.id, q]));
        const assigned = paper.question_ids.map(id => byId.get(Number(id)));
        if (assigned.some(q => !q) || !assigned.length) throw new Error("Assigned questions unavailable. Refresh and retry.");
        const duration = Math.min(60, assigned.length) * 60;
        setChapterMockId(paper.id); setActiveMockPaperId(null);
        setMockQuestions(assigned as MCQ[]); setMockIndex(0); setMockAnswers({}); setMockConfirmSubmit(false);
        setMockSubmitted(false); setMockSubmitting(false); setMockDuration(duration);
        setMockTimeLeft(duration); setMockStartedAt(new Date(paper.started_at).getTime());
        setPracticeMode(false); setMockMode(true);
        return;
      }
      setChapterMockId(null);
      setMockDuration(MOCK_DURATION_SECONDS);
      const { data, error: startError } = await supabase.rpc(
        "start_mock_paper",
        {
          p_subject_id: selectedSubjectObject.id,
          p_paper_number: selectedMockPaper === "retake" ? null : Number(selectedMockPaper),
        }
      );
      if (startError) throw startError;
      const paper = data as MockPaper;
      const byId = new Map(selectedSubjectQuestions.map(q => [q.id, q]));
      const assigned = paper.question_ids.map(id => byId.get(Number(id)));
      if (assigned.some(q => !q) || assigned.length !== MOCK_QUESTION_COUNT) {
        throw new Error("Some assigned questions are no longer available. Contact support.");
      }
      await refreshMockPapers(selectedSubjectObject.id);
      setActiveMockPaperId(paper.id);
      setMockQuestions(assigned as MCQ[]);
      setMockIndex(0);
      setMockAnswers({});
      setMockConfirmSubmit(false);
      setMockSubmitted(false);
      setMockSubmitting(false);
      setMockTimeLeft(MOCK_DURATION_SECONDS);
      setMockStartedAt(Date.now());
      setPracticeMode(false);
      setMockMode(true);
    } catch (startError: any) {
      setMockSubmitError(startError?.message || "Unable to start mock test.");
    } finally {
      setMockStarting(false);
    }
  }

  async function submitMockTest(
    automaticSubmit = false
  ) {
    setMockConfirmSubmit(false);
    if (mockSubmitted || mockSubmitting) {
      return;
    }

    if (mockQuestions.length < 1 || (chapterMockId === null && mockQuestions.length !== MOCK_QUESTION_COUNT)) {
      setMockSubmitError(
        "There are no valid mock questions to submit."
      );
      return;
    }

    setMockSubmitting(true);
    setMockSubmitError("");

    try {
      const timeTakenSeconds = Math.max(
        0,
        mockDuration - mockTimeLeft
      );

      const historySaved = await saveQuizAttempt({
        quizType: "MOCK",
        questions: mockQuestions,
        answers: mockAnswers,
        startedAt: mockStartedAt,
        timeTakenSeconds,
      });

      if (!historySaved) {
        throw new Error("Unable to save quiz history. Please retry submission.");
      }
      if (!activeMockPaperId && !chapterMockId) throw new Error("Mock paper assignment is missing.");
      const { error: completionError } = chapterMockId
        ? await supabase.rpc("complete_chapter_mock", { p_chapter_mock_id: chapterMockId, p_quiz_attempt_id: String(historySaved) })
        : await supabase.rpc("complete_mock_paper", { p_mock_paper_id: activeMockPaperId, p_quiz_attempt_id: String(historySaved) });
      if (completionError) throw completionError;
      if (selectedSubjectObject) {
        await refreshMockPapers(selectedSubjectObject.id);
      }
      setMockSubmitted(true);

      if (automaticSubmit) {
        setMockTimeLeft(0);
      }
    } catch (submitError: any) {
      console.error(
        "Mock test submission error:",
        submitError
      );

      setMockSubmitError(
        submitError?.message ||
          "Unable to submit the mock test. Please try again."
      );
    } finally {
      setMockSubmitting(false);
    }
  }

  function exitMockTest() {
    setMockConfirmSubmit(false);
    setMockMode(false);
    setMockSubmitted(false);
    setMockSubmitting(false);
    setMockSubmitError("");
    setMockQuestions([]);
    setMockAnswers({});
    setMockIndex(0);
    setMockTimeLeft(
      MOCK_DURATION_SECONDS
    );
    setMockStartedAt(null);
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

    if (signupPassword.length < 6) {
      setSignupError(
        "Password must be at least 6 characters."
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
    } catch (resetError: any) {
      console.error("Password reset error:", resetError);
      setForgotPasswordError(
        resetError?.message ||
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

    if (newPassword.length < 6) {
      setUpdatePasswordError("Password must be at least 6 characters long.");
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
    } catch (updateError: any) {
      console.error("Password update error:", updateError);
      setUpdatePasswordError(
        updateError?.message ||
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
    if (await redirectAdminIfAuthorized()) return;

    setCurrentUser(data.user);

    setSigninEmail("");
    setSigninPassword("");
    setSigninLoading(false);
    setShowSignin(false);
  }

  /* =========================
     LOGOUT
  ========================= */

  async function handleLogout() {
    setIsPaidMember(false);
    setShowSubscribeModal(false);

    await supabase.auth.signOut();

    authUserIdRef.current = null;

    setCurrentUser(null);
    setStudentProfile(null);
    setFreeUsage({});
    setIsPaidMember(false);
    setQuestions([]);
    setSubjects([]);
    setChapters([]);

    setSelectedClass(ALL);
    setSelectedSubject(ALL);
    setSelectedChapter(ALL);

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

  if (!currentUser) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[#f8f7ff] text-slate-950">
        {showSignup && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-6">
            <div className="relative my-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-7">
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
                <img src="/images/cbse-students.webp" alt="Indian Class 9 and 10 students in school uniform" className="h-auto max-h-44 w-full object-contain object-center sm:max-h-52" />
              </div>
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
                  <p className="font-bold">Please verify your email address</p>
                  <p className="mt-2">{signupSuccess}</p>
                </div>
              )}

              {!signupSuccess && <form
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
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Email ID
                  </label>

                  <input
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
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Password
                  </label>

                  <input
                    type="password"
                    value={signupPassword}
                    onChange={(e) =>
                      setSignupPassword(
                        e.target.value
                      )
                    }
                    placeholder="Minimum 6 characters"
                    disabled={signupLoading}
                    autoComplete="new-password"
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-100 sm:text-sm"
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
                      setSignupConfirmPassword(
                        e.target.value
                      )
                    }
                    placeholder="Re-enter your password"
                    disabled={signupLoading}
                    autoComplete="new-password"
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-100 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Class
                  </label>

                  <select
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

                    {classes.map((c) => (
                      <option
                        key={c.id}
                        value={c.id}
                      >
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
            <div className="relative my-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-7">
              <button
                type="button"
                onClick={closeSignin}
                disabled={signinLoading}
                className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-2xl font-extrabold text-slate-950 shadow-md hover:bg-slate-100 disabled:opacity-40"
                aria-label="Close sign in"
              >
                ×
              </button>

              <div className="mb-5 overflow-hidden rounded-xl bg-gradient-to-br from-indigo-50 to-violet-100">
                <img src="/images/cbse-students.webp" alt="Indian Class 9 and 10 students in school uniform" className="h-auto max-h-44 w-full object-contain object-center sm:max-h-52" />
              </div>
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
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Password
                  </label>

                  <input
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


        {showForgotPassword && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/70 px-4 py-5 backdrop-blur-sm sm:py-8">
            <div className="relative my-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
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
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Email ID
                  </label>
                  <input
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
            <div className="relative my-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
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
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    disabled={updatePasswordLoading || !!updatePasswordSuccess}
                    autoComplete="new-password"
                    autoFocus
                    className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 disabled:bg-slate-100 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                    Confirm New Password
                  </label>
                  <input
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

        {/*
         * MODERN PUBLIC HOMEPAGE
         *
         * The authenticated question-bank flow below this public page is
         * intentionally preserved: subject/chapter filters, Practice Paper,
         * Real Mock Test, subscription checks, usage tracking, and all
         * existing handlers continue to use the original state and functions.
         */}
        <header className="sticky top-0 z-40 border-b border-indigo-100 bg-white/95 shadow-sm backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-3.5 lg:px-8">
            <a
              href="#home"
              onClick={() => setShowMobileMenu(false)}
              className="flex min-w-0 items-center gap-2.5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-lg shadow-lg shadow-indigo-200">📚</div>
              <div className="min-w-0">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.14em] text-indigo-600 sm:text-[9px] sm:tracking-[0.18em]">CBSE Exam Preparation</p>
                <p className="truncate text-sm font-extrabold tracking-tight text-slate-950 sm:text-lg">CBSE Question Bank</p>
              </div>
            </a>

            <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 lg:flex">
              <a href="#home" className="transition hover:text-indigo-600">Home</a>
              <a href="#features" className="transition hover:text-indigo-600">Features</a>
              <a href="#subjects" className="transition hover:text-indigo-600">Subjects</a>
              <a href="#pricing" className="transition hover:text-indigo-600">Pricing</a>
              <a href="#how-it-works" className="transition hover:text-indigo-600">How It Works</a>
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={openSignin}
                className="min-h-10 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 sm:px-4 sm:text-sm"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={openSignup}
                className="min-h-10 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-extrabold text-slate-950 shadow-lg shadow-amber-200/60 transition hover:bg-amber-300 sm:px-4 sm:text-sm"
              >
                Start Free 🎯
              </button>
              <button
                type="button"
                onClick={() => setShowMobileMenu((previous) => !previous)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm sm:hidden"
                aria-label={showMobileMenu ? "Close menu" : "Open menu"}
                aria-expanded={showMobileMenu}
              >
                <span className="text-xl leading-none">{showMobileMenu ? "×" : "☰"}</span>
              </button>
            </div>
          </div>

          {showMobileMenu && (
            <div className="border-t border-indigo-100 bg-white px-4 py-3 shadow-lg sm:hidden">
              <nav className="grid gap-1">
                {[
                  ["Home", "#home"],
                  ["How It Works", "#how-it-works"],
                  ["Subjects", "#subjects"],
                  ["Features", "#features"],
                  ["Pricing", "#pricing"],
                  ["FAQs", "#faq"],
                ].map(([label, href]) => (
                  <a
                    key={href}
                    href={href}
                    onClick={() => setShowMobileMenu(false)}
                    className="flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {label}
                  </a>
                ))}
                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileMenu(false);
                      openSignin();
                    }}
                    className="min-h-11 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileMenu(false);
                      openSignup();
                    }}
                    className="min-h-11 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-extrabold text-white"
                  >
                    Start Free
                  </button>
                </div>
              </nav>
            </div>
          )}
        </header>
        <section id="home" className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 text-white">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-fuchsia-400/20 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-24">
            <div>
              <span className="inline-flex rounded-full border border-amber-300/40 bg-amber-300/15 px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-amber-200 sm:text-[11px]">🇮🇳 Class 9 &amp; 10 • CBSE</span>
              <img src="/images/cbse-students.webp" alt="CBSE students" className="float-right ml-2 mt-3 h-28 w-28 rounded-xl bg-indigo-50 object-contain shadow-lg sm:hidden" />
              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">Practice Smarter.<br /><span className="text-amber-300">Score Better.</span></h1>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-indigo-100 sm:text-lg sm:leading-8">Practice chapter-wise MCQs, build subject confidence, get instant explanations, and prepare with focused practice tests designed for CBSE students.</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button onClick={openSignup} className="min-h-12 rounded-xl bg-amber-400 px-6 py-3 text-sm font-extrabold text-slate-950 shadow-xl shadow-indigo-950/20 transition hover:bg-amber-300">Start Free 🎯</button>
                <a href="#pricing" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-white/15">View Plans</a>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-3 text-xs font-semibold text-indigo-100">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">✓ 10 free MCQs per subject</span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">✓ Instant explanations</span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">✓ Chapter-wise practice</span>
              </div>
            </div>

            <div className="relative mx-auto hidden w-full max-w-xl sm:block">
              <div className="mb-5 overflow-hidden rounded-[2rem] border border-white/20 bg-gradient-to-br from-indigo-50 to-violet-100 shadow-2xl shadow-indigo-950/20">
                <img src="/images/cbse-students.webp" alt="Illustration of two Indian secondary-school students wearing uniforms and holding books" className="h-auto max-h-[460px] w-full object-contain object-center" loading="eager" />
              </div>
              <div className="absolute inset-8 rounded-[2rem] bg-white/10 blur-2xl pointer-events-none" />
              <div className="relative rounded-[2rem] border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-md sm:p-6">
                <div className="rounded-[1.5rem] bg-white p-5 text-slate-950 shadow-xl sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-indigo-600">Smart Practice</p><h2 className="mt-1 text-xl font-black sm:text-2xl">Choose. Practice. Improve.</h2></div>
                    <div className="rounded-xl bg-indigo-50 px-3 py-2 text-center"><p className="text-[9px] font-bold uppercase text-indigo-500">Free</p><p className="text-lg font-black text-indigo-700">10 / subject</p></div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-violet-50 p-4"><div className="text-2xl">📐</div><p className="mt-2 text-sm font-extrabold">Mathematics</p><p className="mt-1 text-[11px] text-slate-500">Practice by chapter</p></div>
                    <div className="rounded-2xl bg-sky-50 p-4"><div className="text-2xl">🔬</div><p className="mt-2 text-sm font-extrabold">Science</p><p className="mt-1 text-[11px] text-slate-500">Target weak topics</p></div>
                    <div className="rounded-2xl bg-emerald-50 p-4"><div className="text-2xl">📖</div><p className="mt-2 text-sm font-extrabold">English</p><p className="mt-1 text-[11px] text-slate-500">Subject-wise MCQs</p></div>
                    <div className="rounded-2xl bg-orange-50 p-4"><div className="text-2xl">🌍</div><p className="mt-2 text-sm font-extrabold">Social Science</p><p className="mt-1 text-[11px] text-slate-500">Focused preparation</p></div>
                  </div>
                  <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-white"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-indigo-300">REAL MOCK TEST</p><p className="mt-1 text-sm font-extrabold">60 minutes per test • Multiple papers &amp; retakes</p></div><span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[9px] font-extrabold text-emerald-300">PAID MEMBERS</span></div></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-white px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-indigo-600">Simple process</p><h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">How It Works</h2><p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">Get started in three simple steps and build a smarter CBSE preparation routine.</p></div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                { n: "01", icon: "🎓", title: "Pick Your Class", text: "Choose Class 9 or Class 10 and your account stays connected to the right question bank." },
                { n: "02", icon: "📚", title: "Choose a Subject", text: "Select Mathematics, Science, English, Social Science or Hindi, then focus on a chapter if you want." },
                { n: "03", icon: "🎯", title: "Attempt the Quiz", text: "Answer MCQs, see explanations and use practice tests to improve your exam readiness." },
              ].map((step) => (
                <div key={step.n} className="relative rounded-3xl border border-indigo-100 bg-[#f8f7ff] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="flex items-center justify-between"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-xl shadow-lg shadow-indigo-200">{step.icon}</div><span className="text-4xl font-black text-indigo-100">{step.n}</span></div><h3 className="mt-6 text-lg font-extrabold text-slate-950">{step.title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{step.text}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section id="subjects" className="bg-[#f8f7ff] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-indigo-600">CBSE question bank</p><h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">All CBSE Subjects Covered 📚</h2><p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">Comprehensive MCQ practice for the core Class 9 and Class 10 subjects.</p></div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { name: "Mathematics", icon: "📐", tone: "from-violet-500 to-purple-600", tag: "Class 9 & 10" },
                { name: "Science", icon: "🔬", tone: "from-sky-500 to-cyan-500", tag: "Class 9 & 10" },
                { name: "English", icon: "📖", tone: "from-emerald-500 to-teal-500", tag: "Class 9 & 10" },
                { name: "Social Science", icon: "🌍", tone: "from-orange-500 to-amber-500", tag: "Class 9 & 10" },
                { name: "Hindi", icon: "IN", tone: "from-pink-500 to-rose-500", tag: "Class 9 & 10" },
              ].map((subject) => (
                <button key={subject.name} type="button" onClick={openSignup} className={`group min-h-44 rounded-3xl bg-gradient-to-br ${subject.tone} p-5 text-left text-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl`}><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl font-black backdrop-blur">{subject.icon}</div><h3 className="mt-7 text-lg font-black">{subject.name}</h3><span className="mt-2 inline-flex rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold">{subject.tag}</span></button>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="bg-white px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-indigo-600">Built for better preparation</p><h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Everything You Need to Ace Your Exams 💡</h2><p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">Focused tools to help you practice consistently, understand mistakes and prepare with confidence.</p></div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: "🎯", title: "10 Free MCQs", text: "Try the question bank before you buy with 10 free questions per subject." },
                { icon: "💡", title: "Instant Answer + Explanation", text: "Understand why an answer is correct immediately after every question." },
                { icon: "📚", title: "Chapter-wise Practice", text: "Focus on specific chapters and build targeted practice sessions." },
                { icon: "🔄", title: "Reset & Reshuffle", text: "Practice again with questions appearing in a new random order." },
                { icon: "📊", title: "Progress Tracking", text: "Track your practice and identify areas where you need more work." },
                { icon: "🏆", title: "Premium Practice", text: "Unlock full question access and the 60-question Real Mock Test with membership." },
              ].map((feature) => (
                <div key={feature.title} className="rounded-3xl border border-indigo-100 bg-[#f8f7ff] p-6 transition hover:-translate-y-1 hover:shadow-lg"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-xl">{feature.icon}</div><h3 className="mt-5 text-base font-extrabold text-slate-950">{feature.title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{feature.text}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="bg-[#f0efff] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-indigo-600">Simple, affordable plans</p><h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Start Free. Upgrade When Ready. 💰</h2><p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">Try the question bank first, then unlock the full practice experience when you are ready.</p></div>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <div className="rounded-[2rem] border border-indigo-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-center justify-between gap-4"><div><span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold uppercase text-slate-600">FREE</span><h3 className="mt-4 text-2xl font-black text-slate-950">Free Demo</h3></div><p className="text-3xl font-black text-slate-950">₹0<span className="text-xs font-semibold text-slate-400"> / forever</span></p></div><ul className="mt-7 space-y-3 text-sm font-semibold text-slate-600"><li>✓ 10 free MCQs per subject</li><li>✓ All subjects preview</li><li>✓ Instant answers &amp; explanations</li><li>✓ No credit card needed</li></ul><button onClick={openSignup} className="mt-8 min-h-12 w-full rounded-xl bg-indigo-50 px-5 py-3 text-sm font-extrabold text-indigo-700 transition hover:bg-indigo-100">Start Free Demo</button></div>
              <div className="relative rounded-[2rem] bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-800 p-6 text-white shadow-2xl shadow-indigo-200 sm:p-8">
                <span className="absolute right-6 top-0 -translate-y-1/2 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-black uppercase text-slate-950">Recommended</span>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-extrabold uppercase text-indigo-200">PREMIUM</span>
                    <h3 className="mt-4 text-2xl font-black">Financial-Year Membership</h3>
                    <p className="mt-2 text-sm font-bold text-amber-300">🎁 Welcome Discount Offer: WELCOME10 (10% off for eligible new students; subject to verification at purchase)</p>
                  </div>
                  <div className="shrink-0 sm:text-right">
                    <p className="whitespace-nowrap text-3xl font-black [overflow-wrap:normal]">₹99</p>
                    <p className="mt-1 whitespace-nowrap text-xs font-semibold text-indigo-200 [overflow-wrap:normal]">Until 31 March</p>
                  </div>
                </div><ul className="mt-7 space-y-3 text-sm font-semibold text-indigo-100"><li>✓ Unlimited MCQ practice</li><li>✓ All chapters unlocked</li><li>✓ Instant answers + explanations</li><li>✓ Practice reset &amp; reshuffle</li><li>✓ 60-minute mock tests and eligible retakes</li></ul><button onClick={openSignup} className="mt-8 min-h-12 w-full rounded-xl bg-amber-400 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-lg transition hover:bg-amber-300">Explore Premium</button></div>
            </div>
          </div>
        </section>

        <section id="faq" className="bg-white px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <p className="text-center text-xs font-extrabold uppercase tracking-[0.16em] text-indigo-600">Help centre</p>
            <h2 className="mt-2 text-center text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Frequently Asked Questions</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-600">Answers to common questions about practice, mock tests and membership.</p>
            <div className="mt-8 space-y-3">
              {[
                { q: "Who can use this website?", a: "Students in CBSE Classes 9 and 10 can register and practise available chapter-wise MCQs." },
                { q: "What is included in the free plan?", a: "The free plan includes up to 10 MCQs per subject. The allowance is tracked separately for each subject." },
                { q: "Will I see explanations?", a: "Practice questions provide answer feedback and explanations when available in the question bank." },
                { q: "How do Real Mock Tests work?", a: "Each mock test has a 60-minute timer and 60 questions. Paid students can take available numbered papers and unlock randomized retakes after completing the series. A subject needs at least 60 active questions." },
                { q: "When does my membership expire?", a: "Purchased annual memberships are intended to run until 31 March. A free membership activated with a 100% coupon ends on that coupon's stated expiry date." },
                { q: "What happens after my membership expires?", a: "Your account remains accessible, but premium access ends unless you have another valid membership. Your remaining free allowance still applies." },
                { q: "Is this an official CBSE website?", a: "No. CBSE Exam Prep Guide is an independent educational practice platform, not affiliated with or endorsed by CBSE." },
                { q: "How can I request help or deletion of my data?", a: "Please contact the website administrator through the support contact published on the website. A dedicated contact and account-deletion process will be added before public launch." }
              ].map((faq) => (
                <details key={faq.q} className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 open:border-indigo-200 open:bg-indigo-50/50">
                  <summary className="cursor-pointer list-none pr-6 text-sm font-bold text-slate-900 sm:text-base">{faq.q}<span aria-hidden="true" className="float-right text-indigo-600 group-open:rotate-45">+</span></summary>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-950 px-4 py-14 text-white sm:px-6 sm:py-20 lg:px-8"><div className="mx-auto max-w-4xl text-center"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-indigo-300">Ready to start?</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Your next practice session starts here. 🚀</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">Create your student account and start practicing CBSE MCQs today.</p><button onClick={openSignup} className="mt-7 min-h-12 rounded-xl bg-indigo-500 px-7 py-3 text-sm font-extrabold text-white shadow-xl shadow-indigo-950 transition hover:bg-indigo-400">Create Student Account</button></div></section>

        <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><div><p className="font-black text-slate-950">CBSE Question Bank</p><p className="mt-1 text-xs text-slate-500">Practice • Learn • Improve</p></div><p className="text-xs text-slate-400">Independent CBSE practice platform • Not affiliated with CBSE</p></div></footer>
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
      const percentage =
        mockQuestions.length
          ? Math.round(
              (mockScore /
                mockQuestions.length) *
                100
            )
          : 0;

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
                  {percentage}%
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

              <Achievement correct={mockScore} total={mockQuestions.length} />
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
                    {mockScore}
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
                  <label className="text-sm font-bold" htmlFor="mock-review-filter">Review:</label>
                  <select id="mock-review-filter" value={mockReviewFilter} onChange={e => setMockReviewFilter(e.target.value as "all" | "wrong")} className="rounded-lg border border-slate-300 p-2 text-sm">
                    <option value="all">All questions</option><option value="wrong">Wrong / skipped only</option>
                  </select>
                </div>
                <div className="mt-7 space-y-4 sm:mt-9">
                {mockQuestions.filter(q => mockReviewFilter === "all" || mockAnswers[q.id] !== q.correct_option.trim().toUpperCase()).map(
                  (q, index) => {
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
                            {index + 1}
                          </span>

                          <p className="min-w-0 text-sm font-semibold leading-6 text-slate-900 sm:text-base">
                            {q.question_text}
                          </p>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {[q.option_a, q.option_b, q.option_c, q.option_d].map((option, optionIndex) => {
                            const letter = String.fromCharCode(65 + optionIndex);
                            return <div key={letter} className={`rounded-lg border px-3 py-2 text-sm ${letter === correct ? "border-emerald-300 bg-emerald-50" : letter === user ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}>
                              <strong>{letter}.</strong> {option} {letter === correct ? "✓ Correct" : letter === user ? "• Your answer" : ""}
                            </div>;
                          })}
                        </div>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <p className={`rounded-lg border px-3 py-2.5 text-sm ${user && user === correct
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-red-200 bg-red-50 text-red-800"}`}>
                            Your answer:{" "}
                            <strong>
                              {user ||
                                "Not answered"}
                            </strong>
                          </p>

                          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                            Correct answer:{" "}
                            <strong>
                              {correct}
                            </strong>
                          </p>
                        </div>

                        {q.explanation && (
                          <p className="mt-3 break-words rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-950">
                            <strong>
                              Explanation:
                            </strong>{" "}
                            {q.explanation}
                          </p>
                        )}
                      </div>
                    );
                  }
                )}
              </div>

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
              {current.question_text}
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
                      onClick={() =>
                        setMockAnswers(
                          (prev) => ({
                            ...prev,
                            [current.id]:
                              letter,
                          })
                        )
                      }
                      disabled={mockSubmitting}
                      className={`group flex min-h-14 w-full items-start gap-3 rounded-xl border-2 p-3.5 text-left sm:gap-4 sm:p-4 ${
                        selected
                          ? "border-blue-700 bg-blue-50"
                          : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
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
                }
              )}
            </div>
          </div>

          <div className="mt-4 text-sm font-semibold text-slate-700" aria-live="polite">
            Answered: {mockQuestions.filter(q => Boolean(mockAnswers[q.id])).length} / {mockQuestions.length} · Unanswered: {mockQuestions.filter(q => !mockAnswers[q.id]).length}
          </div>
          {mockConfirmSubmit && (
            <div role="dialog" aria-label="Confirm mock submission" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="font-bold text-slate-900">Ready to submit your Mock Test?</p>
              <p className="mt-1 text-sm text-slate-700">{mockQuestions.filter(q => !mockAnswers[q.id]).length} unanswered question(s). The timer continues running.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {mockQuestions.some(q => !mockAnswers[q.id]) && <button type="button" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white" onClick={() => { setMockConfirmSubmit(false); setMockIndex(mockQuestions.findIndex(q => !mockAnswers[q.id])); }}>Review Unanswered Questions</button>}
                <button type="button" disabled={mockSubmitting} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" onClick={() => void submitMockTest(false)}>Submit Anyway</button>
                <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm" onClick={() => setMockConfirmSubmit(false)}>Continue Test</button>
              </div>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-5">
            <button
              disabled={
                mockIndex === 0 ||
                mockSubmitting
              }
              onClick={() =>
                setMockIndex(
                  (p) => p - 1
                )
              }
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
            >
              ← Previous
            </button>

            {mockIndex <
            mockQuestions.length - 1 ? (
              <button
                disabled={mockSubmitting}
                onClick={() =>
                  setMockIndex(
                    (p) => p + 1
                  )
                }
                className="min-h-11 rounded-lg bg-blue-700 px-3 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
              >
                Next →
              </button>
            ) : (
              <button
                disabled={mockSubmitting}
                onClick={() =>
                  setMockConfirmSubmit(true)
                }
                className="min-h-11 rounded-lg bg-emerald-700 px-3 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
              >
                {mockSubmitting
                  ? "Submitting..."
                  : "Submit Mock Test"}
              </button>
            )}
          {mockIndex < mockQuestions.length - 1 && (
            <button type="button" disabled={mockSubmitting} onClick={() => setMockConfirmSubmit(true)} className="mt-3 w-full rounded-lg border border-emerald-600 bg-white px-4 py-2 text-sm font-bold text-emerald-800 disabled:opacity-50">Finish / Review Mock Test</button>
          )}
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
                            {q.question_text}
                          </p>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {[q.option_a, q.option_b, q.option_c, q.option_d].map((option, optionIndex) => {
                            const letter = String.fromCharCode(65 + optionIndex);
                            return <div key={letter} className={`rounded-lg border px-3 py-2 text-sm ${letter === correct ? "border-emerald-300 bg-emerald-50" : letter === user ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}>
                              <strong>{letter}.</strong> {option} {letter === correct ? "✓ Correct" : letter === user ? "• Your answer" : ""}
                            </div>;
                          })}
                        </div>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <p className={`rounded-lg border px-3 py-2.5 text-sm ${user && user === correct
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-red-200 bg-red-50 text-red-800"}`}>
                            Your answer:{" "}
                            <strong>
                              {user ||
                                "Not answered"}
                            </strong>
                          </p>

                          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                            Correct answer:{" "}
                            <strong>
                              {correct}
                            </strong>
                          </p>
                        </div>

                        {q.explanation && (
                          <p className="mt-3 break-words rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-950">
                            <strong>
                              Explanation:
                            </strong>{" "}
                            {q.explanation}
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
              {current.question_text}
            </p>

            <div className="mt-6 space-y-3 sm:mt-7">
              {current.options.map(
                (option, index) => {
                  const letter =
                    String.fromCharCode(
                      65 + index
                    );

                  const selected =
                    (practiceAnswers[current.id] ?? practiceDraft[current.id]) === letter;

                  return (
                    <button
                      key={letter}
                      onClick={() => setPracticeDraft(prev => ({ ...prev, [current.id]: letter }))}
                      disabled={practiceSubmitting || practiceSaving || Object.prototype.hasOwnProperty.call(practiceAnswers, current.id)}
                      className={`group flex min-h-14 w-full items-start gap-3 rounded-xl border-2 p-3.5 text-left sm:gap-4 sm:p-4 ${
                        selected
                          ? "border-blue-700 bg-blue-50"
                          : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
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
                }
              )}
            </div>
          </div>

          {Object.prototype.hasOwnProperty.call(practiceAnswers, current.id) ? (
            <div role="status" className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-slate-900">
              <p className="font-extrabold">{practiceAnswers[current.id] === current.correct_option.trim().toUpperCase() ? "✅ Correct answer!" : practiceAnswers[current.id] ? "❌ Incorrect answer" : "⏭️ Question skipped"}</p>
              <p>Correct answer: <strong>{current.correct_option.toUpperCase()} — {current.options[current.correct_option.toUpperCase().charCodeAt(0) - 65]}</strong></p>
              {current.explanation && <p className="mt-2">{current.explanation}</p>}
            </div>
          ) : (
            <div className="mt-4">
              <button type="button" disabled={practiceSaving || !practiceDraft[current.id]} onClick={() => void choosePracticeAnswer(current.id, practiceDraft[current.id])} className="min-h-12 w-full rounded-xl bg-emerald-700 px-3 py-3 text-sm font-bold text-white disabled:opacity-40">Submit Answer</button>
              <p className="mt-2 text-center text-xs text-slate-600">You can use Next without answering and return later. No answer is revealed when skipping.</p>
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
                onClick={() => void navigatePractice(practiceIndex + 1)}
                className="min-h-11 rounded-lg bg-blue-700 px-3 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
              >
                Next →
              </button>
            ) : (
              <button
                disabled={practiceSubmitting || practiceSaving}
                onClick={() => setPracticeConfirmSubmit(true)}
                className="min-h-11 rounded-lg bg-emerald-700 px-3 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
              >
                {practiceSubmitting
                  ? "Submitting..."
                  : "Submit Test"}
              </button>
            )}
          </div>
          {practiceQuestions.length > 0 && practiceIndex < practiceQuestions.length - 1 && (
            <button type="button" disabled={practiceSubmitting || practiceSaving} onClick={() => setPracticeConfirmSubmit(true)} className="mt-3 w-full rounded-lg border border-emerald-600 bg-white px-4 py-2 text-sm font-bold text-emerald-800 disabled:opacity-50">Finish / Review Practice Test</button>
          )}
          {practiceConfirmSubmit && (
            <div role="dialog" aria-label="Confirm practice submission" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="font-bold text-slate-900">Ready to submit your Practice Test?</p>
              <p className="mt-1 text-sm text-slate-700">Answered: {practiceQuestions.filter(q => Object.prototype.hasOwnProperty.call(practiceAnswers, q.id)).length} / {practiceQuestions.length}. Unanswered: {practiceQuestions.filter(q => !Object.prototype.hasOwnProperty.call(practiceAnswers, q.id)).length}.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {practiceQuestions.some(q => !Object.prototype.hasOwnProperty.call(practiceAnswers, q.id)) && <button type="button" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white" onClick={() => { setPracticeConfirmSubmit(false); void navigatePractice(practiceQuestions.findIndex(q => !Object.prototype.hasOwnProperty.call(practiceAnswers, q.id))); }}>Answer Skipped Questions</button>}
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
      onClick={isPaidMember ? undefined : openSubscribe}
      disabled={isPaidMember}
      className={`inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-lg border border-amber-300 bg-amber-400 px-3 py-2 text-xs font-extrabold text-slate-950 shadow-sm transition hover:bg-amber-300 disabled:cursor-default disabled:border-emerald-300 disabled:bg-emerald-100 disabled:text-emerald-800 sm:px-3 sm:text-xs ${extraClass}`}
    >
      {isPaidMember ? "✓ Premium Active" : "⭐ Subscribe ₹99"}
    </button>
  );

  return (
    <>
      {showSubscribeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
            <button
              type="button"
              onClick={closeSubscribe}
              disabled={couponLoading}
              className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-2xl font-extrabold text-slate-950 shadow-md hover:bg-slate-100 disabled:opacity-40"
              aria-label="Close subscription"
            >
              ×
            </button>

            <div className="pr-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
                Premium Membership
              </p>

              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                Premium Access
              </h2>
              <p className="mt-2 text-sm font-bold text-amber-700">🎁 Welcome Discount Offer: WELCOME10 — 10% for eligible new students. Offer eligibility and redemption must be confirmed before payment.</p>

              <p className="mt-1.5 text-sm leading-5 text-slate-500">
                Get access to paid practice questions and the Real Mock Test.
              </p>
            </div>

            <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-800">
                    Plan until 31 March
                  </p>
                  <p className="mt-1 text-3xl font-extrabold text-slate-950">
                    ₹{ANNUAL_PLAN_PRICE}
                  </p>
                </div>

                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700">
                  Annual
                </span>
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Coupon Code
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase());
                    setCouponDiscount(0);
                    setCouponMessage("");
                  }}
                  placeholder="Enter coupon code"
                  disabled={couponLoading}
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm font-semibold uppercase text-slate-900 outline-none placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-100 sm:text-sm"
                />

                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={couponLoading}
                  className="min-h-11 rounded-lg bg-slate-950 px-4 py-3 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                >
                  {couponLoading ? "Checking..." : "Apply"}
                </button>
              </div>

              {couponMessage && (
                <p className={`mt-2 text-xs font-semibold ${
                  couponDiscount > 0
                    ? "text-emerald-700"
                    : "text-red-700"
                }`}>
                  {couponMessage}
                </p>
              )}
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-slate-600">Plan price</span>
                <span className="font-semibold text-slate-900">₹{ANNUAL_PLAN_PRICE.toFixed(2)}</span>
              </div>

              {couponDiscount > 0 && (
                <div className="mt-2 flex justify-between gap-3 text-sm">
                  <span className="text-emerald-700">Coupon discount ({couponDiscount}%)</span>
                  <span className="font-semibold text-emerald-700">-₹{couponDiscountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="mt-3 border-t border-slate-200 pt-3 flex justify-between gap-3">
                <span className="font-bold text-slate-900">Payable amount</span>
                <span className="text-xl font-extrabold text-blue-700">₹{finalSubscriptionPrice.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={activateFreeMembership}
              disabled={
                couponLoading ||
                finalSubscriptionPrice !== 0 ||
                couponDiscount === 0
              }
              className="mt-5 min-h-12 w-full rounded-lg bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {couponLoading
                ? "Activating..."
                : finalSubscriptionPrice === 0
                ? "Activate Premium Membership"
                : "Payment / Activate"}
            </button>

            <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">
              Payment gateway will be connected after this coupon and pricing test is verified.
            </p>
          </div>
        </div>
      )}

      <main className="min-h-screen overflow-x-hidden bg-slate-50">
      <style>{`@keyframes welcome10-scroll { from { transform: translateX(100vw); } to { transform: translateX(-100%); } } @media (prefers-reduced-motion: reduce) { .welcome10-scroll { animation: none !important; transform: none !important; } }`}</style>
      <div className="w-full overflow-hidden border-b border-amber-300 bg-amber-100 py-2 text-amber-950" role="note" aria-label="Welcome discount offer">
        <div className="welcome10-scroll inline-block whitespace-nowrap text-xs font-extrabold sm:text-sm" style={{ animation: "welcome10-scroll 16s linear infinite", whiteSpace: "nowrap", width: "max-content" }}>
          🎁 WELCOME10 — 10% Welcome Discount for eligible new students! &nbsp; ✨ Use code WELCOME10 at checkout — subject to verification. &nbsp; 🎁
        </div>
      </div>
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-blue-700 sm:text-[11px] sm:tracking-[0.18em]">CBSE Exam Preparation</p>
            <h1 className="text-base font-bold tracking-tight text-slate-950 sm:text-xl">CBSE Exam Question Bank</h1>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
            <div className="hidden text-right sm:block">
              <p className="max-w-32 truncate text-xs font-semibold text-slate-900">{studentProfile?.full_name || currentUser?.email}</p>
              <p className="text-[10px] text-emerald-700">Signed in</p>
            </div>
            <div className="col-span-1 flex min-w-0">{subscribeButton("w-full sm:w-auto")}</div>
            <div className="col-span-1 flex flex-col gap-1.5 sm:gap-1">
              <a href="/dashboard" className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700">📊 Dashboard</a>
              <button type="button" onClick={handleLogout} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">Logout</button>
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
              Let's prepare.
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-indigo-100 sm:mt-5 sm:text-base sm:leading-7">
              Your{" "}
              {enrolledClass?.class_name ||
                "enrolled class"}{" "}
              is locked to your account. Practice MCQ
              questions by subject and chapter, or take
              a 60-question Real Mock Test.
            </p>
          </div>
          <div className="mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/20 bg-indigo-50 shadow-2xl shadow-indigo-950/30 lg:max-w-md">
            <img src="/images/cbse-students.webp" alt="Two students ready to learn" className="h-auto max-h-[390px] w-full object-contain" />
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
                Your class is locked. Select a subject
                and optionally choose a chapter.
              </p>
            </div>

            <div className="w-fit rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-bold text-blue-800">
              {filteredQuestions.length} MCQs
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* CLASS */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Your Class
              </label>

              <select
                value={
                  enrolledClassId !== null
                    ? String(enrolledClassId)
                    : ""
                }
                onChange={(e) =>
                  handleClassChange(
                    e.target.value
                  )
                }
                disabled
                className="min-h-12 w-full rounded-lg border border-slate-300 bg-slate-100 px-3.5 py-3 text-sm font-bold text-slate-700 outline-none disabled:cursor-not-allowed sm:min-h-11"
              >
                {enrolledClass ? (
                  <option
                    value={enrolledClass.id}
                  >
                    {enrolledClass.class_name}
                  </option>
                ) : (
                  <option value="">
                    Class not assigned
                  </option>
                )}
              </select>

              <p className="mt-1.5 text-[11px] text-slate-500">
                Class is linked to your account.
              </p>
            </div>

            {/* SUBJECT */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Subject
              </label>

              <select
                value={selectedSubject}
                aria-busy={subjectQuestionsLoading}
                onChange={(e) =>
                  handleSubjectChange(
                    e.target.value
                  )
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
                  Loading questions for this subject… You can choose a chapter now.
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
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Chapter
              </label>

              <select
                value={selectedChapter}
                onChange={(e) => {
                  setSelectedChapter(e.target.value);
                  setPracticeSet(1);
                }}
                disabled={
                  selectedSubject === ALL ||
                  availableChapters.length === 0
                }
                className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none hover:border-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-11"
              >
                <option value={ALL}>
                  {selectedSubject === ALL
                    ? "Select Subject First"
                    : availableChapters.length
                    ? "All Chapters"
                    : "No Chapters Available"}
                </option>

                {availableChapters.map((c) => (
                  <option
                    key={c.id}
                    value={c.chapter_name}
                  >
                    {c.chapter_number
                      ? `${c.chapter_number}. `
                      : ""}
                    {c.chapter_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* FREE TRIAL STATUS — shown only to non-paid members */}
          {!isPaidMember && selectedSubjectObject && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-amber-900">
                    Free Trial —{" "}
                    {selectedSubjectObject.subject_name}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    You can check up to 10 questions
                    from this subject for free. All
                    chapters in this subject share the
                    same free-question allowance.
                  </p>
                </div>

                <div className="w-fit rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-bold text-amber-900">
                  {freeUsageLoading
                    ? "Loading..."
                    : `${selectedSubjectUsage} / ${DEFAULT_FREE_QUESTIONS} used`}
                </div>
              </div>

              {!freeUsageLoading &&
                !selectedSubjectLimitReached && (
                  <p className="mt-2 text-xs font-semibold text-emerald-700">
                    {selectedSubjectRemaining} free question
                    {selectedSubjectRemaining === 1
                      ? ""
                      : "s"} remaining for this subject.
                  </p>
                )}

              {!freeUsageLoading &&
                selectedSubjectLimitReached && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold leading-5 text-red-800">
                    Your free trial limit for this
                    subject has been reached. A
                    subscription will be required to
                    continue with additional practice
                    questions.
                  </div>
                )}
            </div>
          )}

          {!isPaidMember && !selectedSubjectObject && (
            <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-bold text-blue-900">
                Subject-level Free Trial
              </p>

              <p className="mt-1 text-xs leading-5 text-blue-800">
                Each subject has its own 10-question free
                allowance. All chapters within a subject
                share that allowance.
              </p>
            </div>
          )}

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
        <div className="mt-5 grid gap-5 lg:grid-cols-2 sm:mt-6">
          {/* PRACTICE PAPER */}
          <div className="rounded-2xl border border-blue-800 bg-blue-900 p-4 text-white shadow-sm sm:p-7">
            <div className="flex h-full flex-col justify-between gap-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex min-h-10 items-center rounded-lg border border-blue-700 bg-blue-800 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-blue-100 sm:px-3 sm:text-[11px]">
                  Practice Paper
                </span>
                  {subscribeButton()}
                </div>

                <h3 className="mt-2.5 text-xl font-bold sm:mt-3 sm:text-2xl">
                  Practice Test
                </h3>

                <p className="mt-1 max-w-xl text-sm leading-6 text-blue-100">
                  Select a subject and optionally a
                  chapter. A chapter opens as one paper; All Chapters
                  is divided into sets of 60 questions.
                </p>

                {selectedSubject !== ALL ? (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-sm font-semibold text-white">
                      {filteredQuestions.length} total questions available
                    </p>

                    <p className="text-sm font-semibold text-green-200">
                      {isPaidMember
                        ? `${filteredQuestions.length} questions unlocked`
                        : `${freeAvailableQuestions.length} free questions available`}
                    </p>

                    {!isPaidMember &&
                      filteredQuestions.length >
                        freeAvailableQuestions.length && (
                      <p className="text-xs leading-5 text-blue-200">
                        {filteredQuestions.length -
                          freeAvailableQuestions.length}{" "}
                        questions require a paid plan to access.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm font-semibold text-white">
                    Select a subject first.
                  </p>
                )}
              </div>

              <div className="grid w-full gap-3 sm:flex sm:w-auto sm:flex-row">
                {selectedSubject !== ALL && totalPracticeSets > 1 && (
                  <select
                    aria-label="Select practice set"
                    value={practiceSet}
                    onChange={(e) => setPracticeSet(Number(e.target.value))}
                    className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-white/40 sm:min-h-11 sm:w-auto"
                  >
                    {Array.from({ length: totalPracticeSets }, (_, index) => {
                      const from = index * PRACTICE_SET_SIZE + 1;
                      const to = Math.min((index + 1) * PRACTICE_SET_SIZE, orderedPracticeQuestions.length);
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
                    {orderedPracticeQuestions.length} chapter questions
                  </div>
                )}

                <button
                  onClick={() => void startPracticeTest()}
                  disabled={practiceStarting ||
                    selectedSubject === ALL ||
                    (!isPaidMember && freeUsageLoading)
                  }
                  className="min-h-12 w-full rounded-lg bg-white px-5 py-3 text-sm font-bold text-blue-900 shadow-sm hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-11 sm:w-auto"
                >
                  {selectedSubject === ALL
                    ? "Select Subject First"
                    : (!isPaidMember && freeUsageLoading)
                    ? "Checking Free Usage..."
                    : practiceStarting ? "Loading saved practice..." : "Start / Resume Practice →"}
                </button>

                {isPaidMember && (
                  <button
                    type="button"
                    disabled
                    className="min-h-12 w-full rounded-lg border border-emerald-300 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-800 sm:min-h-11 sm:w-auto"
                  >
                    Membership Active
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* REAL MOCK TEST */}
          <div className="rounded-2xl border border-orange-300 bg-orange-100 p-4 text-slate-900 shadow-sm sm:p-7">
            <div className="flex h-full flex-col justify-between gap-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex min-h-10 items-center rounded-lg border border-orange-300 bg-orange-200 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-orange-900 sm:px-3 sm:text-[11px]">
                    Real Mock Test
                  </span>

                  <span className="inline-flex min-h-10 items-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-emerald-800">
                    ⚡ Available to Paid Members
                  </span>
                  {subscribeButton()}
                </div>

                <h3 className="mt-2.5 text-xl font-bold sm:mt-3 sm:text-2xl">
                  Chapter-Based &amp; Full Syllabus tests
                </h3>

                <p className="mt-1 max-w-xl text-sm leading-6 text-slate-700">
                  Choose Chapter-Based to test topics already studied, or Full Syllabus for 60-question numbered papers and retakes.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:max-w-sm">
                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                      Questions
                    </p>

                    <p className="mt-1 text-lg font-extrabold text-slate-900">
                      60
                    </p>
                  </div>

                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                      Time
                    </p>

                    <p className="mt-1 text-lg font-extrabold text-slate-900">
                      60 Min
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  {selectedSubject === ALL ? (
                    <p className="text-xs font-semibold text-orange-800">
                      Select a subject first.
                    </p>
                  ) : (
                    <p
                      className={`text-xs font-semibold ${
                        mockScope === "chapters" || selectedSubjectQuestionCount >=
                        MOCK_QUESTION_COUNT
                          ? "text-emerald-700"
                          : "text-red-700"
                      }`}
                    >
                      {selectedSubjectQuestionCount} active
                      questions available in this subject.
                      {mockScope === "full" && selectedSubjectQuestionCount <
                        MOCK_QUESTION_COUNT &&
                        ` ${MOCK_QUESTION_COUNT} are required for Full Syllabus mode.`}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-4 rounded-xl border border-orange-300 bg-white/80 p-4">
                  <p className="mb-2 text-sm font-extrabold">Choose test type</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" aria-pressed={mockScope === "chapters"} onClick={() => setMockScope("chapters")} className={`min-h-11 rounded-lg border p-2 text-sm font-bold ${mockScope === "chapters" ? "bg-orange-600 text-white" : "bg-white"}`}>📚 Chapter-Based</button>
                    <button type="button" aria-pressed={mockScope === "full"} onClick={() => setMockScope("full")} className={`min-h-11 rounded-lg border p-2 text-sm font-bold ${mockScope === "full" ? "bg-orange-600 text-white" : "bg-white"}`}>🏆 Full Syllabus</button>
                  </div>
                  {mockScope === "chapters" && <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                    <p className="text-xs text-slate-700">Select one or more chapters. Up to 60 random questions; 1 minute per question.</p>
                    {availableChapters.map(ch => <label key={ch.id} className="flex min-h-10 items-center gap-2 rounded-lg border bg-white p-2 text-sm">
                      <input type="checkbox" checked={mockChapterIds.includes(ch.id)} onChange={e => setMockChapterIds(prev => e.target.checked ? [...prev, ch.id] : prev.filter(id => id !== ch.id))} />
                      <span>{ch.chapter_number ? `Chapter ${ch.chapter_number}: ` : ""}{ch.chapter_name}</span>
                    </label>)}
                  </div>}
                </div>
                {mockScope === "full" && selectedSubject !== ALL && numberedMockCount > 0 && (
                  <div className="mb-4 rounded-lg border border-orange-300 bg-white/70 p-3">
                    <label htmlFor="mock-paper-selector" className="mb-2 block text-sm font-bold">
                      Choose a numbered paper or retake
                    </label>
                    <select id="mock-paper-selector" value={selectedMockPaper}
                      onChange={(e) => setSelectedMockPaper(e.target.value)}
                      className="w-full rounded-lg border border-orange-300 bg-white p-3 text-sm">
                      {Array.from({ length: numberedMockCount }, (_, i) => i + 1).map(n => {
                        const record = mockPapers.find(p => p.paper_number === n);
                        return <option key={n} value={String(n)}>
                          {`Mock Test ${n} — ${record?.status === "COMPLETED" ? "Completed" : record ? "In progress" : "Not started"}`}
                        </option>;
                      })}
                      {allNumberedCompleted && <option value="retake">New randomized retake</option>}
                    </select>
                    <p className="mt-2 text-xs text-slate-700">
                      {completedNumberedMocks}/{numberedMockCount} numbered papers completed.
                      Each numbered paper has unique questions. Retakes unlock after completing all numbered papers.
                    </p>
                    {mockPapers.filter(p => p.status === "COMPLETED").map(p => (
                      <p key={p.id} className="mt-1 text-xs text-slate-700">
                        {p.paper_number ? `Paper ${p.paper_number}` : `Retake ${p.retake_number}`} completed
                        {p.quiz_attempt_id ? ` • Attempt ${p.quiz_attempt_id}` : ""}
                      </p>
                    ))}
                  </div>
                )}
                {mockSubmitError && (
                  <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-xs leading-5 text-red-700">
                    {mockSubmitError}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={startMockTest}
                    disabled={mockStarting || mockHistoryLoading || selectedSubject === ALL || (mockScope === "full" ? (!mockCanStart || (selectedMockPaper !== "retake" && selectedMockRecord?.status === "COMPLETED")) : mockChapterIds.length === 0)}
                    className="min-h-12 w-full rounded-lg bg-orange-500 px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {selectedSubject === ALL
                      ? "Select Subject First"
                      : mockScope === "chapters" ? (mockChapterIds.length ? "Start Chapter Mock →" : "Choose Chapters")
                      : selectedSubjectQuestionCount <
                        MOCK_QUESTION_COUNT
                      ? `Need ${MOCK_QUESTION_COUNT} Questions`
                      : mockStarting ? "Preparing paper..."
                      : selectedMockPaper === "retake" ? "Start Randomized Retake →"
                      : `Start Mock Test ${selectedMockPaper} →`}
                  </button>


                </div>
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