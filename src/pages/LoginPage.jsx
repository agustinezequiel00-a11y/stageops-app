import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    if (result.error) setMessage(result.error.message);
    else if (mode === "signup") setMessage("Cuenta creada. Revisá tu email si la confirmación está activada.");
    setBusy(false);
  }

  return (
    <div className="login-layout">
      <div className="login-hero">
        <div className="brand" style={{ fontSize: 24 }}>Stage<span>OPS</span></div>
        <div className="hero-copy">
          <h1>Organizá tu depósito de pantallas LED <span>con claridad total</span></h1>
          <p>Inventario, lotes, taller, logística, reservas y personal — todo conectado alrededor de cada evento.</p>
        </div>
      </div>
      <div className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <h2 style={{ margin: 0 }}>{mode === "login" ? "Bienvenido de nuevo" : "Crear tu cuenta"}</h2>
          <p className="note" style={{ marginTop: 4 }}>
            {mode === "login" ? "Entrá a tu espacio de StageOPS." : "Creá el primer usuario de tu organización."}
          </p>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label>Contraseña</label>
          <input type="password" minLength="6" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {message && <div className="login-error">{message}</div>}
          <button className="primary-btn" disabled={busy}>
            {busy ? "Un momento…" : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
          <button
            type="button"
            className="btn"
            style={{ width: "100%", marginTop: 10, background: "transparent", border: "none", color: "var(--text-muted)" }}
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Crear cuenta nueva" : "Ya tengo cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}
