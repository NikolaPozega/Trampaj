export const API = "/api/admin";

export function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("admin_token");
  return fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  });
}

export function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("hr-HR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtRelative(ts: number) {
  const d = Date.now() - ts;
  if (d < 60_000) return "upravo";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} min`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} h`;
  return `${Math.floor(d / 86_400_000)} d`;
}

export const NC = "neon-card-cyan";
