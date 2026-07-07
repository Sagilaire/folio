import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Mode = "signin" | "signup" | "forgot";

interface Props {
  returnTo: string;
}

// React island for /login — runs after hydration and resumes the SSR-set session.
export default function AuthForm({ returnTo }: Props) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "info" | "error"; text: string } | null>(null);

  // Check env vars first — createBrowserClient("","") returns a client that
  // crashes on sign-in. The hint above is what the user sees when keys are missing.
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return (
      <div className="hint">
        To enable auth, set <code>PUBLIC_SUPABASE_URL</code> and{" "}
        <code>PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env</code>. See README.
      </div>
    );
  }

  const supabase = createBrowserClient(url, key);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = returnTo;
      } else if (mode === "signup") {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + returnTo },
        });
        if (error) throw error;
        if (data.session) {
          window.location.href = returnTo;
        } else {
          setMsg({
            kind: "info",
            text: "Check your inbox to confirm the account, then sign in.",
          });
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/login",
        });
        if (error) throw error;
        setMsg({ kind: "info", text: "Password reset link sent." });
      }
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="stack gap-4"
      style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}
    >
      <div className="field">
        <label className="label" htmlFor="email">Email</label>
        <input
          id="email"
          className="input"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@domain.com"
        />
      </div>

      {mode !== "forgot" && (
        <div className="field">
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
      )}

      {msg && (
        <div
          className="hint"
          style={{
            padding: "10px 12px",
            borderRadius: "var(--radius-2)",
            background: msg.kind === "error" ? "#fcecec" : "#e7f3ec",
            border:
              "1px solid " + (msg.kind === "error" ? "#f1c0c0" : "#c6e3d2"),
            color: msg.kind === "error" ? "var(--danger)" : "var(--success)",
          }}
        >
          {msg.text}
        </div>
      )}

      <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
        {busy
          ? "Working…"
          : mode === "signin"
            ? "Sign in"
            : mode === "signup"
              ? "Create account"
              : "Send reset link"}
      </button>

      <div className="row gap-3 muted" style={{ fontSize: "var(--fs-12)", justifyContent: "center" }}>
        {mode === "signin" && (
          <>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => setMode("signup")}
            >
              Create an account
            </button>
            <span>·</span>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => setMode("forgot")}
            >
              Forgot password?
            </button>
          </>
        )}
        {mode !== "signin" && (
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => setMode("signin")}
          >
            Back to sign in
          </button>
        )}
      </div>
    </form>
  );
}
