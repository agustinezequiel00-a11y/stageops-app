import { useEffect, useState } from "react";
import { hasSupabase, supabase } from "../lib/supabase";

export default function IngresoPage() {
  const [orgId, setOrgId] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [cabinetTypes, setCabinetTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lotCode, setLotCode] = useState("");
  const [receivedAt, setReceivedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [unitsPerCase, setUnitsPerCase] = useState("");

  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("led_screen");
  const [newProductTracksSerials, setNewProductTracksSerials] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function loadAll() {
    setLoading(true);
    setError("");
    if (!hasSupabase) {
      setSuppliers([{ id: "demo-1", name: "Novastar Argentina" }]);
      setProducts([{ id: "demo-p1", name: "Módulo LED P3.9", track_serials: true, track_lots: true }]);
      setWarehouses([{ id: "demo-w1", name: "Depósito Central" }]);
      setCabinetTypes([]);
      setLoading(false);
      return;
    }
    const [{ data: org }, sup, prod, wh, ct] = await Promise.all([
      supabase.rpc("current_org_id"),
      supabase.from("suppliers").select("id, name").order("name"),
      supabase.from("products").select("id, name, track_lots, track_serials, category").order("name"),
      supabase.from("warehouses").select("id, name").eq("active", true).order("name"),
      supabase.from("cabinet_types").select("id, name, product_id, rows, cols"),
    ]);
    if (sup.error || prod.error || wh.error || ct.error) {
      setError((sup.error || prod.error || wh.error || ct.error).message);
    }
    setOrgId(org);
    setSuppliers(sup.data || []);
    setProducts(prod.data || []);
    setWarehouses(wh.data || []);
    setCabinetTypes(ct.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const selectedProduct = products.find((p) => p.id === productId);
  const cabinetType = cabinetTypes.find((ct) => ct.product_id === productId);
  const isCabinet = Boolean(cabinetType);
  const isSerial = Boolean(selectedProduct?.track_serials) && !isCabinet;

  async function createSupplier() {
    if (!newSupplierName.trim()) return;
    const { data, error: err } = await supabase
      .from("suppliers")
      .insert({ organization_id: orgId, name: newSupplierName.trim() })
      .select()
      .single();
    if (err) { setError(err.message); return; }
    setSuppliers((s) => [...s, data]);
    setSupplierId(data.id);
    setShowNewSupplier(false);
    setNewSupplierName("");
  }

  async function createProduct() {
    if (!newProductName.trim()) return;
    const { data, error: err } = await supabase
      .from("products")
      .insert({
        organization_id: orgId,
        name: newProductName.trim(),
        category: newProductCategory,
        track_serials: newProductTracksSerials,
        track_lots: true,
      })
      .select()
      .single();
    if (err) { setError(err.message); return; }
    setProducts((p) => [...p, data]);
    setProductId(data.id);
    setShowNewProduct(false);
    setNewProductName("");
  }

  function suggestLotCode() {
    if (!selectedProduct) return "";
    const initials = selectedProduct.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase();
    const year = new Date(receivedAt).getFullYear();
    return `${initials}-${year}-${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!productId || !warehouseId || !quantity || Number(quantity) <= 0) {
      setError("Completá producto, depósito y una cantidad mayor a cero.");
      return;
    }
    setBusy(true);
    const finalLotCode = lotCode.trim() || suggestLotCode();

    try {
      if (isCabinet) {
        const { data, error: rpcErr } = await supabase.rpc("create_cabinets_batch", {
          p_cabinet_type_id: cabinetType.id,
          p_quantity: Number(quantity),
          p_code_prefix: finalLotCode,
          p_lot_code: finalLotCode,
          p_purchase_cost: null,
          p_purchase_date: receivedAt,
          p_warehouse_id: warehouseId,
        });
        if (rpcErr) throw rpcErr;

        await supabase.rpc("record_stock_movement", {
          p_product_id: productId,
          p_lot_id: data?.[0]?.lot_id || null,
          p_movement_type: "inbound",
          p_quantity: Number(quantity),
          p_from_warehouse_id: null,
          p_from_location_id: null,
          p_from_state: null,
          p_to_warehouse_id: warehouseId,
          p_to_location_id: null,
          p_to_state: "available",
          p_reference_type: "purchase_order",
          p_reference_id: null,
          p_notes: `Ingreso gabinetes ${finalLotCode}`,
        });

        setResult({ lotCode: finalLotCode, codes: (data || []).map((r) => r.serial_code) });
      } else if (isSerial) {
        const { data: lot, error: lotErr } = await supabase
          .from("lots")
          .insert({
            organization_id: orgId,
            product_id: productId,
            code: finalLotCode,
            supplier_id: supplierId || null,
            received_at: receivedAt,
          })
          .select()
          .single();
        if (lotErr) throw lotErr;

        const n = Number(quantity);
        const rows = Array.from({ length: n }, (_, i) => ({
          organization_id: orgId,
          product_id: productId,
          lot_id: lot.id,
          serial_code: `${finalLotCode}-${String(i + 1).padStart(3, "0")}`,
          status: "available",
          current_warehouse_id: warehouseId,
          received_at: receivedAt,
        }));
        const { error: suErr } = await supabase.from("serial_units").insert(rows);
        if (suErr) throw suErr;

        if (unitsPerCase && Number(unitsPerCase) > 0) {
          await supabase.rpc("assign_serials_to_flight_cases", {
            p_lot_id: lot.id,
            p_units_per_case: Number(unitsPerCase),
            p_code_prefix: finalLotCode,
          });
        }

        await supabase.rpc("record_stock_movement", {
          p_product_id: productId,
          p_lot_id: lot.id,
          p_movement_type: "inbound",
          p_quantity: n,
          p_from_warehouse_id: null,
          p_from_location_id: null,
          p_from_state: null,
          p_to_warehouse_id: warehouseId,
          p_to_location_id: null,
          p_to_state: "available",
          p_reference_type: "purchase_order",
          p_reference_id: null,
          p_notes: `Ingreso ${finalLotCode}`,
        });

        setResult({ lotCode: finalLotCode, codes: rows.map((r) => r.serial_code) });
      } else {
        let lotId = null;
        if (selectedProduct?.track_lots) {
          const { data: lot, error: lotErr } = await supabase
            .from("lots")
            .insert({
              organization_id: orgId,
              product_id: productId,
              code: finalLotCode,
              supplier_id: supplierId || null,
              received_at: receivedAt,
            })
            .select()
            .single();
          if (lotErr) throw lotErr;
          lotId = lot.id;
        }

        await supabase.rpc("record_stock_movement", {
          p_product_id: productId,
          p_lot_id: lotId,
          p_movement_type: "inbound",
          p_quantity: Number(quantity),
          p_from_warehouse_id: null,
          p_from_location_id: null,
          p_from_state: null,
          p_to_warehouse_id: warehouseId,
          p_to_location_id: null,
          p_to_state: "available",
          p_reference_type: "purchase_order",
          p_reference_id: null,
          p_notes: `Ingreso ${finalLotCode}`,
        });

        setResult({ lotCode: finalLotCode, codes: [] });
      }

      setQuantity("");
      setLotCode("");
    } catch (err) {
      setError(err.message || "No se pudo registrar el ingreso.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="empty-state">Cargando…</div>;

  return (
    <div>
      <div className="card">
        <h3>Nuevo ingreso de mercadería</h3>
        {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}
        <form onSubmit={submit}>
          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Proveedor</label>
              {showNewSupplier ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <input value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder="Nombre del proveedor" />
                  <button type="button" className="btn btn-primary" onClick={createSupplier}>Crear</button>
                </div>
              ) : (
                <select value={supplierId} onChange={(e) => (e.target.value === "__new" ? setShowNewSupplier(true) : setSupplierId(e.target.value))}>
                  <option value="">Sin proveedor</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  <option value="__new">+ Nuevo proveedor</option>
                </select>
              )}
            </div>
            <div className="field">
              <label>Producto</label>
              {showNewProduct ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <input value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="Nombre del producto" />
                  <select value={newProductCategory} onChange={(e) => setNewProductCategory(e.target.value)}>
                    <option value="led_screen">Pantallas LED</option>
                    <option value="lighting">Iluminación</option>
                    <option value="audio">Audio</option>
                    <option value="communication">Comunicación</option>
                    <option value="rigging">Rigging</option>
                    <option value="spare_part">Repuesto de taller</option>
                    <option value="other">Otro</option>
                  </select>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <input type="checkbox" checked={newProductTracksSerials} onChange={(e) => setNewProductTracksSerials(e.target.checked)} />
                    Trackea número de serie individual
                  </label>
                  <button type="button" className="btn btn-primary" onClick={createProduct}>Crear producto</button>
                </div>
              ) : (
                <select value={productId} onChange={(e) => (e.target.value === "__new" ? setShowNewProduct(true) : setProductId(e.target.value))}>
                  <option value="">Elegir producto</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  <option value="__new">+ Nuevo producto</option>
                </select>
              )}
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Depósito destino</label>
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">Elegir depósito</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Cantidad recibida</label>
              <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Código de lote (opcional, se genera solo)</label>
              <input value={lotCode} onChange={(e) => setLotCode(e.target.value)} placeholder={selectedProduct ? suggestLotCode() : "P39-2026-X"} />
            </div>
            <div className="field">
              <label>Fecha de recepción</label>
              <input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
            </div>
          </div>

          {isSerial && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Unidades por flight case (opcional)</label>
              <input type="number" min="1" value={unitsPerCase} onChange={(e) => setUnitsPerCase(e.target.value)} placeholder="Ej: 10" />
            </div>
          )}

          {isCabinet && (
            <p className="note">Este producto usa gabinetes ({cabinetType.rows}x{cabinetType.cols}) — se va a crear cada gabinete con su código y su grilla de posiciones automáticamente.</p>
          )}
          {isSerial && <p className="note">Se va a generar un número de serie individual para cada una de las {quantity || "N"} unidades.</p>}
          <p className="note">El costo de esta compra no se carga acá — lo completa el dueño después, desde Reportes → Costos pendientes.</p>

          <button className="btn btn-primary" disabled={busy} style={{ marginTop: 12 }}>
            {busy ? "Registrando…" : "Confirmar ingreso"}
          </button>
        </form>
      </div>

      {result && (
        <div className="card" id="etiquetasCard">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Ingreso registrado — lote {result.lotCode}</h3>
            {result.codes.length > 0 && (
              <button type="button" className="btn btn-primary no-print" onClick={() => window.print()}>
                Imprimir {result.codes.length} etiquetas
              </button>
            )}
          </div>
          {result.codes.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {result.codes.map((code) => (
                <div key={code} style={{ border: "1px dashed var(--border-strong)", borderRadius: 8, padding: 10, textAlign: "center", background: "var(--surface-2)" }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(code)}`}
                    width="80"
                    height="80"
                    alt={`QR ${code}`}
                    style={{ display: "block", margin: "0 auto 6px" }}
                  />
                  <div className="tag-case" style={{ display: "inline-block" }}>{code}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="note">Este producto no trackea unidades individuales, así que no hay etiquetas para imprimir — el stock quedó sumado como cantidad.</p>
          )}
        </div>
      )}
    </div>
  );
}
