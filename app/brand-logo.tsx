import Image from "next/image";

/** Shared identity; the tagline is retained in the supplied artwork. */
export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return <Image src="/images/examyari-logo.webp" alt="ExamYari — Har Exam Ki Pakki Yaari!" width={980} height={347} sizes={compact ? "160px" : "(max-width: 640px) 180px, 220px"} className={compact ? "h-auto w-40 shrink-0" : "h-auto w-[180px] shrink-0 sm:w-[220px]"} />;
}
