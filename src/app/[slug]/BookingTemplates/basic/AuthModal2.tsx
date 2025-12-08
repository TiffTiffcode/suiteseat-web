// C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\BookingTemplates\basic\AuthModal.tsx
"use client";
import { useState, useRef } from "react";
import { useBookingFlow } from "../../BookingFlows/basicFlow";

type Props = { onClose: () => void };

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8400";
const SIGNUP_ENDPOINT = `${API}/api/signup`;


export default function AuthModal({ onClose }: Props) {
  const flow = useBookingFlow();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // shared fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // signup-only
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [confirm, setConfirm] = useState("");

  // extras
  const [info, setInfo] = useState<string | null>(null);
  const passRef = useRef<HTMLInputElement | null>(null);

  function resetAuthFields() {
    setEmail("");
    setPassword("");
    setConfirm("");
    setFirstName("");
    setLastName("");
    setError(null);
    setInfo(null);
  }

async function handleSignIn(e: React.FormEvent) {
  e.preventDefault();
  setBusy(true);
  setError(null);

  const ok = await flow.login(email, password);   // this closes auth + runs _pending
  setBusy(false);

  if (!ok) {
    setError("Invalid email or password.");
    return;
  }
  // ✅ Do nothing else here; login() already did the right thing.
}


  async function onSubmitSignUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (!firstName.trim() || !lastName.trim()) {
        setError("Please enter your first and last name.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }

      const r = await fetch(SIGNUP_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ firstName, lastName, email, password }),
      });

      if (!r.ok) {
        const msg = await r.text().catch(() => "");
        setError(msg || "Could not create account.");
        return;
      }

      // success → flip to sign in, keep email, clear passwords, focus password
      const rememberedEmail = email;
      setMode("signin");
      setInfo("Account created! Please sign in.");
      setEmail(rememberedEmail);
      setPassword("");
      setConfirm("");
      setTimeout(() => passRef.current?.focus(), 0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bk-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="bk-h3" style={{ marginBottom: 12 }}>
          {mode === "signin" ? "Sign in" : "Create account"}
        </h3>

        {mode === "signin" ? (
          <form onSubmit={handleSignIn} className="bk-auth-form">
            {info && <div className="bk-info">{info}</div>}

            <label className="bk-label">
              Email
              <input
                className="bk-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label className="bk-label">
              Password
              <input
                ref={passRef}
                className="bk-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            {error && <div className="bk-error">{error}</div>}

            <div className="bk-modal-actions">
              <button type="button" className="bk-btn" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="bk-btn-primary" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: "0.95rem", textAlign: "center" }}>
              Don’t have an account?{" "}
              <span
                style={{ color: "#0b5cff", cursor: "pointer" }}
                onClick={() => {
                  setMode("signup");
                  resetAuthFields(); // clears email/password + errors
                }}
              >
                Create Account
              </span>
            </div>
          </form>
        ) : (
          <form onSubmit={onSubmitSignUp} className="bk-auth-form">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className="bk-label">
                First name
                <input
                  className="bk-input"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  required
                />
              </label>
              <label className="bk-label">
                Last name
                <input
                  className="bk-input"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  required
                />
              </label>
            </div>

            <label className="bk-label">
              Email
              <input
                className="bk-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label className="bk-label">
              Password
              <input
                className="bk-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>

            <label className="bk-label">
              Confirm password
              <input
                className="bk-input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>

            {error && <div className="bk-error">{error}</div>}

            <div className="bk-modal-actions">
              <button
                type="button"
                className="bk-btn"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                }}
                disabled={busy}
              >
                Back to sign in
              </button>
              <button type="submit" className="bk-btn-primary" disabled={busy}>
                {busy ? "Creating…" : "Sign up"}
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: "0.95rem", textAlign: "center" }}>
              Already have an account?{" "}
              <span
                style={{ color: "#0b5cff", cursor: "pointer" }}
                onClick={() => {
                  setMode("signin");
                  setError(null);
                }}
              >
                Sign in
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
