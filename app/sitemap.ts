import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap { return [{ url: "https://cbse-question-bank.vercel.app/", changeFrequency: "weekly", priority: 1 }]; }
