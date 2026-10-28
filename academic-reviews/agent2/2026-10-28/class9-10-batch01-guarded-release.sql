-- Agent 2 | 2026-10-28 | Class 9/10 Batch 01 | GUARDED RELEASE: NO APPROVED ITEMS
-- Decisions: APPROVE=0; CORRECT_AND_APPROVE=0; HOLD=15; REJECT=0.
-- This release file intentionally contains ZERO SQL data mutations.
-- Agent 5 MUST NOT activate these IDs; all have active equivalent questions.
-- No preconditioned UPDATE is included because there are no approved candidates.
-- IDs on hold: 1600, 8704, 8688, 8692, 8696, 8700, 8708, 8716, 8720, 8728, 1426, 1427, 1428, 1429, 2789.
-- This companion artifact is auditable evidence only; do not interpret as permission to release.
BEGIN TRANSACTION READ ONLY;
SELECT q.id, q.is_active, q.content_review_status, q.updated_at
FROM public.questions q
JOIN public.chapters ch ON ch.id = q.chapter_id
JOIN public.subjects s ON s.id = ch.subject_id
JOIN public.classes c ON c.id = s.class_id
WHERE c.class_number IN (9, 10)
  AND q.id IN (1600, 8704, 8688, 8692, 8696, 8700, 8708, 8716, 8720, 8728, 1426, 1427, 1428, 1429, 2789)
ORDER BY q.id;
COMMIT;
