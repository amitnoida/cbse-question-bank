import type { Metadata } from "next";
export const metadata: Metadata = { title: "Student Practice & Login", robots: { index: false, follow: false } };
export default function StudentAppLayout({children}:{children:React.ReactNode}) { return children; }
