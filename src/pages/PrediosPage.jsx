import { useEffect, useState } from "react";
import { hasSupabase, supabase } from "../lib/supabase";

const SECTIONS = [
  {
    title: "Lugar y contactos",
    fields: [
      ["address", "Dirección", "text"],
      ["venue_type", "Tipo de lugar", "text"],
      ["contact_name", "Contacto del predio", "text"],
      ["contact_phone", "Teléfono del contacto", "text"],
      ["surveyed_at", "Fecha de la visita técnica", "date"],
      ["surveyed_by", "Quién relevó", "text"],
    ],
  },
  {
    title: "Accesos y carga",
    fields: [
      ["truck_entrance", "Ingreso de camiones", "text"],
      ["loading_hours", "Horario de carga", "text"],
      ["max_access_height_m", "Altura máxima de acceso (m)", "number"],
      ["truck_to_stage_distance_m", "Distancia del camión al escenario (m)", "number"],
      ["security_notice", "Aviso a seguridad", "text"],
    ],
  },
  {
    title: "Energía",
    fields: [
      ["power_available", "Potencia disponible", "text"],
      ["power_connection", "Tipo de conexión", "text"],
      ["generator_required", "Requiere generador", "bool"],
      ["panel_location", "Ubicación del tablero", "text"],
    ],
  },
  {
    title: "Espacio y rigging",
    fields: [
      ["stage_size", "Escenario (medidas)", "text"],
      ["ceiling_height_m", "Altura libre (m)", "number"],
      ["rigging_points", "Puntos de colgado", "number"],
      ["rigging_point_capacity_kg", "Capacidad por punto (kg)", "number"],
      ["roof_load_certificate_received", "Certificado de carga del techo recibido", "bool"],
      ["floor_type", "Tipo de piso", "text"],
    ],
  },
  {
    title: "Servicios y restricciones",
    fields: [
      ["internet_notes", "Internet", "text"],
      ["has_dressing_rooms", "Hay camarines y baños", "bool"],
      ["case_storage_notes", "Guardado de cases", "text"],
      ["restrictions", "Restricciones", "text"],
      ["required_documents", "Documentación requerida", "text"],
      ["notes", "Notas", "textarea"],
    ],
  },
];

function toForm(v) {
  const f = {};
  SECTIONS.forEach((s) => {
    s.fields.forEach((fd) => {
      const val = v ? v[fd[0]] : null;
      f[fd[0]] = fd[2] === "bool" ? Boolean(val) : val == null ? "" : String(val);
    });
  });
  return f;
}

function fromForm(f) {
  const out = {};
  SECTIONS.forEach((s) => {
    s.fields.forEach((fd) => {
      const k = fd[0];
      const val = f[k];
      if (fd[2] === "bool") out[k] = Boolean(val);
      else if (fd[2] === "number") out[k] = val === "" ? null : Number(val);
      else out[k] = val === "" ? null : val;
    });
  });
  return out;
}

export default function PrediosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [orgId, setOrgId] = useState(null);
  const [list, setList] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(toForm(null));
  const [newName, setNewName] = useState("");

  async function loadList() {
    if (!hasSupabase) {
      setLoading(false);
      return;
    }
    const [{ data: org }, res] = await Promise.all([
      supabase.rpc("current_org_id"),
      supabase.from("venue_status").select("venue_id, name, missing_critical, events_count").order("name"),
    ]);
    setOrgId(org);
    if (res.error) setError(res.error.message);
    setList(res.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadList();
  }, []);

  async function pick(id) {
    setSelectedId(id);
    setInfo("");
    setError("");
    if (!id) return;
    const { data, error: err } = await supabase.from("venues").select("*").eq("id", id).single();
    if (err) {
      setError(err.message);
      return;
    }
    setForm(toForm(data));
  }

  async function createVenue() {
    if (!newName.trim()) {
      setError("Ingresá el nombre del predio.");
      return;
    }
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.from("venues").insert({ organization_id: orgId, name: newName.trim() }).select("id").single();
    setBusy(false);
    if (err) {
      setError(err.code === "23505" ? "Ya existe un predio con ese nombre." : err.message);
      return;
    }
    setNewName("");
    await loadList();
    pick(data.id);
  }

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!selectedId) return;
    setBusy(true);
    setError("");
    setInfo("");
    const { error: err } = await supabase.from("venues").update(fromForm(form)).eq("id", selectedId);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setInfo("Ficha guardada.");
    loadList();
  }

  if (loading) return <div className="empty-state">Cargando…</div>;
  if (!hasSupabase) return <div className="card"><p className="note">Esta pantalla necesita la conexión a la base de datos.</p></div>;

  const meta = list.find((v) => v.venue_id === selectedId) || null;
  const missing = meta && meta.missing_critical ? meta.missing_critical : [];

  return (
    <div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}
      {info && <p style={{ color: "var(--success)", fontSize: 12.5 }}>{info}</p>}

      <div className="card">
        <h3>Predios</h3>
        <p className="note">Cada predio se carga una sola vez y se reutiliza en todos los eventos que hagas ahí.</p>
        {list.length === 0 ? (
          <p className="note">Todavía no hay predios cargados.</p>
        ) : (
          <table>
            <tbody>
              <tr><th>Predio</th><th>Eventos</th><th>Estado de la ficha</th><th></th></tr>
              {list.map((v) => (
                <tr key={v.venue_id}>
                  <td>{v.name}</td>
                  <td>{v.events_count}</td>
                  <td>
                    {v.missing_critical && v.missing_critical.length > 0
                      ? <span className="tag tag-warning">Faltan {v.missing_critical.length} dato(s) clave</span>
                      : <span className="tag tag-success">Completa</span>}
                  </td>
                  <td><button type="button" className="btn" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => pick(v.venue_id)}>{selectedId === v.venue_id ? "Abierta" : "Abrir ficha"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre del predio nuevo" style={{ flex: 1 }} />
          <button className="btn btn-primary" disabled={busy} onClick={createVenue}>Crear predio</button>
        </div>
      </div>

      {selectedId && (
        <>
          {missing.length > 0 && (
            <div className="card">
              <h3>Datos clave que faltan</h3>
              <ul style={{ margin: "6px 0 0 18px", fontSize: 13 }}>
                {missing.map((m) => <li key={m}>{m}</li>)}
              </ul>
              <p className="note">Son datos de seguridad y logística. No conviene darlos por sabidos: pedilos al predio antes del montaje.</p>
            </div>
          )}

          {SECTIONS.map((s) => (
            <div className="card" key={s.title}>
              <h3>{s.title}</h3>
              <div className="grid-2">
                {s.fields.map((fd) =>
                  fd[2] === "bool" ? (
                    <label key={fd[0]} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <input type="checkbox" checked={Boolean(form[fd[0]])} onChange={(e) => setField(fd[0], e.target.checked)} />
                      {fd[1]}
                    </label>
                  ) : (
                    <div className="field" key={fd[0]}>
                      <label>{fd[1]}</label>
                      {fd[2] === "textarea" ? (
                        <textarea rows="3" value={form[fd[0]]} onChange={(e) => setField(fd[0], e.target.value)} />
                      ) : (
                        <input
                          type={fd[2] === "number" ? "number" : fd[2] === "date" ? "date" : "text"}
                          step={fd[2] === "number" ? "any" : undefined}
                          value={form[fd[0]]}
                          onChange={(e) => setField(fd[0], e.target.value)}
                        />
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          ))}

          <div className="card">
            <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Guardando…" : "Guardar ficha"}</button>
            <p className="note">Las fotos y el plano en PDF se suman en un próximo paso. Todavía no se cruza la altura de acceso con la del camión: para eso falta cargar el alto de cada vehículo.</p>
          </div>
        </>
      )}
    </div>
  );
}
