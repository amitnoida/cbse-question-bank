import Image from "next/image";

export function BrandLogo({compact=false}:{compact?:boolean}){
 return <span className="inline-flex shrink-0 items-center gap-1.5" aria-label="ExamShuru — Har Exam Ki Taiyari Yahin Se Shuru!">
   <Image src="/icons/examyari-512-v2.png" alt="" width={512} height={512} sizes="56px" className={compact?"h-11 w-11 object-contain":"h-14 w-14 object-contain"}/>
   <span><span className={compact?"block text-xl font-black tracking-tight":"block text-2xl font-black tracking-tight"}><span className="text-[#0b2452]">Exam</span><span className="text-[#c44708]">Shuru</span></span><span className="block text-[9px] font-bold text-slate-600">Har Exam Ki Taiyari Yahin Se Shuru!</span></span>
 </span>;
}
