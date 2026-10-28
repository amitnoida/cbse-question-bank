# Agent 1 — CBSE Advanced Mock academic review and production release

Date: 2026-10-28 (IST)  
Project: `amitnoida/cbse-question-bank`; Supabase `darfsuqfmmunxqiyqlvn`  
Agent ownership ONLY: Class 11 Biology (subject 16) and Physics (subject 19).  
Official curriculum: https://cbseacademic.nic.in/curriculum_2027.html

## Controlled execution summary

- Production initial verified state: Physics 60 of 1,569 candidates live; Biology 0 of 98 candidates live.
- Batch 1: 45 individually examined; 4 accepted, 41 rejected, 3 Physics questions released: `28056, 28168, 28677`. Biology question `29683` accepted academically but held due to coverage.
- Batch 2: 13 individually examined; 5 accepted, 8 rejected, 5 Physics questions released: `28043, 28191, 28494, 28521, 28644`.
- Cumulative: **58 reviewed, 9 accepted, 49 rejected, 8 newly released**.
- Final release flags following transactions: **Physics 68 live; Biology 0 live** (68 total in assigned subjects).
- Remaining individually unreviewed: Physics 1,456; Biology 93; total **1,549**.
- Biology pool issue: all 98 staged candidates map to chapter 349, *Body Fluids and Circulation*. Do not present this as an adequately chapter-balanced full Biology mock.
- Source `public.questions.is_active` remains false for every newly released question. Students access these questions ONLY through existing isolated `cbse_import.advanced_mock_stage2_candidates_20261028` release flags and Advanced Mock runtime.
- No application UI change, Practice or Standard Mock Test change, or student-account change was made. No changes to shared PR #24.
- **AI-assisted individual first-pass review**, not human-expert certification. Accept/reject evidence below. Metadata and preliminary automated QC were not treated as independent verification.

## Production audit source and atomic release controls

The authoritative 58-row review register is `cbse_import.advanced_mock_agent1_review_20261028` (private table, RLS enabled; no anon/authenticated access), with per-question evidence, review decision and release authorization.

Two separate atomic PostgreSQL `DO` transactions released exactly the IDs above. Both:
- locked on subject-specific advisory key `agent1-advanced-mock-subject-19`;
- required correct Class 11 subject/chapter mapping, four nonempty options, valid answer and explanation;
- required our independent per-ID accepted register decision; all source questions inactive, source media ready, no blocked/duplicate/answer issue flags;
- required the exact eligible-row counts (3 and 5), and checked exact updated rows;
- verified subject-local live count increased by exactly 3 or 5 and Biology released count remained unchanged;
- aborted and rolled back on any count mismatch or unexpected concurrent change.

A follow-up database check confirmed the first 3 IDs' class/subject/chapter, inactive source/media readiness, distinct text, zero rejected releases and unchanged Biology count. The post-second-batch snapshot confirmed 68 live Physics questions and zero Biology.

## Exact live source question IDs released

- `28043`
- `28056`
- `28168`
- `28191`
- `28494`
- `28521`
- `28644`
- `28677`

## Individual academic review evidence

| Source question ID | Destination subject ID | Destination chapter | Review decision | Production status | Individual first-pass evidence |
|---:|---:|---|---|---|---|
| 29683 | 16 | Body Fluids and Circulation | ACCEPTED | APPROVED / COVERAGE HOLD | Verified ABO: AB has both A/B antigens; QRS=ventricular depolarisation; RV→pulmonary artery; neutrophils/monocytes phagocytose. Correct combination II,III,IV=A. Release held because all 98 Class 11 Biology candidates map to a single chapter. |
| 29724 | 16 | Body Fluids and Circulation | REJECTED | UNRELEASED | Correct option D pairs platelets with clotting and SA node with pacemaker; elementary definition matching. |
| 29728 | 16 | Body Fluids and Circulation | REJECTED | UNRELEASED | 65×80/1000=5.2 L/min correct; one-step cardiac-output arithmetic and repeated pattern. |
| 29746 | 16 | Body Fluids and Circulation | REJECTED | UNRELEASED | 72×70/1000=5.04 L/min correct; near-repeat ID 29728. |
| 29778 | 16 | Body Fluids and Circulation | REJECTED | UNRELEASED | SA→AV→AV bundle→Purkinje is correct B, but elementary recall below Advanced Mock level. |
| 27927 | 19 | Units and Measurements | REJECTED | UNRELEASED | Pendulum uncertainty 0.2+2(2.5/108)×100=4.82963%; numerical duplicate of live uncertainty problems. |
| 27948 | 19 | Units and Measurements | REJECTED | UNRELEASED | Pendulum uncertainty 0.2+2×2.9/116×100=5.2%; same live template. |
| 27951 | 19 | Units and Measurements | REJECTED | UNRELEASED | Pendulum relative-uncertainty 0.2+2×3.2/122×100=5.4459% correct but repeated live template ID 27947. |
| 27986 | 19 | Motion in a Straight Line | REJECTED | UNRELEASED | Two-stage acceleration then braking 2652.53 m correct but numerical repeat of live ID 27984. |
| 28000 | 19 | Motion in a Straight Line | REJECTED | UNRELEASED | Two-stage acceleration then braking 9050.52 m correct but numerical repeat of live ID 27984. |
| 28039 | 19 | Motion in a Plane | REJECTED | UNRELEASED | Horizontal launch range 52√(46/10)=111.528 m; duplicates live horizontal-launch ID 32833. |
| 28040 | 19 | Motion in a Plane | REJECTED | UNRELEASED | Horizontal-projectile range 54√(4.8)=118.308 m correct but repeats live ID 32833. |
| 28043 | 19 | Laws of Motion | ACCEPTED | RELEASED | Angled pull 140 N at 37°: N=150−84=66 N, fk=13.2 N, net horizontal 112−13.2=98.8 N; a=98.8/15=6.58667 m/s². Distinct from live rough incline problems. |
| 28056 | 19 | Laws of Motion | ACCEPTED | RELEASED | Two-block contact force: a=210/(20+22)=5 m/s² and Fcontact=22×5=110 N; distinct from released pulley/lift/incline problems. |
| 28132 | 19 | Work, Energy and Power | REJECTED | UNRELEASED | Perfectly inelastic collision v=17×20/(17+18)=9.71429 m/s, already covered in agent1 review and existing live collision theme. |
| 28133 | 19 | Work, Energy and Power | REJECTED | UNRELEASED | Perfectly inelastic common speed 18×21/37=10.2162 m/s; near-duplicate ID 28134. |
| 28134 | 19 | Work, Energy and Power | REJECTED | UNRELEASED | Perfectly inelastic common speed 19×22/39=10.7179 m/s; low difficulty and overlaps live ID 33080 collision theme. |
| 28156 | 19 | Work, Energy and Power | REJECTED | UNRELEASED | Question text contains JEE Advanced label; also trivial instantaneous power P=Fv. |
| 28168 | 19 | System of Particles and Rotational Motion | ACCEPTED | RELEASED | Energy conservation for hinged rod: MgL/2=(ML²/6)ω²; ω=√(3g/L)=√(30/9)=1.82574 rad/s; distinct from existing inertia/rolling questions. |
| 28191 | 19 | System of Particles and Rotational Motion | ACCEPTED | RELEASED | Uniform disc I=15×0.2²/2=0.3 kg m²; braking deceleration 19/2=9.5 rad/s²; torque 2.85 N m. More involved than one-step live angular acceleration. |
| 28248 | 19 | Gravitation | REJECTED | UNRELEASED | Altitude 12R implies 1/13²=0.00591716; elementary and overlaps live ID 33231. |
| 28254 | 19 | Gravitation | REJECTED | UNRELEASED | Altitude 15R gives g/g_surface=1/16²=0.00390625; basic and repeats released inverse-square altitude concept. |
| 28262 | 19 | Gravitation | REJECTED | UNRELEASED | Altitude 19R implies 1/20²=0.0025; duplicates altitude formula. |
| 28307 | 19 | Mechanical Properties of Fluids | REJECTED | UNRELEASED | Capillary rise ratio 2×13=26; straightforward one-step repetition of capillarity formula. |
| 28344 | 19 | Mechanical Properties of Solids | REJECTED | UNRELEASED | Two-wire series Young modulus 2/(1/150+1/300)=200 GPa; duplicates live ID 28342. |
| 28349 | 19 | Mechanical Properties of Solids | REJECTED | UNRELEASED | Young modulus series result 266.667 GPa; duplicates live ID 28342. |
| 28382 | 19 | Mechanical Properties of Solids | REJECTED | UNRELEASED | Young extension F L/(AY)=100×2/(10^-6×2×10^11)=0.001 m, duplicates live ID 33333. |
| 28389 | 19 | Mechanical Properties of Solids | REJECTED | UNRELEASED | Question carries JEE Advanced branding and asks elementary bulk-modulus definition. |
| 28418 | 19 | Thermal Properties of Matter | REJECTED | UNRELEASED | Ice melt fraction (4.2×19−21)/336=0.175 correct but duplicates live ID 28400. |
| 28427 | 19 | Thermal Properties of Matter | REJECTED | UNRELEASED | Linear expansion ΔL=1e-5×2×28=0.56 mm; numerical variant of earlier simple expansion problem. |
| 28429 | 19 | Thermal Properties of Matter | REJECTED | UNRELEASED | Linear expansion ΔL=0.58 mm; one-step formula substitution. |
| 28494 | 19 | Thermodynamics | ACCEPTED | RELEASED | Carnot cycle work (1−370/570)×2700=947.368 J; physically valid efficiency/kelvin application and distinct from released thermodynamics items. |
| 28521 | 19 | Kinetic Theory | ACCEPTED | RELEASED | Mixture molar heat capacities: Cv/R=16×1.5+17×2.5=66.5, Cp/R=16×2.5+17×3.5=99.5, gamma=99.5/66.5=1.49624; correct unique choice B. |
| 28545 | 19 | Kinetic Theory | REJECTED | UNRELEASED | rms N2 674.018 m/s; same technique as live ID 33459. |
| 28578 | 19 | Oscillations | REJECTED | UNRELEASED | Spring energy 0.5×30×0.2²=0.6 J; too basic. |
| 28595 | 19 | Oscillations | REJECTED | UNRELEASED | Frequency 270/18=15 Hz; too basic. |
| 28613 | 19 | Oscillations | REJECTED | UNRELEASED | Spring energy 0.5×120×0.2²=2.4 J; duplicates easy ID 28578. |
| 28619 | 19 | Oscillations | REJECTED | UNRELEASED | Spring energy 0.5×140×0.2²=2.8 J; duplicates easy ID 28578. |
| 28622 | 19 | Oscillations | REJECTED | UNRELEASED | E=0.5×150×0.2²=3 J; too basic and numerical spring-energy duplicate. |
| 28644 | 19 | Waves | ACCEPTED | RELEASED | Nineteenth closed/open mode ratio [(2×19−1)/4] / [19/2]=37/38=0.973684; correct option D, distinct standing-wave mode comparison. |
| 28677 | 19 | Waves | ACCEPTED | RELEASED | Coherent-wave phasor addition: resultant √(16²+17²+2×16×17×cos120°)=√273=16.5227 mm. Novel relative to 60 live Physics questions. |
| 32789 | 19 | Units and Measurements | REJECTED | UNRELEASED | One-step screw-gauge pitch (4/12=1/3 mm); too basic. |
| 32854 | 19 | Motion in a Straight Line | REJECTED | UNRELEASED | v=19+13×7=110 m/s; one-step and repetitive. |
| 32871 | 19 | Motion in a Straight Line | REJECTED | UNRELEASED | s=7×9+0.5×2×81=144 m; formula-only basic. |
| 32921 | 19 | Motion in a Plane | REJECTED | UNRELEASED | Horizontal range 8√(90/10)=24 m correct but repeats live ID 32833. |
| 32996 | 19 | Laws of Motion | REJECTED | UNRELEASED | Lift apparent weight 60(10+1.5)=690 N; repeats live ID 32977. |
| 33041 | 19 | Work, Energy and Power | REJECTED | UNRELEASED | Parallel-force work 391×3=1173 J; too basic. |
| 33186 | 19 | System of Particles and Rotational Motion | REJECTED | UNRELEASED | Skater angular speed doubles to 6 rad/s; repeats live ID 33148. |
| 33209 | 19 | Gravitation | REJECTED | UNRELEASED | g(3R)=4/9 m/s²; one-step, overlaps released altitude gravity ID 33231. |
| 33217 | 19 | Gravitation | REJECTED | UNRELEASED | Inverse-square gravitational force 132/4=33 N; too basic. |
| 33271 | 19 | Mechanical Properties of Fluids | REJECTED | UNRELEASED | Capillary rise 7.2 cm correct, but same calculation type already live as ID 33328. |
| 33292 | 19 | Mechanical Properties of Solids | REJECTED | UNRELEASED | Hooke constant 132/11=12 N/cm; too basic. |
| 33304 | 19 | Mechanical Properties of Fluids | REJECTED | UNRELEASED | Capillary rise 2.88 cm correct, numerical variant of ID 33271 and live 33328. |
| 33363 | 19 | Thermodynamics | REJECTED | UNRELEASED | Adiabatic T=360/3^0.4≈232 K correct; repeats live ID 33353. |
| 33373 | 19 | Thermodynamics | REJECTED | UNRELEASED | Carnot efficiency (155−144)/155=11/155; overly elementary. |
| 33462 | 19 | Kinetic Theory | REJECTED | UNRELEASED | rms speed √(3×8.3×350/0.028)=557.9 m/s; numerical variant of live ID 33459. |
| 34222 | 19 | Units and Measurements | REJECTED | UNRELEASED | Vernier addition 10+9×0.1=10.9 mm; too basic. |
| 34244 | 19 | Waves | REJECTED | UNRELEASED | Resonance tube v=2×480×(0.5−0.2)=288 m/s; repeats live ID 34207. |

## Reconciliation / read-only audit SQL

```sql
SELECT c.destination_subject_id,
       count(*) AS candidate_count,
       count(*) FILTER (WHERE c.release_approved) AS release_flagged,
       count(*) FILTER (WHERE c.release_approved AND c.academic_verified
         AND c.answer_verified AND c.duplicate_cleared AND c.media_verified
         AND c.reviewed_at IS NOT NULL AND c.source_content_review_status <> 'HOLD'
         AND q.is_active = false AND q.media_ready = true) AS runtime_live
FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
JOIN public.questions q ON q.id = c.source_question_id
WHERE c.destination_subject_id IN (16,19)
GROUP BY c.destination_subject_id;

SELECT r.review_status, r.destination_subject_id, count(*)
FROM cbse_import.advanced_mock_agent1_review_20261028 r
GROUP BY 1,2 ORDER BY 2,1;
```

No browser or end-to-end test was run; those tests are deferred until the four agents complete release work.
