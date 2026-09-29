import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { hasSupabase, supabase } from "./lib/supabase";
import { useProfile } from "./lib/useProfile";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import Shell from "./components/Shell";
import DashboardPage from "./pages/DashboardPage";
import IngresoPage from "./pages/IngresoPage";
import InventarioPage from "./pages/InventarioPage";
import DepositosPage from "./pages/DepositosPage";
import ReservasPage from "./pages/ReservasPage";
import PreparacionPage from "./pages/PreparacionPage";
import RetornoPage from "./pages/RetornoPage";
import VehiculosPage from "./pages/VehiculosPage";
import ReportesPage from "./pages/ReportesPage";
import ClientesPage from "./pages/ClientesPage";
import ColaboradoresPage from "./pages/ColaboradoresPage";
import PersonalPage from "./pages/PersonalPage";
import ProveedoresPage from "./pages/ProveedoresPage";
import ConfiguracionPage from "./pages/ConfiguracionPage";
import CalendarioPage from "./pages/CalendarioPage";
import ComingSoonPage from "./pages/ComingSoonPage";

const comingSoon = {
  "/transporte": ["Plan de carga", "Peso real y asignaciÃÂÃÂ³n de vehÃÂÃÂ­culos."],
  "/taller": ["ReparaciÃÂÃÂ³n", "Ticket de taller, incluye selecciÃÂÃÂ³n de gabinete y repuestos."],
  "/configuracion": ["ConfiguraciÃÂÃÂ³n", "Empresa, mÃÂÃÂ³dulos habilitados y usuarios."],
};

function ProtectedApp({ session, profile }) {
  return (
    <Shell session={session} profile={profile}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/ingreso" element={<IngresoPage />} />
        <Route path="/inventario" element={<InventarioPage />} />
        <Route path="/depositos" element={<DepositosPage />} />
        <Route path="/reservas" element={<ReservasPage />} />
        <Route path="/preparacion" element={<PreparacionPage />} />
        <Route path="/retorno" element={<RetornoPage />} />
        <Route path="/vehiculos" element={<VehiculosPage />} />
        <Route path="/reportes" element={<ReportesPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/colaboradores" element={<ColaboradoresPage />} />
        <Route path="/personal" element={<PersonalPage />} />
        <Route path="/proveedores" element={<ProveedoresPage />} />
        <Route path="/configuracion" element={<ConfiguracionPage />} />
        <Route path="/calendario" element={<CalendarioPage />} />
        {Object.entries(comingSoon).map(([path, [title, description]]) => (
          <Route key={path} path={path} element={<ComingSoonPage title={title} description={description} />} />
        ))}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Shell>
  );
}

export default function App() {
  const [session, setSession] = useState(hasSupabase ? undefined : { user: { email: "demo@stageops.app" }, demo: true });
  const { profile, loading: profileLoading } = useProfile(session);

  useEffect(() => {
    if (!hasSupabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (hasSupabase && session === undefined) return <div className="center-screen">Cargando StageOPSÃÂ¢ÃÂÃÂ¦</div>;
  if (!session) return <LoginPage />;
  if (hasSupabase && profileLoading) return <div className="center-screen">Cargando perfilÃÂ¢ÃÂÃÂ¦</div>;
  if (hasSupabase && !profile?.organization_id) return <OnboardingPage session={session} />;

  return <ProtectedApp session={session} profile={profile} />;
}
