import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AnnouncementBanner from "./announcement-banner";
import InstallPrompt from "./install-prompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cbse-question-bank.vercel.app"),
  title: { default: "CBSE Question Bank | Class 9 & 10 MCQ Practice", template: "%s | CBSE Question Bank" },
  description: "CBSE Class 9 and 10 MCQ practice, chapter-wise questions, explanations and mock tests for English, Hindi, Mathematics, Science and Social Science.",
  applicationName: "CBSE Question Bank",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "CBSE MCQs", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  robots: { index: true, follow: true },
  openGraph: { type: "website", siteName: "CBSE Question Bank", url: "https://cbse-question-bank.vercel.app", title: "CBSE Question Bank | Class 9 & 10 MCQ Practice", description: "Chapter-wise CBSE MCQs and mock tests for Classes 9 and 10." },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><AnnouncementBanner />{children}<InstallPrompt /></body>
    </html>
  );
}
