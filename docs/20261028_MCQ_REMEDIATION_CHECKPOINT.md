# MCQ defect remediation checkpoint — 28 October 2026

## Applied production fix: two incorrect answer keys
- **Class 9 Mathematics QID 732:** fifth term of AP with a=8,d=3. Explanation is `8+4×3=20`; corrected correct_option `D (19)` → `A (20)`.
- **Class 9 Mathematics QID 736:** tenth term of 2,5,8... Explanation is `2+9×3=29`; corrected correct_option `A (28)` → `B (29)`.
- SQL is guarded by question identity, chapter, original answer, expected choice and matching arithmetic explanation; aborts if source changed. Only `public.questions.correct_option` and `updated_at` changed.
- Verified after execution both choices match explanation and questions remain active.
- Historical quiz attempts remain untouched; QID 732 had one historical unanswered quiz record storing the prior `D` answer snapshot, QID 736 had no quiz answer rows. Do not rewrite old reports automatically.

## Confirmed non-defects
- **Zero** identical choices within each question when compared case-sensitively (Class 8–12).
- **Zero** identical complete MCQs (same chapter, question, four options, answer) within school content.
- Variants `TT` and `tt`, or algebraic `D` and `d`, are not duplicates just because lowercase normalization matches.
- Generic normalized prompts such as “Which pair is correctly matched?” may have different answer options and different correct examples; do not deactivate them based on a same-prompt-only alert.
- Arithmetic checks must distinguish **a polynomial's value `p(1)=0`** from the **zero/root of the polynomial `x=1`**. A naive numeric-final-result heuristic falsely flags valid options.
- 463 active explanations below 20 characters: 249 in Class 9 (208 mathematics, 41 science), 214 Class 10 (183 Hindi, 14 English, 6 Science, 4 Maths, 7 Social Science). These are *review candidates*, not necessarily wrong answers. For example `F=ma=3×2=6 N` is valid short teaching content. Improve explanation quality selectively, not a bulk automatic deactivation.

## Unfinished gated content
- 1,222 inactive Class 8–12 questions remain; 164 school image rows are media-not-ready, part of 613 overall across school and deferred exams.
- Do not bulk activate `HOLD`, `PENDING_REVIEW`, or missing-media questions.
- No student role, free-usage, mock allocation, payment or existing question wording changed.

## Further validation
- Review more mathematical calculations with topic-aware checks, then manually verify before any correction.
- Review near-identical paraphrased MCQs as *pedagogic repetition* separately; avoid assuming wrong answer.
- Run 12-account automated UI suite after any high-risk change. Answer correction is DB-only, but historical score reports should not be rewritten inadvertently.
