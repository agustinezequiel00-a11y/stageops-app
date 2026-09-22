import { useEffect, useState } from "react";
import { hasSupabase, supabase } from "../lib/supabase";

export default function VehiculosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgId, setOrgId] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");
  const [isOwn, setIsOwn] = useState(true);
  const [externalProvider, setExternalProvider] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    if (!hasSupabase) {
      setVehicles([
        { vehicle_id: "v1", name: "Camión 1", plate: "XYZ 789", status: "available", is_own: true, current_km: 84320, next_service_km: 85000, km_to_service: 680, total_trips: 142 },
        { vehicle_id: "v2", name: "Flete Expreso Norte", plate: null, status: "available", is_own: false, external_provider_name: "Expreso Norte", current_km: null, next_service_km: null, km_to_service: null, total_trips: 3 },
      ]);
      setLoading(false);
      return;
    }
    const [{ data: org }, vehRes] = await Promise.all([
      supabase.rpc("current_org_id"),
      supabase.from("vehicle_status").select("*").order("name"),
    ]);
    setOrgId(org);
    if (vehRes.error) setError(vehRes.error.message);
    setVehicles(vehRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createVehicle() {
    if (!name.trim()) {
      setError("Ingresá un nombre para el vehículo.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: err } = await supabase.from("vehicles").insert({
      organization_id: orgId,
      name: name.trim(),
      plate: plate.trim() || null,
      is_own: isOwn,
      external_provider: isOwn ? null : externalProvider.trim() || null,
      status: "available",
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setShowNew(false);
    setName("");
    setPlate("");
    setIsOwn(true);
    setExternalProvider("");
    load();
  }

  if (loading) return <div className="empty-state">Cargando…</div>;

  return (
    <div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Flota</h3>
          <button className="btn btn-primary" onClick={() => setShowNew((s) => !s)}>{showNew ? "Cancelar" : "+ Nuevo vehículo"}</button>
        </div>

        {showNew && (
          <div style={{ display: "grid", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
            <div className="grid-2">
              <div className="field"><label>Nombre</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Camión 4" /></div>
              <div className="field"><label>Patente (si es propio)</label><input value={plate} onChange={(e) => setPlate(e.target.value)} /></div>
            </div>
            <div className="field">
              <label>Origen</label>
              <select value={isOwn ? "own" : "external"} onChange={(e) => setIsOwn(e.target.value === "own")}>
                <option value="own">Propio</option>
                <option value="external">Externo (flete/colaborador)</option>
              </select>
            </div>
            {!isOwn && (
              <div className="field"><label>Proveedor del flete</label><input value={externalProvider} onChange={(e) => setExternalProvider(e.target.value)} placeholder="Expreso Norte" /></div>
            )}
            <button className="btn btn-primary" disabled={busy} onClick={createVehicle}>{busy ? "Guardando…" : "Crear vehículo"}</button>
          </div>
        )}

        {vehicles.length === 0 ? (
          <p className="note">Todavía no hay vehículos cargados.</p>
        ) : (
          <table>
            <tbody>
              <tr><th>Vehículo</th><th>Origen</th><th>Estado</th><th>Km actual</th><th>A service</th><th>Viajes</th></tr>
              {vehicles.map((v) => (
                <tr key={v.vehicle_id}>
                  <td>{v.name}{v.plate ? ` · ${v.plate}` : ""}</td>
                  <td>{v.is_own ? <span className="tag tag-success">propio</span> : <span className="tag" style={{ background: "rgba(92,200,224,0.12)", color: "var(--info)" }}>{v.external_provider_name || "externo"}</span>}</td>
                  <td><span className={`tag ${v.status === "available" ? "tag-success" : v.status === "in_use" ? "tag-danger" : "tag-warning"}`}>{v.status}</span></td>
                  <td>{v.current_km != null ? `${Number(v.current_km).toLocaleString("es-AR")} km` : "—"}</td>
                  <td>{v.km_to_service != null ? <span className={v.km_to_service < 1500 ? "tag tag-warning" : "tag tag-success"}>en {Number(v.km_to_service).toLocaleString("es-AR")} km</span> : "—"}</td>
                  <td>{v.total_trips}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
