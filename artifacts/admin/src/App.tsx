import { useState, useEffect, useCallback } from "react";
import { Router as WouterRouter, Switch, Route, useLocation, Link } from "wouter";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "/admin";
const API = "/api/admin";

// ─── helpers ────────────────────────────────────────────────────────────────
function apiFetch(path: string, opts?: RequestInit) {
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

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("hr-HR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Auth context ────────────────────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
      });
      const d = await r.json() as { token?: string; isAdmin?: boolean; error?: string };
      if (!r.ok || !d.token) { setErr(d.error ?? "Pogrešni podaci."); return; }
      if (!d.isAdmin) { setErr("Nemaš admin ovlasti."); return; }
      localStorage.setItem("admin_token", d.token);
      onLogin(d.token);
    } catch { setErr("Greška veze."); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-8 w-full max-w-sm shadow-xl flex flex-col gap-4">
        <div className="text-center mb-2">
          <div className="text-3xl font-black text-primary tracking-tight">Trampaj</div>
          <div className="text-muted-foreground text-sm mt-1">Admin panel</div>
        </div>
        <input
          className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
          type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} required
        />
        <input
          className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
          type="password" placeholder="Lozinka" value={pass} onChange={e => setPass(e.target.value)} required
        />
        {err && <p className="text-destructive text-xs text-center">{err}</p>}
        <button type="submit" disabled={loading}
          className="bg-primary text-primary-foreground font-bold rounded-lg py-2 text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
          {loading ? "Prijava…" : "Prijavi se"}
        </button>
      </form>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
const NAV = [
  { path: "/", label: "Dashboard", icon: "📊" },
  { path: "/listings", label: "Oglasi", icon: "📋" },
  { path: "/users", label: "Korisnici", icon: "👥" },
];

function Sidebar({ onLogout }: { onLogout: () => void }) {
  const [loc] = useLocation();
  return (
    <aside className="w-56 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col min-h-screen">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="text-xl font-black text-primary tracking-tight">Trampaj</div>
        <div className="text-xs text-muted-foreground mt-0.5">Admin panel</div>
      </div>
      <nav className="flex-1 py-4 flex flex-col gap-0.5 px-2">
        {NAV.map(n => {
          const active = n.path === "/" ? loc === "/" : loc.startsWith(n.path);
          return (
            <Link key={n.path} href={n.path}>
              <span className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${active ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
                <span>{n.icon}</span>{n.label}
              </span>
            </Link>
          );
        })}
      </nav>
      <button onClick={onLogout} className="m-3 text-xs text-muted-foreground hover:text-destructive transition-colors py-2 px-3 rounded-lg hover:bg-accent text-left">
        🚪 Odjava
      </button>
    </aside>
  );
}

// ─── Stats card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, color = "text-foreground", sub }: { label: string; value: number | string; color?: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-1">
      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</div>
      <div className={`text-3xl font-black ${color}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
interface Stats { totalListings: number; activeListings: number; pendingListings: number; rejectedListings: number; totalUsers: number; bannedUsers: number; }

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/stats").then(r => r.json()).then((d: Stats) => setStats(d)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-black mb-6 text-foreground">Dashboard</h1>
      {loading ? (
        <div className="text-muted-foreground">Učitavanje…</div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Ukupno oglasa" value={stats.totalListings} />
          <StatCard label="Aktivni oglasi" value={stats.activeListings} color="text-green-400" />
          <StatCard label="Na čekanju" value={stats.pendingListings} color="text-yellow-400" sub="AI moderacija" />
          <StatCard label="Odbijeni" value={stats.rejectedListings} color="text-destructive" />
          <StatCard label="Korisnici" value={stats.totalUsers} />
          <StatCard label="Banirani" value={stats.bannedUsers} color="text-destructive" />
        </div>
      ) : <div className="text-destructive">Greška pri dohvatu statistika.</div>}

      {stats && stats.pendingListings > 0 && (
        <div className="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="font-bold text-yellow-400">{stats.pendingListings} oglasa čeka moderaciju</div>
            <Link href="/listings?status=pending"><span className="text-xs text-yellow-300 underline cursor-pointer">Pregledaj odmah →</span></Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Listings ────────────────────────────────────────────────────────────────
interface AdminListing {
  id: string; title: string; category: string; status: string;
  moderationStatus: string; moderationNote: string | null;
  imageUris: string[]; createdAt: number; userName: string; userId: string;
}

const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-500/15 text-green-400 border-green-500/30",
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  rejected: "bg-red-500/15 text-red-400 border-red-500/30",
};

function Badge({ status }: { status: string }) {
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[status] ?? "bg-muted text-muted-foreground border-border"}`}>{status}</span>;
}

function ListingsPage() {
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteId, setNoteId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/listings?status=${filterStatus}`).then(r => r.json())
      .then((d: { listings: AdminListing[] }) => setListings(d.listings ?? []))
      .finally(() => setLoading(false));
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const moderate = async (id: string, status: "active" | "rejected", noteText?: string) => {
    setActionLoading(id);
    await apiFetch(`/listings/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ moderationStatus: status, moderationNote: noteText ?? null }),
    });
    setActionLoading(null);
    setNoteId(null);
    setNote("");
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Obriši oglas?")) return;
    setActionLoading(id + "_del");
    await apiFetch(`/listings/${id}`, { method: "DELETE" });
    setActionLoading(null);
    load();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-black text-foreground">Oglasi</h1>
        <div className="flex gap-1 bg-muted rounded-lg p-1 ml-auto">
          {["pending","active","rejected"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${filterStatus === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {s === "pending" ? "Na čekanju" : s === "active" ? "Aktivni" : "Odbijeni"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Učitavanje…</div>
      ) : listings.length === 0 ? (
        <div className="text-muted-foreground text-center py-16">Nema oglasa u ovoj kategoriji.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {listings.map(l => (
            <div key={l.id} className="bg-card border border-border rounded-xl p-4 flex gap-4">
              {l.imageUris[0] && (
                <img src={l.imageUris[0]} alt="" className="w-20 h-20 object-cover rounded-lg shrink-0 bg-muted" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-bold text-foreground text-sm">{l.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">@{l.userName} · {l.category} · {fmtDate(l.createdAt)}</div>
                  </div>
                  <Badge status={l.moderationStatus} />
                </div>
                {l.moderationNote && (
                  <div className="mt-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-1">{l.moderationNote}</div>
                )}
                {noteId === l.id && (
                  <input className="mt-2 w-full bg-input border border-border rounded px-2 py-1 text-xs text-foreground" placeholder="Razlog odbijanja (opciono)" value={note} onChange={e => setNote(e.target.value)} />
                )}
                <div className="flex gap-2 mt-3 flex-wrap">
                  {l.moderationStatus !== "active" && (
                    <button onClick={() => moderate(l.id, "active")} disabled={actionLoading === l.id}
                      className="text-xs bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 rounded-lg px-3 py-1 font-semibold transition-colors disabled:opacity-50">
                      ✓ Odobri
                    </button>
                  )}
                  {l.moderationStatus !== "rejected" && (
                    noteId === l.id ? (
                      <button onClick={() => moderate(l.id, "rejected", note)} disabled={actionLoading === l.id}
                        className="text-xs bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 rounded-lg px-3 py-1 font-semibold transition-colors disabled:opacity-50">
                        ✕ Potvrdi odbijanje
                      </button>
                    ) : (
                      <button onClick={() => setNoteId(l.id)}
                        className="text-xs bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 rounded-lg px-3 py-1 font-semibold transition-colors">
                        ✕ Odbij
                      </button>
                    )
                  )}
                  <button onClick={() => del(l.id)} disabled={actionLoading === l.id + "_del"}
                    className="text-xs bg-muted text-muted-foreground hover:text-destructive rounded-lg px-3 py-1 transition-colors disabled:opacity-50">
                    🗑 Obriši
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────
interface AdminUser {
  id: string; username: string; email: string;
  isAdmin: boolean; isBanned: boolean; isVerified: boolean; createdAt: number;
}

function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    apiFetch("/users").then(r => r.json()).then((d: { users: AdminUser[] }) => setUsers(d.users ?? [])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const patch = async (id: string, data: Partial<AdminUser>) => {
    setActionLoading(id);
    await apiFetch(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    setActionLoading(null);
    load();
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-black text-foreground">Korisnici</h1>
        <input className="ml-auto bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40 w-52"
          placeholder="Pretraži korisnika…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {loading ? (
        <div className="text-muted-foreground">Učitavanje…</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3">Korisnik</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Registriran</th>
                <th className="text-right px-4 py-3">Akcije</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-accent/30"} hover:bg-accent/50 transition-colors`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">@{u.username}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {u.isAdmin && <span className="text-xs bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-semibold">Admin</span>}
                      {u.isBanned && <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-semibold">Baniran</span>}
                      {u.isVerified && <span className="text-xs bg-green-500/15 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-semibold">✓ Verificiran</span>}
                      {!u.isBanned && !u.isAdmin && !u.isVerified && <span className="text-xs text-muted-foreground">Aktivan</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1.5 justify-end flex-wrap">
                      <button disabled={actionLoading === u.id} onClick={() => patch(u.id, { isBanned: !u.isBanned })}
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors disabled:opacity-50 ${u.isBanned ? "bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25" : "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25"}`}>
                        {u.isBanned ? "Odbani" : "Baniraj"}
                      </button>
                      <button disabled={actionLoading === u.id} onClick={() => patch(u.id, { isAdmin: !u.isAdmin })}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors disabled:opacity-50">
                        {u.isAdmin ? "Makni admin" : "Postavi admin"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center text-muted-foreground py-10">Nema korisnika.</div>}
        </div>
      )}
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("admin_token"));

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setToken(null);
  };

  if (!token) return <LoginPage onLogin={setToken} />;

  return (
    <WouterRouter base={BASE}>
      <div className="flex min-h-screen bg-background">
        <Sidebar onLogout={handleLogout} />
        <main className="flex-1 overflow-auto">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/listings" component={ListingsPage} />
            <Route path="/users" component={UsersPage} />
            <Route>
              <div className="p-10 text-muted-foreground text-center">Stranica nije pronađena.</div>
            </Route>
          </Switch>
        </main>
      </div>
    </WouterRouter>
  );
}
