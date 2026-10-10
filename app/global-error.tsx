"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Application error:", error); }, [error]);
  return (
    <html lang="en"><body style={{ margin: 0, fontFamily: "Arial, sans-serif", background: "#f4f5ff", color: "#172033" }}>
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, boxSizing: "border-box" }}>
        <section role="alert" style={{ background: "white", maxWidth: 520, padding: "48px 32px", textAlign: "center", borderRadius: 24, boxShadow: "0 12px 35px #1e1b4b18" }}>
          <div style={{ fontSize: 42 }}>📚</div>
          <p style={{ color: "#4f46e5", fontSize: 12, fontWeight: 800, letterSpacing: 2 }}>CBSE EXAM PREP GUIDE</p>
          <h1 style={{ fontSize: 30 }}>We'll Be Back Shortly</h1>
          <p style={{ lineHeight: 1.7, color: "#475569" }}>Our learning platform is temporarily unavailable. Please try again in a little while.</p>
          <button type="button" onClick={reset} style={{ marginTop: 20, background: "#4f46e5", color: "white", padding: "14px 28px", border: 0, borderRadius: 12, cursor: "pointer", fontWeight: 700 }}>Try Again</button>
        </section>
      </main>
    </body></html>
  );
}
