import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ExamYari – Question Bank",
    short_name: "ExamYari",
    description: "CBSE Class 8, 9, 10, 11 and 12 MCQ practice and timed mock tests",
    start_url: "/app", scope: "/", display: "standalone",
    background_color: "#ffffff", theme_color: "#4338ca",
    icons: [
      {src:"/icons/icon-192.png",sizes:"192x192",type:"image/png",purpose:"maskable"},
      {src:"/icons/icon-512.png",sizes:"512x512",type:"image/png",purpose:"maskable"}
    ]
  };
}
