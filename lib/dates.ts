// Dates are stored as plain YYYY-MM-DD strings (no timezone games).

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(fromISO: string, toISO: string) {
  const a = Date.UTC(...(fromISO.split("-").map(Number) as [number, number, number]));
  const b = Date.UTC(...(toISO.split("-").map(Number) as [number, number, number]));
  return Math.round((b - a) / 86_400_000);
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${m}/${d}/${y}`;
}

/** "in 3 days", "today", "5 days overdue" */
export function relDays(iso: string | null | undefined, today = todayISO()) {
  if (!iso) return "";
  const n = daysBetween(today, iso);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}
