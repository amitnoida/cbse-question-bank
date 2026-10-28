-- 28 October 2026: add only missing lookup indexes; no data or RLS policy changes.
-- All seven affected tables were <64 kB at the preflight snapshot.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE INDEX IF NOT EXISTS idx_chapter_mock_papers_subject_id
  ON public.chapter_mock_papers (subject_id);
CREATE INDEX IF NOT EXISTS idx_mock_exam_answers_question_id
  ON public.mock_exam_answers (question_id);
CREATE INDEX IF NOT EXISTS idx_result_email_logs_attempt_id
  ON public.result_email_logs (attempt_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_class_id
  ON public.student_enrollments (class_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_student_id
  ON public.subscription_payments (student_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription_id
  ON public.subscription_payments (subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id
  ON public.subscriptions (plan_id);
COMMIT;
