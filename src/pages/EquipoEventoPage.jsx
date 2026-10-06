import { useEffect, useState } from "react";
import { hasSupabase, supabase } from "../lib/supabase";

const STATUS_LABEL = { invited: "pendiente", confirmed: "confirmado", declined: "rechazó" };
const STATUS_TAG = { invited: "tag-warning", confirmed: "tag-success", declined: "tag-danger" };

function ymd(v) {
  return v ? String(v).slice(0, 10) : "";
}

function fmtD(v) {
  const p = ymd(v).split("-");
  return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : "";
}

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const SHEET_CSS = "body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0}.sheet{page-break-after:always;padding:28px;max-width:720px;margin:0 auto}.sheet:last-child{page-break-after:auto}h1{font-size:22px;margin:0 0 2px}h2{font-size:13px;margin:18px 0 6px;color:#555;font-weight:normal;text-transform:uppercase;letter-spacing:.04em}.row{display:flex;justify-content:space-between;gap:16px}.box{border:1px solid #bbb;border-radius:6px;padding:10px 14px}.muted{color:#666;font-size:12px}.big{font-size:20px;font-weight:bold}table{width:100%;border-collapse:collapse;font-size:13px}td{padding:4px 0;border-top:1px solid #ddd}.chk{display:inline-block;width:12px;height:12px;border:1px solid #333;margin-right:8px;vertical-align:-2px}";

export default function EquipoEventoPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [orgId, setOrgId] = useState(null);
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [roles, setRoles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [people, setPeople] = useState([]);
  const [links, setLinks] = useState([]);

  const [eventId, setEventId] = useState("");
  const [reqs, setReqs] = useState([]);
  const [assigns, setAssigns] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [certAlerts, setCertAlerts] = useState([]);
  const [others, setOthers] = useState([]);

  const [reqRoleId, setReqRoleId] = useState("");
  const [reqQty, setReqQty] = useState("1");
  const [addRoleId, setAddRoleId] = useState("");
  const [addPersonId, setAddPersonId] = useState("");

  async function loadBase() {
    if (!hasSupabase) {
      setLoading(false);
      return;
    }
    const [{ data: org }, ev, ve, ro, te, pe, pl] = await Promise.all([
      supabase.rpc("current_org_id"),
      supabase.from("events").select("id, name, event_at, setup_at, teardown_at, status, venue_id").order("event_at", { ascending: false }),
      supabase.from("venues").select("id, name, address, contact_name, contact_phone, truck_entrance, loading_hours").eq("active", true).order("name"),
      supabase.from("crew_roles").select("id, name, team_id, required_certification_id, generalist_can_cover").eq("active", true).order("name"),
      supabase.from("crew_teams").select("id, name"),
      supabase.from("personnel").select("id, full_name, phone, employment_type, is_generalist").eq("active", true).order("full_name"),
      supabase.from("personnel_roles").select("personnel_id, role_id"),
    ]);
    setOrgId(org);
    const firstError = [ev, ve, ro, te, pe, pl].find((x) => x.error);
    if (firstError) setError(firstError.error.message);
    setEvents(ev.data || []);
    setVenues(ve.data || []);
    setRoles(ro.data || []);
    setTeams(te.data || []);
    setPeople(pe.data || []);
    setLinks(pl.data || []);
    setLoading(false);
    const pre = new URLSearchParams(window.location.search).get("evento");
    if (pre && (ev.data || []).some((x) => x.id === pre)) setEventId(pre);
  }

  useEffect(() => {
    loadBase();
  }, []);

  const ev = events.find((x) => x.id === eventId) || null;
  const win = ev
    ? { start: ymd(ev.setup_at) || ymd(ev.event_at), end: ymd(ev.teardown_at) || ymd(ev.event_at) }
    : { start: "", end: "" };

  async function loadEvent() {
    if (!ev) return;
    const s = win.start;
    const f = win.end;
    const [rq, as, cf, ca, ot] = await Promise.all([
      supabase.from("event_crew_requirements").select("id, role_id, quantity").eq("event_id", eventId),
      supabase.from("event_crew_assignments").select("id, personnel_id, role_id, start_date, end_date, status, call_time").eq("event_id", eventId).order("created_at"),
      supabase.from("event_crew_conflicts").select("assignment_id, other_event_name").eq("event_id", eventId),
      supabase.from("event_crew_cert_alerts").select("assignment_id, certification_name, expires_at, problem").eq("event_id", eventId),
      s && f
        ? supabase.from("event_crew_assignments").select("personnel_id, event_id, start_date, end_date").neq("event_id", eventId).neq("status", "declined").lte("start_date", f).gte("end_date", s)
        : Promise.resolve({ data: [] }),
    ]);
    const firstError = [rq, as, cf, ca, ot].find((x) => x.error);
    if (firstError) setError(firstError.error.message);
    setReqs(rq.data || []);
    setAssigns(as.data || []);
    setConflicts(cf.data || []);
    setCertAlerts(ca.data || []);
    setOthers(ot.data || []);
  }

  useEffect(() => {
    if (eventId && events.length) loadEvent();
  }, [eventId, events]);

  const roleById = {};
  roles.forEach((r) => { roleById[r.id] = r; });
  const teamById = {};
  teams.forEach((t) => { teamById[t.id] = t; });
  const personById = {};
  people.forEach((p) => { personById[p.id] = p; });
  const venueById = {};
  venues.forEach((v) => { venueById[v.id] = v; });

  const activeAssigns = assigns.filter((a) => a.status !== "declined");
  const assignedPeople = {};
  activeAssigns.forEach((a) => { assignedPeople[a.personnel_id] = true; });
  const busyIds = {};
  others.forEach((o) => { busyIds[o.personnel_id] = true; });

  function canDo(p, r) {
    return links.some((l) => l.personnel_id === p.id && l.role_id === r.id) || Boolean(p.is_generalist && r.generalist_can_cover);
  }

  const suggestions = reqs
    .map((rq) => {
      const role = roleById[rq.role_id];
      const have = activeAssigns.filter((a) => a.role_id === rq.role_id).length;
      const missing = rq.quantity - have;
      if (!role || missing <= 0) return null;
      const cands = people.filter((p) => canDo(p, role) && !assignedPeople[p.id] && !busyIds[p.id]).slice(0, Math.max(missing, 3));
      return { rq, role, missing, cands };
    })
    .filter(Boolean);

  const totalMissing = suggestions.reduce((sum, s) => sum + s.missing, 0);

  async function saveVenue(venueId) {
    setError("");
    const { error: err } = await supabase.from("events").update({ venue_id: venueId || null }).eq("id", eventId);
    if (err) {
      setError(err.message);
      return;
    }
    setEvents((es) => es.map((x) => (x.id === eventId ? { ...x, venue_id: venueId || null } : x)));
  }

  async function addRequirement() {
    if (!reqRoleId || !reqQty || Number(reqQty) <= 0) {
      setError("Elegí el puesto y una cantidad mayor a cero.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: err } = await supabase
      .from("event_crew_requirements")
      .upsert({ organization_id: orgId, event_id: eventId, role_id: reqRoleId, quantity: Number(reqQty) }, { onConflict: "event_id,role_id" });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setReqRoleId("");
    setReqQty("1");
    loadEvent();
  }

  async function removeRequirement(id) {
    const { error: err } = await supabase.from("event_crew_requirements").delete().eq("id", id);
    if (err) {
      setError(err.message);
      return;
    }
    loadEvent();
  }

  async function assign(personId, roleId) {
    if (!win.start || !win.end) {
      setError("Este evento no tiene fechas cargadas. Cargalas en Reservas.");
      return;
    }
    setBusy(true);
    setError("");
    setInfo("");
    const { error: err } = await supabase.from("event_crew_assignments").insert({
      organization_id: orgId,
      event_id: eventId,
      personnel_id: personId,
      role_id: roleId,
      start_date: win.start,
      end_date: win.end,
      status: "invited",
    });
    setBusy(false);
    if (err) {
      setError(err.code === "23505" ? "Esa persona ya está asignada a ese puesto en este evento." : err.message);
      return;
    }
    setAddPersonId("");
    loadEvent();
  }

  async function setStatus(a, status) {
    const { error: err } = await supabase.from("event_crew_assignments").update({ status }).eq("id", a.id);
    if (err) {
      setError(err.message);
      return;
    }
    loadEvent();
  }

  async function setCallTime(a, value) {
    const { error: err } = await supabase.from("event_crew_assignments").update({ call_time: value || null }).eq("id", a.id);
    if (err) {
      setError(err.message);
      return;
    }
    setAssigns((list) => list.map((x) => (x.id === a.id ? { ...x, call_time: value || null } : x)));
  }

  async function removeAssignment(a) {
    const { error: err } = await supabase.from("event_crew_assignments").delete().eq("id", a.id);
    if (err) {
      setError(err.message);
      return;
    }
    loadEvent();
  }

  function sheetHtml(a) {
    const p = personById[a.personnel_id] || {};
    const r = roleById[a.role_id] || {};
    const team = r.team_id ? teamById[r.team_id] : null;
    const v = ev && ev.venue_id ? venueById[ev.venue_id] : null;
    const crew = activeAssigns
      .map((x) => {
        const pp = personById[x.personnel_id] || {};
        const rr = roleById[x.role_id] || {};
        return "<tr><td>" + esc(pp.full_name) + "</td><td>" + esc(rr.name) + "</td><td>" + esc(pp.phone || "") + "</td></tr>";
      })
      .join("");
    const url = window.location.origin + "/equipo?evento=" + ev.id;
    const qr = "https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=" + encodeURIComponent(url);
    const callText = a.call_time ? String(a.call_time).slice(0, 5) + " hs" : "A confirmar";
    return (
      '<div class="sheet">' +
      '<div class="row"><div><div class="muted">Hoja de llamado</div><h1>' + esc(ev.name) + "</h1>" +
      '<div class="muted">Período: ' + fmtD(win.start) + " al " + fmtD(win.end) + "</div></div>" +
      '<div class="box" style="text-align:right"><div class="muted">Llamado</div><div class="big">' + esc(callText) + '</div><div class="muted">' + fmtD(a.start_date) + "</div></div></div>" +
      "<h2>Persona</h2><div class=\"big\">" + esc(p.full_name) + "</div><div>" + esc(r.name) + (team ? " · Equipo " + esc(team.name) : "") + "</div>" +
      '<div class="muted">Días asignados: ' + fmtD(a.start_date) + " al " + fmtD(a.end_date) + "</div>" +
      (v
        ? '<h2>Lugar</h2><div class="box"><b>' + esc(v.name) + "</b><br>" + esc(v.address || "") +
          (v.truck_entrance ? "<br>Ingreso de camiones: " + esc(v.truck_entrance) : "") +
          (v.loading_hours ? "<br>Horario de carga: " + esc(v.loading_hours) : "") +
          (v.contact_name || v.contact_phone ? "<br>Contacto: " + esc(v.contact_name || "") + " " + esc(v.contact_phone || "") : "") + "</div>"
        : "") +
      "<h2>Equipo del evento</h2><table>" + crew + "</table>" +
      '<h2>Para tildar en obra</h2><div style="line-height:2"><span class="chk"></span>Llegué al predio &nbsp; <span class="chk"></span>Reunión con el jefe &nbsp; <span class="chk"></span>Tarea terminada</div>' +
      '<h2>Notas</h2><div style="height:70px;border:1px solid #ddd;border-radius:6px"></div>' +
      '<div class="row" style="margin-top:20px;align-items:center"><div style="display:flex;gap:10px;align-items:center"><img src="' + qr + '" width="90" height="90" alt="QR"><div class="muted" style="max-width:260px">Escaneá para ver la versión más reciente. Si cambió algo, vale lo que diga la app.</div></div>' +
      '<div class="muted" style="text-align:right">Impreso: ' + new Date().toLocaleString("es-AR") + "<br>Sin costos en esta hoja</div></div>" +
      "</div>"
    );
  }

  function openSheets(list) {
    if (!list.length) {
      setError("No hay personas asignadas para imprimir.");
      return;
    }
    const w = window.open("", "_blank");
    if (!w) {
      setError("El navegador bloqueó la ventana de impresión. Permití las ventanas emergentes para este sitio y probá de nuevo.");
      return;
    }
    w.document.write(
      '<!doctype html><html><head><meta charset="utf-8"><title>Hojas de llamado</title><style>' + SHEET_CSS + "</style></head><body>" +
      list.map(sheetHtml).join("") + "</body></html>"
    );
    w.document.close();
    w.focus();
    setTimeout(function () { w.print(); }, 1200);
  }

  function shareWhatsApp(a) {
    const p = personById[a.personnel_id] || {};
    const r = roleById[a.role_id] || {};
    const v = ev && ev.venue_id ? venueById[ev.venue_id] : null;
    const msg =
      (p.full_name || "") + ", tu llamado para " + ev.name + ": " + (r.name || "") + ", del " + fmtD(a.start_date) + " al " + fmtD(a.end_date) +
      (a.call_time ? ", a las " + String(a.call_time).slice(0, 5) + " hs" : "") +
      (v ? ". Lugar: " + v.name + (v.address ? ", " + v.address : "") : "") +
      ". Confirmame por este medio.";
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
  }

  if (loading) return <div className="empty-state">Cargando…</div>;
  if (!hasSupabase) return <div className="card"><p className="note">Esta pantalla necesita la conexión a la base de datos.</p></div>;

  const addCandidates = addRoleId && roleById[addRoleId]
    ? people.filter((p) => canDo(p, roleById[addRoleId]) && !assignedPeople[p.id])
    : [];
  const addOthers = addRoleId && roleById[addRoleId]
    ? people.filter((p) => !canDo(p, roleById[addRoleId]) && !assignedPeople[p.id])
    : [];

  return (
    <div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}
      {info && <p style={{ color: "var(--success)", fontSize: 12.5 }}>{info}</p>}

      <div className="card">
        <h3>Equipo del evento</h3>
        <div className="grid-2">
          <div className="field">
            <label>Evento</label>
            <select value={eventId} onChange={(e) => { setEventId(e.target.value); setInfo(""); setError(""); }}>
              <option value="">Elegir evento</option>
              {events.map((e) => <option key={e.id} value={e.id}>{e.name} · {fmtD(e.event_at)}</option>)}
            </select>
          </div>
          {ev && (
            <div className="field">
              <label>Predio</label>
              <select value={ev.venue_id || ""} onChange={(e) => saveVenue(e.target.value)}>
                <option value="">Sin predio asignado</option>
                {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          )}
        </div>
        {ev && <p className="note">Período: {fmtD(win.start)} al {fmtD(win.end)}. Si falta el montaje o el desmontaje, cargalos al crear el evento en Reservas.</p>}
        {roles.length === 0 && <p className="note">Todavía no hay puestos. Creá los tuyos en Puestos y equipos.</p>}
      </div>

      {ev && roles.length > 0 && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Puestos que necesita</h3>
            {reqs.length > 0 && (
              <span className={"tag " + (totalMissing > 0 ? "tag-warning" : "tag-success")}>
                {totalMissing > 0 ? "Faltan " + totalMissing + " persona(s)" : "Equipo completo"}
              </span>
            )}
          </div>
          {reqs.length === 0 ? (
            <p className="note">Todavía no definiste qué puestos necesita este evento. Agregalos abajo.</p>
          ) : (
            <div className="grid-4" style={{ marginBottom: 12 }}>
              {reqs.map((rq) => {
                const role = roleById[rq.role_id] || {};
                const have = activeAssigns.filter((a) => a.role_id === rq.role_id).length;
                const conf = activeAssigns.filter((a) => a.role_id === rq.role_id && a.status === "confirmed").length;
                const full = have >= rq.quantity;
                return (
                  <div key={rq.id} className="kpi">
                    <div className="label">{role.name}{role.team_id && teamById[role.team_id] ? " · " + teamById[role.team_id].name : ""}</div>
                    <div className="value">{have}/{rq.quantity}</div>
                    <div style={{ background: "var(--surface-2)", borderRadius: 99, height: 4, overflow: "hidden", marginTop: 6 }}>
                      <div style={{ background: full ? "var(--success)" : "var(--warning)", height: "100%", width: Math.min(100, (have / rq.quantity) * 100) + "%" }} />
                    </div>
                    <div className="note">{conf} confirmado(s)</div>
                    <button type="button" className="btn" style={{ padding: "2px 8px", fontSize: 11, marginTop: 6 }} onClick={() => removeRequirement(rq.id)}>Quitar</button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="grid-3" style={{ alignItems: "flex-end" }}>
            <div className="field">
              <label>Puesto</label>
              <select value={reqRoleId} onChange={(e) => setReqRoleId(e.target.value)}>
                <option value="">Elegir puesto</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Cantidad</label><input type="number" min="1" value={reqQty} onChange={(e) => setReqQty(e.target.value)} /></div>
            <button className="btn btn-primary" disabled={busy} onClick={addRequirement}>Agregar puesto</button>
          </div>
        </div>
      )}

      {ev && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Personal asignado</h3>
            {activeAssigns.length > 0 && (
              <button type="button" className="btn" onClick={() => openSheets(activeAssigns)}>Imprimir las {activeAssigns.length} hojas de llamado</button>
            )}
          </div>
          {assigns.length === 0 ? (
            <p className="note">Todavía no asignaste a nadie a este evento.</p>
          ) : (
            <table>
              <tbody>
                <tr><th>Persona</th><th>Puesto</th><th>Tipo</th><th>Días</th><th>Llamado</th><th>Estado</th><th>Avisos</th><th></th></tr>
                {assigns.map((a) => {
                  const p = personById[a.personnel_id] || {};
                  const r = roleById[a.role_id] || {};
                  const team = r.team_id ? teamById[r.team_id] : null;
                  const myConflicts = conflicts.filter((c) => c.assignment_id === a.id);
                  const myCerts = certAlerts.filter((c) => c.assignment_id === a.id);
                  return (
                    <tr key={a.id}>
                      <td>{p.full_name || "—"}</td>
                      <td>{r.name || "—"}{team ? <span className="note"> · {team.name}</span> : null}</td>
                      <td>{p.employment_type || "—"}</td>
                      <td>{fmtD(a.start_date)} al {fmtD(a.end_date)}</td>
                      <td><input type="time" value={a.call_time ? String(a.call_time).slice(0, 5) : ""} onChange={(e) => setCallTime(a, e.target.value)} style={{ maxWidth: 110 }} /></td>
                      <td>
                        <select value={a.status} onChange={(e) => setStatus(a, e.target.value)}>
                          {Object.keys(STATUS_LABEL).map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
                        </select>
                      </td>
                      <td>
                        {a.status !== "declined" && myConflicts.map((c, i) => <div key={"c" + i}><span className="tag tag-danger">Se cruza con {c.other_event_name}</span></div>)}
                        {a.status !== "declined" && myCerts.map((c, i) => (
                          <div key={"h" + i}>
                            <span className="tag tag-warning">
                              {c.problem === "missing" ? "Falta " + c.certification_name : c.certification_name + " vence " + fmtD(c.expires_at)}
                            </span>
                          </div>
                        ))}
                        {a.status === "declined" && <span className={"tag " + STATUS_TAG.declined}>Hay que reemplazar</span>}
                      </td>
                      <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button type="button" className="btn" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => shareWhatsApp(a)}>WhatsApp</button>
                        <button type="button" className="btn" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => openSheets([a])}>Imprimir</button>
                        <button type="button" className="btn" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => removeAssignment(a)}>Quitar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="note">La hoja de llamado solo muestra lo del puesto de cada persona y nunca incluye costos. Al enviarla por WhatsApp se abre el mensaje ya escrito y vos elegís el contacto.</p>
        </div>
      )}

      {ev && suggestions.length > 0 && (
        <div className="card">
          <h3>Sugerencias para completar el equipo</h3>
          {suggestions.map((s) => (
            <div key={s.rq.id} style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13, marginBottom: 6 }}>
                Faltan {s.missing} en <b>{s.role.name}</b>. {s.cands.length === 0 ? "No hay nadie libre que pueda cubrirlo en esas fechas." : "Disponibles esos días:"}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {s.cands.map((p) => (
                  <button key={p.id} type="button" className="btn" disabled={busy} onClick={() => assign(p.id, s.role.id)}>
                    Asignar a {p.full_name}{p.is_generalist && !links.some((l) => l.personnel_id === p.id && l.role_id === s.role.id) ? " (polivalente)" : ""}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {ev && roles.length > 0 && (
        <div className="card">
          <h3>Agregar persona a mano</h3>
          <div className="grid-3" style={{ alignItems: "flex-end" }}>
            <div className="field">
              <label>Puesto</label>
              <select value={addRoleId} onChange={(e) => { setAddRoleId(e.target.value); setAddPersonId(""); }}>
                <option value="">Elegir puesto</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Persona</label>
              <select value={addPersonId} onChange={(e) => setAddPersonId(e.target.value)} disabled={!addRoleId}>
                <option value="">Elegir persona</option>
                {addCandidates.length > 0 && <optgroup label="Pueden cubrir este puesto">
                  {addCandidates.map((p) => <option key={p.id} value={p.id}>{p.full_name}{busyIds[p.id] ? " (ocupado en otro evento)" : ""}</option>)}
                </optgroup>}
                {addOthers.length > 0 && <optgroup label="Otras personas">
                  {addOthers.map((p) => <option key={p.id} value={p.id}>{p.full_name}{busyIds[p.id] ? " (ocupado en otro evento)" : ""}</option>)}
                </optgroup>}
              </select>
            </div>
            <button className="btn btn-primary" disabled={busy || !addRoleId || !addPersonId} onClick={() => assign(addPersonId, addRoleId)}>Asignar</button>
          </div>
        </div>
      )}
    </div>
  );
}
