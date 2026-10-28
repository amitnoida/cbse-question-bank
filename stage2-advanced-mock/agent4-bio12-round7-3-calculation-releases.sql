-- Agent4 Biology round7: 3 independently calculated application MCQs, user standing approved.
-- Do not alter questions or other agent's subject IDs. No per-batch browser tests.
BEGIN;
CREATE TABLE IF NOT EXISTS cbse_import.advanced_mock_agent4_bio12_review_round7_20261028(
 source_question_id bigint PRIMARY KEY,expected_answer text NOT NULL CHECK(expected_answer IN('A','B','C','D')),
 reasoning_note text NOT NULL,
 review_type text NOT NULL DEFAULT 'AI_ASSISTED_INDIVIDUAL_CALCULATION',
 human_certified boolean NOT NULL DEFAULT FALSE CHECK(human_certified=false),
 recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cbse_import.advanced_mock_agent4_bio12_review_round7_20261028 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cbse_import.advanced_mock_agent4_bio12_review_round7_20261028 FROM PUBLIC,anon,authenticated;
DO $$
DECLARE eligible integer;affected integer;
BEGIN
 WITH v AS (SELECT * FROM (VALUES
(30337::bigint,'B'::text,'The 5′ coding DNA strand 5′-ATG GAA TTT-3′ gives mRNA 5′-AUG GAA UUU-3′ after T-to-U substitution; checked against distractor complement strands.'::text),
(30219::bigint,'B'::text,'AaBb x aabb under independent assortment: AaBb gametes AB, Ab, aB, ab each 1/4; tester always ab, so aabb offspring probability 1/4.'::text),
(31015::bigint,'C'::text,'For dN/dt=rN(1-N/K) with positive constants, the concave quadratic peaks at N=K/2, not at carrying capacity.'::text)
 ) x(id,answer,note))
 SELECT COUNT(*) INTO eligible
 FROM v JOIN public.questions q ON q.id=v.id AND q.correct_option::text=v.answer
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=v.id
 JOIN public.chapters ch ON ch.id=c.destination_chapter_id
 JOIN public.subjects s ON s.id=ch.subject_id
 JOIN public.classes cl ON cl.id=s.class_id
 WHERE c.destination_subject_id=20 AND s.id=20 AND cl.class_name='Class 12'
 AND ch.is_active AND s.is_active AND NOT c.release_approved AND NOT q.is_active
 AND c.source_media_ready AND q.media_ready AND NOT c.media_blocked AND NOT c.answer_issue
 AND NOT c.duplicate_candidate AND c.source_content_review_status<>'HOLD'
 AND coalesce(q.question_media,'{}'::jsonb)='{}'::jsonb AND q.question_text !~* '\m(jee|neet|iit)\M';
 IF eligible<>3 THEN RAISE EXCEPTION 'Expected 3 eligible Biology application questions, got %',eligible; END IF;

 INSERT INTO cbse_import.advanced_mock_agent4_bio12_review_round7_20261028
 (source_question_id,expected_answer,reasoning_note)
 SELECT id,answer,note FROM (VALUES
(30337::bigint,'B'::text,'The 5′ coding DNA strand 5′-ATG GAA TTT-3′ gives mRNA 5′-AUG GAA UUU-3′ after T-to-U substitution; checked against distractor complement strands.'::text),
(30219::bigint,'B'::text,'AaBb x aabb under independent assortment: AaBb gametes AB, Ab, aB, ab each 1/4; tester always ab, so aabb offspring probability 1/4.'::text),
(31015::bigint,'C'::text,'For dN/dt=rN(1-N/K) with positive constants, the concave quadratic peaks at N=K/2, not at carrying capacity.'::text)
 ) x(id,answer,note);

 UPDATE cbse_import.advanced_mock_stage2_candidates_20261028 c
 SET academic_verified=true,answer_verified=true,duplicate_cleared=true,media_verified=true,
 reviewed_at=clock_timestamp(),
 reviewer_note='Agent4 round7, AI-assisted independently solved Class12 Biology application question; Class12 CBSE 2026-27, answer and distractor checked; no human certification.',
 release_approved=true
 FROM cbse_import.advanced_mock_agent4_bio12_review_round7_20261028 r
 JOIN public.questions q ON q.id=r.source_question_id
 WHERE c.source_question_id=r.source_question_id AND c.destination_subject_id=20
 AND NOT c.release_approved AND NOT q.is_active
 AND r.expected_answer=q.correct_option::text AND q.media_ready AND c.source_media_ready
 AND NOT c.duplicate_candidate AND NOT c.media_blocked AND NOT c.answer_issue
 AND c.source_content_review_status<>'HOLD'
 AND coalesce(q.question_media,'{}'::jsonb)='{}'::jsonb;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>3 THEN RAISE EXCEPTION 'Expected release of exactly three, got %; rolled back',affected; END IF;
END $$;
COMMIT;