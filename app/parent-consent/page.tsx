import type {Metadata} from "next";
import Link from "next/link";
import {PublicFooter,PublicHeader} from "../public-navigation";
export const metadata:Metadata={title:"Parent and Guardian Account Consent",description:"Guidance for parents and guardians before children's ExamYari accounts are created.",alternates:{canonical:"/parent-consent"}};
export default function Page(){return <><PublicHeader/><main id="main-content" className="mx-auto max-w-3xl space-y-6 px-5 py-12 text-slate-900">
<h1 className="text-3xl font-extrabold">Parents and guardians: student registration</h1>
<p className="rounded-xl border border-amber-200 bg-amber-50 p-4 font-semibold">Children under 18 must not use the self-service signup form. ExamYari does not treat an ordinary checkbox or an email code as sufficient proof that a person is an adult parent or lawful guardian.</p>
<h2 className="text-xl font-bold">How to start a request</h2>
<p>A parent or lawful guardian should first contact <a className="text-indigo-700 underline" href="mailto:support.cbseexam@gmail.com?subject=ExamYari%20parental%20consent%20request">support.cbseexam@gmail.com</a> from an address they control, requesting an account for a child. Please do <strong>not</strong> include the child&apos;s name, date of birth, school, identity documents or passwords in your first email.</p>
<h2 className="text-xl font-bold">What the operator must verify</h2>
<p>Before opening a child&apos;s account, an authorized ExamYari administrator must verify the requesting adult&apos;s identity and age using a reliable method, confirm the authority to act as parent or guardian, provide a clear privacy notice, obtain specific consent, and retain a minimal dated audit record. Where an appropriate verification channel is not available, the child&apos;s account must not be opened.</p>
<h2 className="text-xl font-bold">About the student account</h2>
<p>After the authorized guardian&apos;s verification and consent, ExamYari may collect only the information needed for the chosen class, sign-in, question practice, scores and support. Google Analytics remains optional on eligible public pages and is excluded from student practice pages. There is no targeted advertising to children within the ExamYari application.</p>
<h2 className="text-xl font-bold">Help or withdrawal</h2><p>Parents can contact support to request correction, deletion or withdrawal of consent. Identity and guardian authority may need to be checked before a request is processed. Read the <Link href="/privacy" className="text-indigo-700 underline">Privacy Policy</Link> and <Link href="/terms" className="text-indigo-700 underline">Terms</Link>.</p>
<p className="text-sm text-slate-600">This is the current supervised registration guidance, not an online identity-verification service. A verifiable guardian identity workflow and independent legal approval must be confirmed before it is presented as fully compliant.</p>
</main><PublicFooter/></>}
