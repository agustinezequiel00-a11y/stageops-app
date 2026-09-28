import { useEffect, useState } from "react";
import { hasSupabase, supabase } from "../lib/supabase";
import { money, formatDate } from "../lib/format";

export default function ClientesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgId, setOrgId] = useState(null);
  const [clients, setClients] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    if (!hasSupabase) {
      setClients([
        { client_id: "c1", name: "Aurora Producciones", total_events: 6, total_revenue: 14200000, total_margin: 13100000, last_event_at: "2026-09-18" },
      ]);
      setLoading(false);
      return;
    }
    const [{ data: org }, res] = await Promise.all([
      supabase.rpc("current_org_id"),
      supabase.from("client_summary").select("*").order("total_revenue", { ascending: false }),
    ]);
    setOrgId(org);
    if (res.error) setError(res.error.message);
    setClients(res.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createClient() {
    if (!name.trim()) {
      setError("Ingresá el nombre del cliente.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: err } = await supabase.from("clients").insert({
      organization_id: orgId,
      name: name.trim(),
      tax_id: taxId.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setShowNew(false);
    setName(""); setTaxId(""); setEmail(""); setPhone("");
    load();
  }

  if (loading) return <div className="empty-state">Cargando…</div>;

  return (
    <div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Clientes</h3>
          <button className="btn btn-primary" onClick={() => setShowNew((s) => !s)}>{showNew ? "Cancelar" : "+ Nuevo cliente"}</button>
        </div>

        {showNew && (
          <div style={{ display: "grid", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
            <div className="grid-2">
              <div className="field"><label>Nombre</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="field"><label>CUIT / DNI</label><input value={taxId} onChange={(e) => setTaxId(e.target.value)} /></div>
            </div>
            <div className="grid-2">
              <div className="field"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="field"><label>Teléfono</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            </div>
            <button className="btn btn-primary" disabled={busy} onClick={createClient}>{busy ? "Guardando…" : "Crear cliente"}</button>
          </div>
        )}

        {clients.length === 0 ? (
          <p className="note">Todavía no hay clientes cargados.</p>
        ) : (
          <table>
            <tbody>
              <tr><th>Cliente</th><th>Eventos</th><th>Ingresos totales</th><th>Margen</th><th>Último evento</th></tr>
              {clients.map((c) => (
                <tr key={c.client_id}>
                  <td>{c.name}</td>
                  <td>{c.total_events}</td>
                  <td>{money(c.total_revenue)}</td>
                  <td>{money(c.total_margin)}</td>
                  <td>{c.last_event_at ? formatDate(c.last_event_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
