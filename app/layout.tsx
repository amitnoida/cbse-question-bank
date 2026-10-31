import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AnnouncementBanner from "./announcement-banner";
import InstallPrompt from "./install-prompt";
import { Suspense } from "react";
import StudentSessionGuard from "./student-session-guard";
import PublicAnalyticsConsent from "./public-analytics-consent";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://examshuru.com"),
  title: { default: "ExamShuru | Class 8–12 CBSE MCQ Practice", template: "%s | ExamShuru" },
  description: "CBSE MCQ practice, chapter-wise questions, explanations and 60-question mock tests for Classes 8, 9, 10, 11 and 12, including Physics, Chemistry, Mathematics and Biology in Classes 11–12.",
  applicationName: "ExamShuru",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ExamShuru", statusBarStyle: "default" },
  icons: { icon: "/icons/examyari-192-v2.png", apple: "/icons/examyari-apple-v2.png" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website", siteName: "ExamShuru",
    url: "https://examshuru.com",
    title: "ExamShuru | Classes 8–12 MCQ Practice",
    description: "Class 8, 9, 10, 11 and 12 subject-wise MCQ practice and timed mock tests."
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
    <body className="min-h-full flex flex-col"><StudentSessionGuard /><AnnouncementBanner /><Suspense fallback={null}><PublicAnalyticsConsent /></Suspense>{children}<Suspense fallback={null}><InstallPrompt /></Suspense></body>
  </html>;
}
