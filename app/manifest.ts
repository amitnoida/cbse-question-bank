import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ExamShuru – Question Bank",
    short_name: "ExamShuru",
    description: "CBSE Class 8, 9, 10, 11 and 12 MCQ practice and timed mock tests",
    start_url: "/app", scope: "/", display: "standalone",
    background_color: "#ffffff", theme_color: "#4338ca",
    icons: [
      {src:"/icons/examyari-512-v2.png",sizes:"512x512",type:"image/png",purpose:"any"},
      {src:"/icons/examyari-192-v2.png",sizes:"192x192",type:"image/png",purpose:"any"},
      {src:"/icons/examyari-512-v2.png",sizes:"512x512",type:"image/png",purpose:"maskable"}
    ]
  };
}
