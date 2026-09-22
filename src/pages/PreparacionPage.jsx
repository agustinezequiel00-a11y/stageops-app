import { useEffect, useState } from "react";
import { hasSupabase, supabase } from "../lib/supabase";
import { formatDate } from "../lib/format";

export default function PreparacionPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [events, setEvents] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [lines, setLines] = useState([]);
  const [busyLineId, setBusyLineId] = useState(null);
  const [suggestion, setSuggestion] = useState(null);

  useEffect(() => {
    async function load() {
      if (!hasSupabase) {
        setEvents([{ id: "demo-e1", name: "Festival Aurora", event_at: "2026-09-18" }]);
        setWarehouses([{ id: "demo-w1", name: "Depósito Central" }]);
        setLoading(false);
        return;
      }
      const [evRes, whRes] = await Promise.all([
        supabase.from("events_display").select("id, name, event_at").order("event_at", { ascending: false }),
        supabase.from("warehouses").select("id, name").eq("active", true).order("name"),
      ]);
      setEvents(evRes.data || []);
      setWarehouses(whRes.data || []);
      if (whRes.data?.length) setSelectedWarehouseId(whRes.data[0].id);
      setLoading(false);
    }
    load();
  }, []);

  async function loadLines(eventId) {
    if (!hasSupabase || !eventId) { setLines([]); return; }
    const { data, error: err } = await supabase
      .from("event_reservations")
      .select("id, product_id, lot_id, quantity, source, product:products(name, track_serials)")
      .eq("event_id", eventId)
      .eq("source", "internal");
    if (err) setError(err.message);
    setLines(data || []);
  }

  useEffect(() => {
    if (selectedEventId) loadLines(selectedEventId);
  }, [selectedEventId]);

  async function suggestFor(line) {
    setError("");
    setBusyLineId(line.id);
    setSuggestion(null);
    try {
      let lotId = line.lot_id;
      let lotCode = null;

      if (!lotId) {
        const { data: lotSug, error: lotErr } = await supabase.rpc("suggest_stock_allocation", {
          p_product_id: line.product_id,
          p_warehouse_id: selectedWarehouseId,
          p_needed_qty: line.quantity,
        });
        if (lotErr) throw lotErr;
        if (!lotSug || lotSug.length === 0) throw new Error("No hay stock disponible de este producto en ese depósito.");
        lotId = lotSug[0].lot_id;
        lotCode = lotSug[0].lot_code;
      }

      if (line.product?.track_serials) {
        const { data: serialSug, error: serialErr } = await supabase.rpc("suggest_serial_allocation", {
          p_product_id: line.product_id,
          p_lot_id: lotId,
          p_warehouse_id: selectedWarehouseId,
          p_needed_qty: line.quantity,
        });
        if (serialErr) throw serialErr;
        setSuggestion({ lineId: line.id, lotId, lotCode, serials: serialSug || [] });
      } else {
        setSuggestion({ lineId: line.id, lotId, lotCode, serials: null });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyLineId(null);
    }
  }

  async function acceptSuggestion(line) {
    setBusyLineId(line.id);
    setError("");
    try {
      if (suggestion.serials) {
        const ids = suggestion.serials.map((s) => s.serial_unit_id);
        const { error: updErr } = await supabase
          .from("serial_units")
          .update({ status: "reserved", current_event_id: selectedEventId })
          .in("id", ids)
          .eq("status", "available");
        if (updErr) throw updErr;
      }

      await supabase.rpc("record_stock_movement", {
        p_product_id: line.product_id,
        p_lot_id: suggestion.lotId,
        p_movement_type: "reservation_hold",
        p_quantity: line.quantity,
        p_from_warehouse_id: selectedWarehouseId,
        p_from_location_id: null,
        p_from_state: "available",
        p_to_warehouse_id: selectedWarehouseId,
        p_to_location_id: null,
        p_to_state: "reserved",
        p_reference_type: "event",
        p_reference_id: selectedEventId,
        p_notes: "Preparación de pedido",
      });

      if (!line.lot_id) {
        await supabase.from("event_reservations").update({ lot_id: suggestion.lotId }).eq("id", line.id);
      }

      setSuggestion(null);
      loadLines(selectedEventId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyLineId(null);
    }
  }

  if (loading) return <div className="empty-state">Cargando…</div>;

  return (
    <div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}

      <div className="card">
        <h3>Preparación de pedido</h3>
        <div className="grid-2">
          <div className="field">
            <label>Evento</label>
            <select value={selectedEventId} onChange={(e) => { setSelectedEventId(e.target.value); setSuggestion(null); }}>
              <option value="">Elegir evento</option>
              {events.map((e) => <option key={e.id} value={e.id}>{e.name} · {formatDate(e.event_at)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Depósito de origen</label>
            <select value={selectedWarehouseId} onChange={(e) => setSelectedWarehouseId(e.target.value)}>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {selectedEventId && (
        <div className="card">
          <h3>Líneas de stock propio a preparar</h3>
          {lines.length === 0 ? (
            <p className="note">No hay líneas de stock propio para este evento (o todavía no cargaste la reserva).</p>
          ) : (
            <table>
              <tbody>
                <tr><th>Producto</th><th>Cantidad</th><th></th></tr>
                {lines.map((line) => (
                  <>
                    <tr key={line.id}>
                      <td>{line.product?.name}</td>
                      <td>{line.quantity}</td>
                      <td>
                        <button className="btn" style={{ padding: "5px 10px", fontSize: 11 }} disabled={busyLineId === line.id} onClick={() => suggestFor(line)}>
                          {busyLineId === line.id ? "Calculando…" : "Sugerir asignación"}
                        </button>
                      </td>
                    </tr>
                    {suggestion?.lineId === line.id && (
                      <tr key={line.id + "-suggestion"}>
                        <td colSpan="3" style={{ background: "var(--surface-2)" }}>
                          <div style={{ padding: "8px 0" }}>
                            <div className="note" style={{ marginBottom: 8 }}>
                              Lote sugerido: <strong style={{ color: "var(--text)" }}>{suggestion.lotCode || suggestion.lotId}</strong>
                              {suggestion.serials && ` · ${suggestion.serials.length} de ${line.quantity} unidades encontradas`}
                            </div>
                            {suggestion.serials && (
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                                {suggestion.serials.slice(0, 12).map((s) => <span key={s.serial_unit_id} className="tag-case">{s.serial_code}</span>)}
                                {suggestion.serials.length > 12 && <span className="note">+{suggestion.serials.length - 12} más</span>}
                              </div>
                            )}
                            <button className="btn btn-primary" style={{ padding: "5px 10px", fontSize: 11 }} disabled={busyLineId === line.id} onClick={() => acceptSuggestion(line)}>
                              Aceptar y asignar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
