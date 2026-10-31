import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots { return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/dashboard/", "/memberships/", "/app/", "/api/", "/reset-password/", "/learn", "/teacher/"] }], sitemap: "https://examshuru.com/sitemap.xml" }; }
