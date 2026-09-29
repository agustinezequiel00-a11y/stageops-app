import { useEffect, useState } from "react";
import { hasSupabase, supabase } from "../lib/supabase";

export default function DepositosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgId, setOrgId] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [summary, setSummary] = useState(null);
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState(null);

  const [showNewWarehouse, setShowNewWarehouse] = useState(false);
  const [newWhName, setNewWhName] = useState("");
  const [newWhArea, setNewWhArea] = useState("");

  const [showNewLocation, setShowNewLocation] = useState(false);
  const [locCode, setLocCode] = useState("");
  const [locZone, setLocZone] = useState("");
  const [locX, setLocX] = useState("0");
  const [locY, setLocY] = useState("0");
  const [locCapacity, setLocCapacity] = useState("");

  const [reassignType, setReassignType] = useState("serial");
  const [reassignCode, setReassignCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadWarehouses() {
    setLoading(true);
    if (!hasSupabase) {
      setWarehouses([{ id: "w1", name: "Depósito Central" }]);
      setSelectedWarehouseId("w1");
      setLoading(false);
      return;
    }
    const [{ data: org }, whRes] = await Promise.all([
      supabase.rpc("current_org_id"),
      supabase.from("warehouses").select("id, name, total_area_m2").eq("active", true).order("name"),
    ]);
    setOrgId(org);
    setWarehouses(whRes.data || []);
    if (whRes.data?.length && !selectedWarehouseId) setSelectedWarehouseId(whRes.data[0].id);
    setLoading(false);
  }

  useEffect(() => {
    loadWarehouses();
  }, []);

  async function loadWarehouseDetail(warehouseId) {
    if (!hasSupabase || !warehouseId) return;
    const [summaryRes, locRes] = await Promise.all([
      supabase.from("warehouse_summary").select("*").eq("warehouse_id", warehouseId).maybeSingle(),
      supabase.from("location_contents").select("*").eq("warehouse_id", warehouseId),
    ]);
    if (summaryRes.error) setError(summaryRes.error.message);
    setSummary(summaryRes.data || null);
    setLocations(locRes.data || []);
  }

  useEffect(() => {
    if (selectedWarehouseId) loadWarehouseDetail(selectedWarehouseId);
  }, [selectedWarehouseId]);

  async function createWarehouse() {
    if (!newWhName.trim()) {
      setError("Ingresá el nombre del depósito.");
      return;
    }
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.from("warehouses").insert({
      organization_id: orgId,
      name: newWhName.trim(),
      total_area_m2: newWhArea ? Number(newWhArea) : null,
      active: true,
    }).select().single();
    setBusy(false);
    if (err) { setError(err.message); return; }
    setShowNewWarehouse(false);
    setNewWhName(""); setNewWhArea("");
    await loadWarehouses();
    setSelectedWarehouseId(data.id);
  }

  async function createLocation() {
    if (!locCode.trim()) {
      setError("Ingresá el código de la ubicación.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: err } = await supabase.from("warehouse_locations").insert({
      organization_id: orgId,
      warehouse_id: selectedWarehouseId,
      code: locCode.trim(),
      zone: locZone.trim() || null,
      pos_x: Number(locX) || 0,
      pos_y: Number(locY) || 0,
      capacity_units: locCapacity ? Number(locCapacity) : null,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setShowNewLocation(false);
    setLocCode(""); setLocZone(""); setLocX("0"); setLocY("0"); setLocCapacity("");
    loadWarehouseDetail(selectedWarehouseId);
  }

  async function reassign(targetLocationId) {
    if (!reassignCode.trim() || !targetLocationId) {
      setError("Completá el código de la unidad y la ubicación destino.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("assign_unit_location", {
      p_item_type: reassignType,
      p_code: reassignCode.trim(),
      p_location_id: targetLocationId,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setReassignCode("");
    loadWarehouseDetail(selectedWarehouseId);
  }

  if (loading) return <div className="empty-state">Cargando…</div>;

  const maxX = Math.max(0, ...locations.map((l) => l.pos_x));
  const maxY = Math.max(0, ...locations.map((l) => l.pos_y));
  const selectedLocation = locations.find((l) => l.location_id === selectedLocationId);

  return (
    <div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Depósitos</h3>
          <button className="btn btn-primary" onClick={() => setShowNewWarehouse((s) => !s)}>{showNewWarehouse ? "Cancelar" : "+ Nuevo depósito"}</button>
        </div>

        {showNewWarehouse && (
          <div style={{ display: "grid", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
            <div className="grid-2">
              <div className="field"><label>Nombre</label><input value={newWhName} onChange={(e) => setNewWhName(e.target.value)} placeholder="Depósito Norte" /></div>
              <div className="field"><label>Superficie total (m², opcional)</label><input type="number" value={newWhArea} onChange={(e) => setNewWhArea(e.target.value)} /></div>
            </div>
            <button className="btn btn-primary" disabled={busy} onClick={createWarehouse}>{busy ? "Guardando…" : "Crear depósito"}</button>
          </div>
        )}

        <div className="field">
          <label>Depósito seleccionado</label>
          <select value={selectedWarehouseId} onChange={(e) => { setSelectedWarehouseId(e.target.value); setSelectedLocationId(null); }}>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>

      {summary && (
        <div className="card">
          <h3>Resumen — {summary.name}</h3>
          <div className="grid-4" style={{ marginBottom: 8 }}>
            <div className="kpi"><div className="label">Unidades totales</div><div className="value">{Number(summary.total_units).toLocaleString("es-AR")}</div></div>
            <div className="kpi"><div className="label">M² ocupados (conocidos)</div><div className="value">{Number(summary.occupied_m2).toLocaleString("es-AR")}</div></div>
            <div className="kpi"><div className="label">M² totales del depósito</div><div className="value">{summary.total_area_m2 ?? "—"}</div></div>
            <div className="kpi"><div className="label">Ubicaciones / racks</div><div className="value">{summary.location_count}</div></div>
          </div>
          {summary.products_missing_footprint > 0 && (
            <p className="note">⚠️ {summary.products_missing_footprint} producto(s) en este depósito no tienen cargado su m² por unidad, así que no entran en el cálculo de "M² ocupados". Cargalo editando el producto (próximo paso: te agrego ese campo en Ingreso).</p>
          )}
        </div>
      )}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Mapa de ubicaciones</h3>
          <button className="btn btn-primary" onClick={() => setShowNewLocation((s) => !s)}>{showNewLocation ? "Cancelar" : "+ Nueva ubicación"}</button>
        </div>

        {showNewLocation && (
          <div style={{ display: "grid", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
            <div className="grid-2">
              <div className="field"><label>Código</label><input value={locCode} onChange={(e) => setLocCode(e.target.value)} placeholder="Rack A-1" /></div>
              <div className="field"><label>Zona / descripción</label><input value={locZone} onChange={(e) => setLocZone(e.target.value)} placeholder="Fondo, pared este" /></div>
            </div>
            <div className="grid-3">
              <div className="field"><label>Posición X (columna)</label><input type="number" min="0" value={locX} onChange={(e) => setLocX(e.target.value)} /></div>
              <div className="field"><label>Posición Y (fila)</label><input type="number" min="0" value={locY} onChange={(e) => setLocY(e.target.value)} /></div>
              <div className="field"><label>Capacidad (unidades, opcional)</label><input type="number" value={locCapacity} onChange={(e) => setLocCapacity(e.target.value)} /></div>
            </div>
            <button className="btn btn-primary" disabled={busy} onClick={createLocation}>{busy ? "Guardando…" : "Crear ubicación"}</button>
          </div>
        )}

        {locations.length === 0 ? (
          <p className="note">Todavía no hay ubicaciones/racks cargados para este depósito.</p>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${maxX + 1}, minmax(90px, 1fr))`,
                gridTemplateRows: `repeat(${maxY + 1}, 70px)`,
                gap: 8,
                marginBottom: 14,
              }}
            >
              {locations.map((l) => {
                const pct = l.capacity_units ? Math.min(100, (l.occupied_units / l.capacity_units) * 100) : (l.occupied_units > 0 ? 100 : 0);
                const isSelected = l.location_id === selectedLocationId;
                return (
                  <button
                    key={l.location_id}
                    onClick={() => setSelectedLocationId(l.location_id)}
                    style={{
                      gridColumn: l.pos_x + 1,
                      gridRow: l.pos_y + 1,
                      border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border-strong)",
                      borderRadius: 8,
                      background: l.occupied_units > 0 ? "var(--surface-2)" : "var(--surface)",
                      color: "var(--text)",
                      cursor: "pointer",
                      padding: 6,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      textAlign: "left",
                    }}
                  >
                    <span className="tag-case" style={{ fontSize: 10 }}>{l.code}</span>
                    <div style={{ background: "var(--surface-2)", borderRadius: 99, height: 4, overflow: "hidden" }}>
                      <div style={{ background: pct > 90 ? "var(--danger)" : "var(--accent)", height: "100%", width: `${pct}%` }} />
                    </div>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{l.occupied_units}{l.capacity_units ? `/${l.capacity_units}` : ""}</span>
                  </button>
                );
              })}
            </div>

            {selectedLocation && (
              <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: 12 }}>
                <div style={{ fontWeight: 500, marginBottom: 6 }}>{selectedLocation.code} {selectedLocation.zone ? `· ${selectedLocation.zone}` : ""}</div>
                {selectedLocation.items.length === 0 ? (
                  <p className="note">Vacío — no hay unidades con serie asignadas acá todavía.</p>
                ) : (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    {selectedLocation.items.map((it) => (
                      <span key={it.code} className="tag-case" title={it.product}>{it.code}</span>
                    ))}
                  </div>
                )}
                <div className="grid-3" style={{ marginTop: 10 }}>
                  <div className="field">
                    <label>Tipo</label>
                    <select value={reassignType} onChange={(e) => setReassignType(e.target.value)}>
                      <option value="serial">Módulo con serie</option>
                      <option value="cabinet">Gabinete</option>
                    </select>
                  </div>
                  <div className="field"><label>Código</label><input value={reassignCode} onChange={(e) => setReassignCode(e.target.value)} placeholder="LED-1001" /></div>
                  <div className="field">
                    <label>Mover a esta ubicación</label>
                    <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy} onClick={() => reassign(selectedLocation.location_id)}>
                      {busy ? "Moviendo…" : "Asignar acá"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <p className="note">El mapa se arma solo con la posición X/Y que le des a cada ubicación al crearla — pensalo como coordenadas de un croquis simple del depósito.</p>
      </div>
    </div>
  );
}
