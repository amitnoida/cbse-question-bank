import type {Metadata} from "next";
import Link from "next/link";
import {PublicFooter,PublicHeader} from "../public-navigation";
export const metadata:Metadata={title:"Parent and Guardian Account Consent",description:"Guidance for parents and guardians before children's ExamShuru accounts are created.",alternates:{canonical:"/parent-consent"}};
export default function Page(){return <><PublicHeader/><main id="main-content" className="mx-auto max-w-3xl space-y-6 px-5 py-12 text-slate-900">
<h1 className="text-3xl font-extrabold">Parents and guardians: student registration</h1>
<p className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 font-semibold">Students can create an account online. If a student is under 18, a parent or legal guardian should review the Terms of Use and Privacy Policy with them and give permission and supervision before registration.</p>
<h2 className="text-xl font-bold">Register without a support request</h2>
<p>Open the student signup form, enter a name, email address, password and class, then read and select the registration acknowledgement. Verify the email address using the confirmation email before signing in. The signup form does not request a date of birth. Contacting support is not a prerequisite for online registration.</p>
<p><Link href="/app?auth=signup" className="inline-flex min-h-11 items-center rounded-xl bg-indigo-700 px-5 py-3 font-bold text-white">Create a student account</Link></p>
<h2 className="text-xl font-bold">What the acknowledgement means</h2>
<p>The person registering agrees to the terms and acknowledges the privacy notice. Students under 18 also declare parent or legal guardian permission and supervision. The checkbox is a self-declaration; it does not independently verify age, guardian identity or parental consent. Email verification confirms control of an email address only.</p>
<h2 className="text-xl font-bold">About the student account</h2>
<p>ExamShuru uses the account information needed for the chosen class, sign-in, question practice, scores and support. Google Analytics remains optional on eligible public pages and is excluded from student practice pages. There is no targeted advertising to children within the ExamShuru application.</p>
<h2 className="text-xl font-bold">Help or withdrawal</h2><p>Parents can contact support to request correction, deletion or withdrawal of consent. Identity and guardian authority may need to be checked before a request is processed. Read the <Link href="/privacy" className="text-indigo-700 underline">Privacy Policy</Link> and <Link href="/terms" className="text-indigo-700 underline">Terms</Link>.</p>
<p className="text-sm text-slate-600">The optional administrator-assisted guardian verification process remains available for cases that need additional support. Online registration is not a claim of independently verified parental consent or legal compliance.</p>
</main><PublicFooter/></>}
