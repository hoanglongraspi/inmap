import React, { useState } from "react";
import { apiGenerateInvite } from "../lib/api";

export default function GenerateInvite() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      const { token, invite_url } = await apiGenerateInvite(email);
      setMsg(`Invite generated for ${email}. Share this link: ${invite_url}`);
    } catch (ex) {
      setErr(ex.message);
    }
  }

  return (
    <div>
      <h1>Generate Invite</h1>
      {msg && <div className="success">{msg}</div>}
      {err && <div className="error">{err}</div>}
      <form onSubmit={submit}>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} required />
        <button type="submit">Generate Invite</button>
      </form>
    </div>
  );
}