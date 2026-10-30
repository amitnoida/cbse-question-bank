import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots { return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/dashboard/", "/memberships/", "/app/", "/api/", "/reset-password/"] }], sitemap: "https://examyari.com/sitemap.xml" }; }
