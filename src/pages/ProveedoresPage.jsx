import { useEffect, useState } from "react";
import { hasSupabase, supabase } from "../lib/supabase";
import { money, formatDate } from "../lib/format";

export default function ProveedoresPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgId, setOrgId] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [history, setHistory] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    if (!hasSupabase) {
      setSuppliers([{ supplier_id: "s1", name: "Novastar Argentina", total_purchases: 12, total_spent: 34800000, last_purchase_at: "2026-09-14" }]);
      setLoading(false);
      return;
    }
    const [{ data: org }, res] = await Promise.all([
      supabase.rpc("current_org_id"),
      supabase.from("supplier_summary").select("*").order("total_spent", { ascending: false }),
    ]);
    setOrgId(org);
    if (res.error) setError(res.error.message);
    setSuppliers(res.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    async function loadHistory() {
      if (!hasSupabase || !selectedId) { setHistory([]); return; }
      const { data, error: err } = await supabase
        .from("supplier_purchase_history")
        .select("*")
        .eq("supplier_id", selectedId)
        .order("received_at", { ascending: false });
      if (err) setError(err.message);
      setHistory(data || []);
    }
    loadHistory();
  }, [selectedId]);

  async function createSupplier() {
    if (!name.trim()) {
      setError("Ingresá el nombre del proveedor.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: err } = await supabase.from("suppliers").insert({
      organization_id: orgId,
      name: name.trim(),
      tax_id: taxId.trim() || null,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setShowNew(false);
    setName(""); setTaxId("");
    load();
  }

  if (loading) return <div className="empty-state">Cargando…</div>;

  const selected = suppliers.find((s) => s.supplier_id === selectedId);

  return (
    <div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Proveedores</h3>
          <button className="btn btn-primary" onClick={() => setShowNew((s) => !s)}>{showNew ? "Cancelar" : "+ Nuevo proveedor"}</button>
        </div>

        {showNew && (
          <div style={{ display: "grid", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
            <div className="grid-2">
              <div className="field"><label>Nombre</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="field"><label>CUIT</label><input value={taxId} onChange={(e) => setTaxId(e.target.value)} /></div>
            </div>
            <button className="btn btn-primary" disabled={busy} onClick={createSupplier}>{busy ? "Guardando…" : "Crear proveedor"}</button>
          </div>
        )}

        {suppliers.length === 0 ? (
          <p className="note">Todavía no hay proveedores cargados.</p>
        ) : (
          <table>
            <tbody>
              <tr><th>Proveedor</th><th>Compras</th><th>Total gastado</th><th>Última compra</th><th></th></tr>
              {suppliers.map((s) => (
                <tr key={s.supplier_id}>
                  <td>{s.name}</td>
                  <td>{s.total_purchases}</td>
                  <td>{money(s.total_spent)}</td>
                  <td>{s.last_purchase_at ? formatDate(s.last_purchase_at) : "—"}</td>
                  <td><button className="btn" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setSelectedId(s.supplier_id)}>Ver historial</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="card">
          <h3>Historial — {selected.name}</h3>
          {history.length === 0 ? (
            <p className="note">Sin compras registradas todavía.</p>
          ) : (
            <table>
              <tbody>
                <tr><th>Lote</th><th>Producto</th><th>Unidades</th><th>Recibido</th><th>Moneda</th><th>Costo</th></tr>
                {history.map((h) => (
                  <tr key={h.lot_id}>
                    <td className="tag-case" style={{ display: "table-cell" }}>{h.lot_code}</td>
                    <td>{h.product_name}</td>
                    <td>{h.units_received}</td>
                    <td>{formatDate(h.received_at)}</td>
                    <td>{h.purchase_cost_currency}</td>
                    <td>{money(h.purchase_cost, h.purchase_cost_currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
