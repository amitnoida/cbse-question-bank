import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const headers = { "Cache-Control": "private, no-store, max-age=0" };
function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers });
}

type MediaEntry = { src?: string; alt?: string };
type Media = Record<string, MediaEntry | undefined>;
type QuestionRow = {
  id: number; question_text: string; option_a: string; option_b: string;
  option_c: string; option_d: string; explanation: string | null; question_media: Media | null;
};
function mediaText(text: string | null, media: Media | null, slot: string): string {
  const item = media?.[slot];
  if (!item || typeof item.src !== "string") return text || "";
  const local = /^\/question-images\/[A-Za-z0-9/_.-]+\.(?:png|jpe?g|webp|svg)$/i;
  const hosted = /^https:\/\/darfsuqfmmunxqiyqlvn\.supabase\.co\/storage\/v1\/object\/public\/question-images\/[A-Za-z0-9/_.-]+\.(?:png|jpe?g|webp|svg)$/i;
  if (!local.test(item.src) && !hosted.test(item.src)) return text || "";
  const alt = String(item.alt || "Question diagram").slice(0, 200).replace(/[\[\]\r\n]/g, " ");
  return (text || "") + "\n![" + alt + "](" + item.src + ")";
}

/**
 * Only completed, owned MOCK attempts no more than 14 days old are readable.
 * This is a report snapshot endpoint, never a way to view answers for live papers.
 */
export async function GET(req: NextRequest) {
  try {
    const attemptId = Number(req.nextUrl.searchParams.get("attemptId"));
    if (!Number.isSafeInteger(attemptId) || attemptId <= 0) return fail("Invalid report ID", 400);
    const match = req.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i);
    if (!match) return fail("Please sign in to download the report", 401);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anon || !secret) return fail("Reports are temporarily unavailable", 503);
    const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await auth.auth.getUser(match[1]);
    if (authError || !user) return fail("Unauthorized", 401);

    const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: attempt, error: attemptError } = await db.from("quiz_attempts")
      .select("id,student_id,subject_id,quiz_type,status,total_questions,answered_questions,correct_answers,wrong_answers,unanswered_questions,total_marks,obtained_marks,percentage,started_at,submitted_at,time_taken_seconds")
      .eq("id", attemptId).eq("student_id", user.id).maybeSingle();
    if (attemptError) return fail("Unable to retrieve report", 500);
    if (!attempt || String(attempt.quiz_type).toUpperCase() !== "MOCK" || attempt.status !== "COMPLETED") {
      return fail("Completed mock report not found", 404);
    }
    if (!attempt.submitted_at || Date.parse(attempt.submitted_at) < Date.now() - 14 * 86400_000) {
      return fail("The 14-day report download window has ended", 410);
    }

    const [answersResult, profileResult, subjectResult] = await Promise.all([
      db.from("quiz_attempt_answers")
        .select("id,question_id,selected_answer,correct_answer,is_correct,marks_obtained")
        .eq("attempt_id", attemptId).order("id", { ascending: true }).limit(120),
      db.from("student_profiles").select("full_name").eq("id", user.id).maybeSingle(),
      db.from("subjects").select("subject_name").eq("id", attempt.subject_id).maybeSingle(),
    ]);
    if (answersResult.error || profileResult.error || subjectResult.error) {
      return fail("Unable to retrieve complete report", 500);
    }
    const answers = answersResult.data || [];
    if (!answers.length || answers.length !== Number(attempt.total_questions) || answers.length > 120) {
      return fail("Report questions are incomplete; please contact support", 409);
    }
    const questionIds = answers.map(a => a.question_id);
    const { data: questions, error: questionsError } = await db.from("questions")
      .select("id,question_text,option_a,option_b,option_c,option_d,explanation,question_media")
      .in("id", questionIds).limit(120);
    if (questionsError || !questions || questions.length !== answers.length) {
      return fail("Report question content is unavailable", 409);
    }
    const byId = new Map((questions as QuestionRow[]).map(q => [q.id, q]));
    const items = answers.map((a, index) => {
      const q = byId.get(a.question_id);
      if (!q) return null;
      return {
        number: index + 1, id: a.question_id,
        question: mediaText(q.question_text, q.question_media, "question"),
        options: {
          A: mediaText(q.option_a, q.question_media, "A"),
          B: mediaText(q.option_b, q.question_media, "B"),
          C: mediaText(q.option_c, q.question_media, "C"),
          D: mediaText(q.option_d, q.question_media, "D"),
        },
        answer: a.selected_answer, correct: a.correct_answer,
        isCorrect: a.is_correct, obtainedMarks: a.marks_obtained,
        explanation: mediaText(q.explanation, q.question_media, "explanation"),
      };
    });
    if (items.some(q => !q)) return fail("Incomplete mock report", 409);
    return NextResponse.json({
      student: profileResult.data?.full_name || user.email || "Student",
      subject: subjectResult.data?.subject_name || "Subject",
      attempt: {
        id: attempt.id, submittedAt: attempt.submitted_at,
        total: attempt.total_questions, answered: attempt.answered_questions,
        correct: attempt.correct_answers, wrong: attempt.wrong_answers,
        unanswered: attempt.unanswered_questions, totalMarks: attempt.total_marks,
        obtainedMarks: attempt.obtained_marks, percentage: attempt.percentage,
        durationSeconds: attempt.time_taken_seconds,
      },
      items,
    }, { headers });
  } catch {
    return fail("Report unavailable", 500);
  }
}
