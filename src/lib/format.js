export function money(value, currency = "ARS") {
  if (value === null || value === undefined) return "🔒 privado";
  const symbol = currency === "USD" ? "U$D " : currency === "EUR" ? "€" : "$";
  return symbol + Number(value).toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

export function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}
