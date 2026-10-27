import catalog from "./seo-catalog.json";
import additionalCatalog from "./seo-catalog-new-classes.json";

export type Chapter = (typeof catalog)[number];
export const SITE = "https://cbse-question-bank.vercel.app";
export const CLASS_NUMBERS = [8, 9, 10, 11, 12] as const;
export const subjects = [
  { name: "English", slug: "english" },
  { name: "Hindi", slug: "hindi" },
  { name: "Mathematics", slug: "mathematics" },
  { name: "Science", slug: "science" },
  { name: "Social Science", slug: "social-science" },
] as const;
export const seniorSubjects = [
  { name: "Physics", slug: "physics" },
  { name: "Chemistry", slug: "chemistry" },
  { name: "Mathematics", slug: "mathematics" },
  { name: "Biology", slug: "biology" },
] as const;

export const getSubjectsForClass = (n: number) =>
  n === 11 || n === 12 ? seniorSubjects : subjects;

export const chapters: Chapter[] = [...catalog, ...additionalCatalog];
export const classPath = (n: number) => `/class-${n}`;
export const subjectPath = (n: number, s: string) => `${classPath(n)}/${s}`;
export const chapterPath = (c: Chapter) => `${subjectPath(c.classNumber, c.subjectSlug)}/${c.slug}`;
export function getClass(slug: string): number | null {
  const match = /^class-(8|9|10|11|12)$/.exec(slug);
  return match ? Number(match[1]) : null;
}
export function getSubject(slug: string, n: number) {
  return getSubjectsForClass(n).find(s => s.slug === slug);
}
export function getChapter(n: number, s: string, slug: string) {
  return chapters.find(c => c.classNumber === n && c.subjectSlug === s && c.slug === slug);
}
