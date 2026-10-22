import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "CBSE Question Bank", short_name: "CBSE MCQs", description: "Class 9 and 10 MCQ practice and mock tests", start_url: "/app", scope: "/", display: "standalone", background_color: "#ffffff", theme_color: "#4338ca", icons: [{src:"/icons/icon-192.png",sizes:"192x192",type:"image/png",purpose:"maskable"},{src:"/icons/icon-512.png",sizes:"512x512",type:"image/png",purpose:"maskable"}] };
}
