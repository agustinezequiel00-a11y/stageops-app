import { useEffect, useState } from "react";
import { hasSupabase, supabase } from "../lib/supabase";
import { formatDate } from "../lib/format";

export default function RetornoPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgId, setOrgId] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [units, setUnits] = useState([]);
  const [outcomes, setOutcomes] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    async function load() {
      if (!hasSupabase) {
        setEvents([{ id: "demo-e1", name: "Festival Aurora", event_at: "2026-09-18" }]);
        setLoading(false);
        return;
      }
      const [{ data: org }, evRes] = await Promise.all([
        supabase.rpc("current_org_id"),
        supabase.from("events_display").select("id, name, event_at").order("event_at", { ascending: false }),
      ]);
      setOrgId(org);
      setEvents(evRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  async function loadUnits(eventId) {
    setOutcomes({});
    setDone(null);
    if (!hasSupabase || !eventId) { setUnits([]); return; }
    const { data, error: err } = await supabase
      .from("serial_units")
      .select("id, serial_code, product_id, lot_id, current_warehouse_id, status, product:products(name)")
      .eq("current_event_id", eventId)
      .eq("status", "reserved");
    if (err) setError(err.message);
    setUnits(data || []);
  }

  useEffect(() => {
    if (selectedEventId) loadUnits(selectedEventId);
  }, [selectedEventId]);

  function setOutcome(id, value) {
    setOutcomes((o) => ({ ...o, [id]: value }));
  }

  const counts = units.reduce(
    (acc, u) => {
      const v = outcomes[u.id];
      if (v) acc[v] += 1;
      return acc;
    },
    { ok: 0, damaged: 0, lost: 0 }
  );

  async function confirmReturn() {
    setBusy(true);
    setError("");
    try {
      const groups = {};
      units.forEach((u) => {
        const outcome = outcomes[u.id];
        if (!outcome) return;
        const key = `${u.product_id}-${u.lot_id}-${u.current_warehouse_id}-${outcome}`;
        if (!groups[key]) groups[key] = { product_id: u.product_id, lot_id: u.lot_id, warehouse_id: u.current_warehouse_id, outcome, ids: [] };
        groups[key].ids.push(u.id);
      });

      for (const g of Object.values(groups)) {
        if (g.outcome === "ok") {
          await supabase.from("serial_units").update({ status: "available", current_event_id: null }).in("id", g.ids);
          await supabase.rpc("record_stock_movement", {
            p_product_id: g.product_id, p_lot_id: g.lot_id, p_movement_type: "transfer", p_quantity: g.ids.length,
            p_from_warehouse_id: g.warehouse_id, p_from_location_id: null, p_from_state: "reserved",
            p_to_warehouse_id: g.warehouse_id, p_to_location_id: null, p_to_state: "available",
            p_reference_type: "event", p_reference_id: selectedEventId, p_notes: "Retorno sin novedad",
          });
        } else if (g.outcome === "damaged") {
          await supabase.from("serial_units").update({ status: "in_repair", current_event_id: null }).in("id", g.ids);
          await supabase.rpc("record_stock_movement", {
            p_product_id: g.product_id, p_lot_id: g.lot_id, p_movement_type: "repair_in", p_quantity: g.ids.length,
            p_from_warehouse_id: g.warehouse_id, p_from_location_id: null, p_from_state: "reserved",
            p_to_warehouse_id: g.warehouse_id, p_to_location_id: null, p_to_state: "workshop",
            p_reference_type: "event", p_reference_id: selectedEventId, p_notes: "Retorno dañado",
          });
          const repairRows = g.ids.map((serialUnitId) => ({
            organization_id: orgId, product_id: g.product_id, lot_id: g.lot_id,
            serial_unit_id: serialUnitId, quantity: 1, status: "pending",
            related_event_id: selectedEventId, failure_type: "retorno_evento",
          }));
          await supabase.from("repairs").insert(repairRows);
        } else if (g.outcome === "lost") {
          await supabase.from("serial_units").update({ status: "lost", current_event_id: selectedEventId }).in("id", g.ids);
          await supabase.rpc("record_stock_movement", {
            p_product_id: g.product_id, p_lot_id: g.lot_id, p_movement_type: "adjustment", p_quantity: g.ids.length,
            p_from_warehouse_id: g.warehouse_id, p_from_location_id: null, p_from_state: "reserved",
            p_to_warehouse_id: null, p_to_location_id: null, p_to_state: null,
            p_reference_type: "event", p_reference_id: selectedEventId, p_notes: "Baja por pérdida",
          });
        }
      }

      setDone({ ok: counts.ok, damaged: counts.damaged, lost: counts.lost });
      loadUnits(selectedEventId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="empty-state">Cargando…</div>;

  const allMarked = units.length > 0 && units.every((u) => outcomes[u.id]);

  return (
    <div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}

      <div className="card">
        <h3>Retorno de equipo</h3>
        <div className="field">
          <label>Evento</label>
          <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
            <option value="">Elegir evento</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.name} · {formatDate(e.event_at)}</option>)}
          </select>
        </div>
      </div>

      {selectedEventId && (
        <div className="card">
          <h3>Unidades reservadas para este evento</h3>
          {units.length === 0 ? (
            <p className="note">No hay unidades con serie reservadas para este evento (o ya se procesaron).</p>
          ) : (
            <>
              <table>
                <tbody>
                  <tr><th>Serial</th><th>Producto</th><th></th></tr>
                  {units.map((u) => (
                    <tr key={u.id}>
                      <td className="tag-case" style={{ display: "table-cell" }}>{u.serial_code}</td>
                      <td>{u.product?.name}</td>
                      <td style={{ display: "flex", gap: 6 }}>
                        <button type="button" className={`btn ${outcomes[u.id] === "ok" ? "btn-success" : ""}`} style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setOutcome(u.id, "ok")}>Sin novedad</button>
                        <button type="button" className={`btn ${outcomes[u.id] === "damaged" ? "btn-danger" : ""}`} style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setOutcome(u.id, "damaged")}>Dañado</button>
                        <button type="button" className="btn" style={{ padding: "4px 8px", fontSize: 11, background: outcomes[u.id] === "lost" ? "var(--warning-bg)" : undefined, color: outcomes[u.id] === "lost" ? "var(--warning)" : undefined }} onClick={() => setOutcome(u.id, "lost")}>Falta</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="grid-3" style={{ margin: "14px 0" }}>
                <div className="kpi" style={{ background: "var(--success-bg)" }}><div className="label" style={{ color: "var(--success)" }}>Sin novedad</div><div className="value" style={{ color: "var(--success)" }}>{counts.ok}</div></div>
                <div className="kpi" style={{ background: "var(--danger-bg)" }}><div className="label" style={{ color: "var(--danger)" }}>Dañadas</div><div className="value" style={{ color: "var(--danger)" }}>{counts.damaged}</div></div>
                <div className="kpi" style={{ background: "var(--warning-bg)" }}><div className="label" style={{ color: "var(--warning)" }}>Faltan</div><div className="value" style={{ color: "var(--warning)" }}>{counts.lost}</div></div>
              </div>
              <button className="btn btn-primary" disabled={busy || !allMarked} onClick={confirmReturn}>
                {busy ? "Procesando…" : allMarked ? "Confirmar retorno" : "Marcá todas las unidades antes de confirmar"}
              </button>
            </>
          )}
        </div>
      )}

      {done && (
        <div className="card">
          <h3>Retorno confirmado</h3>
          <p className="note">{done.ok} unidades volvieron a disponible, {done.damaged} pasaron a taller (con ticket de reparación creado), {done.lost} se dieron de baja por pérdida.</p>
        </div>
      )}
    </div>
  );
}
