"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export default function ResendVerification({ email, initialCooldown = 0 }: { email: string; initialCooldown?: number }) {
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(initialCooldown);
  const [message, setMessage] = useState("");
  const locked = useRef(false);
  const deadline = useRef(0);

  useEffect(() => {
    deadline.current = Date.now() + initialCooldown * 1000;
    const tick = () => setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [initialCooldown]);

  async function resend() {
    if (locked.current || Date.now() < deadline.current) return;
    locked.current = true;
    setBusy(true);
    setMessage("");
    // Supabase enforces the server limit too; this countdown prevents accidental retries.
    deadline.current = Date.now() + 60000;
    setRemaining(60);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: "https://examshuru.com/auth/callback" },
      });
      if (error) {
        setMessage(error.status === 429
          ? "Too many email requests. Please wait before trying again."
          : "We could not request a verification email. Please try again later or contact support.");
      } else {
        setMessage("If this email has an account awaiting confirmation, a new verification email has been requested. Check Inbox and Spam, and use the latest email link.");
      }
    } catch {
      setMessage("Unable to connect. Check your internet connection and try again after the countdown.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return <section className="mt-4 space-y-2 text-sm" aria-label="Email verification help">
    <p>Didn&apos;t receive the email? Check Spam or request a new link for <strong className="break-all">{email}</strong>.</p>
    <button type="button" onClick={() => void resend()} disabled={busy || remaining > 0}
      className="min-h-11 rounded-lg border border-indigo-300 bg-white px-4 py-2 font-bold text-indigo-800 disabled:cursor-wait disabled:opacity-60">
      {busy ? "Requesting email…" : remaining > 0 ? `Resend available in ${remaining}s` : "Resend verification email"}
    </button>
    {message && <p role="status" className="break-words">{message}</p>}
  </section>;
}
