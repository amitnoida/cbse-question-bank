import type { MetadataRoute } from "next";
import { SITE, CLASS_NUMBERS, classPath, getSubjectsForClass, subjectPath } from "@/lib/seo-catalog";

// Chapter guide pages remain noindex until individually reviewed for original, accurate educational content.
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", ...CLASS_NUMBERS.flatMap(n => [
    classPath(n),
    ...getSubjectsForClass(n).map(s => subjectPath(n,s.slug)),
  ])];
  return paths.map(path => ({
    url: `${SITE}${path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : path.split("/").length === 2 ? 0.8 : 0.7,
  }));
}
