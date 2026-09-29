import { useEffect, useMemo, useState } from "react";
import { hasSupabase, supabase } from "../lib/supabase";

const stateTag = { available: "tag-success", reserved: "tag-warning", at_event: "tag-warning", workshop: "tag-danger" };
const stateLabel = { available: "disponible", reserved: "reservado", at_event: "en evento", workshop: "taller" };

export default function InventarioPage() {
  const [loading, setLoading] = useState(true);
  const [qrProductId, setQrProductId] = useState("");
  const [qrQuantity, setQrQuantity] = useState("1");
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
          { product_id: "p1", warehouse_id: "w1", lot_id: "l1", state: "available", quantity: 196, product: { name: "MÃ³dulo P3.9", track_serials: true }, lot: { code: "P39-2026-A" }, warehouse: { name: "DepÃ³sito Central" } },
          { product_id: "p1", warehouse_id: "w1", lot_id: "l1", state: "reserved", quantity: 120, product: { name: "MÃ³dulo P3.9", track_serials: true }, lot: { code: "P39-2026-A" }, warehouse: { name: "DepÃ³sito Central" } },
        ]);
        setProducts([{ id: "p1", name: "MÃ³dulo P3.9" }]);
        setWarehouses([{ id: "w1", name: "DepÃ³sito Central" }]);
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
      const name = r.warehouse?.name || "Sin depÃ³sito";
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

  if (loading) return <div className="empty-state">Cargando inventarioâ¦</div>;

  return (
    <div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}

      <div className="card" id="etiquetasCard">
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Generar QR de producto</h3>
        </div>
        <div className="grid-3 no-print" style={{ marginBottom: 12 }}>
          <div className="field">
            <label>Producto</label>
            <select value={qrProductId} onChange={(e) => setQrProductId(e.target.value)}>
              <option value="">Elegir producto</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Cantidad de etiquetas</label>
            <input type="number" min="1" value={qrQuantity} onChange={(e) => setQrQuantity(e.target.value)} />
          </div>
          <div className="field" style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="button" className="btn btn-primary" style={{ width: "100%" }} disabled={!qrProductId} onClick={() => window.print()}>
              Imprimir etiquetas
            </button>
          </div>
        </div>
        {qrProductId && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {Array.from({ length: Math.max(1, Number(qrQuantity) || 1) }).map((_, i) => {
              const product = products.find((p) => p.id === qrProductId);
              const qrData = `PRODUCTO:${qrProductId}`;
              return (
                <div key={i} style={{ border: "1px dashed var(--border-strong)", borderRadius: 8, padding: 10, textAlign: "center", background: "var(--surface-2)" }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(qrData)}`}
                    width="90"
                    height="90"
                    alt={`QR ${product?.name}`}
                    style={{ display: "block", margin: "0 auto 6px" }}
                  />
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{product?.name}</div>
                </div>
              );
            })}
          </div>
        )}
        <p className="note no-print">Este QR identifica el producto en general (no una unidad puntual) — sirve para pegar en estantes, bins o cajas donde se guarda ese producto.</p>
      </div>

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Producto</label>
          <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}>
            <option value="">Todos los productos</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>DepÃ³sito</label>
          <select value={filterWarehouse} onChange={(e) => setFilterWarehouse(e.target.value)}>
            <option value="">Todos los depÃ³sitos</option>
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
        <h3>Stock por producto / lote / depÃ³sito</h3>
        {filteredRows.length === 0 ? (
          <p className="note">No hay stock cargado todavÃ­a con estos filtros. EmpezÃ¡ por Ingreso de mercaderÃ­a.</p>
        ) : (
          <table>
            <tbody>
              <tr><th>Producto</th><th>Lote</th><th>DepÃ³sito</th><th>Estado</th><th>Cantidad</th><th></th></tr>
              {filteredRows.map((r) => {
                const key = `${r.product_id}-${r.lot_id}-${r.warehouse_id}-${r.state}`;
                const isOpen = expandedKey === key;
                return (
                  <>
                    <tr key={key}>
                      <td>{r.product?.name || "â"}</td>
                      <td>{r.lot?.code || "â"}</td>
                      <td>{r.warehouse?.name || "â"}</td>
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
                            <span className="note">Cargando seriesâ¦</span>
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
        <h3>Resumen por depÃ³sito</h3>
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
