import { NavLink, useNavigate } from "react-router-dom";
import { hasSupabase, supabase } from "../lib/supabase";

const groups = [
  {
    title: "Resumen",
    items: [
      ["Dashboard", "/dashboard"],
      ["Calendario", "/calendario"],
    ],
  },
  {
    title: "Inventario",
    items: [
      ["Ingreso de mercadería", "/ingreso"],
      ["Inventario general", "/inventario"],
    ],
  },
  {
    title: "Eventos",
    items: [
      ["Reservas", "/reservas"],
      ["Preparación de pedido", "/preparacion"],
      ["Plan de carga", "/transporte"],
      ["Vehículos", "/vehiculos"],
      ["Retorno de evento", "/retorno"],
    ],
  },
  {
    title: "Taller",
    items: [["Reparación", "/taller"]],
  },
  {
    title: "Gestión",
    items: [
      ["Reportes", "/reportes"],
      ["Clientes", "/clientes"],
      ["Colaboradores", "/colaboradores"],
      ["Personal", "/personal"],
      ["Proveedores", "/proveedores"],
      ["Configuración", "/configuracion"],
    ],
  },
];

export default function Shell({ children, session, profile }) {
  const navigate = useNavigate();

  async function signOut() {
    if (hasSupabase) await supabase.auth.signOut();
    else navigate("/dashboard");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Stage<span>OPS</span></div>
        <div className="brand-subtitle">Gestión de pantallas LED</div>
        <nav>
          {groups.map((g) => (
            <div className="nav-group" key={g.title}>
              <div className="nav-group-title">{g.title}</div>
              {g.items.map(([label, path]) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                >
                  <span className="nav-dot" />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <h1 id="pageTitle">StageOPS</h1>
          <span className="spacer" />
          <span className="who">
            {profile?.full_name || session?.user?.email} · {profile?.role || "sin rol"}
          </span>
          <button className="btn" onClick={signOut}>
            {session?.demo ? "Demo" : "Salir"}
          </button>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
