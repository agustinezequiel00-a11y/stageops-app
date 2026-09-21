export default function ComingSoonPage({ title, description }) {
  return (
    <div>
      <div className="card empty-state">
        <h2>{title}</h2>
        <p>{description || "Esta pantalla está diseñada (ver el boceto) pero todavía no está conectada a Supabase. La vamos completando módulo por módulo."}</p>
      </div>
    </div>
  );
}
