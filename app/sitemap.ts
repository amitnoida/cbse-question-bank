import type {MetadataRoute} from "next";
import {SITE,subjects,subjectPath,classPath} from "@/lib/seo-catalog";
// Chapter pages are intentionally excluded until unique educational content and syllabus alignment are reviewed.
export default function sitemap():MetadataRoute.Sitemap {
 const paths=["/",...([9,10].flatMap(n=>[classPath(n),...subjects.map(s=>subjectPath(n,s.slug))]))];
 return paths.map(path=>({url:`${SITE}${path === "/" ? "/" : path}`,changeFrequency:"monthly",priority:path==="/"?1:path.split("/").length===2?0.8:0.7}));
}
