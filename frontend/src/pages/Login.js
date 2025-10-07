import React,{useEffect,useState} from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { apiLogin, apiMe } from "../lib/api";
import { supabase } from "../lib/supabase";

export default function Login({ onAuthed }) {
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [err,setErr] = useState("");
  const [busy,setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(()=>{
    // Check if user is already authenticated
    (async()=>{
      try {
        const { user } = await apiMe();
        if (user) {
          onAuthed(user);
          navigate("/");  // <-- redirect to app page
        }
      } catch {}
    })();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          try {
            const { user } = await apiMe();
            onAuthed(user);
            navigate("/");
          } catch (error) {
            console.error('Error getting user info:', error);
          }
        } else if (event === 'SIGNED_OUT') {
          onAuthed(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  },[onAuthed, navigate]);

  async function submit(e){
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const { user } = await apiLogin({ email, password });
      onAuthed(user);
      navigate("/");  // <-- redirect after login
    } catch(ex){
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Sign in" subtitle="Access is limited to registered users.">
      {err && <div className="error" style={{marginBottom:10}}>{err}</div>}
      <form onSubmit={submit}>
        <label className="form-label">Email</label>
        <input className="form-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <label className="form-label" style={{marginTop:10}}>Password</label>
        <input className="form-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        <div style={{display:"flex",gap:10,marginTop:14,justifyContent:"space-between"}}>
          <button className="btn primary" disabled={busy} type="submit">
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <a className="note" href="/forgot">Forgot password?</a>
        </div>
      </form>
    </AuthLayout>
  );
}
