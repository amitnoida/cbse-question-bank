# ExamYari — children's data protection implementation and independent legal-review packet

Date: 30 October 2026. Status: engineering implementation with **independent counsel sign-off still required**, not a lawyer's opinion or compliance certificate.

## Governing official material and timing

- Government of India, Digital Personal Data Protection Act 2023: https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf
- MeitY November 13, 2025 commencement notification: https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf
- MeitY DPDP Rules 2025: https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf

Sections 3–10 of the Act and Rules 3, 5–16, 22–23 are generally scheduled to commence eighteen months after the November 13, 2025 notification (May 13, 2027), subject to later amendments/orders. Confirm operative version with qualified Indian counsel.

Section 9 concerns verifiable parental/lawful-guardian consent, child welfare, child tracking/behaviour monitoring and targeted advertising. Rule 10 describes verification of adult identity/age using reliable existing information, voluntarily provided reliable details or an authorized token (including Digital Locker). **An email OTP, age checkbox or simple self-assertion alone does not verify adult age.** Whether ExamYari qualifies for any fourth-schedule educational-institution exemption must be decided by legal counsel; being a private tutoring/practice website is not automatically such an exemption.

## Controls in this release

1. **Current public self-signup:** The registration form accepts students of all ages based on a single declaration of parent/guardian permission and supervision for users under 18. It does **not** collect age, independently verify guardian authority, or enforce a server-side guardian-consent prerequisite. Adult verification is NOT implemented on public self-service signup.
2. **Manual guardian verification register:** Before a Full Admin can create a new STUDENT account through the admin API, a private, single-use guardian consent record must be present. The admin must verify the adult's age/identity through DigiLocker/reliable existing record/offline government-issued document, verify parental or lawful guardian authority, give the privacy notice, obtain affirmative guardian consent, and record the verification method, non-sensitive case reference, notice version, consent timestamp and admin verifier.
3. **No sensitive document storage:** ExamYari stores audit references and the verified adult's contact details, not government ID photos, full Aadhaar numbers or DOB scans. Any offline identity handling must have separately approved secure procedures; don't use ordinary email attachments for ID scans.
4. **One-use grant:** The backend atomically reserves the consent for one creation request and links it to that child account. Role enforcement is Full Admin/service-role only; table is RLS-protected and inaccessible to anon/authenticated clients.
5. **Privacy choices:** Public-page GA4 opt-in only; private student/admin pages excluded. No targeted advertising to children is intentionally implemented.
6. **Parent rights:** `/parent-consent`, `/privacy` and `/contact` explain the request/correction/deletion channels. Verified identity/guardian authority is required before disclosure.

## Known gaps / do NOT claim complete compliance

- Public self-signup has no age-verification or independently verified guardian-consent gate; a checkbox is insufficient as evidence. Implement a legally reviewed server-side gate with a verifiable adult-authority workflow before representing the service as fully verified.
- Existing ~34 student accounts predate the guardian register. Review their ages and parental permissions using minimal, lawful outreach before changing or disabling their accounts; do not automatically infer that all minors lack consent.
- The manual process depends on trained authorized staff actually checking reliable adult identity and guardian relationship and keeping separate secure evidence of that check. The application cannot independently validate an offline document or DigiLocker token without a suitable authorized integration.
- A verified adult is not automatically the child's parent. Relationship verification requires a defensible lawful process; legal counsel should specify acceptable evidence and audit retention without over-collection.
- The operator's legal identity, privacy grievance contact, breach response, records of processing, data-retention/deletion schedule, third-party DPAs, cross-border flows and security impact assessment need independent review.
- Consider whether the platform is a Data Fiduciary subject to all Rule 10 duties and whether any educational exception in the Fourth Schedule actually applies.
- This engineering implementation is not an **independent** legal review. An outside Indian privacy lawyer must examine, approve and date the final policies, workflows and statutory interpretations.

## Required professional legal review and acceptance

A practicing Indian technology/privacy lawyer should provide a signed, dated written opinion covering:
- Applicability and enforcement timeline (including subsequent 2026 orders), children under 18, guardian duties, exemptions and consent withdrawal.
- Verification methods: permitted ID/DigiLocker evidence, adult age and actual parent/guardian relationship, anti-fraud assurance, retention and minimal disclosure.
- Child account basis, existing user remediation, contracts/terms and the guardian privacy notice; data-subject grievance/contact channels.
- Vercel/Supabase/Google Analytics processing roles, international transfers, data-subprocessor contracts, retention and deletion.
- Security safeguards, parental access/deletion workflow, incident response and deadlines, cybersecurity audit and whether a DPO is required.
- Specific modifications needed, written sign-off on exact production version, and periodic review dates.

## Safe admin standard operating procedure

1. Guardian sends initial non-sensitive request to the existing support contact; no child details yet.
2. Send privacy notice and describe processing; choose secure, reputable verification channel.
3. Full Admin verifies guardian as an identifiable adult aged 18+ with authoritative/reliable records and verifies actual parental/lawful-guardian authority.
4. Obtain explicit, dated consent for specified student-account processing. Record case references, not raw documents, in `/admin/guardian-consents`.
5. Enter the one-time consent ID on `/admin/create-user` to create the student. Backend rejects absent/reused grants.
6. Respond to withdrawal/correction/deletion requests after authenticating authority; apply lawful retention and remove access where needed.
7. If evidence is missing, ambiguous or disputed, do not create the child account. Consult independent counsel on disputed cases.

## Security acceptance checks

- Anonymous and Viewer cannot query or insert guardian evidence; Full Admin only.
- Student creation API rejects an otherwise valid student request without verified grant, including requests that bypass the UI.
- A grant can reserve only one request and link to one student (DB uniqueness).
- CURRENT GAP: minor/unknown-age students can create accounts through self-service registration after declaring guardian permission; `auth.signUp` is also reachable directly. A backend verified-consent gate is required. The parent path accurately discloses this limitation.
- Existing student/question/test data and access are not modified by this release.
