import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { apiAcceptInvite } from "../lib/api";

export default function AcceptInvite() {
  const token = useMemo(
    () => new URLSearchParams(window.location.search).get("token") || "",
    []
  );
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      await apiAcceptInvite({ token, password });
      setMsg("Account created successfully! Redirecting to dashboard…");
      // Since user is now signed in with Supabase, redirect to main app
      setTimeout(() => navigate("/", { replace: true }), 1200);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Set your password" subtitle="Opened from your invite email.">
      {msg && <div className="success" style={{ marginBottom: 10 }}>{msg}</div>}
      {err && <div className="error" style={{ marginBottom: 10 }}>{err}</div>}

      <form onSubmit={submit}>
        <label className="form-label">Invite token</label>
        <input className="form-input" value={token} readOnly />

        <label className="form-label" style={{ marginTop: 10 }}>New password</label>
        <input
          className="form-input"
          type="password"
          minLength={8}
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "space-between" }}>
          <button className="btn primary" disabled={busy}>
            {busy ? "Saving…" : "Save password"}
          </button>
          <a className="note" href="/login">Back to sign in</a>
        </div>
      </form>
    </AuthLayout>
  );
}
