"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    // A recovery link can contain a PKCE code, an implicit auth fragment,
    // or (with customized email templates) a token_hash.
    const params = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const code = params.get("code");
    const tokenHash = params.get("token_hash");
    const recoveryLink = Boolean(code || tokenHash || fragment.get("access_token"));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") {
        setAuthorized(true);
        setChecking(false);
      }
      if (event === "SIGNED_OUT") setAuthorized(false);
    });

    async function checkLink() {
      try {
        if (tokenHash && params.get("type") === "recovery") {
          const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
          if (result.error) throw result.error;
          if (active) setAuthorized(true);
        } else if (code) {
          const result = await supabase.auth.exchangeCodeForSession(code);
          // Supabase may have already exchanged the code automatically.
          if (result.error) {
            const sessionResult = await supabase.auth.getSession();
            if (!sessionResult.data.session) throw result.error;
          }
          if (active) setAuthorized(true);
        } else if (fragment.get("access_token") && fragment.get("type") === "recovery") {
          const result = await supabase.auth.setSession({
            access_token: fragment.get("access_token")!,
            refresh_token: fragment.get("refresh_token") || "",
          });
          if (result.error) throw result.error;
          if (active) setAuthorized(true);
        } else if (!recoveryLink) {
          // A normal signed-in session alone must not grant reset access.
          if (active) setError("Open the password-reset link from your email. If it has expired, request a new link.");
        }
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Invalid or expired reset link. Please request another.");
      } finally {
        if (active) setChecking(false);
      }
    }
    void checkLink();
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!authorized) return;
    if (password.length < 8) { setError("Use at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    const result = await supabase.auth.updateUser({ password });
    if (result.error) setError(result.error.message);
    else {
      setDone(true);
      setPassword("");
      setConfirm("");
      // End the recovery session; the student should sign in again.
      await supabase.auth.signOut();
    }
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 flex items-center justify-center">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-9">
        <p className="text-xs font-extrabold uppercase tracking-widest text-indigo-600">CBSE Exam Preparation</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Set new password</h1>
        <p className="mt-2 text-sm text-slate-600">Create a secure password for your CBSE Question Bank account.</p>
        {checking ? <p className="mt-6 text-sm">Verifying your reset link…</p> : done ? (
          <div className="mt-6 space-y-4"><p className="rounded-xl bg-green-50 p-4 text-green-800">Password updated successfully. Please sign in using your new password.</p><a className="block rounded-xl bg-indigo-600 px-4 py-3 text-center font-bold text-white" href="/">Go to sign in</a></div>
        ) : authorized ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-base" /></label>
            <label className="block text-sm font-semibold text-slate-700">Confirm new password<input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-base" /></label>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-indigo-600 p-3 font-bold text-white disabled:opacity-60">{busy ? "Updating…" : "Update password"}</button>
          </form>
        ) : <div className="mt-6"><p role="alert" className="text-sm text-red-700">{error || "This reset link is invalid or expired."}</p><a href="/" className="mt-4 inline-block font-semibold text-indigo-600">Return to website to request another link →</a></div>}
      </section>
    </main>
  );
}
