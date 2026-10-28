-- Second substantive Class XII Biology individual AI-assisted review, 52 questions, 4 per each of 13 chapters.
-- Correctness is checked independently of Advanced Mock suitability; repeated concepts are not released.
-- No human teacher certification. No changes to public.questions or release ledger.
BEGIN;
CREATE TABLE cbse_import.advanced_mock_biology12_substantive_review_round2_20261028 (
 source_question_id bigint PRIMARY KEY,
 expected_answer text NOT NULL CHECK(expected_answer IN('A','B','C','D')),
 review_category text NOT NULL CHECK(review_category IN('FIT','REPEATED','AMBIGUOUS','ERROR')),
 evidence_note text NOT NULL,
 academic_factual_check text NOT NULL DEFAULT 'AI_ASSISTED_ANSWER_AND_CONCEPT_CHECK',
 chapter_alignment_source text NOT NULL DEFAULT 'CBSE Class XII Biology 2026-27 and NCERT Biology XII',
 human_certified boolean NOT NULL DEFAULT FALSE CHECK (human_certified=false),
 release_approved boolean NOT NULL DEFAULT FALSE CHECK (release_approved=false),
 reviewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cbse_import.advanced_mock_biology12_substantive_review_round2_20261028 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE cbse_import.advanced_mock_biology12_substantive_review_round2_20261028 FROM PUBLIC,anon,authenticated;
DO $$
DECLARE matched integer;chapter_count integer;ins integer;
BEGIN
 SELECT COUNT(*),COUNT(DISTINCT a.destination_chapter_id) INTO matched,chapter_count
 FROM (VALUES
(31167,'D','FIT','I/II false: genetic diversity includes within species and cryopreservation is ultra-cold; III/IV true: ex-situ seed banking and fragmentation harms biodiversity'),
(31198,'A','REPEATED','I-III true, IV false; repeats species-area slope Z and seed banks already individually reviewed'),
(31171,'B','REPEATED','I overexploitation, III in situ, IV hotspot true; II genetic diversity false; repeats biodiversity conservation facts'),
(31176,'B','FIT','III ecological interaction conservation and IV ex-situ true; I sacred groves are in situ and II species-area slope Z not C'),
(30824,'B','FIT','I gene therapy, II RNAi and III transgenic model true; IV PCR amplifies DNA not protein'),
(30842,'C','REPEATED','I C peptide permanent false; II activated Bt toxin damages insect gut, III recombinant hosts and IV cry genes true; insulin already reviewed'),
(30840,'A','REPEATED','I RNAi and IV insulin A/B disulfide true; II model extrapolation and III retained C peptide false; repeats previously reviewed facts'),
(30839,'B','FIT','ADA modified lymphocytes not guaranteed lifetime cure; PCR, biological IP and alkaline Bt protoxin activation true'),
(30717,'D','FIT','I insertional inactivation, III heat-stable Taq, IV doubling PCR true; II primerless PCR false'),
(30745,'B','REPEATED','II Agrobacterium vector and III PCR exponential true; I Taq heat-labile false, IV larger fragments migrate further false; Taq/PCR repeated'),
(30713,'D','REPEATED','III Taq and IV cloning ori true; I DNA electrophoresis polarity false, II linear PCR count false; repeats PCR'),
(30743,'A','FIT','I competent cells, III smaller gel fragments and IV PCR primers true; II marker preserved after insertion false'),
(31074,'B','FIT','II upright energy pyramid and IV trophic level feeding role true; I consumer-producer confusion and III humification confusion false'),
(31080,'B','FIT','I NPP=GPP-R, III detritus fragmentation, IV nutrient cycling true; II cold/dry decomposition maximization false'),
(31076,'C','REPEATED','I humification and III upright energy pyramid true; II nutrients cannot cycle and IV leaching as humus false; repeated key concepts'),
(31059,'B','REPEATED','I food web, III NPP and IV warm moist decomposition true; II inverted energy pyramid false; duplicates concept combination'),
(30399,'B','FIT','I mutations can generate heritable variation, II p+q=1, IV disruptive selection true; III directed antibiotic mutation false'),
(30416,'B','FIT','III homology shares ancestral structural plan and IV founder-effect sampling true; I disruptive selects mean and II fossils no chronology false'),
(30431,'B','REPEATED','I convergence, II reproductive isolation, IV gene flow true; III disruptive selects mean false; repeats earlier selection statement'),
(30408,'D','FIT','II stabilising selects intermediate and IV genetic drift stochastic true; I gene flow conflation with drift and III fossil chronology denial false'),
(30505,'A','REPEATED','III Salmonella Typhi typhoid and IV interferons antiviral true; I malaria misattribution and II innate exposure requirement false; disease recall'),
(30527,'A','FIT','I B lymphocyte plasma cells, II metastasis and III HIV CD4 loss true; IV S Typhi not protozoan amoebiasis'),
(30520,'B','REPEATED','I innate barriers, II B cell plasma cells and IV interferons true; III metastasis benign false; repeats B-cell metastasis'),
(30510,'B','FIT','I Anopheles malaria, II immune memory and III innate defence true; IV maternal antibody passive not active'),
(29945,'D','FIT','I oxytocin positive feedback, II cleavage partitions zygote true; III oocyte metaphase II not mitotic telophase, IV colostrum passive antibody false'),
(29912,'C','FIT','I blastocyst implantation, II prolactin milk production, III early hCG corpus luteum true; IV LH surge rather than FSH minimum triggers ovulation'),
(29914,'C','REPEATED','III blastocyst inner mass/trophoblast and IV corpus luteum progesterone true; I FSH and II colostrum claims false; repeats ovulation/colostrum'),
(29923,'A','REPEATED','III blastocyst implantation and IV hCG true; I Leydig androgens rather than inhibin and II colostrum passive false; repeated hormones'),
(30612,'C','REPEATED','II Rhizobium, III Penicillium, IV Bt biocontrol true; I streptokinase clot-dissolving, not statin; microbe recall'),
(30602,'D','REPEATED','II mycorrhiza phosphorus, III penicillin and IV streptokinase true; I Rhizobium does fix N2; repeats microbe application'),
(30603,'B','FIT','I LAB curd acid, III anaerobic methane generation and IV yeast fermentation true; II streptokinase not cholesterol inhibitor'),
(30613,'B','FIT','I cyclosporin immunosuppressant, II Penicillium penicillin and IV Acetobacter vinegar true; III dough rises from CO2 not alcohol'),
(30287,'A','FIT','I DNA polymerase 5-to-3 and III ligase joins DNA true; II introns removed, IV Okazaki DNA not Golgi proteins false'),
(30295,'A','REPEATED','II reverse transcriptase and III degeneracy true; I introns translated and IV UAG start false; codon and intron recall'),
(30310,'A','FIT','I DNA antiparallel, II lac operator binding and III allolactose inducer true; IV A=G false (A=T, G=C)'),
(30307,'A','REPEATED','II A-T two bonds and IV lagging Okazaki true; I lac repressor not beta-galactosidase, III conservative strands false; repeats replication'),
(30935,'C','FIT','I parasitism costs host and IV natality true; II logistic peak occurs at K/2, III predation affects prey'),
(30957,'C','REPEATED','I age pyramid and II natality true; III parasitism does not benefit both, IV logistic zero at K; repeated logistic'),
(30951,'A','FIT','II age structure, III commensalism and IV brood parasitism true; I exponential growth requires unlimited resources not fixed K'),
(30952,'D','REPEATED','I mutualism, III carrying capacity and IV brood parasitism true; II migration can affect population size; repeats population interaction'),
(30189,'B','FIT','II codominance and IV X-linked haemophilia true; I AaBb produces four independent gametes, III i is recessive'),
(30209,'B','REPEATED','I/II haemophilia and hemizygous males true; IV unlinked AaBb four gametes true; III paternal X daughters not sons; same core facts'),
(30197,'B','REPEATED','I ABO, II haemophilia and IV point mutation true; III Down is trisomy 21 not sex chromosome; repeats ABO/haemophilia'),
(30215,'C','FIT','II X-linked hemizygosity and III ABO codominance true; I Klinefelter 47XXY not 45X; IV crossing over can split linked genes'),
(30040,'D','FIT','I infertility either/both partners and IV ZIFT fallopian tube true; II amniocentesis diagnosis and III vasectomy vas deferens not ureter'),
(30024,'D','FIT','II lactational amenorrhoea suppresses ovulation and IV amniocentesis diagnostic true; I copper IUD local, III late embryos uterus'),
(30019,'C','REPEATED','II amniocentesis and III vasectomy true; I condoms not LH suppression, IV hormonal pills no STI physical barrier; repeated'),
(30037,'C','REPEATED','II copper IUD, III ZIFT and IV oral-contraceptive feedback true; I lactational amenorrhoea not permanent; repeated earlier'),
(29833,'C','REPEATED','I four anther microsporangia, II microspore meiosis and IV generative cell two gametes true; III bagging excludes pollen false; recall'),
(29830,'B','FIT','III syngamy forms zygote and IV generative two gametes true; I parthenocarpy fruit not embryo, II filiform apparatus synergid not antipodal'),
(29815,'A','REPEATED','I syngamy, III four anther microsporangia, IV generative two gametes true; II microspore mother cell undergoes meiosis; repeated'),
(29842,'A','FIT','I synergid filiform apparatus and IV two male gametes true; II triple fusion 3n endosperm, III bagging prevents unwanted pollen')
 ) AS v(id,answer,assessment,note)
 JOIN public.questions q ON q.id=v.id AND q.correct_option=v.answer
 JOIN cbse_import.advanced_mock_bulk_academic_audit_20261028 a ON a.source_question_id=v.id
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=v.id
 WHERE a.destination_subject_id=20 AND a.automated_qc_status='PASS_PRELIMINARY_AUTOMATED_SCREEN'
 AND c.release_approved=false AND q.is_active=false
 AND NOT EXISTS (SELECT 1 FROM cbse_import.advanced_mock_biology12_substantive_review_20261028 prev WHERE prev.source_question_id=v.id);
 IF matched<>52 OR chapter_count<>13 THEN
 RAISE EXCEPTION 'Review evidence mismatched: % rows over % chapters',matched,chapter_count;
 END IF;
 INSERT INTO cbse_import.advanced_mock_biology12_substantive_review_round2_20261028
 (source_question_id,expected_answer,review_category,evidence_note)
 SELECT id,answer,assessment,note FROM (VALUES
(31167,'D','FIT','I/II false: genetic diversity includes within species and cryopreservation is ultra-cold; III/IV true: ex-situ seed banking and fragmentation harms biodiversity'),
(31198,'A','REPEATED','I-III true, IV false; repeats species-area slope Z and seed banks already individually reviewed'),
(31171,'B','REPEATED','I overexploitation, III in situ, IV hotspot true; II genetic diversity false; repeats biodiversity conservation facts'),
(31176,'B','FIT','III ecological interaction conservation and IV ex-situ true; I sacred groves are in situ and II species-area slope Z not C'),
(30824,'B','FIT','I gene therapy, II RNAi and III transgenic model true; IV PCR amplifies DNA not protein'),
(30842,'C','REPEATED','I C peptide permanent false; II activated Bt toxin damages insect gut, III recombinant hosts and IV cry genes true; insulin already reviewed'),
(30840,'A','REPEATED','I RNAi and IV insulin A/B disulfide true; II model extrapolation and III retained C peptide false; repeats previously reviewed facts'),
(30839,'B','FIT','ADA modified lymphocytes not guaranteed lifetime cure; PCR, biological IP and alkaline Bt protoxin activation true'),
(30717,'D','FIT','I insertional inactivation, III heat-stable Taq, IV doubling PCR true; II primerless PCR false'),
(30745,'B','REPEATED','II Agrobacterium vector and III PCR exponential true; I Taq heat-labile false, IV larger fragments migrate further false; Taq/PCR repeated'),
(30713,'D','REPEATED','III Taq and IV cloning ori true; I DNA electrophoresis polarity false, II linear PCR count false; repeats PCR'),
(30743,'A','FIT','I competent cells, III smaller gel fragments and IV PCR primers true; II marker preserved after insertion false'),
(31074,'B','FIT','II upright energy pyramid and IV trophic level feeding role true; I consumer-producer confusion and III humification confusion false'),
(31080,'B','FIT','I NPP=GPP-R, III detritus fragmentation, IV nutrient cycling true; II cold/dry decomposition maximization false'),
(31076,'C','REPEATED','I humification and III upright energy pyramid true; II nutrients cannot cycle and IV leaching as humus false; repeated key concepts'),
(31059,'B','REPEATED','I food web, III NPP and IV warm moist decomposition true; II inverted energy pyramid false; duplicates concept combination'),
(30399,'B','FIT','I mutations can generate heritable variation, II p+q=1, IV disruptive selection true; III directed antibiotic mutation false'),
(30416,'B','FIT','III homology shares ancestral structural plan and IV founder-effect sampling true; I disruptive selects mean and II fossils no chronology false'),
(30431,'B','REPEATED','I convergence, II reproductive isolation, IV gene flow true; III disruptive selects mean false; repeats earlier selection statement'),
(30408,'D','FIT','II stabilising selects intermediate and IV genetic drift stochastic true; I gene flow conflation with drift and III fossil chronology denial false'),
(30505,'A','REPEATED','III Salmonella Typhi typhoid and IV interferons antiviral true; I malaria misattribution and II innate exposure requirement false; disease recall'),
(30527,'A','FIT','I B lymphocyte plasma cells, II metastasis and III HIV CD4 loss true; IV S Typhi not protozoan amoebiasis'),
(30520,'B','REPEATED','I innate barriers, II B cell plasma cells and IV interferons true; III metastasis benign false; repeats B-cell metastasis'),
(30510,'B','FIT','I Anopheles malaria, II immune memory and III innate defence true; IV maternal antibody passive not active'),
(29945,'D','FIT','I oxytocin positive feedback, II cleavage partitions zygote true; III oocyte metaphase II not mitotic telophase, IV colostrum passive antibody false'),
(29912,'C','FIT','I blastocyst implantation, II prolactin milk production, III early hCG corpus luteum true; IV LH surge rather than FSH minimum triggers ovulation'),
(29914,'C','REPEATED','III blastocyst inner mass/trophoblast and IV corpus luteum progesterone true; I FSH and II colostrum claims false; repeats ovulation/colostrum'),
(29923,'A','REPEATED','III blastocyst implantation and IV hCG true; I Leydig androgens rather than inhibin and II colostrum passive false; repeated hormones'),
(30612,'C','REPEATED','II Rhizobium, III Penicillium, IV Bt biocontrol true; I streptokinase clot-dissolving, not statin; microbe recall'),
(30602,'D','REPEATED','II mycorrhiza phosphorus, III penicillin and IV streptokinase true; I Rhizobium does fix N2; repeats microbe application'),
(30603,'B','FIT','I LAB curd acid, III anaerobic methane generation and IV yeast fermentation true; II streptokinase not cholesterol inhibitor'),
(30613,'B','FIT','I cyclosporin immunosuppressant, II Penicillium penicillin and IV Acetobacter vinegar true; III dough rises from CO2 not alcohol'),
(30287,'A','FIT','I DNA polymerase 5-to-3 and III ligase joins DNA true; II introns removed, IV Okazaki DNA not Golgi proteins false'),
(30295,'A','REPEATED','II reverse transcriptase and III degeneracy true; I introns translated and IV UAG start false; codon and intron recall'),
(30310,'A','FIT','I DNA antiparallel, II lac operator binding and III allolactose inducer true; IV A=G false (A=T, G=C)'),
(30307,'A','REPEATED','II A-T two bonds and IV lagging Okazaki true; I lac repressor not beta-galactosidase, III conservative strands false; repeats replication'),
(30935,'C','FIT','I parasitism costs host and IV natality true; II logistic peak occurs at K/2, III predation affects prey'),
(30957,'C','REPEATED','I age pyramid and II natality true; III parasitism does not benefit both, IV logistic zero at K; repeated logistic'),
(30951,'A','FIT','II age structure, III commensalism and IV brood parasitism true; I exponential growth requires unlimited resources not fixed K'),
(30952,'D','REPEATED','I mutualism, III carrying capacity and IV brood parasitism true; II migration can affect population size; repeats population interaction'),
(30189,'B','FIT','II codominance and IV X-linked haemophilia true; I AaBb produces four independent gametes, III i is recessive'),
(30209,'B','REPEATED','I/II haemophilia and hemizygous males true; IV unlinked AaBb four gametes true; III paternal X daughters not sons; same core facts'),
(30197,'B','REPEATED','I ABO, II haemophilia and IV point mutation true; III Down is trisomy 21 not sex chromosome; repeats ABO/haemophilia'),
(30215,'C','FIT','II X-linked hemizygosity and III ABO codominance true; I Klinefelter 47XXY not 45X; IV crossing over can split linked genes'),
(30040,'D','FIT','I infertility either/both partners and IV ZIFT fallopian tube true; II amniocentesis diagnosis and III vasectomy vas deferens not ureter'),
(30024,'D','FIT','II lactational amenorrhoea suppresses ovulation and IV amniocentesis diagnostic true; I copper IUD local, III late embryos uterus'),
(30019,'C','REPEATED','II amniocentesis and III vasectomy true; I condoms not LH suppression, IV hormonal pills no STI physical barrier; repeated'),
(30037,'C','REPEATED','II copper IUD, III ZIFT and IV oral-contraceptive feedback true; I lactational amenorrhoea not permanent; repeated earlier'),
(29833,'C','REPEATED','I four anther microsporangia, II microspore meiosis and IV generative cell two gametes true; III bagging excludes pollen false; recall'),
(29830,'B','FIT','III syngamy forms zygote and IV generative two gametes true; I parthenocarpy fruit not embryo, II filiform apparatus synergid not antipodal'),
(29815,'A','REPEATED','I syngamy, III four anther microsporangia, IV generative two gametes true; II microspore mother cell undergoes meiosis; repeated'),
(29842,'A','FIT','I synergid filiform apparatus and IV two male gametes true; II triple fusion 3n endosperm, III bagging prevents unwanted pollen')
 ) AS v(id,answer,assessment,note);
 GET DIAGNOSTICS ins=ROW_COUNT;
 IF ins<>52 THEN RAISE EXCEPTION 'Expected 52 review rows, got %',ins; END IF;
END $$;
COMMIT;
