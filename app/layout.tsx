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
  metadataBase: new URL("https://examyari.com"),
  title: { default: "ExamYari – Question Bank | CBSE MCQ Practice Classes 8–12", template: "%s | ExamYari" },
  description: "CBSE MCQ practice, chapter-wise questions, explanations and 60-question mock tests for Classes 8, 9, 10, 11 and 12, including Physics, Chemistry, Mathematics and Biology in Classes 11–12.",
  applicationName: "ExamYari – Question Bank",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ExamYari", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website", siteName: "ExamYari – Question Bank",
    url: "https://examyari.com",
    title: "ExamYari – Question Bank | CBSE MCQ Practice Classes 8–12",
    description: "Class 8, 9, 10, 11 and 12 subject-wise MCQ practice and timed mock tests."
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
    <body className="min-h-full flex flex-col"><StudentSessionGuard /><AnnouncementBanner /><PublicAnalyticsConsent />{children}<Suspense fallback={null}><InstallPrompt /></Suspense></body>
  </html>;
}
