import { useEffect, useState } from "react";
import { hasSupabase, supabase } from "../lib/supabase";

const TEMPLATES = [
  ["general", "General"],
  ["led", "Pantallas LED"],
  ["lighting", "Iluminación"],
  ["audio", "Audio"],
  ["rigging", "Rigging"],
  ["staging", "Escenografía"],
];
const EMPLOYMENT = [["fijo", "Fijo"], ["eventual", "Eventual"], ["freelance", "Freelance"]];

export default function PuestosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [orgId, setOrgId] = useState(null);
  const [teams, setTeams] = useState([]);
  const [certs, setCerts] = useState([]);
  const [roles, setRoles] = useState([]);
  const [roleLinks, setRoleLinks] = useState([]);
  const [people, setPeople] = useState([]);

  const [roleName, setRoleName] = useState("");
  const [teamChoice, setTeamChoice] = useState("");
  const [newTeam, setNewTeam] = useState("");
  const [certChoice, setCertChoice] = useState("");
  const [newCert, setNewCert] = useState("");
  const [generalist, setGeneralist] = useState(false);
  const [certNameInput, setCertNameInput] = useState("");

  const [personId, setPersonId] = useState("");
  const [pRoles, setPRoles] = useState([]);
  const [pCerts, setPCerts] = useState({});
  const [pGeneralist, setPGeneralist] = useState(false);
  const [pType, setPType] = useState("eventual");

  async function load(silent) {
    if (!silent) setLoading(true);
    if (!hasSupabase) {
      setLoading(false);
      return;
    }
    const [{ data: org }, t, c, r, l, p] = await Promise.all([
      supabase.rpc("current_org_id"),
      supabase.from("crew_teams").select("id, name").order("name"),
      supabase.from("certifications").select("id, name").order("name"),
      supabase.from("crew_roles").select("id, name, team_id, required_certification_id, generalist_can_cover, active").eq("active", true).order("name"),
      supabase.from("personnel_roles").select("personnel_id, role_id"),
      supabase.from("personnel").select("id, full_name, employment_type, is_generalist, active").eq("active", true).order("full_name"),
    ]);
    setOrgId(org);
    const firstError = [t, c, r, l, p].find((x) => x.error);
    if (firstError) setError(firstError.error.message);
    setTeams(t.data || []);
    setCerts(c.data || []);
    setRoles(r.data || []);
    setRoleLinks(l.data || []);
    setPeople(p.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load(false);
  }, []);

  async function applyTemplate(key) {
    setBusy(true);
    setError("");
    setInfo("");
    const { data, error: err } = await supabase.rpc("apply_crew_template", { p_template: key });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setInfo(data > 0 ? "Se agregaron " + data + " puesto(s) nuevos." : "Esa plantilla ya estaba aplicada: no se agregó nada nuevo.");
    load(true);
  }

  async function ensureTeam(name) {
    const { data, error: err } = await supabase.from("crew_teams").upsert({ organization_id: orgId, name: name.trim() }, { onConflict: "organization_id,name" }).select("id").single();
    if (err) throw err;
    return data.id;
  }

  async function ensureCert(name) {
    const { data, error: err } = await supabase.from("certifications").upsert({ organization_id: orgId, name: name.trim() }, { onConflict: "organization_id,name" }).select("id").single();
    if (err) throw err;
    return data.id;
  }

  async function createRole() {
    if (!roleName.trim()) {
      setError("Ingresá el nombre del puesto.");
      return;
    }
    setBusy(true);
    setError("");
    setInfo("");
    try {
      let teamId = teamChoice || null;
      if (teamChoice === "__new") teamId = newTeam.trim() ? await ensureTeam(newTeam) : null;
      let certId = certChoice || null;
      if (certChoice === "__new") certId = newCert.trim() ? await ensureCert(newCert) : null;
      const { error: err } = await supabase.from("crew_roles").insert({
        organization_id: orgId,
        name: roleName.trim(),
        team_id: teamId,
        required_certification_id: certId,
        generalist_can_cover: generalist,
      });
      if (err) throw err;
      setRoleName("");
      setTeamChoice("");
      setNewTeam("");
      setCertChoice("");
      setNewCert("");
      setGeneralist(false);
      setInfo("Puesto creado.");
      await load(true);
    } catch (err) {
      setError(err.code === "23505" ? "Ya existe un puesto con ese nombre." : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeRole(id) {
    if (!window.confirm("¿Quitar este puesto? Los eventos que ya lo usaron lo conservan en su historial.")) return;
    const { error: err } = await supabase.from("crew_roles").update({ active: false }).eq("id", id);
    if (err) {
      setError(err.message);
      return;
    }
    load(true);
  }

  async function addCert() {
    if (!certNameInput.trim()) return;
    setError("");
    const { error: err } = await supabase.from("certifications").insert({ organization_id: orgId, name: certNameInput.trim() });
    if (err) {
      setError(err.code === "23505" ? "Ya existe una habilitación con ese nombre." : err.message);
      return;
    }
    setCertNameInput("");
    load(true);
  }

  async function removeCert(id) {
    if (!window.confirm("¿Quitar esta habilitación? También se borra de las personas que la tienen cargada.")) return;
    const { error: err } = await supabase.from("certifications").delete().eq("id", id);
    if (err) {
      setError(err.message);
      return;
    }
    load(true);
  }

  async function pickPerson(id) {
    setPersonId(id);
    setInfo("");
    if (!id) return;
    const p = people.find((x) => x.id === id);
    setPGeneralist(Boolean(p && p.is_generalist));
    setPType(p ? p.employment_type : "eventual");
    setPRoles(roleLinks.filter((l) => l.personnel_id === id).map((l) => l.role_id));
    const { data, error: err } = await supabase.from("personnel_certifications").select("certification_id, expires_at").eq("personnel_id", id);
    if (err) {
      setError(err.message);
      return;
    }
    const map = {};
    (data || []).forEach((c) => {
      map[c.certification_id] = c.expires_at || "";
    });
    setPCerts(map);
  }

  function toggleRole(id) {
    setPRoles((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  }

  function toggleCert(id) {
    setPCerts((m) => {
      const n = { ...m };
      if (id in n) delete n[id];
      else n[id] = "";
      return n;
    });
  }

  function setCertDate(id, v) {
    setPCerts((m) => ({ ...m, [id]: v }));
  }

  async function savePerson() {
    if (!personId) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const up = await supabase.from("personnel").update({ is_generalist: pGeneralist, employment_type: pType }).eq("id", personId);
      if (up.error) throw up.error;
      const d1 = await supabase.from("personnel_roles").delete().eq("personnel_id", personId);
      if (d1.error) throw d1.error;
      if (pRoles.length) {
        const ins = await supabase.from("personnel_roles").insert(pRoles.map((rid) => ({ organization_id: orgId, personnel_id: personId, role_id: rid })));
        if (ins.error) throw ins.error;
      }
      const d2 = await supabase.from("personnel_certifications").delete().eq("personnel_id", personId);
      if (d2.error) throw d2.error;
      const certRows = Object.keys(pCerts).map((cid) => ({ organization_id: orgId, personnel_id: personId, certification_id: cid, expires_at: pCerts[cid] || null }));
      if (certRows.length) {
        const ins2 = await supabase.from("personnel_certifications").insert(certRows);
        if (ins2.error) throw ins2.error;
      }
      setInfo("Perfil guardado.");
      await load(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="empty-state">Cargando…</div>;
  if (!hasSupabase) return <div className="card"><p className="note">Esta pantalla necesita la conexión a la base de datos.</p></div>;

  const teamName = (id) => (teams.find((t) => t.id === id) || {}).name || "—";
  const certName = (id) => (certs.find((c) => c.id === id) || {}).name || "—";
  const countFor = (roleId) => roleLinks.filter((l) => l.role_id === roleId).length;

  return (
    <div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}
      {info && <p style={{ color: "var(--success)", fontSize: 12.5 }}>{info}</p>}

      <div className="card">
        <h3>Plantillas de arranque</h3>
        <p className="note">Cargan puestos de ejemplo del rubro. Después los editás o los quitás. Repetir una plantilla no duplica nada. Solo el dueño o un admin puede aplicarlas.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {TEMPLATES.map((t) => (
            <button key={t[0]} type="button" className="btn" disabled={busy} onClick={() => applyTemplate(t[0])}>{t[1]}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Puestos</h3>
        {roles.length === 0 ? (
          <p className="note">Todavía no hay puestos. Aplicá una plantilla o creá el primero abajo.</p>
        ) : (
          <table>
            <tbody>
              <tr><th>Puesto</th><th>Equipo</th><th>Habilitación requerida</th><th>Polivalente puede</th><th>Personas</th><th></th></tr>
              {roles.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.team_id ? teamName(r.team_id) : "—"}</td>
                  <td>{r.required_certification_id ? certName(r.required_certification_id) : "—"}</td>
                  <td>{r.generalist_can_cover ? "Sí" : "No"}</td>
                  <td>{countFor(r.id)}</td>
                  <td><button type="button" className="btn" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => removeRole(r.id)}>Quitar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Nuevo puesto</h3>
        <div className="grid-3" style={{ marginBottom: 12 }}>
          <div className="field"><label>Nombre</label><input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Operador de humo" /></div>
          <div className="field">
            <label>Equipo</label>
            <select value={teamChoice} onChange={(e) => setTeamChoice(e.target.value)}>
              <option value="">Sin equipo</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              <option value="__new">Crear equipo nuevo…</option>
            </select>
            {teamChoice === "__new" && <input style={{ marginTop: 6 }} value={newTeam} onChange={(e) => setNewTeam(e.target.value)} placeholder="Nombre del equipo" />}
          </div>
          <div className="field">
            <label>Habilitación requerida</label>
            <select value={certChoice} onChange={(e) => setCertChoice(e.target.value)}>
              <option value="">Ninguna</option>
              {certs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="__new">Crear habilitación nueva…</option>
            </select>
            {certChoice === "__new" && <input style={{ marginTop: 6 }} value={newCert} onChange={(e) => setNewCert(e.target.value)} placeholder="Nombre de la habilitación" />}
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12 }}>
          <input type="checkbox" checked={generalist} onChange={(e) => setGeneralist(e.target.checked)} />
          Lo puede cubrir una persona polivalente
        </label>
        <button className="btn btn-primary" disabled={busy} onClick={createRole}>{busy ? "Guardando…" : "Crear puesto"}</button>
      </div>

      <div className="card">
        <h3>Habilitaciones</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {certs.length === 0 && <span className="note">Todavía no hay habilitaciones.</span>}
          {certs.map((c) => (
            <span key={c.id} className="tag tag-neutral">
              {c.name}{" "}
              <button type="button" onClick={() => removeCert(c.id)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={certNameInput} onChange={(e) => setCertNameInput(e.target.value)} placeholder="Trabajo en altura, habilitación eléctrica…" style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={addCert}>Agregar</button>
        </div>
      </div>

      <div className="card">
        <h3>Perfil del personal</h3>
        <p className="note">Qué puestos puede cubrir cada persona y qué habilitaciones tiene, con su vencimiento. Con eso la planilla de cada evento te sugiere a quién asignar.</p>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Persona</label>
          <select value={personId} onChange={(e) => pickPerson(e.target.value)}>
            <option value="">Elegir persona</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
        {people.length === 0 && <p className="note">Todavía no cargaste personal. Empezá por la pantalla Personal.</p>}
        {personId && (
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            <div className="grid-2">
              <div className="field">
                <label>Tipo</label>
                <select value={pType} onChange={(e) => setPType(e.target.value)}>
                  {EMPLOYMENT.map((t) => <option key={t[0]} value={t[0]}>{t[1]}</option>)}
                </select>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={pGeneralist} onChange={(e) => setPGeneralist(e.target.checked)} />
                Polivalente: puede cubrir cualquier puesto que lo permita
              </label>
            </div>
            <div>
              <div className="note" style={{ marginBottom: 6 }}>Puestos que puede cubrir</div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {roles.map((r) => (
                  <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={pRoles.includes(r.id)} onChange={() => toggleRole(r.id)} />
                    {r.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="note" style={{ marginBottom: 6 }}>Habilitaciones y vencimiento</div>
              {certs.length === 0 ? (
                <p className="note">Todavía no hay habilitaciones cargadas.</p>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {certs.map((c) => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 200 }}>
                        <input type="checkbox" checked={c.id in pCerts} onChange={() => toggleCert(c.id)} />
                        {c.name}
                      </label>
                      {c.id in pCerts && <span className="note">vence</span>}
                      {c.id in pCerts && <input type="date" value={pCerts[c.id]} onChange={(e) => setCertDate(c.id, e.target.value)} style={{ maxWidth: 170 }} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div><button className="btn btn-primary" disabled={busy} onClick={savePerson}>{busy ? "Guardando…" : "Guardar perfil"}</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
