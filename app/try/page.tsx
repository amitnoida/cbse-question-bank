import type {Metadata}from "next";
import {PublicHeader,PublicFooter}from "../public-navigation";
import Demo from "./student-demo";
export const metadata:Metadata={title:"Try 10 free MCQs — no signup",description:"Try a 10-question Class 8–12 Maths or Science practice demo with explanations. No account or payment required.",alternates:{canonical:"/try"}};
export default function Page(){return <><PublicHeader/><main id="main-content" className="mx-auto min-h-[70vh] max-w-4xl space-y-6 px-5 py-10"><p className="text-xs font-extrabold uppercase tracking-widest text-indigo-700">A little practice. A clearer understanding.</p><h1 className="text-3xl font-black text-slate-950 sm:text-4xl">Try 10 questions. Find your next step.</h1><p className="leading-7 text-slate-600">No account, email or payment needed. This small sample introduces MCQ practice and explanations; it is supplementary revision, not a complete board-exam paper.</p><Demo/></main><PublicFooter/></>;}
