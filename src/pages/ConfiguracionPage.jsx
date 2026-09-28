import { useEffect, useState } from "react";
import { hasSupabase, supabase } from "../lib/supabase";

const roles = ["owner", "admin", "supervisor", "warehouse", "technician", "sales", "viewer"];
const roleLabel = { owner: "Dueño", admin: "Admin", supervisor: "Supervisor", warehouse: "Depósito", technician: "Técnico", sales: "Ventas", viewer: "Solo lectura" };
const featureLabel = {
  led_operations: "Pantallas LED",
  lighting_operations: "Iluminación",
  audio_operations: "Audio",
  advanced_logistics: "Logística avanzada",
  analytics_pro: "Reportes y analítica",
};

export default function ConfiguracionPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [org, setOrg] = useState(null);
  const [features, setFeatures] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [isOwner, setIsOwner] = useState(false);

  async function load() {
    setLoading(true);
    if (!hasSupabase) {
      setOrg({ id: "demo", name: "StageOPS Demo", currency_code: "ARS" });
      setFeatures({ led_operations: true, lighting_operations: false, audio_operations: false, advanced_logistics: true, analytics_pro: true });
      setProfiles([{ id: "u1", full_name: "Agustín", role: "owner" }]);
      setIsOwner(true);
      setLoading(false);
      return;
    }
    const { data: orgId } = await supabase.rpc("current_org_id");
    const [role, orgRes, featRes, profRes] = await Promise.all([
      supabase.rpc("current_user_role"),
      supabase.from("organizations").select("id, name, currency_code").eq("id", orgId).single(),
      supabase.from("organization_features").select("*").eq("organization_id", orgId).maybeSingle(),
      supabase.from("profiles").select("id, full_name, role").eq("organization_id", orgId),
    ]);
    setIsOwner(role.data === "owner");
    if (orgRes.error) setError(orgRes.error.message);
    setOrg(orgRes.data || null);
    setFeatures(featRes.data || {});
    setProfiles(profRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleFeature(key) {
    if (!hasSupabase) return;
    const next = { ...features, [key]: !features[key] };
    setFeatures(next);
    const { error: err } = await supabase.from("organization_features").update({ [key]: next[key] }).eq("organization_id", org.id);
    if (err) setError(err.message);
  }

  async function changeRole(profileId, newRole) {
    if (!hasSupabase) return;
    const { error: err } = await supabase.from("profiles").update({ role: newRole }).eq("id", profileId);
    if (err) { setError(err.message); return; }
    setProfiles((ps) => ps.map((p) => (p.id === profileId ? { ...p, role: newRole } : p)));
  }

  if (loading) return <div className="empty-state">Cargando…</div>;

  return (
    <div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}

      <div className="card">
        <h3>Datos de la empresa</h3>
        <div className="grid-2">
          <div className="field"><label>Nombre</label><input value={org?.name || ""} disabled /></div>
          <div className="field"><label>Moneda</label><input value={org?.currency_code || ""} disabled /></div>
        </div>
        <p className="note">Para cambiar estos datos, pedime que agregue el guardado — por ahora es solo de lectura.</p>
      </div>

      <div className="card">
        <h3>Módulos habilitados</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {Object.entries(featureLabel).map(([key, label]) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={Boolean(features?.[key])} onChange={() => toggleFeature(key)} disabled={!isOwner} />
              {label}
            </label>
          ))}
        </div>
        {!isOwner && <p className="note">Solo el dueño puede cambiar los módulos habilitados.</p>}
      </div>

      <div className="card">
        <h3>Usuarios y roles</h3>
        {profiles.length === 0 ? (
          <p className="note">No hay otros usuarios en esta organización todavía.</p>
        ) : (
          <table>
            <tbody>
              <tr><th>Usuario</th><th>Rol</th></tr>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td>{p.full_name || p.id}</td>
                  <td>
                    {isOwner ? (
                      <select value={p.role} onChange={(e) => changeRole(p.id, e.target.value)}>
                        {roles.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
                      </select>
                    ) : (
                      <span className="tag tag-neutral">{roleLabel[p.role] || p.role}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="note">Para invitar gente nueva, todavía hace falta que se registren desde /login con su email — la invitación por mail directa queda para más adelante.</p>
      </div>
    </div>
  );
}
