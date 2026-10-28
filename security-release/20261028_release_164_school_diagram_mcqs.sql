-- Production audit / one-time controlled release.
-- 164 restored school-image MCQs were checked for consistent answer keys,
-- explanations, diagrams, classes/chapters, usage, source and media paths.
-- TEST_READY explicitly means preliminarily validated, not a claim of formal
-- external textbook certification. No JEE/NEET records are touched.
-- This file is applied exactly once via Supabase controlled transaction.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='90s';

CREATE TABLE IF NOT EXISTS cbse_import.school_image_activation_backup_20261028 (
  question_id bigint PRIMARY KEY,
  previous_is_active boolean NOT NULL,
  previous_content_review_status text NOT NULL,
  previous_media_ready boolean NOT NULL,
  original_import_disposition text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cbse_import.school_image_activation_backup_20261028 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cbse_import.school_image_activation_backup_20261028
  FROM PUBLIC, anon, authenticated;

DO $release$
DECLARE n integer; n8 integer; n11 integer; n_saved integer; n_updated integer;
BEGIN
  -- Abort if the images, sources, classes, review status or academic fields
  -- differ from the verified starting state.
  SELECT count(*),
         count(*) FILTER (WHERE c.class_number=8),
         count(*) FILTER (WHERE c.class_number=11)
  INTO n,n8,n11
  FROM public.questions q
  JOIN cbse_import.question_media_backup_20261028 original ON original.question_id=q.id
  JOIN cbse_import.master_rows m ON m.question_id=q.id
  JOIN public.chapters ch ON ch.id=q.chapter_id
  JOIN public.subjects s ON s.id=ch.subject_id
  JOIN public.classes c ON c.id=s.class_id
  WHERE c.class_number IN(8,11)
    AND c.is_active AND s.is_active AND ch.is_active
    AND q.is_active=false AND q.content_review_status='HOLD'
    AND q.media_ready=true AND m.disposition='INSERTED_INACTIVE'
    AND q.question_type='MCQ'
    AND q.question_usage IN('PRACTICE','MOCK','SHARED')
    AND q.correct_option IN('A','B','C','D')
    AND length(btrim(coalesce(q.explanation,'')))>=30
    AND length(btrim(coalesce(q.question_text,'')))>0
    AND length(btrim(coalesce(q.option_a,'')))>0
    AND length(btrim(coalesce(q.option_b,'')))>0
    AND length(btrim(coalesce(q.option_c,'')))>0
    AND length(btrim(coalesce(q.option_d,'')))>0
    AND q.option_a<>q.option_b AND q.option_a<>q.option_c AND q.option_a<>q.option_d
    AND q.option_b<>q.option_c AND q.option_b<>q.option_d AND q.option_c<>q.option_d
    AND q.question_media->'question'->>'src'=
       '/question-images/imported-school-20261028/' ||
       CASE WHEN c.class_number=8 THEN substring(m.payload->17->0->>'path' FROM 8)
            ELSE regexp_replace(substring(m.payload->17->0->>'path' FROM 8),'[.]png$','.svg') END
    AND coalesce(length(q.question_media->'question'->>'alt'),0)>2;
  IF n<>164 OR n8<>67 OR n11<>97 THEN
    RAISE EXCEPTION 'Preflight failed: total %, Class 8 %, Class 11 %',n,n8,n11;
  END IF;

  -- Persist status snapshot; never alter the original question/media backup.
  INSERT INTO cbse_import.school_image_activation_backup_20261028
    (question_id,previous_is_active,previous_content_review_status,
     previous_media_ready,original_import_disposition)
  SELECT q.id,q.is_active,q.content_review_status,q.media_ready,m.disposition
  FROM public.questions q
  JOIN cbse_import.question_media_backup_20261028 original ON original.question_id=q.id
  JOIN cbse_import.master_rows m ON m.question_id=q.id
  WHERE q.is_active=false AND q.content_review_status='HOLD' AND q.media_ready=true
    AND m.disposition='INSERTED_INACTIVE'
  ON CONFLICT (question_id) DO NOTHING;
  SELECT count(*) INTO n_saved FROM cbse_import.school_image_activation_backup_20261028;
  IF n_saved<>164 THEN RAISE EXCEPTION 'Release backup expected 164 rows, found %',n_saved; END IF;

  UPDATE public.questions q
  SET is_active=true, content_review_status='TEST_READY', updated_at=now()
  FROM cbse_import.school_image_activation_backup_20261028 saved
  WHERE saved.question_id=q.id AND q.is_active=false AND q.media_ready=true
    AND q.content_review_status='HOLD'
    AND saved.previous_content_review_status='HOLD'
    AND saved.previous_is_active=false
    AND saved.original_import_disposition='INSERTED_INACTIVE';
  GET DIAGNOSTICS n_updated=ROW_COUNT;
  IF n_updated<>164 THEN
    RAISE EXCEPTION 'Activation affected % instead of 164: rolled back',n_updated;
  END IF;

  SELECT count(*) INTO n
  FROM public.questions q
  JOIN cbse_import.school_image_activation_backup_20261028 saved ON saved.question_id=q.id
  WHERE q.is_active=true AND q.content_review_status='TEST_READY' AND q.media_ready=true;
  IF n<>164 THEN RAISE EXCEPTION 'Postflight failed: verified % expected 164',n; END IF;
END
$release$;
COMMIT;
