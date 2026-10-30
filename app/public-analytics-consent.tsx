"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const measurementId = "G-7LDGQZJF8E";
const consentKey = "examyari-analytics-consent-v1";
const preferencesEvent = "examyari:analytics-preferences";
type Preference = "accepted" | "declined" | null;

function isPublicPage(path: string) {
  return path === "/" || /^\/class-(8|9|10|11|12)(\/[^/]+){0,2}\/?$/.test(path);
}

function activeStudentSession() {
  try {
    return Object.keys(localStorage).some(key => {
      if (!/^sb-[a-z0-9-]+-auth-token$/.test(key)) return false;
      const value = localStorage.getItem(key);
      if (!value) return false;
      const session = JSON.parse(value);
      return Boolean(session?.access_token);
    });
  } catch {
    // Unknown stored session: avoid tracking rather than risk sending student data.
    return true;
  }
}

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

export default function PublicAnalyticsConsent() {
  const path = usePathname() || "";
  const allowed = isPublicPage(path);
  const [preference, setPreference] = useState<Preference>(null);
  const [loaded, setLoaded] = useState(false);
  const [showChoices, setShowChoices] = useState(false);

  // A client-side transition from a public page must not carry the GA library
  // into a student, membership, account, or admin page.
  useEffect(() => {
    if (allowed || !window.gtag) return;
    (window as unknown as Record<string, unknown>)["ga-disable-" + measurementId] = true;
    window.gtag("consent", "update", { analytics_storage: "denied" });
    window.location.reload();
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    try {
      const stored = localStorage.getItem(consentKey);
      setPreference(stored === "accepted" || stored === "declined" ? stored : null);
    } catch { setPreference(null); }
  }, [allowed]);

  useEffect(() => {
    const open = () => setShowChoices(true);
    window.addEventListener(preferencesEvent, open);
    return () => window.removeEventListener(preferencesEvent, open);
  }, []);

  const choose = useCallback((next: Exclude<Preference, null>) => {
    try { localStorage.setItem(consentKey, next); } catch { /* session-only preference */ }
    setPreference(next);
    setShowChoices(false);
    if (next === "declined") {
      window.gtag?.("consent", "update", { analytics_storage: "denied" });
      // Reload to unload any analytics library if consent was previously granted.
      if (loaded) window.location.reload();
    }
  }, [loaded]);

  useEffect(() => {
    if (!allowed || preference !== "accepted" || activeStudentSession()) return;
    if (!window.gtag) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = (...args: unknown[]) => { window.dataLayer?.push(args); };
      window.gtag("js", new Date());
      window.gtag("config", measurementId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      });
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://www.googletagmanager.com/gtag/js?id=" + measurementId;
      document.head.appendChild(script);
    }
    setLoaded(true);
    window.gtag("event", "page_view", {
      page_location: window.location.origin + path,
      page_path: path,
      page_title: document.title,
    });
  }, [allowed, path, preference]);

  if (!allowed || (preference !== null && !showChoices)) return null;

  return (
    <aside role="region" aria-label="Optional website analytics" className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-2xl rounded-2xl border border-indigo-200 bg-white p-4 text-slate-900 shadow-2xl sm:p-5">
      <p className="text-sm font-bold">Optional website analytics</p>
      <p className="mt-1 text-xs leading-5 text-slate-700 sm:text-sm">
        ExamYari would like to use Google Analytics to understand visits to public educational pages.
        Analytics is off until you accept. Student practice, accounts, memberships and admin pages are excluded.
        You can change your choice through Analytics preferences in the footer.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => choose("declined")} className="rounded-lg border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-900">Decline</button>
        <button type="button" onClick={() => choose("accepted")} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white">Allow public-page analytics</button>
      </div>
    </aside>
  );
}
