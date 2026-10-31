import Image from "next/image";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return <Image src="/images/examshuru-logo.webp" alt="ExamShuru — Har Exam Ki Taiyari Yahin Se Shuru!" width={2048} height={689} sizes={compact ? "180px" : "(max-width: 640px) 200px, 240px"} className={compact ? "h-auto w-[180px] shrink-0" : "h-auto w-[200px] shrink-0 sm:w-[240px]"} />;
}
