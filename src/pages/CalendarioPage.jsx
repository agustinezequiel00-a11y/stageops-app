import { useEffect, useState } from "react";
import { hasSupabase, supabase } from "../lib/supabase";
import { formatDate } from "../lib/format";

const statusTag = { draft: "tag-neutral", quoted: "tag-warning", confirmed: "tag-success", in_progress: "tag-warning", completed: "tag-success", cancelled: "tag-danger" };
const statusLabel = { draft: "borrador", quoted: "presupuesto enviado", confirmed: "confirmado", in_progress: "en curso", completed: "completado", cancelled: "cancelado" };

export default function CalendarioPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [events, setEvents] = useState([]);
  const [conflicts, setConflicts] = useState([]);

  useEffect(() => {
    async function load() {
      if (!hasSupabase) {
        setEvents([
          { id: "1", name: "Festival Aurora", event_at: "2026-09-18", setup_at: "2026-09-11", teardown_at: "2026-09-19", status: "quoted" },
          { id: "2", name: "Tech Convention", event_at: "2026-09-19", setup_at: null, teardown_at: null, status: "confirmed" },
        ]);
        setConflicts([]);
        setLoading(false);
        return;
      }
      const [evRes, confRes] = await Promise.all([
        supabase.from("events_display").select("id, name, event_at, setup_at, teardown_at, status").order("event_at", { ascending: true }),
        supabase.from("event_schedule_conflicts").select("*"),
      ]);
      if (evRes.error) setError(evRes.error.message);
      setEvents(evRes.data || []);
      setConflicts(confRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="empty-state">Cargando calendario…</div>;

  const uniqueConflicts = [];
  const seen = new Set();
  conflicts.forEach((c) => {
    const key = [c.event_id, c.conflicting_event_id].sort().join("-");
    if (!seen.has(key)) {
      seen.add(key);
      uniqueConflicts.push(c);
    }
  });

  return (
    <div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}

      {uniqueConflicts.length > 0 && (
        <div className="card" style={{ background: "var(--danger-bg)", borderColor: "var(--danger)" }}>
          <h3 style={{ color: "var(--danger)" }}>⚠️ Conflictos de agenda detectados</h3>
          {uniqueConflicts.map((c, i) => (
            <div key={i} style={{ fontSize: 12.5, marginBottom: 6 }}>
              <strong>{c.event_name}</strong> (montaje {formatDate(c.setup_at)} a {formatDate(c.teardown_at)}) se solapa con{" "}
              <strong>{c.conflicting_event_name}</strong> (montaje {formatDate(c.conflicting_setup_at)} a {formatDate(c.conflicting_teardown_at)}).
            </div>
          ))}
          <p className="note">Esto solo mira fechas, no si el equipo o el personal alcanzan para las dos cosas — es un aviso para que lo revises.</p>
        </div>
      )}

      <div className="card">
        <h3>Todos los eventos</h3>
        {events.length === 0 ? (
          <p className="note">Todavía no hay eventos cargados.</p>
        ) : (
          <table>
            <tbody>
              <tr><th>Evento</th><th>Montaje</th><th>Evento</th><th>Desmontaje</th><th>Estado</th></tr>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{e.setup_at ? formatDate(e.setup_at) : "—"}</td>
                  <td>{formatDate(e.event_at)}</td>
                  <td>{e.teardown_at ? formatDate(e.teardown_at) : "—"}</td>
                  <td><span className={`tag ${statusTag[e.status] || "tag-neutral"}`}>{statusLabel[e.status] || e.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="note">Cargá "Montaje" y "Desmontaje" al crear el evento en Reservas para que esta vista detecte solapamientos.</p>
      </div>
    </div>
  );
}
