-- Stage 2 / Phase B: isolated 60-question Advanced Mock runtime (2026-10-28)
-- Safe to apply before or after 1,664 unresolved source deletion.
-- No edits to standard mocks, original question text, student records, or results.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS public.advanced_mock_papers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 subject_id bigint NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
 paper_number integer,
 retake_number integer,
 question_ids bigint[] NOT NULL,
 status text NOT NULL DEFAULT 'STARTED' CHECK (status IN ('STARTED','COMPLETED')),
 started_at timestamptz NOT NULL DEFAULT now(),
 deadline_at timestamptz NOT NULL DEFAULT (now() + interval '60 minutes'),
 completed_at timestamptz,
 correct_count integer,
 answered_count integer,
 score_percent numeric(5,2),
 CONSTRAINT advanced_mock_question_count CHECK (cardinality(question_ids)=60),
 CONSTRAINT advanced_mock_sequence CHECK ((paper_number IS NOT NULL AND retake_number IS NULL AND paper_number>0) OR (paper_number IS NULL AND retake_number IS NOT NULL AND retake_number>0)),
 CONSTRAINT advanced_mock_score_bounds CHECK ((correct_count IS NULL AND answered_count IS NULL AND score_percent IS NULL) OR (correct_count BETWEEN 0 AND 60 AND answered_count BETWEEN 0 AND 60 AND score_percent BETWEEN 0 AND 100))
);
CREATE UNIQUE INDEX IF NOT EXISTS advanced_mock_numbered_unique ON public.advanced_mock_papers(student_id,subject_id,paper_number) WHERE paper_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS advanced_mock_retake_unique ON public.advanced_mock_papers(student_id,subject_id,retake_number) WHERE retake_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS advanced_mock_history_idx ON public.advanced_mock_papers(student_id,subject_id,started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS advanced_mock_one_started ON public.advanced_mock_papers(student_id,subject_id) WHERE status='STARTED';
ALTER TABLE public.advanced_mock_papers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.advanced_mock_papers FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS public.advanced_mock_answers (
 paper_id uuid NOT NULL REFERENCES public.advanced_mock_papers(id) ON DELETE CASCADE,
 question_id bigint NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
 selected_answer text NOT NULL CHECK (selected_answer IN ('A','B','C','D')),
 answered_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (paper_id,question_id)
);
CREATE INDEX IF NOT EXISTS advanced_mock_answers_question_idx ON public.advanced_mock_answers(question_id);
ALTER TABLE public.advanced_mock_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.advanced_mock_answers FROM PUBLIC,anon,authenticated;

-- Finalizer also handles deadline expiry. Called only via owner-checked routines.
CREATE OR REPLACE FUNCTION cbse_import.advanced_mock_finalize_v1(p_paper_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE p public.advanced_mock_papers%ROWTYPE; v_correct integer; v_answered integer;
BEGIN
 SELECT * INTO p FROM public.advanced_mock_papers WHERE id=p_paper_id FOR UPDATE;
 IF NOT FOUND OR p.student_id IS DISTINCT FROM auth.uid() OR NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Advanced mock paper unavailable' USING ERRCODE='42501';
 END IF;
 IF p.status='COMPLETED' THEN
   RETURN jsonb_build_object('status','COMPLETED','correct',p.correct_count,
      'answered',p.answered_count,'total',60,'percent',p.score_percent,'paper_id',p.id);
 END IF;
 SELECT count(*)::integer,
        count(*) FILTER (WHERE upper(btrim(q.correct_option::text))=a.selected_answer)::integer
 INTO v_answered,v_correct
 FROM public.advanced_mock_answers a
 JOIN public.questions q ON q.id=a.question_id
 WHERE a.paper_id=p.id;
 UPDATE public.advanced_mock_papers
 SET status='COMPLETED',completed_at=clock_timestamp(),
     answered_count=v_answered,correct_count=v_correct,
     score_percent=round(v_correct::numeric*100/60,2)
 WHERE id=p.id;
 RETURN jsonb_build_object('status','COMPLETED','correct',v_correct,
       'answered',v_answered,'total',60,'percent',round(v_correct::numeric*100/60,2),'paper_id',p.id);
END $fn$;
REVOKE ALL ON FUNCTION cbse_import.advanced_mock_finalize_v1(uuid) FROM PUBLIC,anon,authenticated;

-- Authorized overview; no answer leakage. A locked pool stays locked until signed release.
CREATE OR REPLACE FUNCTION public.advanced_mock_overview_v1(p_subject_id bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_user uuid:=auth.uid(); v_subject public.subjects%ROWTYPE;
 v_class_name text; v_pool integer; v_numbered integer; v_retakes integer; v_started jsonb; v_recent jsonb;
BEGIN
 IF v_user IS NULL OR NOT public.is_active_student() THEN
  RAISE EXCEPTION 'Active student required' USING ERRCODE='42501';
 END IF;
 SELECT s.*,c.class_name INTO v_subject,v_class_name
 FROM public.subjects s JOIN public.classes c ON c.id=s.class_id
 JOIN public.student_profiles sp ON sp.class_id=s.class_id AND sp.id=v_user
 WHERE s.id=p_subject_id AND s.is_active AND c.class_name IN ('Class 11','Class 12');
 IF NOT FOUND THEN RAISE EXCEPTION 'Advanced mocks are available for your enrolled Class 11 or 12 only' USING ERRCODE='42501'; END IF;
 SELECT count(*)::integer INTO v_pool
 FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
 JOIN public.questions q ON q.id=c.source_question_id
 WHERE c.destination_subject_id=p_subject_id AND c.release_approved
   AND c.academic_verified AND c.answer_verified AND c.duplicate_cleared AND c.media_verified
   AND c.reviewed_at IS NOT NULL AND c.source_content_review_status <> 'HOLD'
   AND q.is_active=FALSE AND q.media_ready=TRUE;
 SELECT count(*) FILTER (WHERE paper_number IS NOT NULL)::integer,
        count(*) FILTER (WHERE retake_number IS NOT NULL)::integer
 INTO v_numbered,v_retakes FROM public.advanced_mock_papers
 WHERE student_id=v_user AND subject_id=p_subject_id;
 SELECT jsonb_build_object('id',id,'deadline_at',deadline_at,'paper_number',paper_number,
  'retake_number',retake_number) INTO v_started
 FROM public.advanced_mock_papers WHERE student_id=v_user AND subject_id=p_subject_id
 AND status='STARTED' LIMIT 1;
 SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.started_at DESC),'[]'::jsonb) INTO v_recent
 FROM (SELECT id,paper_number,retake_number,status,started_at,completed_at,
             deadline_at,correct_count,answered_count,score_percent
       FROM public.advanced_mock_papers WHERE student_id=v_user AND subject_id=p_subject_id
       ORDER BY started_at DESC LIMIT 15) t;
 RETURN jsonb_build_object('subject_id',p_subject_id,'subject_name',v_subject.subject_name,
  'class_name',v_class_name,'released_questions',v_pool,'ready_for_60',v_pool>=60,
  'paid',public.cbse_is_paid_for_subject_v1(v_user),
  'numbered_started',v_numbered,'retakes_started',v_retakes,
  'active_paper',v_started,'history',v_recent);
END $fn$;

-- Stable saved paper, 60 unique released source IDs, no use of standard pools.
CREATE OR REPLACE FUNCTION public.advanced_mock_start_v1(p_subject_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_user uuid:=auth.uid(); v_existing public.advanced_mock_papers%ROWTYPE;
 v_pool integer; v_prevmax integer; v_capacity integer; v_retake integer; v_ids bigint[]; v_paper uuid;
BEGIN
 IF v_user IS NULL OR NOT public.is_active_student() THEN RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF NOT public.cbse_is_paid_for_subject_v1(v_user) THEN RAISE EXCEPTION 'Paid membership required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.subjects s JOIN public.classes cl ON cl.id=s.class_id
  JOIN public.student_profiles sp ON sp.class_id=cl.id AND sp.id=v_user
  WHERE s.id=p_subject_id AND s.is_active AND cl.class_name IN ('Class 11','Class 12')) THEN
  RAISE EXCEPTION 'Subject unavailable for your Class 11/12 enrollment' USING ERRCODE='42501';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':advanced:'||p_subject_id::text,0));
 SELECT * INTO v_existing FROM public.advanced_mock_papers
 WHERE student_id=v_user AND subject_id=p_subject_id AND status='STARTED'
 ORDER BY started_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
   IF clock_timestamp()>=v_existing.deadline_at THEN
     PERFORM cbse_import.advanced_mock_finalize_v1(v_existing.id);
   ELSE
     RETURN jsonb_build_object('paper_id',v_existing.id,'resumed',true,
       'deadline_at',v_existing.deadline_at);
   END IF;
 END IF;
 SELECT count(*)::integer INTO v_pool
 FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
 JOIN public.questions q ON q.id=c.source_question_id
 WHERE c.destination_subject_id=p_subject_id AND c.release_approved
   AND c.academic_verified AND c.answer_verified AND c.duplicate_cleared AND c.media_verified
   AND c.reviewed_at IS NOT NULL AND c.source_content_review_status<>'HOLD'
   AND q.is_active=FALSE AND q.media_ready=TRUE;
 IF v_pool<60 THEN RAISE EXCEPTION 'Advanced Mock Test is awaiting academic approval (at least 60 released questions required)' USING ERRCODE='22023'; END IF;
 SELECT COALESCE(MAX(paper_number),0) INTO v_prevmax
 FROM public.advanced_mock_papers WHERE student_id=v_user AND subject_id=p_subject_id;
 v_capacity:=GREATEST(1,v_pool/60);
 -- Favor questions the student has not yet received, fall back to retakes.
 SELECT array_agg(id ORDER BY random()) INTO v_ids FROM (
   SELECT c.source_question_id AS id
   FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
   JOIN public.questions q ON q.id=c.source_question_id
   WHERE c.destination_subject_id=p_subject_id AND c.release_approved
      AND c.academic_verified AND c.answer_verified AND c.duplicate_cleared AND c.media_verified
      AND c.reviewed_at IS NOT NULL AND c.source_content_review_status<>'HOLD'
      AND q.is_active=FALSE AND q.media_ready=TRUE
   ORDER BY CASE WHEN EXISTS (
      SELECT 1 FROM public.advanced_mock_papers old
      WHERE old.student_id=v_user AND old.subject_id=p_subject_id
      AND c.source_question_id=ANY(old.question_ids)
   ) THEN 1 ELSE 0 END,random()
   LIMIT 60
 ) chosen;
 IF COALESCE(cardinality(v_ids),0)<>60 OR (SELECT count(DISTINCT x) FROM unnest(v_ids) x)<>60 THEN
  RAISE EXCEPTION 'Advanced mock question pool incomplete' USING ERRCODE='22023';
 END IF;
 IF v_prevmax<v_capacity THEN
  INSERT INTO public.advanced_mock_papers(student_id,subject_id,paper_number,question_ids)
  VALUES(v_user,p_subject_id,v_prevmax+1,v_ids) RETURNING id INTO v_paper;
 ELSE
  SELECT COALESCE(MAX(retake_number),0)+1 INTO v_retake
  FROM public.advanced_mock_papers WHERE student_id=v_user AND subject_id=p_subject_id;
  INSERT INTO public.advanced_mock_papers(student_id,subject_id,retake_number,question_ids)
  VALUES(v_user,p_subject_id,v_retake,v_ids) RETURNING id INTO v_paper;
 END IF;
 RETURN jsonb_build_object('paper_id',v_paper,'resumed',false);
END $fn$;

-- All paper content and answer review are owned, with no correct-answer
-- or explanation data delivered to a still-started paper.
CREATE OR REPLACE FUNCTION public.advanced_mock_get_v1(p_paper_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE p public.advanced_mock_papers%ROWTYPE; v_questions jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO p FROM public.advanced_mock_papers WHERE id=p_paper_id
 AND student_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Advanced mock not found' USING ERRCODE='42501'; END IF;
 IF p.status='STARTED' AND clock_timestamp()>=p.deadline_at THEN
   PERFORM cbse_import.advanced_mock_finalize_v1(p.id);
   SELECT * INTO p FROM public.advanced_mock_papers WHERE id=p_paper_id;
 END IF;
 SELECT jsonb_agg(jsonb_build_object(
   'id',q.id,'chapter_id',c.destination_chapter_id,
   'question_text',public.cbse_media_text_v1(q.question_text,q.question_media,'question'),
   'option_a',public.cbse_media_text_v1(q.option_a,q.question_media,'A'),
   'option_b',public.cbse_media_text_v1(q.option_b,q.question_media,'B'),
   'option_c',public.cbse_media_text_v1(q.option_c,q.question_media,'C'),
   'option_d',public.cbse_media_text_v1(q.option_d,q.question_media,'D'),
   'selected_answer',a.selected_answer,
   'correct_option',CASE WHEN p.status='COMPLETED' THEN q.correct_option::text ELSE NULL END,
   'explanation',CASE WHEN p.status='COMPLETED' THEN q.explanation ELSE NULL END
 ) ORDER BY t.ord) INTO v_questions
 FROM unnest(p.question_ids) WITH ORDINALITY t(id,ord)
 JOIN public.questions q ON q.id=t.id
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=q.id
 LEFT JOIN public.advanced_mock_answers a ON a.paper_id=p.id AND a.question_id=q.id;
 RETURN jsonb_build_object('id',p.id,'subject_id',p.subject_id,
  'paper_number',p.paper_number,'retake_number',p.retake_number,'status',p.status,
  'started_at',p.started_at,'deadline_at',p.deadline_at,'completed_at',p.completed_at,
  'correct_count',CASE WHEN p.status='COMPLETED' THEN p.correct_count ELSE NULL END,
  'answered_count',CASE WHEN p.status='COMPLETED' THEN p.answered_count ELSE NULL END,
  'score_percent',CASE WHEN p.status='COMPLETED' THEN p.score_percent ELSE NULL END,
  'questions',COALESCE(v_questions,'[]'::jsonb));
END $fn$;

CREATE OR REPLACE FUNCTION public.advanced_mock_answer_v1(p_paper_id uuid,p_question_id bigint,p_answer text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE p public.advanced_mock_papers%ROWTYPE; v_answer text:=upper(btrim(p_answer));
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_active_student() THEN RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM public.advanced_mock_papers
 WHERE id=p_paper_id AND student_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Advanced mock unavailable' USING ERRCODE='42501'; END IF;
 IF p.status<>'STARTED' THEN RETURN jsonb_build_object('saved',false,'completed',true); END IF;
 IF clock_timestamp()>=p.deadline_at THEN
  PERFORM cbse_import.advanced_mock_finalize_v1(p.id);
  RETURN jsonb_build_object('saved',false,'completed',true,'expired',true);
 END IF;
 IF v_answer NOT IN ('A','B','C','D') OR v_answer IS NULL THEN
  RAISE EXCEPTION 'Invalid selected option' USING ERRCODE='22023';
 END IF;
 IF p_question_id IS NULL OR NOT COALESCE(p_question_id=ANY(p.question_ids),false) THEN
  RAISE EXCEPTION 'Question is not assigned to this paper' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.advanced_mock_answers(paper_id,question_id,selected_answer)
 VALUES(p.id,p_question_id,v_answer)
 ON CONFLICT(paper_id,question_id)
 DO UPDATE SET selected_answer=EXCLUDED.selected_answer,answered_at=now();
 RETURN jsonb_build_object('saved',true,'question_id',p_question_id,'selected_answer',v_answer);
END $fn$;

CREATE OR REPLACE FUNCTION public.advanced_mock_finish_v1(p_paper_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_active_student() THEN RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 RETURN cbse_import.advanced_mock_finalize_v1(p_paper_id);
END $fn$;

REVOKE ALL ON FUNCTION public.advanced_mock_overview_v1(bigint) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.advanced_mock_start_v1(bigint) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.advanced_mock_get_v1(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.advanced_mock_answer_v1(uuid,bigint,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.advanced_mock_finish_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.advanced_mock_overview_v1(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advanced_mock_start_v1(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advanced_mock_get_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advanced_mock_answer_v1(uuid,bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advanced_mock_finish_v1(uuid) TO authenticated;
COMMIT;
