import { useEffect, useState } from "react";
import { hasSupabase, supabase } from "../lib/supabase";
import { money, formatDate } from "../lib/format";

export default function ReservasPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [reservations, setReservations] = useState([]);
  const [products, setProducts] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [clients, setClients] = useState([]);
  const [orgId, setOrgId] = useState(null);

  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventClientId, setNewEventClientId] = useState("");

  const [lineProductId, setLineProductId] = useState("");
  const [lineQuantity, setLineQuantity] = useState("");
  const [lineSource, setLineSource] = useState("internal");
  const [lineCollaboratorId, setLineCollaboratorId] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadBase() {
    if (!hasSupabase) {
      setEvents([{ id: "demo-e1", name: "Festival Aurora", event_at: "2026-09-18", status: "quoted", contract_amount: null, contract_currency: "ARS" }]);
      setProducts([{ id: "demo-p1", name: "Módulo LED P3.9" }]);
      setCollaborators([]);
      setClients([]);
      setLoading(false);
      return;
    }
    const [{ data: org }, evRes, prodRes, colRes, cliRes] = await Promise.all([
      supabase.rpc("current_org_id"),
      supabase.from("events_display").select("id, name, event_at, status, contract_amount, contract_currency").order("event_at", { ascending: false }),
      supabase.from("products").select("id, name").order("name"),
      supabase.from("collaborators").select("id, name").eq("active", true).order("name"),
      supabase.from("clients").select("id, name").order("name"),
    ]);
    setOrgId(org);
    setEvents(evRes.data || []);
    setProducts(prodRes.data || []);
    setCollaborators(colRes.data || []);
    setClients(cliRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadBase();
  }, []);

  async function loadReservations(eventId) {
    if (!hasSupabase || !eventId) {
      setReservations([]);
      return;
    }
    const { data, error: err } = await supabase
      .from("event_reservations")
      .select("id, quantity, source, status, collaborator_cost, product:products(name), collaborator:collaborators(name)")
      .eq("event_id", eventId);
    if (err) setError(err.message);
    setReservations(data || []);
  }

  useEffect(() => {
    if (selectedEventId) loadReservations(selectedEventId);
  }, [selectedEventId]);

  async function createEvent() {
    if (!newEventName.trim() || !newEventDate) {
      setError("Completá nombre y fecha del evento.");
      return;
    }
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase
      .from("events")
      .insert({
        organization_id: orgId,
        name: newEventName.trim(),
        client_id: newEventClientId || null,
        event_at: newEventDate,
        status: "draft",
      })
      .select()
      .single();
    setBusy(false);
    if (err) { setError(err.message); return; }
    setEvents((e) => [data, ...e]);
    setSelectedEventId(data.id);
    setShowNewEvent(false);
    setNewEventName("");
    setNewEventDate("");
  }

  async function addLine(e) {
    e.preventDefault();
    setError("");
    if (!selectedEventId || !lineProductId || !lineQuantity || Number(lineQuantity) <= 0) {
      setError("Elegí evento, producto y una cantidad mayor a cero.");
      return;
    }
    if (lineSource === "collaborator" && !lineCollaboratorId) {
      setError("Elegí de qué colaborador sale esta línea.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.from("event_reservations").insert({
      organization_id: orgId,
      event_id: selectedEventId,
      product_id: lineProductId,
      quantity: Number(lineQuantity),
      source: lineSource,
      collaborator_id: lineSource === "collaborator" ? lineCollaboratorId : null,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setLineProductId("");
    setLineQuantity("");
    setLineSource("internal");
    setLineCollaboratorId("");
    loadReservations(selectedEventId);
  }

  if (loading) return <div className="empty-state">Cargando…</div>;

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}

      <div className="card">
        <h3>Evento</h3>
        {showNewEvent ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div className="grid-2">
              <div className="field"><label>Nombre del evento</label><input value={newEventName} onChange={(e) => setNewEventName(e.target.value)} /></div>
              <div className="field"><label>Fecha</label><input type="date" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} /></div>
            </div>
            <div className="field">
              <label>Cliente (opcional)</label>
              <select value={newEventClientId} onChange={(e) => setNewEventClientId(e.target.value)}>
                <option value="">Sin cliente</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" disabled={busy} onClick={createEvent}>Crear evento</button>
              <button className="btn" onClick={() => setShowNewEvent(false)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} style={{ flex: 1 }}>
              <option value="">Elegir evento</option>
              {events.map((e) => <option key={e.id} value={e.id}>{e.name} · {formatDate(e.event_at)}</option>)}
            </select>
            <button className="btn btn-primary" onClick={() => setShowNewEvent(true)}>+ Nuevo evento</button>
          </div>
        )}
      </div>

      {selectedEvent && (
        <>
          <div className="card">
            <h3>Equipo reservado — {selectedEvent.name}</h3>
            {reservations.length === 0 ? (
              <p className="note">Todavía no hay nada reservado para este evento.</p>
            ) : (
              <table>
                <tbody>
                  <tr><th>Producto</th><th>Cantidad</th><th>Origen</th><th>Estado</th></tr>
                  {reservations.map((r) => (
                    <tr key={r.id}>
                      <td>{r.product?.name || "—"}</td>
                      <td>{r.quantity}</td>
                      <td>{r.source === "collaborator" ? <span className="tag" style={{ background: "rgba(92,200,224,0.12)", color: "var(--info)" }}>{r.collaborator?.name || "colaborador"}</span> : <span className="tag tag-success">stock propio</span>}</td>
                      <td><span className="tag tag-warning">{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h3>Agregar línea de equipo</h3>
            <form onSubmit={addLine}>
              <div className="grid-2" style={{ marginBottom: 12 }}>
                <div className="field">
                  <label>Producto</label>
                  <select value={lineProductId} onChange={(e) => setLineProductId(e.target.value)}>
                    <option value="">Elegir producto</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Cantidad</label>
                  <input type="number" min="1" value={lineQuantity} onChange={(e) => setLineQuantity(e.target.value)} />
                </div>
              </div>
              <div className="grid-2" style={{ marginBottom: 12 }}>
                <div className="field">
                  <label>Origen</label>
                  <select value={lineSource} onChange={(e) => setLineSource(e.target.value)}>
                    <option value="internal">Stock propio</option>
                    <option value="collaborator">Colaborador externo</option>
                  </select>
                </div>
                {lineSource === "collaborator" && (
                  <div className="field">
                    <label>Colaborador</label>
                    <select value={lineCollaboratorId} onChange={(e) => setLineCollaboratorId(e.target.value)}>
                      <option value="">Elegir colaborador</option>
                      {collaborators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <button className="btn btn-primary" disabled={busy}>{busy ? "Guardando…" : "Agregar a la reserva"}</button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
