import { useState, useEffect, useCallback } from "react";
import { Router as WouterRouter, Switch, Route, useLocation, Link } from "wouter";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "/admin";
const API = "/api/admin";

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

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setLoading(true);
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
        <input className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
          type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} required />
        <input className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
          type="password" placeholder="Lozinka" value={pass} onChange={e => setPass(e.target.value)} required />
        {err && <p className="text-destructive text-xs text-center">{err}</p>}
        <button type="submit" disabled={loading}
          className="bg-primary text-primary-foreground font-bold rounded-lg py-2 text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
          {loading ? "Prijava…" : "Prijavi se"}
        </button>
      </form>
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
const NAV = [
  { path: "/", label: "Nadzorna ploča", icon: "📊" },
  { path: "/listings", label: "Oglasi", icon: "📋" },
  { path: "/users", label: "Korisnici", icon: "👥" },
];

type NavItem = { path: string; label: string; icon: string };

function TopBar({ onLogout, menuOpen, setMenuOpen, navItems }: { onLogout: () => void; menuOpen: boolean; setMenuOpen: (v: boolean) => void; navItems: NavItem[] }) {
  const [loc] = useLocation();
  const current = navItems.find(n => n.path === "/" ? loc === "/" : loc.startsWith(n.path));
  return (
    <header className="sticky top-0 z-30 bg-sidebar border-b border-sidebar-border flex items-center px-4 h-14 gap-3">
      <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-sidebar-accent text-sidebar-foreground text-xl">
        {menuOpen ? "✕" : "☰"}
      </button>
      <div className="text-lg font-black text-primary tracking-tight hidden md:block">Trampaj</div>
      <div className="hidden md:flex items-center gap-1 ml-4">
        {navItems.map(n => {
          const active = n.path === "/" ? loc === "/" : loc.startsWith(n.path);
          return (
            <Link key={n.path} href={n.path}>
              <span className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${active ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
                <span className="text-base">{n.icon}</span>{n.label}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="flex-1 flex items-center md:hidden">
        <span className="text-sm font-semibold text-foreground">{current?.label ?? "Admin"}</span>
      </div>
      <button onClick={onLogout} className="ml-auto text-xs text-muted-foreground hover:text-destructive transition-colors py-1.5 px-3 rounded-lg hover:bg-accent">
        Odjava
      </button>
    </header>
  );
}

function MobileMenu({ open, onClose, navItems }: { open: boolean; onClose: () => void; navItems: NavItem[] }) {
  const [loc] = useLocation();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-20 md:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <nav className="absolute top-14 left-0 right-0 bg-sidebar border-b border-sidebar-border shadow-xl" onClick={e => e.stopPropagation()}>
        {navItems.map(n => {
          const active = n.path === "/" ? loc === "/" : loc.startsWith(n.path);
          return (
            <Link key={n.path} href={n.path}>
              <span onClick={onClose} className={`flex items-center gap-3 px-5 py-3.5 text-sm cursor-pointer transition-colors border-b border-sidebar-border/40 ${active ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
                <span className="text-lg">{n.icon}</span>{n.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

// ─── Mini bar chart ────────────────────────────────────────────────────────────
function BarChart({ data, color = "#F5C100" }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex flex-col gap-2">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <div className="w-24 shrink-0 text-muted-foreground truncate text-right">{d.label}</div>
          <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden relative">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max((d.value / max) * 100, 2)}%`, backgroundColor: color }} />
          </div>
          <div className="w-6 text-right font-semibold text-foreground">{d.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Stat card variants ────────────────────────────────────────────────────────
function StatCard({ label, value, color = "text-foreground", sub, icon }: { label: string; value: number | string; color?: string; sub?: string; icon?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
      {icon && <span className="text-2xl mt-0.5">{icon}</span>}
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide leading-none mb-1">{label}</div>
        <div className={`text-2xl font-black leading-none ${color}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color = "text-foreground" }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  );
}

// ─── Donut / funnel display ────────────────────────────────────────────────────
function ModerationFunnel({ total, active, pending, rejected }: { total: number; active: number; pending: number; rejected: number }) {
  const moderated = active + rejected;
  const approvalPct = moderated > 0 ? Math.round((active / moderated) * 100) : null;
  const pendingPct = total > 0 ? Math.round((pending / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">Odobreni</span>
          <span className="text-green-400 font-semibold">{active} ({approvalPct != null ? approvalPct + "%" : "—"})</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full" style={{ width: total > 0 ? `${(active / total) * 100}%` : "0%" }} />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">Na čekanju</span>
          <span className="text-yellow-400 font-semibold">{pending} ({pendingPct}%)</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-yellow-500 rounded-full" style={{ width: total > 0 ? `${(pending / total) * 100}%` : "0%" }} />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">Odbijeni</span>
          <span className="text-red-400 font-semibold">{rejected} ({total > 0 ? Math.round((rejected / total) * 100) : 0}%)</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-red-500 rounded-full" style={{ width: total > 0 ? `${(rejected / total) * 100}%` : "0%" }} />
        </div>
      </div>
      {approvalPct != null && (
        <div className="mt-1 text-center text-xs text-muted-foreground">
          AI odobrava <span className="text-green-400 font-bold">{approvalPct}%</span> moderiranih oglasa
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
interface Stats {
  totalListings: number; activeListings: number; pendingListings: number; rejectedListings: number;
  totalUsers: number; bannedUsers: number;
  newListings7d: number; newUsers7d: number; newUsers30d: number;
  approvalRate: number | null;
  categoryBreakdown: { category: string; count: number }[];
  topCities: { city: string; count: number }[];
}

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiFetch("/stats").then(r => r.json()).then((d: Stats) => {
      if ("error" in d) { setError(true); } else { setStats(d); }
    }).catch(() => setError(true)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-muted-foreground text-sm">Učitavanje…</div>;
  if (error || !stats) return <div className="p-6 text-destructive text-sm">Greška pri dohvatu statistika.</div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-foreground">Nadzorna ploča</h1>
        <button onClick={() => { setLoading(true); setError(false); apiFetch("/stats").then(r => r.json()).then((d: Stats) => setStats(d)).finally(() => setLoading(false)); }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-accent">
          ↻ Osvježi
        </button>
      </div>

      {stats.pendingListings > 0 && (
        <Link href="/listings?status=pending">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-yellow-500/15 transition-colors">
            <span className="text-xl">⚠️</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-yellow-400 text-sm">{stats.pendingListings} oglasa čeka moderaciju</div>
              <div className="text-xs text-yellow-300/70">Klikni za pregled →</div>
            </div>
          </div>
        </Link>
      )}

      {/* Primary stats */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pregled</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Ukupno oglasa" value={stats.totalListings} icon="📋" />
          <StatCard label="Aktivni" value={stats.activeListings} color="text-green-400" icon="✅" />
          <StatCard label="Korisnici" value={stats.totalUsers} icon="👥" />
          <StatCard label="Banirani" value={stats.bannedUsers} color={stats.bannedUsers > 0 ? "text-destructive" : "text-foreground"} icon="🚫" />
        </div>
      </div>

      {/* Growth */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Rast (zadnjih 7 dana)</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Novi oglasi" value={`+${stats.newListings7d}`} color="text-primary" icon="📈" />
          <StatCard label="Novi korisnici" value={`+${stats.newUsers7d}`} color="text-sky-400" icon="🧑" />
          <StatCard label="Korisnici (30d)" value={`+${stats.newUsers30d}`} color="text-sky-300" sub="zadnjih 30 dana" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Moderation funnel */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-bold text-foreground mb-4">🤖 AI Moderacija</h2>
          <ModerationFunnel
            total={stats.totalListings}
            active={stats.activeListings}
            pending={stats.pendingListings}
            rejected={stats.rejectedListings}
          />
        </div>

        {/* Top cities */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-bold text-foreground mb-4">📍 Top gradovi</h2>
          {stats.topCities.length > 0 ? (
            <BarChart
              data={stats.topCities.map(c => ({ label: c.city || "—", value: c.count }))}
              color="#38BDF8"
            />
          ) : (
            <div className="text-xs text-muted-foreground text-center py-4">Nema podataka</div>
          )}
        </div>
      </div>

      {/* Category breakdown */}
      {stats.categoryBreakdown.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-bold text-foreground mb-4">📦 Oglasi po kategorijama</h2>
          <BarChart
            data={stats.categoryBreakdown.map(c => ({ label: c.category, value: c.count }))}
            color="#F5C100"
          />
        </div>
      )}

      {/* Quick user summary */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-bold text-foreground mb-3">👤 Sažetak korisnika</h2>
        <MiniStat label="Ukupno registriranih" value={stats.totalUsers} />
        <MiniStat label="Novi ovaj tjedan" value={`+${stats.newUsers7d}`} color="text-sky-400" />
        <MiniStat label="Novi ovaj mjesec" value={`+${stats.newUsers30d}`} color="text-sky-300" />
        <MiniStat label="Banirani" value={stats.bannedUsers} color={stats.bannedUsers > 0 ? "text-destructive" : "text-muted-foreground"} />
      </div>
    </div>
  );
}

// ─── Listings ─────────────────────────────────────────────────────────────────
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

const STATUS_LABEL: Record<string, string> = { active: "Aktivan", pending: "Na čekanju", rejected: "Odbijen" };

function Badge({ status }: { status: string }) {
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[status] ?? "bg-muted text-muted-foreground border-border"}`}>{STATUS_LABEL[status] ?? status}</span>;
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
    await apiFetch(`/listings/${id}`, { method: "PATCH", body: JSON.stringify({ moderationStatus: status, moderationNote: noteText ?? null }) });
    setActionLoading(null); setNoteId(null); setNote(""); load();
  };

  const del = async (id: string) => {
    if (!confirm("Obriši oglas?")) return;
    setActionLoading(id + "_del");
    await apiFetch(`/listings/${id}`, { method: "DELETE" });
    setActionLoading(null); load();
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <h1 className="text-xl font-black text-foreground">Oglasi</h1>
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
        <div className="text-muted-foreground text-sm">Učitavanje…</div>
      ) : listings.length === 0 ? (
        <div className="text-muted-foreground text-center py-16 text-sm">Nema oglasa u ovoj kategoriji.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {listings.map(l => (
            <div key={l.id} className="bg-card border border-border rounded-xl p-4 flex gap-3">
              {l.imageUris[0] ? (
                <img src={l.imageUris[0]} alt="" className="w-16 h-16 object-cover rounded-lg shrink-0 bg-muted" />
              ) : (
                <div className="w-16 h-16 rounded-lg shrink-0 bg-muted flex items-center justify-center text-2xl">📦</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-bold text-foreground text-sm truncate">{l.title}</div>
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
                    🗑
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
    setActionLoading(null); load();
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <h1 className="text-xl font-black text-foreground">Korisnici</h1>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">{users.length} ukupno</span>
        <input className="ml-auto bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40 w-48"
          placeholder="Pretraži…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {loading ? (
        <div className="text-muted-foreground text-sm">Učitavanje…</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden">
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
                  <tr key={u.id} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-accent/20"} hover:bg-accent/40 transition-colors`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">@{u.username}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {u.isAdmin && <span className="text-xs bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-semibold">Admin</span>}
                        {u.isBanned && <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-semibold">Baniran</span>}
                        {u.isVerified && <span className="text-xs bg-green-500/15 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-semibold">✓</span>}
                        {!u.isBanned && !u.isAdmin && !u.isVerified && <span className="text-xs text-muted-foreground">Aktivan</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1.5 justify-end">
                        <button disabled={actionLoading === u.id} onClick={() => patch(u.id, { isBanned: !u.isBanned })}
                          className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors disabled:opacity-50 ${u.isBanned ? "bg-green-500/15 text-green-400 border border-green-500/30" : "bg-red-500/15 text-red-400 border border-red-500/30"}`}>
                          {u.isBanned ? "Odbani" : "Baniraj"}
                        </button>
                        <button disabled={actionLoading === u.id} onClick={() => patch(u.id, { isAdmin: !u.isAdmin })}
                          className="text-xs px-2.5 py-1 rounded-lg font-semibold bg-muted text-muted-foreground border border-border transition-colors disabled:opacity-50">
                          {u.isAdmin ? "Makni admin" : "Admin"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="text-center text-muted-foreground py-10 text-sm">Nema korisnika.</div>}
          </div>

          {/* Mobile cards */}
          <div className="md:hidden flex flex-col gap-3">
            {filtered.map(u => (
              <div key={u.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-bold text-foreground text-sm">@{u.username}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{fmtDate(u.createdAt)}</div>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {u.isAdmin && <span className="text-xs bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-semibold">Admin</span>}
                    {u.isBanned && <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-semibold">Baniran</span>}
                    {u.isVerified && <span className="text-xs bg-green-500/15 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-semibold">✓ Verif.</span>}
                  </div>
                </div>
                <div className="flex gap-2 mt-1">
                  <button disabled={actionLoading === u.id} onClick={() => patch(u.id, { isBanned: !u.isBanned })}
                    className={`flex-1 text-xs py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50 ${u.isBanned ? "bg-green-500/15 text-green-400 border border-green-500/30" : "bg-red-500/15 text-red-400 border border-red-500/30"}`}>
                    {u.isBanned ? "Odbani" : "Baniraj"}
                  </button>
                  <button disabled={actionLoading === u.id} onClick={() => patch(u.id, { isAdmin: !u.isAdmin })}
                    className="flex-1 text-xs py-1.5 rounded-lg font-semibold bg-muted text-muted-foreground border border-border transition-colors disabled:opacity-50">
                    {u.isAdmin ? "Makni admin" : "Postavi admin"}
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="text-center text-muted-foreground py-10 text-sm">Nema korisnika.</div>}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Monitor ──────────────────────────────────────────────────────────────────
interface MonitorCheck { name: string; status: "ok" | "error"; latencyMs: number; detail?: string; }
interface MonitorStatus { ok: boolean; timestamp: number; checks: MonitorCheck[]; }

const STATUS_DOT: Record<string, string> = {
  ok: "bg-green-500",
  error: "bg-red-500",
};

function MonitorPage() {
  const [data, setData] = useState<MonitorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/monitor/status");
      const d = await r.json() as MonitorStatus;
      setData(d);
      setLastRefresh(new Date());
    } catch {
      setData(null);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

  const sendTestAlert = async () => {
    setTestLoading(true); setTestResult(null);
    try {
      const token = localStorage.getItem("admin_token");
      const r = await fetch("/api/monitor/test-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const d = await r.json() as { ok: boolean; message?: string };
      setTestResult(d.ok ? "✅ Test email poslan!" : `❌ ${d.message ?? "Greška"}`);
    } catch { setTestResult("❌ Greška slanja"); }
    finally { setTestLoading(false); }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-black text-foreground">Monitor</h1>
        <div className={`w-3 h-3 rounded-full ${data ? (data.ok ? "bg-green-500" : "bg-red-500") : "bg-muted"} animate-pulse`} />
        <span className="text-xs text-muted-foreground">{data?.ok ? "Sve radi" : data ? "Greška" : "Provjera…"}</span>
        <button onClick={refresh} className="ml-auto text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent transition-colors">↻ Osvježi</button>
      </div>

      {lastRefresh && (
        <div className="text-xs text-muted-foreground">Zadnja provjera: {lastRefresh.toLocaleTimeString("hr-HR")} · automatski svakih 30s</div>
      )}

      {loading && !data ? (
        <div className="text-muted-foreground text-sm">Provjera servisa…</div>
      ) : data ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {data.checks.map((c, i) => (
            <div key={c.name} className={`flex items-center gap-4 px-4 py-3.5 ${i > 0 ? "border-t border-border/50" : ""}`}>
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[c.status] ?? "bg-muted"}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">{c.name}</div>
                {c.detail && <div className="text-xs text-muted-foreground mt-0.5">{c.detail}</div>}
              </div>
              <div className="text-right shrink-0">
                <div className={`text-xs font-bold ${c.status === "ok" ? "text-green-400" : "text-red-400"}`}>
                  {c.status === "ok" ? "OK" : "GREŠKA"}
                </div>
                {c.latencyMs > 0 && <div className="text-xs text-muted-foreground">{c.latencyMs}ms</div>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          ❌ Ne mogu dohvatiti status servera
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-bold text-foreground">📧 Email notifikacije</h2>
        <p className="text-xs text-muted-foreground">
          Email alert se šalje automatski kad server ima grešku (max jednom svakih 15 minuta).
          Pošalji test email da provjeriš radi li.
        </p>
        <button onClick={sendTestAlert} disabled={testLoading}
          className="text-sm bg-primary text-primary-foreground font-bold rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50 transition-opacity">
          {testLoading ? "Šaljem…" : "Pošalji test email"}
        </button>
        {testResult && <div className="text-sm font-medium">{testResult}</div>}
      </div>
    </div>
  );
}

// ─── Nav update ──────────────────────────────────────────────────────────────
const NAV_UPDATED = [
  { path: "/", label: "Nadzorna ploča", icon: "📊" },
  { path: "/listings", label: "Oglasi", icon: "📋" },
  { path: "/users", label: "Korisnici", icon: "👥" },
  { path: "/monitor", label: "Monitor", icon: "🟢" },
];

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("admin_token"));
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => { localStorage.removeItem("admin_token"); setToken(null); };

  if (!token) return <LoginPage onLogin={setToken} />;

  return (
    <WouterRouter base={BASE}>
      <div className="min-h-screen bg-background flex flex-col">
        <TopBar onLogout={handleLogout} menuOpen={menuOpen} setMenuOpen={setMenuOpen} navItems={NAV_UPDATED} />
        <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} navItems={NAV_UPDATED} />
        <main className="flex-1 overflow-auto">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/listings" component={ListingsPage} />
            <Route path="/users" component={UsersPage} />
            <Route path="/monitor" component={MonitorPage} />
            <Route><div className="p-10 text-muted-foreground text-center text-sm">Stranica nije pronađena.</div></Route>
          </Switch>
        </main>
      </div>
    </WouterRouter>
  );
}
