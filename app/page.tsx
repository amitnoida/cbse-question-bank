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
  const [practiceCount, setPracticeCount] = useState(5);
  const [practiceQuestions, setPracticeQuestions] = useState<
    MCQ[]
  >([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceAnswers, setPracticeAnswers] = useState<
    Record<number, string>
  >({});
  const [practiceSubmitted, setPracticeSubmitted] =
    useState(false);
  const [practiceSubmitting, setPracticeSubmitting] =
    useState(false);
  const [practiceSubmitError, setPracticeSubmitError] =
    useState("");

  /* =========================
     REAL MOCK TEST
  ========================= */

  const [mockMode, setMockMode] = useState(false);
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
    setCouponMessage(`${discount}% discount applied successfully.`);
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

    const { data, error: activationError } =
      await supabase.rpc(
        "activate_paid_membership_with_coupon",
        {
          p_coupon_code: couponCode.trim().toUpperCase(),
        }
      );

    if (activationError) {
      console.error("Membership activation error:", activationError);
      setCouponMessage(
        activationError.message ||
          "Unable to activate membership. Please try again."
      );
      setCouponLoading(false);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result?.success) {
      setCouponMessage(
        result?.message ||
          "Unable to activate membership. Please try again."
      );
      setCouponLoading(false);
      return;
    }

    setIsPaidMember(true);
    setShowSubscribeModal(false);
    setCouponLoading(false);
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
     LOAD PUBLIC CLASSES
  ========================= */

  async function loadClasses(): Promise<ClassRow[]> {
    const { data, error: classError } = await supabase
      .from("classes")
      .select("id,class_name,is_active")
      .eq("is_active", true)
      .order("id");

    if (classError) {
      setError(classError.message);
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

  async function loadPaidMembership(userId: string) {
    const { data, error: subscriptionError } =
      await supabase
        .from("subscriptions")
        .select("id,status,start_date,end_date")
        .eq("student_id", userId)
        .eq("status", "Active")
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (subscriptionError) {
      console.error("Subscription lookup error:", subscriptionError);
      setIsPaidMember(false);
      return;
    }

    setIsPaidMember(
      !!data &&
        (!data.end_date || new Date(data.end_date).getTime() >= Date.now())
    );
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

  async function loadQuestionData(
    classRowsOverride?: ClassRow[]
  ) {
    setLoading(true);
    setError("");

    const [
      classResult,
      subjectResult,
      chapterResult,
      questionResult,
    ] = await Promise.all([
      supabase
        .from("classes")
        .select("id,class_name,is_active")
        .eq("is_active", true)
        .order("id"),

      supabase
        .from("subjects")
        .select(
          "id,class_id,subject_name,is_active"
        )
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
      classResult.error ||
      subjectResult.error ||
      chapterResult.error ||
      questionResult.error;

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const classRows =
      classRowsOverride ||
      ((classResult.data || []) as ClassRow[]);

    const subjectRows =
      (subjectResult.data || []) as SubjectRow[];

    const chapterRows =
      (chapterResult.data || []) as ChapterRow[];

    const questionRows =
      (questionResult.data || []) as QuestionRow[];

    setClasses(classRows);

    const classMap = new Map(
      classRows.map((item) => [item.id, item])
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

      const classRows = await loadClasses();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (session?.user) {
        setCurrentUser(session.user);

        await loadStudentProfile(
          session.user.id,
          session.user
        );

        await loadFreeUsage(
          session.user.id
        );

        await loadPaidMembership(session.user.id);

        if (mounted) {
          await loadQuestionData(classRows);
        }
      } else {
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

          await loadStudentProfile(
            session.user.id,
            session.user
          );

          await loadFreeUsage(
            session.user.id
          );

          await loadPaidMembership(session.user.id);

          if (mounted) {
            await loadQuestionData();
          }
        } else {
          setCurrentUser(null);
          setStudentProfile(null);
          setFreeUsage({});
          setQuestions([]);
          setSubjects([]);
          setChapters([]);
          setSelectedClass(ALL);
          setSelectedSubject(ALL);
          setSelectedChapter(ALL);
          setLoading(false);

          setPracticeMode(false);
          setMockMode(false);
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

    return rows.filter((c) => {
      const key = c.chapter_name
        .trim()
        .toLowerCase();

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

  const mockCanStart =
    selectedSubject !== ALL &&
    selectedSubjectQuestionCount >=
      MOCK_QUESTION_COUNT;

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

  const practiceOptions = useMemo(() => {
    const count =
      availablePracticeQuestions.length;

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
  }, [availablePracticeQuestions.length]);

  useEffect(() => {
    const availableCount =
      availablePracticeQuestions.length;

    if (availableCount === 0) {
      return;
    }

    if (practiceCount > availableCount) {
      setPracticeCount(availableCount);
    }
  }, [
    availablePracticeQuestions.length,
    practiceCount,
  ]);

  useEffect(() => {
    if (!practiceOptions.length) {
      return;
    }

    if (!practiceOptions.includes(practiceCount)) {
      setPracticeCount(
        practiceOptions[
          practiceOptions.length - 1
        ]
      );
    }
  }, [practiceOptions, practiceCount]);

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
  }

  function handleSubjectChange(value: string) {
    setSelectedSubject(value);
    setSelectedChapter(ALL);
  }

  function clearFilters() {
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

  function startPracticeTest() {
    setPracticeSubmitError("");

    if (!currentUser) {
      return;
    }

    if (selectedSubject === ALL) {
      setPracticeSubmitError(
        "Please select a subject before starting the Practice Paper."
      );
      return;
    }

    if (freeUsageLoading && !isPaidMember) {
      return;
    }

    const eligibleQuestions = isPaidMember
      ? shuffleQuestions(filteredQuestions)
      : freeAvailableQuestions;

    if (eligibleQuestions.length === 0) {
      setPracticeSubmitError(
        isPaidMember
          ? "No questions are currently available for this subject."
          : "No free questions remain for this subject."
      );
      return;
    }

    const selectedCount = Math.min(
      practiceCount,
      eligibleQuestions.length
    );

    if (selectedCount <= 0) {
      setPracticeSubmitError(
        "Please select at least one question."
      );
      return;
    }

    setPracticeQuestions(
      eligibleQuestions.slice(
        0,
        selectedCount
      )
    );

    setPracticeIndex(0);
    setPracticeAnswers({});
    setPracticeSubmitted(false);
    setPracticeSubmitting(false);
    setPracticeSubmitError("");
    setPracticeMode(true);
    setMockMode(false);
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
  async function submitPracticeTest() {
    if (!currentUser) {
      setPracticeSubmitError(
        "Your session has expired. Please sign in again."
      );
      return;
    }

    if (
      practiceSubmitting ||
      practiceSubmitted
    ) {
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
      if (isPaidMember) {
        setPracticeSubmitted(true);
        return;
      }

      for (const question of practiceQuestions) {
        const { error: usageError } =
          await supabase.rpc(
            "record_free_question_usage",
            {
              p_student_id:
                currentUser.id,
              p_subject_id:
                question.subjectId,
              p_chapter_id:
                question.chapter_id,
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

      await loadFreeUsage(
        currentUser.id
      );

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
    setPracticeSubmitted(false);
    setPracticeSubmitting(false);
    setPracticeSubmitError("");
    setPracticeQuestions([]);
    setPracticeAnswers({});
    setPracticeIndex(0);
  }

  /* =========================
     REAL MOCK TEST
  ========================= */

  function startMockTest() {
    setMockSubmitError("");

    if (!currentUser) {
      return;
    }

    if (!isPaidMember) {
      openSubscribe();
      return;
    }

    if (selectedSubject === ALL) {
      setMockSubmitError(
        "Please select a subject before starting the Real Mock Test."
      );
      return;
    }

    if (
      selectedSubjectQuestionCount <
      MOCK_QUESTION_COUNT
    ) {
      setMockSubmitError(
        `This subject currently has only ${selectedSubjectQuestionCount} active questions. At least ${MOCK_QUESTION_COUNT} questions are required for the Real Mock Test.`
      );
      return;
    }

    /*
     * Real Mock Test uses the COMPLETE selected subject.
     *
     * Chapter filter is intentionally ignored.
     *
     * Every new attempt shuffles the complete subject
     * question pool and selects exactly 60.
     */
    const randomizedQuestions =
      shuffleQuestions(
        selectedSubjectQuestions
      ).slice(0, MOCK_QUESTION_COUNT);

    if (
      randomizedQuestions.length !==
      MOCK_QUESTION_COUNT
    ) {
      setMockSubmitError(
        "Unable to prepare the 60-question mock test. Please try again."
      );
      return;
    }

    setMockQuestions(randomizedQuestions);
    setMockIndex(0);
    setMockAnswers({});
    setMockSubmitted(false);
    setMockSubmitting(false);
    setMockSubmitError("");
    setMockTimeLeft(
      MOCK_DURATION_SECONDS
    );

    setPracticeMode(false);
    setMockMode(true);
  }

  async function submitMockTest(
    automaticSubmit = false
  ) {
    if (mockSubmitted || mockSubmitting) {
      return;
    }

    if (mockQuestions.length !== MOCK_QUESTION_COUNT) {
      setMockSubmitError(
        "There are no valid mock questions to submit."
      );
      return;
    }

    setMockSubmitting(true);
    setMockSubmitError("");

    /*
     * Real Mock Test does not consume the 10-question
     * free-trial allowance.
     *
     * It is a separate 60-question mock-test system.
     */
    setMockSubmitted(true);
    setMockSubmitting(false);

    if (automaticSubmit) {
      setMockTimeLeft(0);
    }
  }

  function exitMockTest() {
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

    setCurrentUser(data.user);

    await loadStudentProfile(
      data.user.id,
      data.user
    );

    await loadFreeUsage(
      data.user.id
    );

    await loadPaidMembership(data.user.id);

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

  /* =========================
     PUBLIC HOME PAGE
  ========================= */

  if (!currentUser) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-slate-50">
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
                      setSignupFullName(
                        e.target.value
                      )
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
                      setSignupEmail(
                        e.target.value
                      )
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
                      setSignupPassword(
                        e.target.value
                      )
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
                      setSignupConfirmPassword(
                        e.target.value
                      )
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
                      setSignupClassId(
                        e.target.value
                      )
                    }
                    disabled={signupLoading}
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-100"
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
                      setSigninEmail(
                        e.target.value
                      )
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
                      setSigninPassword(
                        e.target.value
                      )
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
                Practice questions organized by subject
                and chapter.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg font-bold text-blue-700">
                02
              </div>

              <h3 className="mt-4 text-lg font-bold text-slate-950">
                Focused Practice
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Select your subject and chapter to build
                a focused practice session.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg font-bold text-blue-700">
                03
              </div>

              <h3 className="mt-4 text-lg font-bold text-slate-950">
                Real Mock Test
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Attempt a randomized 60-question,
                60-minute subject mock test.
              </p>
            </div>
          </div>
        </section>

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
            Check your Supabase URL/key and make sure
            the tables allow SELECT access.
          </p>
        </div>
      </main>
    );
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
                  Your 60-question mock test has been completed.
                </p>
              </div>

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

              <div className="mt-7 space-y-4 sm:mt-9">
                {mockQuestions.map(
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

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <p className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600">
                            Your answer:{" "}
                            <strong className="text-slate-900">
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
                60 Questions
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
              {mockSubmitError}
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
                  submitMockTest(false)
                }
                className="min-h-11 rounded-lg bg-emerald-700 px-3 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
              >
                {mockSubmitting
                  ? "Submitting..."
                  : "Submit Mock Test"}
              </button>
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
                {practiceQuestions.map(
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

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <p className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600">
                            Your answer:{" "}
                            <strong className="text-slate-900">
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
              {practiceSubmitError}
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
                    practiceAnswers[
                      current.id
                    ] === letter;

                  return (
                    <button
                      key={letter}
                      onClick={() =>
                        setPracticeAnswers(
                          (prev) => ({
                            ...prev,
                            [current.id]:
                              letter,
                          })
                        )
                      }
                      disabled={practiceSubmitting}
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

          <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-5">
            <button
              disabled={
                practiceIndex === 0 ||
                practiceSubmitting
              }
              onClick={() =>
                setPracticeIndex(
                  (p) => p - 1
                )
              }
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
            >
              ← Previous
            </button>

            {practiceIndex <
            practiceQuestions.length - 1 ? (
              <button
                disabled={practiceSubmitting}
                onClick={() =>
                  setPracticeIndex(
                    (p) => p + 1
                  )
                }
                className="min-h-11 rounded-lg bg-blue-700 px-3 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
              >
                Next →
              </button>
            ) : (
              <button
                disabled={practiceSubmitting}
                onClick={submitPracticeTest}
                className="min-h-11 rounded-lg bg-emerald-700 px-3 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
              >
                {practiceSubmitting
                  ? "Submitting..."
                  : "Submit Test"}
              </button>
            )}
          </div>
        </section>
      </main>
    );
  }

  /* =========================
     MAIN AUTHENTICATED PAGE
  ========================= */

  return (
    <>
      {showSubscribeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
            <button
              type="button"
              onClick={closeSubscribe}
              disabled={couponLoading}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-lg font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
              aria-label="Close subscription"
            >
              ×
            </button>

            <div className="pr-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
                Annual Membership
              </p>

              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                Annual Paid Plan
              </h2>

              <p className="mt-1.5 text-sm leading-5 text-slate-500">
                Get access to paid practice questions and the Real Mock Test.
              </p>
            </div>

            <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-800">
                    Annual Plan
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
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm font-semibold uppercase text-slate-900 outline-none placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-100"
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
                ? "Activate Annual Membership"
                : "Payment / Activate"}
            </button>

            <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">
              Payment gateway will be connected after this coupon and pricing test is verified.
            </p>
          </div>
        </div>
      )}

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
              {enrolledClass
                ? enrolledClass.class_name
                : "Student Dashboard"}
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
              Your{" "}
              {enrolledClass?.class_name ||
                "enrolled class"}{" "}
              is locked to your account. Practice MCQ
              questions by subject and chapter, or take
              a 60-question Real Mock Test.
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
                onChange={(e) =>
                  setSelectedChapter(
                    e.target.value
                  )
                }
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

          {/* FREE TRIAL STATUS */}
          {selectedSubjectObject ? (
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
          ) : (
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
                <span className="inline-flex rounded-md border border-blue-700 bg-blue-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-blue-100 sm:px-3 sm:text-[11px]">
                  Practice Paper
                </span>

                <h3 className="mt-2.5 text-xl font-bold sm:mt-3 sm:text-2xl">
                  Practice Test
                </h3>

                <p className="mt-1 max-w-xl text-sm leading-6 text-blue-100">
                  Select a subject and optionally a
                  chapter. Choose how many questions
                  you want to practice.
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
                <select
                  value={practiceCount}
                  onChange={(e) =>
                    setPracticeCount(
                      Number(e.target.value)
                    )
                  }
                  disabled={
                    selectedSubject === ALL ||
                    !availablePracticeQuestions.length ||
                    (!isPaidMember && freeUsageLoading)
                  }
                  className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-white/40 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-11 sm:w-auto"
                >
                  {practiceOptions.map(
                    (count) => (
                      <option
                        key={count}
                        value={count}
                      >
                        {count ===
                        availablePracticeQuestions.length
                          ? `All ${count} Questions`
                          : `${count} Questions`}
                      </option>
                    )
                  )}
                </select>

                <button
                  type="button"
                  onClick={openSubscribe}
                  disabled={isPaidMember}
                  className="min-h-12 w-full rounded-lg border border-white/70 bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/20 disabled:cursor-default disabled:opacity-100 sm:min-h-11 sm:w-auto"
                >
                  {isPaidMember ? "Membership Active" : "Subscribe ₹99"}
                </button>

                <button
                  onClick={startPracticeTest}
                  disabled={
                    selectedSubject === ALL ||
                    !availablePracticeQuestions.length ||
                    (!isPaidMember && freeUsageLoading)
                  }
                  className="min-h-12 w-full rounded-lg bg-white px-5 py-3 text-sm font-bold text-blue-900 shadow-sm hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-11 sm:w-auto"
                >
                  {selectedSubject === ALL
                    ? "Select Subject First"
                    : (!isPaidMember && freeUsageLoading)
                    ? "Checking Free Usage..."
                    : "Start Practice Paper →"}
                </button>
              </div>
            </div>
          </div>

          {/* REAL MOCK TEST */}
          <div className="rounded-2xl border border-orange-300 bg-orange-100 p-4 text-slate-900 shadow-sm sm:p-7">
            <div className="flex h-full flex-col justify-between gap-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-md border border-orange-300 bg-orange-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-orange-900 sm:px-3 sm:text-[11px]">
                    Real Mock Test
                  </span>

                  <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">
                    ⚡ Available to Paid Members
                  </span>
                </div>

                <h3 className="mt-2.5 text-xl font-bold sm:mt-3 sm:text-2xl">
                  60 Questions • 60 Minutes
                </h3>

                <p className="mt-1 max-w-xl text-sm leading-6 text-slate-700">
                  Select a subject with at least 60 active
                  MCQs. Every new attempt randomly selects
                  60 questions from the complete subject.
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
                        selectedSubjectQuestionCount >=
                        MOCK_QUESTION_COUNT
                          ? "text-emerald-700"
                          : "text-red-700"
                      }`}
                    >
                      {selectedSubjectQuestionCount} active
                      questions available in this subject.
                      {selectedSubjectQuestionCount <
                        MOCK_QUESTION_COUNT &&
                        ` ${MOCK_QUESTION_COUNT} are required.`}
                    </p>
                  )}
                </div>
              </div>

              <div>
                {mockSubmitError && (
                  <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-xs leading-5 text-red-700">
                    {mockSubmitError}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={startMockTest}
                    disabled={!mockCanStart}
                    className="min-h-12 w-full rounded-lg bg-orange-500 px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {selectedSubject === ALL
                      ? "Select Subject First"
                      : selectedSubjectQuestionCount <
                        MOCK_QUESTION_COUNT
                      ? `Need ${MOCK_QUESTION_COUNT} Questions`
                      : "Start Real Mock Test →"}
                  </button>

                  <button
                    type="button"
                    onClick={openSubscribe}
                    className="min-h-12 w-full rounded-lg border border-orange-400 bg-white/70 px-5 py-3 text-sm font-extrabold text-orange-900 hover:bg-white"
                  >
                    Subscribe ₹99
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