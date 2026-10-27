-- CBSE Question Bank: resumed Stage 1 from the interrupted Work import, 27 Oct 2026.
-- APPLIED to production in controlled batches. Archive for audit/restore; no need to re-run.
-- IMPORTANT: Remaining CSV rows are NOT in cbse_import.master_rows. Do not mark batch COMPLETE until staged.
-- Restaging must verify SHA256 e5ddf80c7d1085dca679e7bac58cf10b95ee6e1d6e004605dcc8ee8e1ffd3ec6.
-- This SQL assumes the pre-existing cbse_import schema, staged payload positional JSON arrays,
-- prior question_usage/content_review_status/media_ready/import_key columns, and all class/chapter IDs.
BEGIN;

CREATE TABLE IF NOT EXISTS cbse_import.question_classifications_before_cutover_20261027 AS
SELECT q.id,q.question_usage,q.content_review_status,q.is_active,q.updated_at
FROM public.questions q WITH NO DATA;
INSERT INTO cbse_import.question_classifications_before_cutover_20261027
SELECT q.id,q.question_usage,q.content_review_status,q.is_active,q.updated_at
FROM public.questions q
WHERE NOT EXISTS (SELECT 1 FROM cbse_import.question_classifications_before_cutover_20261027 b WHERE b.id=q.id);

UPDATE public.questions q SET question_usage=r.payload->>3, updated_at=now()
FROM cbse_import.master_rows r WHERE r.source_key='DB-'||q.id::text
AND r.payload->>3 IN ('PRACTICE','MOCK','SHARED')
AND q.question_usage IS DISTINCT FROM r.payload->>3;

-- Inactive by construction, review-gated. Embedded images remain in staging
-- until they can be uploaded to approved public question-image storage.
INSERT INTO public.questions
(chapter_id,question_text,option_a,option_b,option_c,option_d,correct_option,
 explanation,difficulty,marks,question_type,is_active,question_media,question_usage,
 content_review_status,media_ready,import_key)
SELECT (p->>2)::bigint,p->>5,p->>6,p->>7,p->>8,p->>9,(p->>10)::char(1),
p->>11,p->>12,(p->>13)::numeric,'MCQ',false,
CASE WHEN jsonb_typeof(p->15)='object' AND octet_length((p->15)::text)<=12000
 THEN p->15 ELSE '{}'::jsonb END,
p->>3,CASE WHEN p->>4='HOLD_PREVIOUSLY_EXCLUDED' THEN 'HOLD' ELSE 'PENDING_REVIEW' END,
(p->>16='NO_PACKAGED_ASSET'),source_key
FROM (SELECT r.source_key,r.payload p FROM cbse_import.master_rows r
WHERE r.source_key LIKE 'MCQ-MERGED-%'
AND r.payload->>3 IN ('PRACTICE','MOCK','SHARED')
AND r.payload->>10 IN ('A','B','C','D')
AND r.payload->>12 IN ('Easy','Medium','Hard')
AND r.payload->>4 IN ('REQUIRES_ACADEMIC_REVIEW','HOLD_PREVIOUSLY_EXCLUDED')) pending
ON CONFLICT (import_key) DO NOTHING;

UPDATE cbse_import.master_rows r SET question_id=q.id,
disposition=CASE WHEN q.content_review_status='HOLD' THEN 'HOLD_QUARANTINED' ELSE 'INSERTED_INACTIVE' END
FROM public.questions q
WHERE r.source_key=q.import_key AND r.source_key LIKE 'MCQ-MERGED-%'
AND r.question_id IS DISTINCT FROM q.id;
UPDATE cbse_import.master_rows r SET question_id=q.id,disposition='PRESERVED_CLASSIFIED'
FROM public.questions q WHERE r.source_key='DB-'||q.id::text
AND r.question_id IS DISTINCT FROM q.id;

INSERT INTO public.mock_question_coverage(student_id,subject_id,question_id)
SELECT DISTINCT mp.student_id,mp.subject_id,x.question_id
FROM public.mock_papers mp CROSS JOIN LATERAL unnest(mp.question_ids) AS x(question_id)
WHERE x.question_id IS NOT NULL
ON CONFLICT (student_id,subject_id,question_id) DO NOTHING;

DO $guard$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint
 WHERE conrelid='public.questions'::regclass AND conname='questions_review_gate_active') THEN
  ALTER TABLE public.questions ADD CONSTRAINT questions_review_gate_active
  CHECK (NOT is_active OR (media_ready AND content_review_status IN ('APPROVED','LEGACY')));
 END IF;
END $guard$;

-- DB function: cbse_assigned_mock_questions_v2
CREATE OR REPLACE FUNCTION public.cbse_assigned_mock_questions_v2(p_paper_id uuid)
 RETURNS TABLE(id bigint, chapter_id bigint, question_text text, option_a text, option_b text, option_c text, option_d text, correct_option text, explanation text, difficulty text, marks numeric, question_type text, is_active boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_active_student() THEN
  RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.mock_papers p WHERE p.id=p_paper_id AND p.student_id=auth.uid()
  AND (p.status='STARTED' OR (p.status='COMPLETED' AND p.completed_at>=now()-interval '14 days'))
 ) THEN RAISE EXCEPTION 'Assigned mock unavailable' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 SELECT q.id,q.chapter_id,
 public.cbse_media_text_v1(q.question_text,q.question_media,'question'),
 public.cbse_media_text_v1(q.option_a,q.question_media,'A'),
 public.cbse_media_text_v1(q.option_b,q.question_media,'B'),
 public.cbse_media_text_v1(q.option_c,q.question_media,'C'),
 public.cbse_media_text_v1(q.option_d,q.question_media,'D'),
 ''::text,NULL::text,q.difficulty,q.marks,q.question_type,true
 FROM public.mock_papers p
 CROSS JOIN LATERAL unnest(p.question_ids) WITH ORDINALITY AS x(id,ord)
 JOIN public.questions q ON q.id=x.id
 WHERE p.id=p_paper_id AND p.student_id=auth.uid()
 ORDER BY x.ord;
END;
$function$
;

-- DB function: cbse_chapter_counts_v1
CREATE OR REPLACE FUNCTION public.cbse_chapter_counts_v1(p_subject_id bigint)
 RETURNS TABLE(chapter_id bigint, question_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.subjects sub
    JOIN public.student_profiles sp ON sp.class_id=sub.class_id
    WHERE sub.id=p_subject_id AND sub.is_active AND sp.id=auth.uid()) THEN
   RAISE EXCEPTION 'Subject unavailable' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 SELECT c.id,count(q.id)::bigint FROM public.chapters c
 LEFT JOIN public.questions q ON q.chapter_id=c.id AND q.is_active AND q.media_ready AND q.content_review_status<>'HOLD' AND q.question_usage IN ('PRACTICE','SHARED') AND q.question_type='MCQ'
 WHERE c.subject_id=p_subject_id AND c.is_active GROUP BY c.id ORDER BY c.id;
END;
$function$
;

-- DB function: cbse_mock_pool_counts_v2
CREATE OR REPLACE FUNCTION public.cbse_mock_pool_counts_v2(p_subject_id bigint)
 RETURNS TABLE(mock_count bigint, shared_count bigint, numbered_paper_capacity bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_active_student() THEN
  RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.student_profiles sp JOIN public.subjects s ON s.class_id=sp.class_id
  WHERE sp.id=auth.uid() AND s.id=p_subject_id AND s.is_active
 ) THEN RAISE EXCEPTION 'Subject unavailable' USING ERRCODE='42501'; END IF;
 RETURN QUERY WITH counts AS (
 SELECT count(*) FILTER(WHERE q.question_usage='MOCK')::bigint a,
 count(*) FILTER(WHERE q.question_usage='SHARED')::bigint b
 FROM public.questions q JOIN public.chapters c ON c.id=q.chapter_id
 WHERE c.subject_id=p_subject_id AND c.is_active AND q.is_active
 AND q.media_ready AND q.content_review_status<>'HOLD' AND q.question_type='MCQ'
 ) SELECT a,b,CASE WHEN a>=48 AND b>=12 THEN (a+b)/60 ELSE 0 END FROM counts;
END;
$function$
;

-- DB function: cbse_start_practice_v1
CREATE OR REPLACE FUNCTION public.cbse_start_practice_v1(p_subject_id bigint, p_chapter_id bigint, p_set_number integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_student uuid := auth.uid(); v_paid boolean; v_used integer := 0;
 v_session public.practice_sessions%ROWTYPE; v_ids bigint[]; v_page integer;
BEGIN
 IF v_student IS NULL OR NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF p_set_number IS NULL OR p_set_number<1 OR p_set_number>10000 THEN
   RAISE EXCEPTION 'Invalid set number'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.subjects s JOIN public.student_profiles sp ON sp.class_id=s.class_id
   WHERE s.id=p_subject_id AND sp.id=v_student AND s.is_active
 ) THEN RAISE EXCEPTION 'Subject unavailable' USING ERRCODE='42501'; END IF;
 IF p_chapter_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.chapters c WHERE c.id=p_chapter_id AND c.subject_id=p_subject_id AND c.is_active
 ) THEN RAISE EXCEPTION 'Chapter does not belong to subject'; END IF;
 -- Shared with the finalizer: serialize starts and free-usage charges.
 PERFORM pg_advisory_xact_lock(hashtextextended(v_student::text||':'||p_subject_id::text,0));
 v_paid := public.cbse_is_paid_for_subject_v1(v_student);
 IF NOT v_paid THEN
   SELECT coalesce(f.questions_used,0) INTO v_used FROM public.free_usage f
   WHERE f.student_id=v_student AND f.subject_id=p_subject_id FOR UPDATE;
   v_used := coalesce(v_used,0);
   IF v_used>=10 THEN RAISE EXCEPTION 'Free question limit reached'; END IF;
   IF EXISTS (SELECT 1 FROM public.practice_sessions ps
     WHERE ps.student_id=v_student AND ps.subject_id=p_subject_id
       AND ps.status='IN_PROGRESS'
       AND (ps.set_number<>p_set_number OR ps.chapter_id IS DISTINCT FROM p_chapter_id))
   THEN RAISE EXCEPTION 'Finish your existing practice session first'; END IF;
 END IF;
 SELECT * INTO v_session FROM public.practice_sessions ps
 WHERE ps.student_id=v_student AND ps.subject_id=p_subject_id
 AND ps.set_number=p_set_number AND ps.status='IN_PROGRESS'
 AND ps.chapter_id IS NOT DISTINCT FROM p_chapter_id
 ORDER BY ps.created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
   IF NOT v_paid AND cardinality(v_session.question_ids)>10-v_used THEN
     RAISE EXCEPTION 'Existing free session exceeds remaining allowance'; END IF;
   RETURN to_jsonb(v_session);
 END IF;
 IF NOT v_paid AND p_set_number<>1 THEN RAISE EXCEPTION 'Free question limit reached'; END IF;
 v_page := (p_set_number-1)*60;
 IF v_paid THEN
   SELECT array_agg(id ORDER BY id) INTO v_ids FROM (
     SELECT q.id FROM public.questions q JOIN public.chapters c ON c.id=q.chapter_id
     WHERE c.subject_id=p_subject_id AND c.is_active AND q.is_active AND q.media_ready AND q.content_review_status<>'HOLD' AND q.question_usage IN ('PRACTICE','SHARED') AND q.question_type='MCQ'
     AND (p_chapter_id IS NULL OR q.chapter_id=p_chapter_id)
     ORDER BY q.id
     OFFSET (CASE WHEN p_chapter_id IS NULL THEN v_page ELSE 0 END)
     LIMIT (CASE WHEN p_chapter_id IS NULL THEN 60 ELSE NULL END)
   ) chosen;
 ELSE
   -- Allocate from the chapter the student actually selected. No bodies are
   -- exposed beforehand and a free student may have only one open subject session.
   -- Charge the immutable assignment at completion (even for skipped questions).
   SELECT array_agg(id ORDER BY id) INTO v_ids FROM (
     SELECT q.id FROM public.questions q JOIN public.chapters c ON c.id=q.chapter_id
     WHERE c.subject_id=p_subject_id AND c.is_active AND q.is_active AND q.media_ready AND q.content_review_status<>'HOLD' AND q.question_usage IN ('PRACTICE','SHARED') AND q.question_type='MCQ'
       AND (p_chapter_id IS NULL OR q.chapter_id=p_chapter_id)
       AND NOT EXISTS (SELECT 1 FROM public.practice_question_usage used_question
         WHERE used_question.student_id=v_student AND used_question.subject_id=p_subject_id
           AND used_question.question_id=q.id)
       AND NOT EXISTS (SELECT 1 FROM public.practice_sessions completed_session
         WHERE completed_session.student_id=v_student
           AND completed_session.subject_id=p_subject_id
           AND completed_session.status='COMPLETED'
           AND q.id=ANY(completed_session.question_ids))
     ORDER BY q.id LIMIT (10-v_used)
   ) chosen;
 END IF;
 IF coalesce(cardinality(v_ids),0)=0 THEN RAISE EXCEPTION 'No eligible questions in this set'; END IF;
 INSERT INTO public.practice_sessions(student_id,subject_id,chapter_id,set_number,question_ids,answers,current_index,status)
 VALUES(v_student,p_subject_id,p_chapter_id,p_set_number,v_ids,'{}'::jsonb,0,'IN_PROGRESS')
 RETURNING * INTO v_session;
 RETURN to_jsonb(v_session);
END;
$function$
;

-- DB function: start_next_mock_paper_v2
CREATE OR REPLACE FUNCTION public.start_next_mock_paper_v2(p_subject_id bigint)
 RETURNS mock_papers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_user uuid:=auth.uid();
 v_existing public.mock_papers;
 v_result public.mock_papers;
 v_number integer;
 v_max_number integer;
 v_total integer;
 v_mock_count integer;
 v_shared_count integer;
 v_mock bigint[];
 v_shared bigint[];
 v_selected bigint[];
 v_retake integer;
BEGIN
 IF v_user IS NULL OR NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501';
 END IF;
 IF NOT public.cbse_is_paid_for_subject_v1(v_user) THEN
   RAISE EXCEPTION 'Active paid membership required' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.subjects s
   JOIN public.student_profiles sp ON sp.class_id=s.class_id
   WHERE s.id=p_subject_id AND s.is_active AND sp.id=v_user
 ) THEN RAISE EXCEPTION 'Subject unavailable for enrolled class' USING ERRCODE='42501'; END IF;

 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':mock:'||p_subject_id::text,0));

 SELECT * INTO v_existing FROM public.mock_papers p
 WHERE p.student_id=v_user AND p.subject_id=p_subject_id AND p.status='STARTED'
 ORDER BY p.paper_number NULLS LAST,p.retake_number DESC NULLS LAST LIMIT 1;
 IF FOUND THEN RETURN v_existing; END IF;

 SELECT COUNT(*) FILTER(WHERE q.question_usage='MOCK'),
        COUNT(*) FILTER(WHERE q.question_usage='SHARED')
 INTO v_mock_count,v_shared_count
 FROM public.questions q JOIN public.chapters c ON c.id=q.chapter_id
 WHERE c.subject_id=p_subject_id AND c.is_active AND q.is_active
 AND q.media_ready AND q.content_review_status <> 'HOLD'
 AND q.question_type='MCQ' AND q.question_usage IN ('MOCK','SHARED');
 IF v_mock_count<48 OR v_shared_count<12 THEN
   RAISE EXCEPTION 'A complete mock requires 48 MOCK and 12 SHARED eligible questions'
     USING ERRCODE='22023';
 END IF;

 SELECT COALESCE(MAX(p.paper_number),0) INTO v_max_number
 FROM public.mock_papers p WHERE p.student_id=v_user AND p.subject_id=p_subject_id
 AND p.paper_number IS NOT NULL;
 v_total:=GREATEST(1,(v_mock_count+v_shared_count)/60,v_max_number);
 v_number:=v_max_number+1;
 IF v_number>v_total AND (
   SELECT count(*) FROM public.mock_papers p
   WHERE p.student_id=v_user AND p.subject_id=p_subject_id
     AND p.paper_number IS NOT NULL AND p.status='COMPLETED'
 )<v_max_number THEN
   RAISE EXCEPTION 'Complete all numbered mocks before starting retakes' USING ERRCODE='42501';
 END IF;

 -- Prefer questions never assigned to this learner. Reuse only after depletion.
 -- Legacy paper assignments are considered even if they predate the coverage ledger.
 SELECT array_agg(z.id) INTO v_mock FROM (
 SELECT q.id
 FROM public.questions q JOIN public.chapters c ON c.id=q.chapter_id
 WHERE c.subject_id=p_subject_id AND c.is_active AND q.is_active
   AND q.media_ready AND q.content_review_status<>'HOLD'
   AND q.question_type='MCQ' AND q.question_usage='MOCK'
 ORDER BY CASE WHEN
   EXISTS (SELECT 1 FROM public.mock_question_coverage cv
     WHERE cv.student_id=v_user AND cv.subject_id=p_subject_id AND cv.question_id=q.id)
   OR EXISTS (SELECT 1 FROM public.mock_papers prev
     WHERE prev.student_id=v_user AND prev.subject_id=p_subject_id AND q.id=ANY(prev.question_ids))
   THEN 1 ELSE 0 END,random() LIMIT 48
 ) z;
 SELECT array_agg(z.id) INTO v_shared FROM (
 SELECT q.id
 FROM public.questions q JOIN public.chapters c ON c.id=q.chapter_id
 WHERE c.subject_id=p_subject_id AND c.is_active AND q.is_active
   AND q.media_ready AND q.content_review_status<>'HOLD'
   AND q.question_type='MCQ' AND q.question_usage='SHARED'
 ORDER BY CASE WHEN
   EXISTS (SELECT 1 FROM public.mock_question_coverage cv
     WHERE cv.student_id=v_user AND cv.subject_id=p_subject_id AND cv.question_id=q.id)
   OR EXISTS (SELECT 1 FROM public.mock_papers prev
     WHERE prev.student_id=v_user AND prev.subject_id=p_subject_id AND q.id=ANY(prev.question_ids))
   THEN 1 ELSE 0 END,random() LIMIT 12
 ) z;

 IF cardinality(v_mock)<>48 OR cardinality(v_shared)<>12 THEN
   RAISE EXCEPTION 'Insufficient eligible mock questions' USING ERRCODE='22023';
 END IF;
 SELECT array_agg(id ORDER BY random()) INTO v_selected
 FROM unnest(v_mock||v_shared) AS x(id);
 IF cardinality(v_selected)<>60 OR
   (SELECT count(distinct id) FROM unnest(v_selected) AS x(id))<>60 THEN
   RAISE EXCEPTION 'Duplicate questions detected while allocating mock' USING ERRCODE='23505';
 END IF;

 IF v_number<=v_total THEN
   INSERT INTO public.mock_papers(student_id,subject_id,paper_number,retake_number,question_ids,status,allocation_version)
   VALUES(v_user,p_subject_id,v_number,NULL,v_selected,'STARTED',2)
   RETURNING * INTO v_result;
 ELSE
   SELECT COALESCE(MAX(p.retake_number),0)+1 INTO v_retake
   FROM public.mock_papers p WHERE p.student_id=v_user AND p.subject_id=p_subject_id;
   INSERT INTO public.mock_papers(student_id,subject_id,paper_number,retake_number,question_ids,status,allocation_version)
   VALUES(v_user,p_subject_id,NULL,v_retake,v_selected,'STARTED',2)
   RETURNING * INTO v_result;
 END IF;
 INSERT INTO public.mock_question_coverage(student_id,subject_id,question_id)
 SELECT v_user,p_subject_id,x.id FROM unnest(v_selected) AS x(id)
 ON CONFLICT (student_id,subject_id,question_id) DO NOTHING;
 RETURN v_result;
END;
$function$
;

REVOKE ALL ON FUNCTION public.cbse_mock_pool_counts_v2(bigint) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.cbse_assigned_mock_questions_v2(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.start_next_mock_paper_v2(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cbse_mock_pool_counts_v2(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cbse_assigned_mock_questions_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_next_mock_paper_v2(bigint) TO authenticated;
COMMIT;
-- Preserves all original existing questions and every past mock assignment.
-- Full CSV import completion awaits JEE Advanced and NEET remaining 6,319 CSV rows.
