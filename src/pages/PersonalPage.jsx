import { useEffect, useState } from "react";
import { hasSupabase, supabase } from "../lib/supabase";
import { money } from "../lib/format";

export default function PersonalPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgId, setOrgId] = useState(null);
  const [people, setPeople] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [employmentType, setEmploymentType] = useState("fijo");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    if (!hasSupabase) {
      setPeople([
        { id: "p1", full_name: "J. Fernández", employment_type: "fijo", specialties: ["depósito", "chofer"], phone: "+54 11 4555-0123", day_rate: 45000 },
        { id: "p2", full_name: "R. Acosta", employment_type: "eventual", specialties: ["rigging", "armado"], phone: "+54 9 11 3344-7788", day_rate: 38000 },
      ]);
      setLoading(false);
      return;
    }
    const [{ data: org }, res] = await Promise.all([
      supabase.rpc("current_org_id"),
      supabase.from("personnel_display").select("*").order("full_name"),
    ]);
    setOrgId(org);
    if (res.error) setError(res.error.message);
    setPeople(res.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createPerson() {
    if (!fullName.trim()) {
      setError("Ingresá el nombre de la persona.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: err } = await supabase.from("personnel").insert({
      organization_id: orgId,
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      employment_type: employmentType,
      specialties: specialties.split(",").map((s) => s.trim()).filter(Boolean),
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setShowNew(false);
    setFullName(""); setPhone(""); setSpecialties(""); setEmploymentType("fijo");
    load();
  }

  if (loading) return <div className="empty-state">Cargando…</div>;

  return (
    <div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Personal</h3>
          <button className="btn btn-primary" onClick={() => setShowNew((s) => !s)}>{showNew ? "Cancelar" : "+ Nueva persona"}</button>
        </div>

        {showNew && (
          <div style={{ display: "grid", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
            <div className="grid-2">
              <div className="field"><label>Nombre</label><input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div className="field"><label>Teléfono</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Tipo</label>
                <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
                  <option value="fijo">Fijo</option>
                  <option value="eventual">Eventual</option>
                </select>
              </div>
              <div className="field"><label>Especialidades (separadas por coma)</label><input value={specialties} onChange={(e) => setSpecialties(e.target.value)} placeholder="técnico led, chofer" /></div>
            </div>
            <button className="btn btn-primary" disabled={busy} onClick={createPerson}>{busy ? "Guardando…" : "Crear persona"}</button>
          </div>
        )}

        {people.length === 0 ? (
          <p className="note">Todavía no hay personal cargado.</p>
        ) : (
          <>
            <table>
              <tbody>
                <tr><th>Nombre</th><th>Tipo</th><th>Especialidades</th><th>Contacto</th><th>Tarifa/jornada</th></tr>
                {people.map((p) => (
                  <tr key={p.id}>
                    <td>{p.full_name}</td>
                    <td><span className={`tag ${p.employment_type === "fijo" ? "tag-success" : "tag-warning"}`}>{p.employment_type}</span></td>
                    <td>{(p.specialties || []).map((s) => <span key={s} className="tag tag-neutral" style={{ marginRight: 4 }}>{s}</span>)}</td>
                    <td>{p.phone || "—"}</td>
                    <td>{money(p.day_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note">Personal "fijo" trabaja en planta todo el año; "eventual" se llama según la carga de trabajo. La tarifa es visible solo para el dueño.</p>
          </>
        )}
      </div>
    </div>
  );
}
