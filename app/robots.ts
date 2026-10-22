import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots { return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/dashboard/", "/app/", "/api/", "/reset-password/"] }], sitemap: "https://cbse-question-bank.vercel.app/sitemap.xml" }; }
