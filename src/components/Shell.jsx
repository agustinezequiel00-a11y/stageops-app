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
      ["Ingreso de mercaderÃ­a", "/ingreso"],
      ["Inventario general", "/inventario"],
      ["Depósitos y ubicaciones", "/depositos"],
    ],
  },
  {
    title: "Eventos",
    items: [
      ["Reservas", "/reservas"],
      ["PreparaciÃ³n de pedido", "/preparacion"],
      ["Plan de carga", "/transporte"],
      ["VehÃ­culos", "/vehiculos"],
      ["Retorno de evento", "/retorno"],
    ],
  },
  {
    title: "Taller",
    items: [["ReparaciÃ³n", "/taller"]],
  },
  {
    title: "GestiÃ³n",
    items: [
      ["Reportes", "/reportes"],
      ["Clientes", "/clientes"],
      ["Colaboradores", "/colaboradores"],
      ["Personal", "/personal"],
      ["Proveedores", "/proveedores"],
      ["ConfiguraciÃ³n", "/configuracion"],
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
        <div className="brand-subtitle">GestiÃ³n de pantallas LED</div>
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
            {profile?.full_name || session?.user?.email} Â· {profile?.role || "sin rol"}
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
