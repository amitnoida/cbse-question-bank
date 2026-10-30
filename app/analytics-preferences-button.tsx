"use client";

export default function AnalyticsPreferencesButton() {
  return (
    <button type="button" className="py-2 font-semibold hover:text-indigo-700"
      onClick={() => window.dispatchEvent(new Event("examyari:analytics-preferences"))}>
      Analytics preferences
    </button>
  );
}
