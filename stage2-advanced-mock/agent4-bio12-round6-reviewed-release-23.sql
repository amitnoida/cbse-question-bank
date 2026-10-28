-- Agent4 Biology Class XII round6 (28 Oct 2026): 23 individually checked and distinctive 4-statement Advanced MCQs.
-- 418 unique atomic claims across 863 previously unreviewed statement MCQs were first-pass assessed
-- against CBSE/NCERT scientific knowledge; THIS RELEASE IS ONLY 23 explicit IDs, not 863 blanket approvals.
-- Owner standing approval. Human expert certification NOT claimed. No source question edits.
BEGIN;
CREATE TABLE IF NOT EXISTS cbse_import.advanced_mock_agent4_bio12_review_round6_20261028(
 source_question_id bigint PRIMARY KEY,
 checked_answer text NOT NULL CHECK(checked_answer IN('A','B','C','D')),
 evidence_note text NOT NULL,
 decision text NOT NULL DEFAULT 'ACCEPT_FIRST_PASS' CHECK(decision='ACCEPT_FIRST_PASS'),
 review_method text NOT NULL DEFAULT 'AI_ASSISTED_CONTENT_AND_FACT_CHECK',
 human_teacher_certified boolean NOT NULL DEFAULT false CHECK(human_teacher_certified=false),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cbse_import.advanced_mock_agent4_bio12_review_round6_20261028 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cbse_import.advanced_mock_agent4_bio12_review_round6_20261028 FROM PUBLIC,anon,authenticated;

DO $$
DECLARE count_ok integer; chapter_ok integer; selected_updated integer; before_count integer; after_count integer;
BEGIN
 SELECT count(*) INTO before_count FROM cbse_import.advanced_mock_stage2_candidates_20261028
 WHERE destination_subject_id=20 AND release_approved;

 WITH ins AS(SELECT * FROM (VALUES
(31193::bigint,'B'::text,'Coextinction from loss of obligate partner, within-species genetic diversity, fragmentation and hotspot criteria.'::text),
(30819::bigint,'C'::text,'Therapeutic recombinant proteins, RNAi target complementarity, Bt cry specificity and alkaline-insect-gut toxin action.'::text),
(30844::bigint,'B'::text,'Biopatents are intellectual property; RNAi requires complementary sequences; ELISA uses antibody recognition; insulin retains A/B chains.'::text),
(29947::bigint,'A'::text,'Leydig androgen synthesis, corpus-luteum progesterone, Sertoli-cell germ support and spermiogenesis after meiosis.'::text),
(30919::bigint,'D'::text,'Logistic growth has maximum absolute rate at K/2, emigration reduces abundance, mutualism benefits both and migration affects population size.'::text),
(30940::bigint,'A'::text,'Parasitism harms host, predation affects abundance, logistic growth zero at K, and natality means births.'::text),
(30206::bigint,'A'::text,'Recessive carriers can mask traits, codominance expresses alleles, Down is trisomy 21 and paternal X passes to daughters.'::text),
(30229::bigint,'D'::text,'PKU autosomal recessive, point mutation changes a nucleotide, Turner typically 45X and Down syndrome is trisomy 21.'::text),
(30021::bigint,'C'::text,'ICSI injects sperm into egg, tubal ligation blocks oviduct, later embryos can transfer to uterus, vasectomy interrupts vas deferens.'::text),
(29813::bigint,'A'::text,'Tapetum nourishes pollen, generative cell forms two sperm, four pollen sacs in typical anther, double fertilisation is syngamy plus triple fusion.'::text),
(29891::bigint,'B'::text,'Ovule develops into seed, parthenocarpy forms fruit without fertilisation, triple fusion makes triploid endosperm, apomixis without syngamy.'::text),
(30741::bigint,'D'::text,'Cloning vector needs ori, biolistic microprojectiles deliver DNA, dyed gel bands are visualisable and DNA migrates to anode.'::text),
(30739::bigint,'C'::text,'Sequence-specific restriction enzymes, markers select transformants, insertional inactivation can disrupt markers, competent bacteria can take up DNA.'::text),
(31079::bigint,'A'::text,'Standing biomass can invert in aquatic systems, oxygen/mild warmth promotes decomposition, energy dissipates as heat, detritus is dead biomass.'::text),
(31127::bigint,'A'::text,'Secondary consumer eats primary, energy not recyclable, decomposers metabolise organic debris and NPP=GPP-R.'::text),
(30427::bigint,'B'::text,'Selection does not create purposive mutation, fossils document history, directional selection shifts mean and mutations generate variable alleles.'::text),
(30428::bigint,'C'::text,'Directional and disruptive selection correctly distinguished, Hardy Weinberg heterozygotes 2pq and fossils show ancient life.'::text),
(30531::bigint,'C'::text,'Innate barriers, helper T-cell roles, IgE/histamine allergy and dengue vector Aedes versus malaria Anopheles.'::text),
(30507::bigint,'A'::text,'Interferons antiviral, Anopheles rather than Aedes malaria vector, vaccination active immunity, maternal antibodies passive.'::text),
(30614::bigint,'B'::text,'Mycorrhiza enhances phosphate uptake, streptokinase breaks clots, lactic acid bacteria acidify curd, Rhizobium fixes nitrogen.'::text),
(30601::bigint,'D'::text,'Yeast fermentation not nitrogen fixing, secondary wastewater treatment lowers BOD, carbon dioxide raises dough, Aspergillus niger makes citric acid.'::text),
(30286::bigint,'A'::text,'AT has two H-bonds and GC three, spliceosomal intron removal, tRNA codon pairing and DNA template used in transcription.'::text),
(30315::bigint,'A'::text,'Semiconservative DNA molecules inherit one old strand, transcription uses DNA, coding strand corresponds to RNA except U/T, and AT/GC H bonds.'::text)
 ) v(id,answer,note)),
 exam AS(
 SELECT x.id,c.destination_chapter_id,q.question_text,q.explanation,q.correct_option,
  CASE q.correct_option WHEN 'A' THEN q.option_a WHEN 'B' THEN q.option_b WHEN 'C' THEN q.option_c WHEN 'D' THEN q.option_d END selected_option
 FROM ins x JOIN public.questions q ON q.id=x.id AND q.correct_option::text=x.answer
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=x.id
 JOIN public.chapters ch ON ch.id=c.destination_chapter_id
 JOIN public.subjects s ON s.id=ch.subject_id
 JOIN public.classes cl ON cl.id=s.class_id
 WHERE c.destination_subject_id=20 AND ch.subject_id=20 AND cl.class_name='Class 12' AND s.subject_name='Biology'
 AND ch.is_active AND s.is_active AND NOT c.release_approved AND NOT q.is_active AND q.media_ready AND c.source_media_ready
 AND NOT c.duplicate_candidate AND NOT c.media_blocked AND NOT c.answer_issue AND c.source_content_review_status<>'HOLD'
 AND coalesce(q.question_media,'{}'::jsonb)='{}'::jsonb AND length(btrim(q.explanation))>=25
 AND q.question_text LIKE 'Which of the following statements are correct?%'
 AND q.question_text !~* '\m(jee|neet|iit)\M'
 ), truth AS(
 SELECT e.*,
 (explanation ~ '(^|[[:space:]])I is correct[.]') i,
 (explanation ~ '(^|[[:space:]])II is correct[.]') ii,
 (explanation ~ '(^|[[:space:]])III is correct[.]') iii,
 (explanation ~ '(^|[[:space:]])IV is correct[.]') iv,
 (explanation ~ '(^|[[:space:]])I is incorrect[.]') ni,
 (explanation ~ '(^|[[:space:]])II is incorrect[.]') nii,
 (explanation ~ '(^|[[:space:]])III is incorrect[.]') niii,
 (explanation ~ '(^|[[:space:]])IV is incorrect[.]') niv
 FROM exam e
 ),valid AS(
 SELECT * FROM truth
 WHERE i<>ni AND ii<>nii AND iii<>niii AND iv<>niv
 AND (selected_option ~ '\mI\M')=i
 AND (selected_option ~ '\mII\M')=ii
 AND (selected_option ~ '\mIII\M')=iii
 AND (selected_option ~ '\mIV\M')=iv
 )
 SELECT count(*),count(DISTINCT destination_chapter_id) INTO count_ok,chapter_ok FROM valid;
 IF count_ok<>23 OR chapter_ok<>13 THEN
  RAISE EXCEPTION 'Preflight failed: % of 23 verified from % of 13 chapters',count_ok,chapter_ok;
 END IF;

 INSERT INTO cbse_import.advanced_mock_agent4_bio12_review_round6_20261028(source_question_id,checked_answer,evidence_note)
 SELECT id,answer,note FROM (VALUES
(31193::bigint,'B'::text,'Coextinction from loss of obligate partner, within-species genetic diversity, fragmentation and hotspot criteria.'::text),
(30819::bigint,'C'::text,'Therapeutic recombinant proteins, RNAi target complementarity, Bt cry specificity and alkaline-insect-gut toxin action.'::text),
(30844::bigint,'B'::text,'Biopatents are intellectual property; RNAi requires complementary sequences; ELISA uses antibody recognition; insulin retains A/B chains.'::text),
(29947::bigint,'A'::text,'Leydig androgen synthesis, corpus-luteum progesterone, Sertoli-cell germ support and spermiogenesis after meiosis.'::text),
(30919::bigint,'D'::text,'Logistic growth has maximum absolute rate at K/2, emigration reduces abundance, mutualism benefits both and migration affects population size.'::text),
(30940::bigint,'A'::text,'Parasitism harms host, predation affects abundance, logistic growth zero at K, and natality means births.'::text),
(30206::bigint,'A'::text,'Recessive carriers can mask traits, codominance expresses alleles, Down is trisomy 21 and paternal X passes to daughters.'::text),
(30229::bigint,'D'::text,'PKU autosomal recessive, point mutation changes a nucleotide, Turner typically 45X and Down syndrome is trisomy 21.'::text),
(30021::bigint,'C'::text,'ICSI injects sperm into egg, tubal ligation blocks oviduct, later embryos can transfer to uterus, vasectomy interrupts vas deferens.'::text),
(29813::bigint,'A'::text,'Tapetum nourishes pollen, generative cell forms two sperm, four pollen sacs in typical anther, double fertilisation is syngamy plus triple fusion.'::text),
(29891::bigint,'B'::text,'Ovule develops into seed, parthenocarpy forms fruit without fertilisation, triple fusion makes triploid endosperm, apomixis without syngamy.'::text),
(30741::bigint,'D'::text,'Cloning vector needs ori, biolistic microprojectiles deliver DNA, dyed gel bands are visualisable and DNA migrates to anode.'::text),
(30739::bigint,'C'::text,'Sequence-specific restriction enzymes, markers select transformants, insertional inactivation can disrupt markers, competent bacteria can take up DNA.'::text),
(31079::bigint,'A'::text,'Standing biomass can invert in aquatic systems, oxygen/mild warmth promotes decomposition, energy dissipates as heat, detritus is dead biomass.'::text),
(31127::bigint,'A'::text,'Secondary consumer eats primary, energy not recyclable, decomposers metabolise organic debris and NPP=GPP-R.'::text),
(30427::bigint,'B'::text,'Selection does not create purposive mutation, fossils document history, directional selection shifts mean and mutations generate variable alleles.'::text),
(30428::bigint,'C'::text,'Directional and disruptive selection correctly distinguished, Hardy Weinberg heterozygotes 2pq and fossils show ancient life.'::text),
(30531::bigint,'C'::text,'Innate barriers, helper T-cell roles, IgE/histamine allergy and dengue vector Aedes versus malaria Anopheles.'::text),
(30507::bigint,'A'::text,'Interferons antiviral, Anopheles rather than Aedes malaria vector, vaccination active immunity, maternal antibodies passive.'::text),
(30614::bigint,'B'::text,'Mycorrhiza enhances phosphate uptake, streptokinase breaks clots, lactic acid bacteria acidify curd, Rhizobium fixes nitrogen.'::text),
(30601::bigint,'D'::text,'Yeast fermentation not nitrogen fixing, secondary wastewater treatment lowers BOD, carbon dioxide raises dough, Aspergillus niger makes citric acid.'::text),
(30286::bigint,'A'::text,'AT has two H-bonds and GC three, spliceosomal intron removal, tRNA codon pairing and DNA template used in transcription.'::text),
(30315::bigint,'A'::text,'Semiconservative DNA molecules inherit one old strand, transcription uses DNA, coding strand corresponds to RNA except U/T, and AT/GC H bonds.'::text)
 ) v(id,answer,note);
 IF (SELECT COUNT(*) FROM cbse_import.advanced_mock_agent4_bio12_review_round6_20261028)<>23 THEN
 RAISE EXCEPTION 'Review ledger not exactly 23'; END IF;

 UPDATE cbse_import.advanced_mock_stage2_candidates_20261028 c
 SET academic_verified=true,answer_verified=true,duplicate_cleared=true,media_verified=true,
 reviewed_at=clock_timestamp(),
 reviewer_note='Agent4 Class12 Biology round6: first-pass AI-assisted scientific truth, four-statement key, answer explanation, novel fact combination and CBSE 2026-27 chapter aligned; not human teacher-certified. Owner standing release approval.',
 release_approved=true
 FROM cbse_import.advanced_mock_agent4_bio12_review_round6_20261028 r
 JOIN public.questions q ON q.id=r.source_question_id
 WHERE c.source_question_id=r.source_question_id AND c.destination_subject_id=20
 AND r.checked_answer=q.correct_option::text AND NOT c.release_approved
 AND NOT q.is_active AND q.media_ready AND c.source_media_ready
 AND NOT c.duplicate_candidate AND NOT c.media_blocked AND NOT c.answer_issue AND c.source_content_review_status<>'HOLD'
 AND coalesce(q.question_media,'{}'::jsonb)='{}'::jsonb;
 GET DIAGNOSTICS selected_updated=ROW_COUNT;
 IF selected_updated<>23 THEN RAISE EXCEPTION 'Updated % instead of 23; rolled back',selected_updated; END IF;
 SELECT COUNT(*) INTO after_count FROM cbse_import.advanced_mock_stage2_candidates_20261028
 WHERE destination_subject_id=20 AND release_approved;
 IF after_count<>before_count+23 THEN RAISE EXCEPTION 'Expected +23 Biology-only releases; was % now %',before_count,after_count; END IF;
END $$;
COMMIT;