import catalog from "./seo-catalog.json";
export type Chapter = (typeof catalog)[number];
export const SITE = "https://cbse-question-bank.vercel.app";
export const subjects = [
  { name: "English", slug: "english" },
  { name: "Hindi", slug: "hindi" },
  { name: "Mathematics", slug: "mathematics" },
  { name: "Science", slug: "science" },
  { name: "Social Science", slug: "social-science" },
] as const;
export const chapters = catalog;
export const classPath = (n: number) => `/class-${n}`;
export const subjectPath = (n: number, s: string) => `${classPath(n)}/${s}`;
export const chapterPath = (c: Chapter) => `${subjectPath(c.classNumber,c.subjectSlug)}/${c.slug}`;
export function getClass(slug: string) { return slug === "class-9" ? 9 : slug === "class-10" ? 10 : null; }
export function getSubject(slug: string) { return subjects.find(s => s.slug === slug); }
export function getChapter(n: number, s: string, slug: string) { return chapters.find(c => c.classNumber === n && c.subjectSlug === s && c.slug === slug); }
