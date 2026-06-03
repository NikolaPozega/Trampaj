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
      <form onSubmit={handleSubmit} className="bg-card border border-yellow-500/20 rounded-2xl p-8 w-full max-w-sm flex flex-col gap-4"
            style={{ boxShadow: "0 0 40px rgba(245,193,0,0.08)" }}>
        <div className="text-center mb-2">
          <div className="text-3xl font-black tracking-tight" style={{ color: "#F5C100", textShadow: "0 0 20px rgba(245,193,0,0.5)" }}>Trampaj</div>
          <div className="text-[11px] text-muted-foreground mt-1 uppercase tracking-widest">Admin Panel</div>
        </div>
        <input className="bg-input border border-yellow-500/20 rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-yellow-500/50 transition-all"
          type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} required />
        <input className="bg-input border border-yellow-500/20 rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-yellow-500/50 transition-all"
          type="password" placeholder="Lozinka" value={pass} onChange={e => setPass(e.target.value)} required />
        {err && <p className="text-destructive text-xs text-center">{err}</p>}
        <button type="submit" disabled={loading}
          className="font-bold rounded-lg py-2.5 text-sm transition-all disabled:opacity-50"
          style={{ background: "#F5C100", color: "#08152E", boxShadow: loading ? "none" : "0 0 20px rgba(245,193,0,0.3)" }}>
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
        className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-yellow-500/10 text-sidebar-foreground transition-colors text-base">
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
          <div className={`absolute right-0 top-10 z-50 w-72 ${NC} shadow-2xl overflow-hidden`}
               style={{ boxShadow: "0 0 30px rgba(245,193,0,0.1)" }}>
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-yellow-500/10">
              <span className="text-[11px] font-bold text-yellow-400 uppercase tracking-widest">Notifikacije</span>
              {pending > 0 && (
                <Link href="/listings?status=pending" onClick={() => setOpen(false)}>
                  <span className="text-[9px] bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full font-bold cursor-pointer">
                    {pending} čeka
                  </span>
                </Link>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-border/30">
              {events.length === 0
                ? <div className="p-4 text-center text-xs text-muted-foreground">Nema aktivnosti</div>
                : events.map((e, i) => (
                  <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-yellow-500/5 transition-colors">
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
    <div className="flex flex-col h-full" style={{ background: "#06101E" }}>
      {/* Logo */}
      <div className="px-4 py-4 border-b border-yellow-500/10">
        <div className="text-lg font-black tracking-tight" style={{ color: "#F5C100", textShadow: "0 0 15px rgba(245,193,0,0.4)" }}>Trampaj</div>
        <div className="text-[9px] text-muted-foreground uppercase tracking-widest mt-0.5">Admin Panel</div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV.map(n => {
          const active = n.exact ? loc === "/" : loc.startsWith(n.path);
          return (
            <Link key={n.path} href={n.path}>
              <span onClick={onClose}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] cursor-pointer transition-all ${
                  active
                    ? "text-yellow-400 font-bold"
                    : "text-sidebar-foreground hover:bg-yellow-500/5 hover:text-foreground"
                }`}
                style={active ? { background: "rgba(245,193,0,0.08)", borderLeft: "2px solid #F5C100", boxShadow: "0 0 10px rgba(245,193,0,0.05)" } : { borderLeft: "2px solid transparent" }}
              >
                <span className="text-base shrink-0">{n.icon}</span>
                <span className="truncate">{n.label}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: bell + logout */}
      <div className="px-3 pb-4 pt-2 border-t border-yellow-500/10 flex items-center gap-2">
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
      <div className="min-h-screen bg-background flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-yellow-500/10 sticky top-0 h-screen">
          <Sidebar onLogout={handleLogout} />
        </aside>

        {/* Mobile: topbar + drawer */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center px-4 h-12 border-b border-yellow-500/10"
             style={{ background: "#06101E" }}>
          <button onClick={() => setMobileOpen(v => !v)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-yellow-500/10 text-foreground text-lg">
            {mobileOpen ? "✕" : "☰"}
          </button>
          <span className="ml-3 text-base font-black" style={{ color: "#F5C100" }}>Trampaj</span>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-20 flex" onClick={() => setMobileOpen(false)}>
            <div className="absolute inset-0 bg-black/60" />
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
