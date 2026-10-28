-- Class XII Biology / Agent 4, Round 5. 52 real MCQ first-pass inspections.
-- 11 accepted with answer and distinctive concept checks; 41 skipped for novelty / difficulty.
-- CBSE 2026-27 Biology (044), NCERT Class XII. AI-assisted: no human teacher certification.
BEGIN;
CREATE TABLE IF NOT EXISTS cbse_import.advanced_mock_agent4_bio12_review_round5_20261028 (
 source_question_id bigint PRIMARY KEY,
 decision text NOT NULL CHECK(decision IN('ACCEPT','SKIP_FIRST_PASS')),
 expected_answer text CHECK(expected_answer IN('A','B','C','D')),
 review_note text NOT NULL,
 reviewer_type text NOT NULL DEFAULT 'AI_ASSISTED_FIRST_PASS',
 human_certified boolean NOT NULL DEFAULT false CHECK(human_certified=false),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT answer_only_on_accept CHECK ((decision='ACCEPT')=(expected_answer IS NOT NULL))
);
ALTER TABLE cbse_import.advanced_mock_agent4_bio12_review_round5_20261028 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cbse_import.advanced_mock_agent4_bio12_review_round5_20261028 FROM PUBLIC, anon, authenticated;
DO $$
DECLARE n integer; pass integer; chapters integer;
BEGIN
 SELECT COUNT(*),COUNT(*) FILTER(WHERE v.status='ACCEPT'),COUNT(DISTINCT c.destination_chapter_id)
 INTO n,pass,chapters
 FROM (VALUES
(31190::bigint,'ACCEPT'::text,'D'::text,'Coextinction risk from loss of an obligate partner; richness, invasives and ecosystem diversity correctly distinguished.'::text),
(31195::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30856::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30858::bigint,'ACCEPT'::text,'C'::text,'PCR diagnoses nucleic acid by amplification, not protein; biopiracy and gene-therapy definitions hold; animal efficacy alone does not prove human safety.'::text),
(30723::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30737::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(31081::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(31065::bigint,'ACCEPT'::text,'C'::text,'Leaching transports soluble material; mineralisation releases inorganic nutrients; cold dry conditions inhibit decomposition, and decomposers are heterotrophs.'::text),
(30417::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30424::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30512::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30539::bigint,'ACCEPT'::text,'A'::text,'HIV may deplete helper CD4 cells, Aedes transmits dengue, interferon protects adjacent cells; B cells do not direct helper-T receptor signalling.'::text),
(29934::bigint,'ACCEPT'::text,'B'::text,'hCG maintains corpus luteum; acrosome aids gamete interaction; spermiogenesis differentiates spermatids and spermatocytes yield four haploid spermatids.'::text),
(29921::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30609::bigint,'ACCEPT'::text,'A'::text,'Aeration supports microbial sewage treatment and BOD reduction; Acetobacter makes acetic acid, while cyclosporin A is immunosuppressant rather than clot-dissolving agent.'::text),
(30631::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30279::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30298::bigint,'ACCEPT'::text,'A'::text,'lac repressor suppresses transcription, allolactose derepresses, tRNA anticodon pairs with mRNA; nonsense mutation creates premature stop not sense codon.'::text),
(30923::bigint,'ACCEPT'::text,'D'::text,'Births, deaths and migration determine population size; logistic growth peaks at K/2; resource partitioning reduces competition overlap.'::text),
(30966::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30110::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30204::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30043::bigint,'ACCEPT'::text,'B'::text,'Amniocentesis identifies some fetal abnormalities, later embryo transfers target uterus, MTP differs from contraception, untreated STIs may cause infertility.'::text),
(30049::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(29810::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(29893::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(31189::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(31172::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30822::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30833::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30711::bigint,'ACCEPT'::text,'D'::text,'Biolistics transfers DNA-coated particles; downstream processing purifies products and smaller DNA fragments migrate farther; claim that competent cells reject DNA false.'::text),
(30699::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(31137::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(31045::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30400::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30412::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30513::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30518::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(29911::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(29917::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30607::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30626::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30293::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30273::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30920::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30963::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30201::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30240::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30044::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30010::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(29832::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(29888::bigint,'ACCEPT'::text,'D'::text,'Emasculation removes anthers, apomixis forms seeds without fertilisation, parthenocarpy forms fruit without fertilisation and syngamy joins gametes.'::text)
 ) v(id,status,expected,note)
 JOIN public.questions q ON q.id=v.id
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=v.id
 JOIN cbse_import.advanced_mock_bulk_academic_audit_20261028 a ON a.source_question_id=v.id
 WHERE c.destination_subject_id=20 AND a.destination_subject_id=20
 AND c.destination_chapter_id=a.destination_chapter_id
 AND a.automated_qc_status='PASS_PRELIMINARY_AUTOMATED_SCREEN'
 AND NOT c.release_approved AND NOT q.is_active
 AND NOT c.duplicate_candidate AND NOT c.media_blocked AND NOT c.answer_issue
 AND c.source_media_ready AND q.media_ready
 AND COALESCE(q.question_media,'{}'::jsonb)='{}'::jsonb
 AND q.question_text !~* '\m(jee|neet|iit)\M'
 AND (v.expected IS NULL OR v.expected=q.correct_option::text)
 AND NOT EXISTS(SELECT 1 FROM cbse_import.advanced_mock_agent4_bio12_review_round4_20261028 prev WHERE prev.source_question_id=v.id);
 IF n<>52 OR pass<>11 OR chapters<>13 THEN
 RAISE EXCEPTION 'Round5 eligibility mismatch: % total % accepted % chapters',n,pass,chapters;
 END IF;
 INSERT INTO cbse_import.advanced_mock_agent4_bio12_review_round5_20261028
 (source_question_id,decision,expected_answer,review_note)
 SELECT id,status,expected,note FROM (VALUES
(31190::bigint,'ACCEPT'::text,'D'::text,'Coextinction risk from loss of an obligate partner; richness, invasives and ecosystem diversity correctly distinguished.'::text),
(31195::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30856::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30858::bigint,'ACCEPT'::text,'C'::text,'PCR diagnoses nucleic acid by amplification, not protein; biopiracy and gene-therapy definitions hold; animal efficacy alone does not prove human safety.'::text),
(30723::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30737::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(31081::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(31065::bigint,'ACCEPT'::text,'C'::text,'Leaching transports soluble material; mineralisation releases inorganic nutrients; cold dry conditions inhibit decomposition, and decomposers are heterotrophs.'::text),
(30417::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30424::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30512::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30539::bigint,'ACCEPT'::text,'A'::text,'HIV may deplete helper CD4 cells, Aedes transmits dengue, interferon protects adjacent cells; B cells do not direct helper-T receptor signalling.'::text),
(29934::bigint,'ACCEPT'::text,'B'::text,'hCG maintains corpus luteum; acrosome aids gamete interaction; spermiogenesis differentiates spermatids and spermatocytes yield four haploid spermatids.'::text),
(29921::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30609::bigint,'ACCEPT'::text,'A'::text,'Aeration supports microbial sewage treatment and BOD reduction; Acetobacter makes acetic acid, while cyclosporin A is immunosuppressant rather than clot-dissolving agent.'::text),
(30631::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30279::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30298::bigint,'ACCEPT'::text,'A'::text,'lac repressor suppresses transcription, allolactose derepresses, tRNA anticodon pairs with mRNA; nonsense mutation creates premature stop not sense codon.'::text),
(30923::bigint,'ACCEPT'::text,'D'::text,'Births, deaths and migration determine population size; logistic growth peaks at K/2; resource partitioning reduces competition overlap.'::text),
(30966::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30110::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30204::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30043::bigint,'ACCEPT'::text,'B'::text,'Amniocentesis identifies some fetal abnormalities, later embryo transfers target uterus, MTP differs from contraception, untreated STIs may cause infertility.'::text),
(30049::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(29810::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(29893::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(31189::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(31172::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30822::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30833::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30711::bigint,'ACCEPT'::text,'D'::text,'Biolistics transfers DNA-coated particles; downstream processing purifies products and smaller DNA fragments migrate farther; claim that competent cells reject DNA false.'::text),
(30699::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(31137::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(31045::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30400::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30412::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30513::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30518::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(29911::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(29917::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30607::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30626::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30293::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30273::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30920::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30963::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30201::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30240::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30044::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(30010::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(29832::bigint,'SKIP_FIRST_PASS'::text,NULL::text,'AI-assisted first pass: fact combinations overlap the existing live bank or do not add sufficient advanced-level variety; defer without editing the source.'::text),
(29888::bigint,'ACCEPT'::text,'D'::text,'Emasculation removes anthers, apomixis forms seeds without fertilisation, parthenocarpy forms fruit without fertilisation and syngamy joins gametes.'::text)
 ) v(id,status,expected,note);
 IF (SELECT count(*) FROM cbse_import.advanced_mock_agent4_bio12_review_round5_20261028)<>52 THEN
 RAISE EXCEPTION 'Round5 missing rows';
 END IF;
END $$;
COMMIT;