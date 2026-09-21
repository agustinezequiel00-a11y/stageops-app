import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function OnboardingPage({ session }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Ingresá el nombre de tu empresa.");
      return;
    }
    setBusy(true);
    setError("");
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const { error: rpcError } = await supabase.rpc("bootstrap_my_organization", {
      p_name: name.trim(),
      p_slug: slug,
    });
    if (rpcError) {
      setError(rpcError.message);
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="login-layout">
      <div className="login-hero">
        <div className="brand" style={{ fontSize: 24 }}>Stage<span>OPS</span></div>
        <div className="hero-copy">
          <h1>Ya casi arrancamos</h1>
          <p>Nos falta un solo paso: crear tu organización. Sos el primer usuario, así que vas a quedar como dueño.</p>
        </div>
      </div>
      <div className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <h2 style={{ margin: 0 }}>Crear tu empresa</h2>
          <p className="note" style={{ marginTop: 4 }}>
            Conectado como {session?.user?.email}
          </p>
          <label>Nombre de la empresa</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="StageOPS Argentina" required />
          {error && <div className="login-error">{error}</div>}
          <button className="primary-btn" disabled={busy}>
            {busy ? "Creando…" : "Crear organización"}
          </button>
        </form>
      </div>
    </div>
  );
}
