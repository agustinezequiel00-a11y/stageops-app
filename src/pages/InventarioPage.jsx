import { useEffect, useMemo, useState } from "react";
import { hasSupabase, supabase } from "../lib/supabase";

const stateTag = { available: "tag-success", reserved: "tag-warning", at_event: "tag-warning", workshop: "tag-danger" };
const stateLabel = { available: "disponible", reserved: "reservado", at_event: "en evento", workshop: "taller" };

export default function InventarioPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [filterProduct, setFilterProduct] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("");
  const [filterState, setFilterState] = useState("");

  const [expandedKey, setExpandedKey] = useState(null);
  const [seriesByKey, setSeriesByKey] = useState({});
  const [loadingSeries, setLoadingSeries] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      if (!hasSupabase) {
        setRows([
          { product_id: "p1", warehouse_id: "w1", lot_id: "l1", state: "available", quantity: 196, product: { name: "Módulo P3.9", track_serials: true }, lot: { code: "P39-2026-A" }, warehouse: { name: "Depósito Central" } },
          { product_id: "p1", warehouse_id: "w1", lot_id: "l1", state: "reserved", quantity: 120, product: { name: "Módulo P3.9", track_serials: true }, lot: { code: "P39-2026-A" }, warehouse: { name: "Depósito Central" } },
        ]);
        setProducts([{ id: "p1", name: "Módulo P3.9" }]);
        setWarehouses([{ id: "w1", name: "Depósito Central" }]);
        setLoading(false);
        return;
      }
      const [balRes, prodRes, whRes] = await Promise.all([
        supabase.from("inventory_balances").select("product_id, warehouse_id, lot_id, state, quantity, product:products(name, track_serials), lot:lots(code), warehouse:warehouses(name)").gt("quantity", 0),
        supabase.from("products").select("id, name").order("name"),
        supabase.from("warehouses").select("id, name").order("name"),
      ]);
      if (balRes.error) setError(balRes.error.message);
      setRows(balRes.data || []);
      setProducts(prodRes.data || []);
      setWarehouses(whRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filterProduct && r.product_id !== filterProduct) return false;
      if (filterWarehouse && r.warehouse_id !== filterWarehouse) return false;
      if (filterState && r.state !== filterState) return false;
      return true;
    });
  }, [rows, filterProduct, filterWarehouse, filterState]);

  const kpis = useMemo(() => {
    const totals = { available: 0, reserved: 0, at_event: 0, workshop: 0 };
    rows.forEach((r) => {
      if (totals[r.state] !== undefined) totals[r.state] += Number(r.quantity) || 0;
    });
    return totals;
  }, [rows]);

  const byWarehouse = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      const name = r.warehouse?.name || "Sin depósito";
      map[name] = (map[name] || 0) + (Number(r.quantity) || 0);
    });
    return Object.entries(map);
  }, [rows]);

  async function toggleSeries(row) {
    const key = `${row.product_id}-${row.lot_id}-${row.warehouse_id}-${row.state}`;
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(key);
    if (seriesByKey[key] || !hasSupabase) return;
    setLoadingSeries(true);
    let query = supabase.from("serial_units").select("serial_code").eq("product_id", row.product_id).eq("current_warehouse_id", row.warehouse_id).eq("status", row.state);
    if (row.lot_id) query = query.eq("lot_id", row.lot_id);
    const { data, error: err } = await query.limit(50);
    if (!err) setSeriesByKey((s) => ({ ...s, [key]: data || [] }));
    setLoadingSeries(false);
  }

  if (loading) return <div className="empty-state">Cargando inventario…</div>;

  return (
    <div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Producto</label>
          <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}>
            <option value="">Todos los productos</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Depósito</label>
          <select value={filterWarehouse} onChange={(e) => setFilterWarehouse(e.target.value)}>
            <option value="">Todos los depósitos</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Estado</label>
          <select value={filterState} onChange={(e) => setFilterState(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="available">Disponible</option>
            <option value="reserved">Reservado</option>
            <option value="at_event">En evento</option>
            <option value="workshop">Taller</option>
          </select>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="label">Disponible</div><div className="value">{kpis.available.toLocaleString("es-AR")}</div></div>
        <div className="kpi"><div className="label">Reservado</div><div className="value">{kpis.reserved.toLocaleString("es-AR")}</div></div>
        <div className="kpi"><div className="label">En evento</div><div className="value">{kpis.at_event.toLocaleString("es-AR")}</div></div>
        <div className="kpi"><div className="label">Taller</div><div className="value">{kpis.workshop.toLocaleString("es-AR")}</div></div>
      </div>

      <div className="card">
        <h3>Stock por producto / lote / depósito</h3>
        {filteredRows.length === 0 ? (
          <p className="note">No hay stock cargado todavía con estos filtros. Empezá por Ingreso de mercadería.</p>
        ) : (
          <table>
            <tbody>
              <tr><th>Producto</th><th>Lote</th><th>Depósito</th><th>Estado</th><th>Cantidad</th><th></th></tr>
              {filteredRows.map((r) => {
                const key = `${r.product_id}-${r.lot_id}-${r.warehouse_id}-${r.state}`;
                const isOpen = expandedKey === key;
                return (
                  <>
                    <tr key={key}>
                      <td>{r.product?.name || "—"}</td>
                      <td>{r.lot?.code || "—"}</td>
                      <td>{r.warehouse?.name || "—"}</td>
                      <td><span className={`tag ${stateTag[r.state] || "tag-neutral"}`}>{stateLabel[r.state] || r.state}</span></td>
                      <td>{Number(r.quantity).toLocaleString("es-AR")}</td>
                      <td>
                        {r.product?.track_serials && (
                          <button type="button" className="btn" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => toggleSeries(r)}>
                            {isOpen ? "Ocultar" : "Ver series"}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={key + "-detail"}>
                        <td colSpan="6" style={{ background: "var(--surface-2)" }}>
                          {loadingSeries && !seriesByKey[key] ? (
                            <span className="note">Cargando series…</span>
                          ) : (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {(seriesByKey[key] || []).length === 0 ? (
                                <span className="note">Sin series encontradas para este grupo.</span>
                              ) : (
                                (seriesByKey[key] || []).map((s) => (
                                  <span key={s.serial_code} className="tag-case">{s.serial_code}</span>
                                ))
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Resumen por depósito</h3>
        <div className="grid-3">
          {byWarehouse.map(([name, total]) => (
            <div key={name} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontWeight: 500 }}>{name}</div>
              <div className="note">{total.toLocaleString("es-AR")} unidades</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
