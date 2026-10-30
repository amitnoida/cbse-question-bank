# Teacher PDF and Word import POC

Admin dashboard → Teacher MCQ Imports (/admin/teacher-imports). Teacher uploads are now limited to text-based PDF and Word .docx, ten MiB per file, ten files per submission. New uploads select one subject and one chapter. Scanned pages, screenshots, legacy .doc and handwriting are outside this POC.

Process & Import downloads the private source into the authenticated admin browser. PDF.js 6.4.299 (browser compatibility build) reads PDF text using a self-hosted worker. Mammoth 1.13.0 converts Word content to inert text; generated HTML is never rendered. Dependencies are pinned; their license notices and the PDF worker are copied by the npm postinstall script. There are no AI API calls, external OCR services or new paid plans.

The parser recognizes numbered questions, four distinct options A–D, an explicit correct answer letter and a source explanation. It never generates missing information. Wrapped text and common marker forms are supported. Unsupported layouts, ambiguous/missing answers, missing explanations, diagram references and unreadable text are skipped. Source pages with no extractable text fail before import and remain available for retry. Each file is limited to 300 PDF pages, one million extracted characters and 3,000 recognized questions. Unrecognized text cannot be reliably counted as questions.

Example source layout:

```
1. What is the derivative of x^2?
A. 2x
B. x
C. 2
D. x^2
Answer: A
Explanation: The power rule gives d(x^2)/dx = 2x.
```

The server independently parses submitted text, verifies Full Admin permission and the destination chapter, then calls a service-only transaction. It inserts complete questions as active TEST_READY MCQs with one mark, Medium difficulty and SHARED usage. TEST_READY means technically complete; it does NOT mean a teacher or AI performed academic certification. No semantic difficulty assessment or independent answer verification is performed. Duplicate checking compares normalized question/options in the destination chapter, including inactive questions, and catches within-file and cross-file repeats. It is not semantic similarity matching.

A unique per-file import record, an advisory lock and the transaction prevent repeated clicks, concurrent imports or a lost response from duplicating questions. The transaction records imported question IDs and counts; all accepted inserts and history commit together. Original source text and skipped question bodies are not retained.

Only after a verified commit does the server call Supabase Storage remove. The metadata and import history are retained with a source deletion timestamp; imported questions remain in the database. A cleanup failure shows Retry source cleanup and never re-extracts/reinserts. A browser/download failure before commit preserves the original. Closing the browser may stop extraction; it is not an unattended background AI job. Uploaded file bytes count against existing Storage quotas until deleted; imported question rows use database storage.

No additional teacher review or second admin approval is required. Admin can inspect imported questions through View imported MCQs. Successful files are deleted even when only some of their recognized questions could be imported. All-skipped recognized files are recorded and cleaned up. Files with no recognizable question boundaries remain pending for retry/manual deletion rather than claiming successful processing.

Verification sources: maintenance/test-mcq-document-parser.cjs; rollback-only maintenance/test-teacher-document-import.sql; real document generator maintenance/generate-import-poc.py; browser workflow e2e/teacher-imports.spec.cjs. The fixtures contain five numbered questions per file: PDF expects three imports and two skips; DOCX expects two imports and three skips after cross-file duplicate checking. The browser check also interrupts a source download, retries and verifies source removal plus retained active question rows.

## Verified release — 30 October 2026

Production browser workflow 41014104195 passed end to end. The current submission imported 3/5 questions from the PDF (2 skipped) and 2/5 from DOCX (3 skipped, including the cross-file duplicate). Both originals were physically deleted, their history remained readable, and imported active question rows were verified. Repeating the same import did not add questions. An interrupted download retained its original; reloading the dashboard and retrying succeeded. Older disposable test sources were also processed and reclaimed, leaving zero objects in the teacher source bucket before fixture cleanup.

The PDF.js browser compatibility build and matching self-hosted worker support older browser engines. The page must stay open during extraction. Teacher workflow regression 41012116535, production TypeScript/build checks, 35 focused parser/account/session tests and the rollback-only database import checks passed. Temporary POC questions/accounts were cleaned up only after checking for question references, preserving existing student data.

## Owner's permanent import rule — 30 October 2026

The canonical instruction is in root `AGENTS.md` under **ExamYari — standing MCQ import policy**. Teachers alone are responsible for academic review. Ingestion only extracts clear source MCQs, checks four options, an explicit correct answer and a source-supported explanation, confirms chapter/class mapping, deduplicates and inserts accepted questions directly as active `TEST_READY`. **No hold queue, no AI academic review, no question repairs, no OCR rescues and no paid AI services.** If only 250 of 500 items meet the rules, import 250 and ignore the rest. Normal successful import deletes the original source after atomic commit; failures before a valid commit retain it for safe retries. A file whose extraction contains no numbered recognized questions still needs administrative cleanup under the present reader; do not misreport it as imported.
