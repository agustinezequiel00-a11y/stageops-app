import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { hasSupabase, supabase } from "../lib/supabase";
import { money, formatDate } from "../lib/format";

const statusTag = { draft: "tag-neutral", quoted: "tag-warning", confirmed: "tag-success", in_progress: "tag-warning", completed: "tag-success", cancelled: "tag-danger" };
const statusLabel = { draft: "borrador", quoted: "presupuesto enviado", confirmed: "confirmado", in_progress: "en curso", completed: "completado", cancelled: "cancelado" };

export default function DashboardPage() {
  const [loading, setLoading] = useState(hasSupabase);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [balances, setBalances] = useState({ available: 0, workshop: 0, reserved: 0, at_event: 0 });
  const [fleet, setFleet] = useState({ available: 0, total: 0 });
  const [monthRevenue, setMonthRevenue] = useState(undefined);
  const [zoneFailures, setZoneFailures] = useState([]);

  useEffect(() => {
    if (!hasSupabase) {
      setEvents([
        { name: "Festival Aurora", event_at: "2026-09-18", status: "quoted", contract_amount: null, contract_currency: "ARS" },
        { name: "Tech Convention", event_at: "2026-09-19", status: "confirmed", contract_amount: 2800000, contract_currency: "ARS" },
      ]);
      setBalances({ available: 1842, workshop: 128, reserved: 312, at_event: 420 });
      setFleet({ available: 5, total: 8 });
      setMonthRevenue(7000000);
      setZoneFailures([{ zone: "corner", n: 58 }, { zone: "edge", n: 27 }, { zone: "center", n: 9 }]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      supabase.from("events_display").select("name, event_at, status, contract_amount, contract_currency")
        .gte("event_at", new Date().toISOString().slice(0, 10))
        .order("event_at", { ascending: true })
        .limit(6),
      supabase.from("inventory_balances").select("state, quantity"),
      supabase.from("vehicle_status").select("status"),
      supabase.from("event_profitability").select("contract_amount, event_at"),
      supabase.from("repairs_display").select("zone"),
    ])
      .then(([evRes, balRes, vehRes, profRes, repRes]) => {
        if (cancelled) return;
        const firstError = [evRes, balRes, vehRes, profRes, repRes].find((r) => r.error);
        if (firstError) throw firstError.error;

        setEvents(evRes.data || []);

        const bal = { available: 0, workshop: 0, reserved: 0, at_event: 0 };
        (balRes.data || []).forEach((row) => {
          if (bal[row.state] !== undefined) bal[row.state] += Number(row.quantity) || 0;
        });
        setBalances(bal);

        const total = (vehRes.data || []).length;
        const available = (vehRes.data || []).filter((v) => v.status === "available").length;
        setFleet({ available, total });

        const now = new Date();
        const thisMonth = (profRes.data || []).filter((e) => {
          if (!e.event_at) return false;
          const d = new Date(e.event_at);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const anyVisible = thisMonth.some((e) => e.contract_amount !== null);
        setMonthRevenue(anyVisible ? thisMonth.reduce((sum, e) => sum + (e.contract_amount || 0), 0) : null);

        const zoneCounts = {};
        (repRes.data || []).forEach((r) => {
          if (!r.zone) return;
          zoneCounts[r.zone] = (zoneCounts[r.zone] || 0) + 1;
        });
        setZoneFailures(Object.entries(zoneCounts).map(([zone, n]) => ({ zone, n })));
      })
      .catch((err) => setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="empty-state">Cargando dashboard…</div>;
  if (error) return <div className="card"><p style={{ color: "var(--danger)" }}>No se pudo cargar el dashboard: {error}</p></div>;

  const zoneLabel = { corner: "Esquina", edge: "Borde", center: "Centro" };
  const maxZone = Math.max(1, ...zoneFailures.map((z) => z.n));

  return (
    <div>
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="label">Eventos próximos</div><div className="value">{events.length}</div></div>
        <div className="kpi"><div className="label">Disponible</div><div className="value">{balances.available.toLocaleString("es-AR")}</div></div>
        <div className="kpi"><div className="label">En taller</div><div className="value">{balances.workshop.toLocaleString("es-AR")}</div></div>
        <div className="kpi"><div className="label">Vehículos libres</div><div className="value">{fleet.available}/{fleet.total}</div></div>
      </div>

      <div className="card">
        <h3>Ingresos del mes</h3>
        <div className="value" style={{ fontSize: 22 }}>
          {monthRevenue === undefined ? "…" : money(monthRevenue)}
        </div>
        {monthRevenue === null && <div className="note">Solo el dueño puede ver este dato.</div>}
      </div>

      <div className="card">
        <h3>Próximos eventos</h3>
        {events.length === 0 ? (
          <p className="note">No hay eventos próximos cargados todavía.</p>
        ) : (
          <table>
            <tbody>
              <tr><th>Evento</th><th>Fecha</th><th>Estado</th><th>Facturado</th></tr>
              {events.map((e) => (
                <tr key={e.name + e.event_at}>
                  <td>{e.name}</td>
                  <td>{formatDate(e.event_at)}</td>
                  <td><span className={`tag ${statusTag[e.status] || "tag-neutral"}`}>{statusLabel[e.status] || e.status}</span></td>
                  <td>{money(e.contract_amount, e.contract_currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="note"><Link to="/calendario" style={{ color: "var(--accent)" }}>Ver todos en el calendario →</Link></div>
      </div>

      <div className="card">
        <h3>Fallas por zona</h3>
        {zoneFailures.length === 0 ? (
          <p className="note">Todavía no hay reparaciones cargadas.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {zoneFailures.map((z) => (
              <div key={z.zone}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                  <span>{zoneLabel[z.zone] || z.zone}</span><span>{z.n}</span>
                </div>
                <div style={{ background: "var(--surface-2)", borderRadius: 99, height: 7, overflow: "hidden" }}>
                  <div style={{ background: "var(--accent)", height: "100%", width: `${(z.n / maxZone) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
