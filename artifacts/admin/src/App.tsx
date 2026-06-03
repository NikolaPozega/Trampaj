import { useState, useEffect, useCallback } from "react";
import { Router as WouterRouter, Switch, Route, useLocation, Link } from "wouter";
import { apiFetch, fmtRelative, NC } from "./lib/api";
import { Dashboard } from "./pages/Dashboard";
import { ListingsPage } from "./pages/ListingsPage";
import { UsersPage } from "./pages/UsersPage";
import { StatsPage } from "./pages/StatsPage";
import { PushPage } from "./pages/PushPage";
import { EarlyAdoptersPage } from "./pages/EarlyAdoptersPage";
import { SocialPage } from "./pages/SocialPage";
import { MonitorPage } from "./pages/MonitorPage";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "/admin";

const NAV = [
  { path: "/", label: "Dashboard", icon: "📊", exact: true },
  { path: "/listings", label: "Oglasi", icon: "📋" },
  { path: "/users", label: "Korisnici", icon: "👥" },
  { path: "/stats", label: "Statistike", icon: "📈" },
  { path: "/push", label: "Push poruke", icon: "📨" },
  { path: "/early-adopters", label: "Early Adopters", icon: "🌟" },
  { path: "/social", label: "Social Media", icon: "📱" },
  { path: "/monitor", label: "Monitor", icon: "🟢" },
];

function ArrowsLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="14" fill="rgba(0,200,255,0.10)" />
      <path d="M20 22h16l-4-4M20 22l4 4" stroke="#F5C100" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M44 42H28l4 4M44 42l-4-4" stroke="#F5C100" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M36 22c4 0 8 4 8 10" stroke="#F5C100" strokeWidth="3" strokeLinecap="round"/>
      <path d="M28 42c-4 0-8-4-8-10" stroke="#F5C100" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
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
    <div className="min-h-screen flex items-center justify-center neon-bg relative overflow-hidden">
      {/* bokeh blobs */}
      <div className="bokeh-blob w-80 h-80 bg-blue-600/20 top-[-60px] left-[-80px]" />
      <div className="bokeh-blob w-96 h-96 bg-cyan-500/10 bottom-[-80px] right-[-60px]" />
      <div className="bokeh-blob w-64 h-64 bg-yellow-500/8 top-1/2 left-1/3" />

      <form onSubmit={handleSubmit} className="neon-card-cyan w-full max-w-sm mx-4 p-8 flex flex-col gap-4 relative">
        <div className="flex flex-col items-center gap-3 mb-2">
          <ArrowsLogo size={60} />
          <div>
            <div className="text-3xl font-black tracking-tight text-center neon-text-yellow">Trampaj.hr</div>
            <div className="text-[11px] text-center uppercase tracking-widest mt-1" style={{ color: "rgba(0,200,255,0.7)" }}>
              Administratorska ploča
            </div>
          </div>
        </div>

        <input
          className="neon-input w-full px-4 py-3 text-sm"
          type="email" placeholder="E-mail"
          value={email} onChange={e => setEmail(e.target.value)} required
          autoComplete="email"
        />
        <input
          className="neon-input w-full px-4 py-3 text-sm"
          type="password" placeholder="Lozinka"
          value={pass} onChange={e => setPass(e.target.value)} required
          autoComplete="current-password"
        />
        {err && <p className="text-red-400 text-xs text-center">{err}</p>}
        <button type="submit" disabled={loading} className="neon-btn-yellow w-full py-3 text-sm mt-1">
          {loading ? "Prijava…" : "Prijavi se"}
        </button>
      </form>
    </div>
  );
}

// ─── Notification bell ────────────────────────────────────────────────────────
type ActivityEvent = { type: string; label: string; sub: string; ts: number; link?: string };

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [pending, setPending] = useState(0);
  const [lastSeen, setLastSeen] = useState<number>(() => parseInt(localStorage.getItem("notif_seen") ?? "0", 10));

  const refresh = useCallback(() => {
    apiFetch("/activity").then(r => r.json()).then((d: { events: ActivityEvent[]; pendingCount: number }) => {
      setEvents(d.events ?? []);
      setPending(d.pendingCount ?? 0);
    }).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const unseen = events.filter(e => e.ts > lastSeen).length;
  const badge = unseen > 0 ? unseen : pending > 0 ? pending : 0;

  const handleOpen = () => {
    if (!open) {
      refresh();
      const now = Date.now();
      setLastSeen(now);
      localStorage.setItem("notif_seen", String(now));
    }
    setOpen(v => !v);
  };

  return (
    <div className="relative">
      <button onClick={handleOpen}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-cyan-500/10 transition-colors text-base">
        🔔
        {badge > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute right-0 top-10 z-50 w-72 neon-card-cyan overflow-hidden`}>
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-cyan-500/10">
              <span className="text-[11px] font-bold neon-text-cyan uppercase tracking-widest">Notifikacije</span>
              {pending > 0 && (
                <Link href="/listings?status=pending" onClick={() => setOpen(false)}>
                  <span className="text-[9px] bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full font-bold cursor-pointer">
                    {pending} čeka
                  </span>
                </Link>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
              {events.length === 0
                ? <div className="p-4 text-center text-xs text-muted-foreground">Nema aktivnosti</div>
                : events.map((e, i) => (
                  <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-cyan-500/5 transition-colors">
                    <span className="text-sm mt-0.5 shrink-0">{e.type === "user" ? "👤" : "📋"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-foreground truncate">{e.label}</div>
                      <div className="text-[10px] text-muted-foreground">{e.sub}</div>
                    </div>
                    <div className="text-[10px] text-muted-foreground shrink-0">{fmtRelative(e.ts)}</div>
                  </div>
                ))
              }
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sidebar nav ─────────────────────────────────────────────────────────────
function Sidebar({ onLogout, onClose }: { onLogout: () => void; onClose?: () => void }) {
  const [loc] = useLocation();

  return (
    <div className="flex flex-col h-full neon-sidebar">
      <div className="px-4 py-4 border-b border-cyan-500/10 flex items-center gap-3">
        <ArrowsLogo size={36} />
        <div>
          <div className="text-base font-black neon-text-yellow leading-none">Trampaj</div>
          <div className="text-[9px] mt-0.5 uppercase tracking-widest" style={{ color: "rgba(0,200,255,0.6)" }}>Admin Panel</div>
        </div>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV.map(n => {
          const active = n.exact ? loc === "/" : loc.startsWith(n.path);
          return (
            <Link key={n.path} href={n.path}>
              <span onClick={onClose}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] cursor-pointer transition-all ${
                  active
                    ? "neon-nav-active font-bold"
                    : "text-sidebar-foreground hover:bg-cyan-500/5 hover:text-white"
                }`}
                style={!active ? { borderLeft: "2px solid transparent" } : {}}
              >
                <span className="text-base shrink-0">{n.icon}</span>
                <span className="truncate">{n.label}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4 pt-2 border-t border-cyan-500/10 flex items-center gap-2">
        <NotificationBell />
        <button onClick={onLogout}
          className="flex-1 text-[11px] text-muted-foreground hover:text-red-400 transition-colors py-1.5 px-2 rounded-lg hover:bg-red-500/10 text-left font-medium">
          ⏻ Odjava
        </button>
      </div>
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("admin_token"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { localStorage.removeItem("admin_token"); setToken(null); };

  if (!token) return <LoginPage onLogin={setToken} />;

  return (
    <WouterRouter base={BASE}>
      <div className="min-h-screen neon-bg flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-52 shrink-0 sticky top-0 h-screen">
          <Sidebar onLogout={handleLogout} />
        </aside>

        {/* Mobile: topbar + drawer */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center px-4 h-12 border-b border-cyan-500/10"
             style={{ background: "rgba(6,14,28,0.95)", backdropFilter: "blur(12px)" }}>
          <button onClick={() => setMobileOpen(v => !v)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-cyan-500/10 text-foreground text-lg">
            {mobileOpen ? "✕" : "☰"}
          </button>
          <div className="ml-3 flex items-center gap-2">
            <ArrowsLogo size={24} />
            <span className="text-base font-black neon-text-yellow">Trampaj</span>
          </div>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-20 flex" onClick={() => setMobileOpen(false)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className="relative w-52 h-full z-30" onClick={e => e.stopPropagation()}>
              <Sidebar onLogout={handleLogout} onClose={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 md:overflow-auto mt-12 md:mt-0">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/listings" component={ListingsPage} />
            <Route path="/users" component={UsersPage} />
            <Route path="/stats" component={StatsPage} />
            <Route path="/push" component={PushPage} />
            <Route path="/early-adopters" component={EarlyAdoptersPage} />
            <Route path="/social" component={SocialPage} />
            <Route path="/monitor" component={MonitorPage} />
            <Route><div className="p-10 text-muted-foreground text-center text-sm">Stranica nije pronađena.</div></Route>
          </Switch>
        </main>
      </div>
    </WouterRouter>
  );
}
