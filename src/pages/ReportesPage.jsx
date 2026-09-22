import { useEffect, useState } from "react";
import { hasSupabase, supabase } from "../lib/supabase";
import { money } from "../lib/format";

const zoneLabel = { corner: "Esquina", edge: "Borde", center: "Centro" };

export default function ReportesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [zoneFailures, setZoneFailures] = useState([]);
  const [profitability, setProfitability] = useState([]);
  const [stockValue, setStockValue] = useState(null);
  const [pendingCost, setPendingCost] = useState([]);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    async function load() {
      if (!hasSupabase) {
        setZoneFailures([{ zone: "corner", n: 58 }, { zone: "edge", n: 27 }, { zone: "center", n: 9 }]);
        setProfitability([{ event_id: "1", event_name: "Festival Aurora", client_name: "Aurora Producciones", contract_amount: 4200000, margin: 4115000 }]);
        setStockValue({ total_stock_value: 412600000, currency: "ARS", lots_missing_exchange_rate: 2 });
        setIsOwner(true);
        setLoading(false);
        return;
      }

      const [role, repRes, profRes, stockRes, pendingRes] = await Promise.all([
        supabase.rpc("current_user_role"),
        supabase.from("repairs_display").select("zone"),
        supabase.from("event_profitability").select("event_id, event_name, client_name, contract_amount, margin").order("event_at", { ascending: false }).limit(10),
        supabase.from("stock_value_summary").select("*").maybeSingle(),
        supabase.from("lots_pending_cost").select("lot_id, code, received_at, unit_count"),
      ]);

      setIsOwner(role.data === "owner");
      if (repRes.error) setError(repRes.error.message);

      const zoneCounts = {};
      (repRes.data || []).forEach((r) => {
        if (!r.zone) return;
        zoneCounts[r.zone] = (zoneCounts[r.zone] || 0) + 1;
      });
      setZoneFailures(Object.entries(zoneCounts).map(([zone, n]) => ({ zone, n })));
      setProfitability(profRes.data || []);
      setStockValue(stockRes.data || null);
      setPendingCost(pendingRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="empty-state">Cargando reportes…</div>;

  const maxZone = Math.max(1, ...zoneFailures.map((z) => z.n));

  return (
    <div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}

      <div className="card">
        <h3>Fallas por zona del gabinete</h3>
        {zoneFailures.length === 0 ? (
          <p className="note">Todavía no hay reparaciones con gabinete cargadas.</p>
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

      <div className="card">
        <h3>Valor del stock</h3>
        <div className="grid-2">
          <div className="kpi"><div className="label">Valor total (convertido a {stockValue?.currency || "ARS"} hoy)</div><div className="value">{money(stockValue?.total_stock_value)}</div></div>
          <div className="kpi"><div className="label">Lotes sin tipo de cambio cargado</div><div className="value" style={{ color: "var(--warning)" }}>{stockValue?.lots_missing_exchange_rate ?? "—"}</div></div>
        </div>
      </div>

      {isOwner && pendingCost.length > 0 && (
        <div className="card">
          <h3>🔒 Costos pendientes de carga (solo dueño)</h3>
          <table>
            <tbody>
              <tr><th>Lote</th><th>Unidades</th><th>Recibido</th></tr>
              {pendingCost.map((l) => (
                <tr key={l.lot_id}><td className="tag-case" style={{ display: "table-cell" }}>{l.code}</td><td>{l.unit_count}</td><td>{l.received_at}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="note">Cargá el costo de estos lotes desde la función set_lot_purchase_cost (pantalla dedicada, próximo paso).</p>
        </div>
      )}

      <div className="card">
        <h3>Rentabilidad por evento</h3>
        {profitability.length === 0 ? (
          <p className="note">Todavía no hay eventos con datos de rentabilidad.</p>
        ) : (
          <table>
            <tbody>
              <tr><th>Evento</th><th>Cliente</th><th>Ingreso</th><th>Margen</th></tr>
              {profitability.map((p) => (
                <tr key={p.event_id}>
                  <td>{p.event_name}</td>
                  <td>{p.client_name || "—"}</td>
                  <td>{money(p.contract_amount)}</td>
                  <td>{money(p.margin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

