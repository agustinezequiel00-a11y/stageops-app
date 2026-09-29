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
  const [newKm, setNewKm] = useState("");
  const [newNextService, setNewNextService] = useState("");
  const [busy, setBusy] = useState(false);

  const [expandedId, setExpandedId] = useState(null);
  const [odometerInput, setOdometerInput] = useState("");
  const [serviceType, setServiceType] = useState("service");
  const [serviceKm, setServiceKm] = useState("");
  const [serviceCost, setServiceCost] = useState("");
  const [serviceNextDue, setServiceNextDue] = useState("");
  const [serviceNotes, setServiceNotes] = useState("");
  const [rowBusy, setRowBusy] = useState(false);

  async function load() {
    setLoading(true);
    if (!hasSupabase) {
      setVehicles([
        { vehicle_id: "v1", name: "Camión 1", plate: "XYZ 789", status: "available", is_own: true, current_km: 84320, next_service_km: 85000, km_to_service: 680, total_trips: 142, total_km_traveled: 15200 },
        { vehicle_id: "v2", name: "Flete Expreso Norte", plate: null, status: "available", is_own: false, external_provider_name: "Expreso Norte", current_km: null, next_service_km: null, km_to_service: null, total_trips: 3, total_km_traveled: 0 },
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
      current_km: newKm ? Number(newKm) : 0,
      next_service_km: newNextService ? Number(newNextService) : null,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setShowNew(false);
    setName(""); setPlate(""); setIsOwn(true); setExternalProvider(""); setNewKm(""); setNewNextService("");
    load();
  }

  function toggleExpand(v) {
    if (expandedId === v.vehicle_id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(v.vehicle_id);
    setOdometerInput(v.current_km != null ? String(v.current_km) : "");
    setServiceType("service");
    setServiceKm(v.current_km != null ? String(v.current_km) : "");
    setServiceCost("");
    setServiceNextDue("");
    setServiceNotes("");
  }

  async function updateOdometer(vehicleId) {
    if (!odometerInput) {
      setError("Ingresá el km actual.");
      return;
    }
    setRowBusy(true);
    setError("");
    const { error: err } = await supabase.from("vehicles").update({ current_km: Number(odometerInput) }).eq("id", vehicleId);
    setRowBusy(false);
    if (err) { setError(err.message); return; }
    load();
  }

  async function registerService(vehicleId) {
    if (!serviceKm) {
      setError("Ingresá el km al que se hizo el service.");
      return;
    }
    setRowBusy(true);
    setError("");
    const { error: err } = await supabase.from("vehicle_maintenance").insert({
      organization_id: orgId,
      vehicle_id: vehicleId,
      maintenance_type: serviceType,
      odometer_km: Number(serviceKm),
      cost: serviceCost ? Number(serviceCost) : null,
      next_due_km: serviceNextDue ? Number(serviceNextDue) : null,
      notes: serviceNotes.trim() || null,
    });
    if (err) { setRowBusy(false); setError(err.message); return; }
    const updatePayload = { current_km: Number(serviceKm) };
    if (serviceNextDue) updatePayload.next_service_km = Number(serviceNextDue);
    await supabase.from("vehicles").update(updatePayload).eq("id", vehicleId);
    setRowBusy(false);
    setServiceCost(""); setServiceNotes(""); setServiceNextDue("");
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
            <div className="grid-2">
              <div className="field"><label>Km actual</label><input type="number" min="0" value={newKm} onChange={(e) => setNewKm(e.target.value)} placeholder="0" /></div>
              <div className="field"><label>Próximo service (km, opcional)</label><input type="number" min="0" value={newNextService} onChange={(e) => setNewNextService(e.target.value)} /></div>
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
              <tr><th>Vehículo</th><th>Origen</th><th>Estado</th><th>Km actual</th><th>A service</th><th>Km recorridos</th><th>Viajes</th><th></th></tr>
              {vehicles.map((v) => (
                <>
                  <tr key={v.vehicle_id}>
                    <td>{v.name}{v.plate ? ` · ${v.plate}` : ""}</td>
                    <td>{v.is_own ? <span className="tag tag-success">propio</span> : <span className="tag" style={{ background: "rgba(92,200,224,0.12)", color: "var(--info)" }}>{v.external_provider_name || "externo"}</span>}</td>
                    <td><span className={`tag ${v.status === "available" ? "tag-success" : v.status === "in_use" ? "tag-danger" : "tag-warning"}`}>{v.status}</span></td>
                    <td>{v.current_km != null ? `${Number(v.current_km).toLocaleString("es-AR")} km` : "—"}</td>
                    <td>{v.km_to_service != null ? <span className={v.km_to_service < 1500 ? "tag tag-warning" : "tag tag-success"}>en {Number(v.km_to_service).toLocaleString("es-AR")} km</span> : "—"}</td>
                    <td>{Number(v.total_km_traveled || 0).toLocaleString("es-AR")} km</td>
                    <td>{v.total_trips}</td>
                    <td>{v.is_own && <button className="btn" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => toggleExpand(v)}>{expandedId === v.vehicle_id ? "Cerrar" : "Actualizar"}</button>}</td>
                  </tr>
                  {expandedId === v.vehicle_id && (
                    <tr key={v.vehicle_id + "-detail"}>
                      <td colSpan="8" style={{ background: "var(--surface-2)" }}>
                        <div style={{ padding: 10 }}>
                          <div className="grid-2" style={{ marginBottom: 14 }}>
                            <div className="field"><label>Actualizar odómetro (km actual)</label><input type="number" value={odometerInput} onChange={(e) => setOdometerInput(e.target.value)} /></div>
                            <div className="field" style={{ display: "flex", alignItems: "flex-end" }}>
                              <button className="btn btn-primary" style={{ width: "100%" }} disabled={rowBusy} onClick={() => updateOdometer(v.vehicle_id)}>{rowBusy ? "Guardando…" : "Actualizar km"}</button>
                            </div>
                          </div>
                          <div className="note" style={{ marginBottom: 8 }}>Registrar service / mantenimiento</div>
                          <div className="grid-3" style={{ marginBottom: 8 }}>
                            <div className="field">
                              <label>Tipo</label>
                              <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                                <option value="service">Service</option>
                                <option value="tires">Cubiertas</option>
                                <option value="brakes">Frenos</option>
                                <option value="inspection">Inspección</option>
                                <option value="other">Otro</option>
                              </select>
                            </div>
                            <div className="field"><label>Km al momento</label><input type="number" value={serviceKm} onChange={(e) => setServiceKm(e.target.value)} /></div>
                            <div className="field"><label>Próximo a los (km, opcional)</label><input type="number" value={serviceNextDue} onChange={(e) => setServiceNextDue(e.target.value)} /></div>
                          </div>
                          <div className="grid-2" style={{ marginBottom: 8 }}>
                            <div className="field"><label>Costo (opcional)</label><input type="number" value={serviceCost} onChange={(e) => setServiceCost(e.target.value)} /></div>
                            <div className="field"><label>Notas</label><input value={serviceNotes} onChange={(e) => setServiceNotes(e.target.value)} placeholder="Cambio de aceite y filtros" /></div>
                          </div>
                          <button className="btn btn-primary" disabled={rowBusy} onClick={() => registerService(v.vehicle_id)}>{rowBusy ? "Guardando…" : "Registrar service"}</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
        <p className="note">"Km recorridos" se calcula solo de viajes registrados con salida y retorno (Plan de carga) — todavía no está esa pantalla conectada, así que por ahora va a estar en 0 aunque actualices el odómetro a mano.</p>
      </div>
    </div>
  );
}
