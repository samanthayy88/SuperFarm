"use client";

import { useState } from "react";

/** Password-only sign-in, laid out for a phone first. The password is checked on the server. */
export default function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        onSuccess();
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not sign in. Try again.");
    } catch {
      setError("Can't reach the server. Check your internet connection.");
    }
    setBusy(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-card border border-hairline bg-surface p-6 shadow-card">
        <h1 className="text-2xl font-medium tracking-tight text-ink">Farm Manager</h1>
        <p className="mt-1 text-sm text-ink-2">Enter the password to continue.</p>
        <div className="relative mt-5">
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            placeholder="Password"
            aria-label="Password"
            // 16px keeps iPhones from zooming into the field
            className="w-full rounded-xl border border-hairline bg-surface px-4 py-3.5 pr-16 text-base text-ink focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute inset-y-0 right-0 px-4 text-sm font-medium text-accent"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-critical" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={!password || busy}
          className="mt-5 w-full rounded-full bg-accent px-5 py-3.5 text-base font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? "Checking…" : "Open dashboard"}
        </button>
      </form>
    </main>
  );
}
