import { Fragment, useEffect, useState } from "react";
import { hasSupabase, supabase } from "../lib/supabase";
import { money, formatDate } from "../lib/format";

const statusTag = { pending: "tag-warning", in_progress: "tag-warning", completed: "tag-success" };
const statusLabel = { pending: "pendiente", in_progress: "en curso", completed: "cerrado" };
const zoneLabel = { corner: "esquina", edge: "borde", center: "centro" };

export default function TallerPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgId, setOrgId] = useState(null);
  const [repairs, setRepairs] = useState([]);
  const [products, setProducts] = useState([]);
  const [cabinets, setCabinets] = useState([]);
  const [cabinetTypes, setCabinetTypes] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [serialMap, setSerialMap] = useState({});

  const [mode, setMode] = useState("cabinet");
  const [cabinetId, setCabinetId] = useState("");
  const [slots, setSlots] = useState([]);
  const [selectedSlotIds, setSelectedSlotIds] = useState([]);
  const [ticketProductId, setTicketProductId] = useState("");
  const [ticketNotes, setTicketNotes] = useState("");
  const [manualSerial, setManualSerial] = useState("");
  const [manualFailure, setManualFailure] = useState("");
  const [busy, setBusy] = useState(false);

  const [expandedId, setExpandedId] = useState(null);
  const [partsByRepair, setPartsByRepair] = useState({});
  const [partProductId, setPartProductId] = useState("");
  const [partQty, setPartQty] = useState("1");
  const [partCost, setPartCost] = useState("");
  const [partWarehouseId, setPartWarehouseId] = useState("");
  const [rowBusyId, setRowBusyId] = useState(null);

  async function load() {
    setLoading(true);
    if (!hasSupabase) {
      setRepairs([{ id: "r1", product_id: "p1", serial_unit_id: "s1", zone: "corner", status: "in_progress", opened_at: "2026-09-12", parts_cost: 22000 }]);
      setProducts([{ id: "p1", name: "Módulo P3.9", category: "led_screen" }]);
      setSerialMap({ s1: { id: "s1", serial_code: "LED-0547" } });
      setLoading(false);
      return;
    }
    const [{ data: org }, repRes, prodRes, cabRes, ctRes, whRes] = await Promise.all([
      supabase.rpc("current_org_id"),
      supabase.from("repairs_display").select("*").neq("status", "completed").order("opened_at", { ascending: false }),
      supabase.from("products").select("id, name, category, track_serials").order("name"),
      supabase.from("cabinets").select("id, serial_code, cabinet_type_id").order("serial_code"),
      supabase.from("cabinet_types").select("id, name, product_id, rows, cols"),
      supabase.from("warehouses").select("id, name, is_workshop").eq("active", true),
    ]);
    setOrgId(org);
    if (repRes.error) setError(repRes.error.message);
    const reps = repRes.data || [];
    setRepairs(reps);
    setProducts(prodRes.data || []);
    setCabinets(cabRes.data || []);
    setCabinetTypes(ctRes.data || []);
    setWarehouses(whRes.data || []);

    const ids = reps.map((r) => r.serial_unit_id).filter(Boolean);
    const map = {};
    if (ids.length) {
      const { data } = await supabase.from("serial_units").select("id, serial_code, lot_id, current_warehouse_id").in("id", ids);
      (data || []).forEach((s) => { map[s.id] = s; });
    }
    setSerialMap(map);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const productName = (id) => products.find((p) => p.id === id)?.name || "—";
  const workshopWarehouses = warehouses.filter((w) => w.is_workshop);
  const spareParts = products.filter((p) => p.category === "spare_part");

  async function pickCabinet(id) {
    setCabinetId(id);
    setSelectedSlotIds([]);
    setSlots([]);
    if (!id || !hasSupabase) return;
    const cab = cabinets.find((c) => c.id === id);
    const ct = cabinetTypes.find((t) => t.id === cab?.cabinet_type_id);
    setTicketProductId(ct?.product_id || "");
    const { data, error: err } = await supabase
      .from("cabinet_slots")
      .select("id, row_index, col_index, zone, current_serial_unit_id")
      .eq("cabinet_id", id)
      .order("row_index")
      .order("col_index");
    if (err) setError(err.message);
    setSlots(data || []);
  }

  function toggleSlot(id) {
    setSelectedSlotIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function createCabinetTickets() {
    if (!cabinetId || selectedSlotIds.length === 0) {
      setError("Elegí un gabinete y tocá al menos un módulo dañado.");
      return;
    }
    if (!ticketProductId) {
      setError("Elegí a qué producto corresponde el módulo dañado.");
      return;
    }
    setBusy(true);
    setError("");
    const rows = slots
      .filter((s) => selectedSlotIds.includes(s.id))
      .map((s) => ({
        organization_id: orgId,
        product_id: ticketProductId,
        serial_unit_id: s.current_serial_unit_id || null,
        cabinet_slot_id: s.id,
        zone: s.zone,
        quantity: 1,
        status: "pending",
        failure_type: "gabinete",
        notes: ticketNotes.trim() || null,
      }));
    const { error: err } = await supabase.from("repairs").insert(rows);
    setBusy(false);
    if (err) { setError(err.message); return; }
    setSelectedSlotIds([]);
    setTicketNotes("");
    load();
  }

  async function createManualTicket() {
    if (!ticketProductId) {
      setError("Elegí el producto.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      let serialUnit = null;
      if (manualSerial.trim()) {
        const { data } = await supabase
          .from("serial_units")
          .select("id, lot_id, current_warehouse_id, status")
          .eq("serial_code", manualSerial.trim())
          .maybeSingle();
        serialUnit = data;
      }
      if (serialUnit && serialUnit.status === "available") {
        const mv = await supabase.rpc("record_stock_movement", {
          p_product_id: ticketProductId, p_lot_id: serialUnit.lot_id, p_movement_type: "repair_in", p_quantity: 1,
          p_from_warehouse_id: serialUnit.current_warehouse_id, p_from_location_id: null, p_from_state: "available",
          p_to_warehouse_id: serialUnit.current_warehouse_id, p_to_location_id: null, p_to_state: "workshop",
          p_reference_type: "repair", p_reference_id: null, p_notes: "Ingreso a taller",
        });
        if (mv.error) throw mv.error;
        await supabase.from("serial_units").update({ status: "in_repair" }).eq("id", serialUnit.id);
      }
      const { error: err } = await supabase.from("repairs").insert({
        organization_id: orgId,
        product_id: ticketProductId,
        lot_id: serialUnit?.lot_id || null,
        serial_unit_id: serialUnit?.id || null,
        serial_code: manualSerial.trim() || null,
        quantity: 1,
        status: "pending",
        failure_type: manualFailure.trim() || null,
        notes: ticketNotes.trim() || null,
      });
      if (err) throw err;
      setManualSerial(""); setManualFailure(""); setTicketNotes("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function startRepair(repair) {
    setRowBusyId(repair.id);
    const { error: err } = await supabase.from("repairs").update({ status: "in_progress" }).eq("id", repair.id);
    setRowBusyId(null);
    if (err) { setError(err.message); return; }
    load();
  }

  async function closeRepair(repair, resolution) {
    setRowBusyId(repair.id);
    setError("");
    try {
      const serial = serialMap[repair.serial_unit_id];
      if (serial) {
        const common = {
          p_product_id: repair.product_id, p_lot_id: repair.lot_id || serial.lot_id, p_quantity: 1,
          p_from_warehouse_id: serial.current_warehouse_id, p_from_location_id: null, p_from_state: "workshop",
          p_reference_type: "repair", p_reference_id: repair.id,
        };
        if (resolution === "repaired") {
          const mv = await supabase.rpc("record_stock_movement", {
            ...common, p_movement_type: "repair_out",
            p_to_warehouse_id: serial.current_warehouse_id, p_to_location_id: null, p_to_state: "available", p_notes: "Reparado",
          });
          if (mv.error) throw mv.error;
          await supabase.from("serial_units").update({ status: "available" }).eq("id", serial.id);
        } else {
          const mv = await supabase.rpc("record_stock_movement", {
            ...common, p_movement_type: "adjustment",
            p_to_warehouse_id: null, p_to_location_id: null, p_to_state: null, p_notes: "Baja: no reparable",
          });
          if (mv.error) throw mv.error;
          await supabase.from("serial_units").update({ status: "retired", retired_at: new Date().toISOString().slice(0, 10) }).eq("id", serial.id);
        }
      }
      const { error: err } = await supabase
        .from("repairs")
        .update({ status: "completed", resolution, closed_at: new Date().toISOString() })
        .eq("id", repair.id);
      if (err) throw err;
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRowBusyId(null);
    }
  }

  async function loadParts(repairId) {
    const { data } = await supabase
      .from("repair_parts_used_display")
      .select("id, product_id, quantity, unit_cost, used_at")
      .eq("repair_id", repairId)
      .order("used_at", { ascending: false });
    setPartsByRepair((m) => ({ ...m, [repairId]: data || [] }));
  }

  function toggleExpand(repair) {
    if (expandedId === repair.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(repair.id);
    setPartProductId("");
    setPartQty("1");
    setPartCost("");
    setPartWarehouseId(workshopWarehouses[0]?.id || "");
    if (hasSupabase) loadParts(repair.id);
  }

  async function addPart(repair) {
    if (!partProductId || !partWarehouseId || !partQty || Number(partQty) <= 0) {
      setError("Elegí el repuesto, el depósito de taller y una cantidad.");
      return;
    }
    setRowBusyId(repair.id);
    setError("");
    const { error: err } = await supabase.rpc("use_repair_part", {
      p_repair_id: repair.id,
      p_product_id: partProductId,
      p_quantity: Number(partQty),
      p_unit_cost: partCost ? Number(partCost) : null,
      p_warehouse_id: partWarehouseId,
    });
    setRowBusyId(null);
    if (err) { setError(err.message); return; }
    setPartCost("");
    setPartQty("1");
    loadParts(repair.id);
    load();
  }

  if (loading) return <div className="empty-state">Cargando…</div>;

  const maxCol = Math.max(1, ...slots.map((s) => s.col_index));

  return (
    <div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}

      <div className="card">
        <h3>Nuevo ticket de reparación</h3>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Tipo de equipo</label>
          <select value={mode} onChange={(e) => { setMode(e.target.value); setSelectedSlotIds([]); }}>
            <option value="cabinet">Módulo dentro de un gabinete (marcar en el dibujo)</option>
            <option value="manual">Equipo suelto (por número de serie)</option>
          </select>
        </div>

        {mode === "cabinet" ? (
          <>
            <div className="grid-2" style={{ marginBottom: 12 }}>
              <div className="field">
                <label>Gabinete</label>
                <select value={cabinetId} onChange={(e) => pickCabinet(e.target.value)}>
                  <option value="">Elegir gabinete</option>
                  {cabinets.map((c) => <option key={c.id} value={c.id}>{c.serial_code}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Producto del módulo</label>
                <select value={ticketProductId} onChange={(e) => setTicketProductId(e.target.value)}>
                  <option value="">Elegir producto</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            {cabinetId && slots.length === 0 && <p className="note">Este gabinete todavía no tiene posiciones generadas.</p>}
            {slots.length > 0 && (
              <>
                <div className="note" style={{ marginBottom: 6 }}>Tocá el módulo dañado — la zona (esquina/borde/centro) se calcula sola.</div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${maxCol}, 54px)`, gap: 8, margin: "10px 0" }}>
                  {slots.map((s) => {
                    const on = selectedSlotIds.includes(s.id);
                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => toggleSlot(s.id)}
                        title={zoneLabel[s.zone]}
                        style={{
                          aspectRatio: "1",
                          border: `1px solid ${on ? "var(--danger)" : "var(--border-strong)"}`,
                          background: on ? "var(--danger-bg)" : "var(--surface-2)",
                          color: on ? "var(--danger)" : "var(--text)",
                          borderRadius: 6,
                          fontSize: 10,
                          cursor: "pointer",
                        }}
                      >
                        {s.row_index}·{s.col_index}
                      </button>
                    );
                  })}
                </div>
                <div className="note">
                  {selectedSlotIds.length === 0
                    ? "Ningún módulo marcado todavía."
                    : `${selectedSlotIds.length} marcado(s): ` +
                      slots.filter((s) => selectedSlotIds.includes(s.id)).map((s) => `${s.row_index}·${s.col_index} (${zoneLabel[s.zone]})`).join(", ")}
                </div>
              </>
            )}
            <div className="field" style={{ marginTop: 10 }}>
              <label>Notas (opcional)</label>
              <input value={ticketNotes} onChange={(e) => setTicketNotes(e.target.value)} />
            </div>
            <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={busy} onClick={createCabinetTickets}>{busy ? "Creando…" : "Crear ticket(s)"}</button>
          </>
        ) : (
          <>
            <div className="grid-2" style={{ marginBottom: 12 }}>
              <div className="field">
                <label>Producto</label>
                <select value={ticketProductId} onChange={(e) => setTicketProductId(e.target.value)}>
                  <option value="">Elegir producto</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="field"><label>Número de serie (si tiene)</label><input value={manualSerial} onChange={(e) => setManualSerial(e.target.value)} placeholder="LED-1001" /></div>
            </div>
            <div className="grid-2">
              <div className="field"><label>Falla</label><input value={manualFailure} onChange={(e) => setManualFailure(e.target.value)} placeholder="No enciende, píxeles muertos…" /></div>
              <div className="field"><label>Notas (opcional)</label><input value={ticketNotes} onChange={(e) => setTicketNotes(e.target.value)} /></div>
            </div>
            <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={busy} onClick={createManualTicket}>{busy ? "Creando…" : "Crear ticket"}</button>
          </>
        )}
      </div>

      <div className="card">
        <h3>Tickets abiertos</h3>
        {repairs.length === 0 ? (
          <p className="note">No hay reparaciones abiertas.</p>
        ) : (
          <table>
            <tbody>
              <tr><th>Equipo</th><th>Serie</th><th>Zona</th><th>Estado</th><th>Abierto</th><th>Repuestos</th><th></th></tr>
              {repairs.map((r) => (
                <Fragment key={r.id}>
                  <tr>
                    <td>{productName(r.product_id)}</td>
                    <td>{serialMap[r.serial_unit_id]?.serial_code || r.serial_code || "—"}</td>
                    <td>{r.zone ? zoneLabel[r.zone] : "—"}</td>
                    <td><span className={`tag ${statusTag[r.status] || "tag-neutral"}`}>{statusLabel[r.status] || r.status}</span></td>
                    <td>{formatDate(r.opened_at)}</td>
                    <td>{money(r.parts_cost)}</td>
                    <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {r.status === "pending" && <button className="btn" style={{ padding: "4px 8px", fontSize: 11 }} disabled={rowBusyId === r.id} onClick={() => startRepair(r)}>Iniciar</button>}
                      <button className="btn" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => toggleExpand(r)}>{expandedId === r.id ? "Cerrar panel" : "Repuestos"}</button>
                      <button className="btn btn-success" style={{ padding: "4px 8px", fontSize: 11 }} disabled={rowBusyId === r.id} onClick={() => closeRepair(r, "repaired")}>Reparado</button>
                      <button className="btn btn-danger" style={{ padding: "4px 8px", fontSize: 11 }} disabled={rowBusyId === r.id} onClick={() => closeRepair(r, "scrapped")}>Dar de baja</button>
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr>
                      <td colSpan="7" style={{ background: "var(--surface-2)" }}>
                        <div style={{ padding: 10 }}>
                          <div className="note" style={{ marginBottom: 8 }}>Repuestos usados en este ticket</div>
                          {(partsByRepair[r.id] || []).length === 0 ? (
                            <p className="note">Todavía no se usó ningún repuesto.</p>
                          ) : (
                            <table style={{ marginBottom: 10 }}>
                              <tbody>
                                <tr><th>Repuesto</th><th>Cantidad</th><th>Costo unitario</th></tr>
                                {partsByRepair[r.id].map((p) => (
                                  <tr key={p.id}><td>{productName(p.product_id)}</td><td>{p.quantity}</td><td>{money(p.unit_cost)}</td></tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          {workshopWarehouses.length === 0 ? (
                            <p className="note">Para descontar repuestos necesitás un depósito marcado como "de taller". Por ahora hay que marcarlo en la base (columna is_workshop en warehouses).</p>
                          ) : spareParts.length === 0 ? (
                            <p className="note">Todavía no hay productos con categoría "Repuesto de taller" (se crean desde Ingreso de mercadería).</p>
                          ) : (
                            <div className="grid-3" style={{ alignItems: "flex-end" }}>
                              <div className="field">
                                <label>Repuesto</label>
                                <select value={partProductId} onChange={(e) => setPartProductId(e.target.value)}>
                                  <option value="">Elegir</option>
                                  {spareParts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                              </div>
                              <div className="field"><label>Cantidad</label><input type="number" min="1" value={partQty} onChange={(e) => setPartQty(e.target.value)} /></div>
                              <div className="field"><label>Costo unitario (opcional)</label><input type="number" value={partCost} onChange={(e) => setPartCost(e.target.value)} /></div>
                              <div className="field">
                                <label>Depósito de taller</label>
                                <select value={partWarehouseId} onChange={(e) => setPartWarehouseId(e.target.value)}>
                                  {workshopWarehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                              </div>
                              <button className="btn btn-primary" disabled={rowBusyId === r.id} onClick={() => addPart(r)}>Descontar del taller</button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
        <p className="note">"Reparado" devuelve la unidad a disponible; "Dar de baja" la retira del inventario para siempre. Los tickets cerrados salen de esta lista (siguen contando en Reportes).</p>
      </div>
    </div>
  );
}
