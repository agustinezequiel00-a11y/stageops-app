import { useEffect, useState } from "react";
import { hasSupabase, supabase } from "../lib/supabase";
import { money } from "../lib/format";

export default function ColaboradoresPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgId, setOrgId] = useState(null);
  const [collaborators, setCollaborators] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    if (!hasSupabase) {
      setCollaborators([{ id: "col1", name: "Pantallas del Sur", specialty_notes: "Pantallas P2.6 / P3.9 · CABA/GBA", phone: null, eventos: 4, total: 3100000 }]);
      setLoading(false);
      return;
    }
    const [{ data: org }, colRes, lineRes] = await Promise.all([
      supabase.rpc("current_org_id"),
      supabase.from("collaborators").select("id, name, tax_id, contact_name, phone, email, specialty_notes, active").order("name"),
      supabase.from("event_reservations").select("collaborator_id, event_id, collaborator_cost").eq("source", "collaborator"),
    ]);
    setOrgId(org);
    if (colRes.error) setError(colRes.error.message);

    const totals = {};
    (lineRes.data || []).forEach((l) => {
      if (!l.collaborator_id) return;
      if (!totals[l.collaborator_id]) totals[l.collaborator_id] = { events: new Set(), total: 0, anyVisible: false };
      totals[l.collaborator_id].events.add(l.event_id);
      if (l.collaborator_cost !== null) {
        totals[l.collaborator_id].total += Number(l.collaborator_cost);
        totals[l.collaborator_id].anyVisible = true;
      }
    });

    setCollaborators(
      (colRes.data || []).map((c) => ({
        ...c,
        eventos: totals[c.id]?.events.size || 0,
        total: totals[c.id]?.anyVisible ? totals[c.id].total : null,
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createCollaborator() {
    if (!name.trim()) {
      setError("Ingresá el nombre del colaborador.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: err } = await supabase.from("collaborators").insert({
      organization_id: orgId,
      name: name.trim(),
      specialty_notes: specialty.trim() || null,
      phone: phone.trim() || null,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setShowNew(false);
    setName(""); setSpecialty(""); setPhone("");
    load();
  }

  if (loading) return <div className="empty-state">Cargando…</div>;

  return (
    <div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Colaboradores</h3>
          <button className="btn btn-primary" onClick={() => setShowNew((s) => !s)}>{showNew ? "Cancelar" : "+ Nuevo colaborador"}</button>
        </div>

        {showNew && (
          <div style={{ display: "grid", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
            <div className="grid-2">
              <div className="field"><label>Nombre</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="field"><label>Teléfono</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            </div>
            <div className="field"><label>Especialidad</label><input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Pantallas P2.6/P3.9, cobertura CABA/GBA" /></div>
            <button className="btn btn-primary" disabled={busy} onClick={createCollaborator}>{busy ? "Guardando…" : "Crear colaborador"}</button>
          </div>
        )}

        {collaborators.length === 0 ? (
          <p className="note">Todavía no hay colaboradores cargados.</p>
        ) : (
          <table>
            <tbody>
              <tr><th>Colaborador</th><th>Especialidad</th><th>Eventos cubiertos</th><th>Total pagado</th></tr>
              {collaborators.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.specialty_notes || "—"}</td>
                  <td>{c.eventos}</td>
                  <td>{money(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="note">Cuando el stock propio no alcanza para un evento, se agrega una línea de reserva con origen "colaborador" en Reservas — el costo se descuenta automáticamente del margen de ese evento en Reportes.</p>
      </div>
    </div>
  );
}
