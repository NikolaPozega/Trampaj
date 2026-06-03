import { useState, useEffect } from "react";
import { Link } from "wouter";
import { apiFetch, fmtDate, NC } from "../lib/api";

interface Stats {
  totalListings: number; activeListings: number; pendingListings: number; rejectedListings: number;
  totalUsers: number; bannedUsers: number;
  newListings7d: number; newUsers7d: number; newUsers30d: number;
  approvalRate: number | null;
  earlyAdopters?: number;
  categoryBreakdown: { category: string; count: number }[];
  topCities: { city: string; count: number }[];
}

function NCard({ label, value, color = "text-foreground", sub, icon }: { label: string; value: number | string; color?: string; sub?: string; icon?: string }) {
  return (
    <div className={`${NC} p-3`} style={{ boxShadow: "0 0 15px rgba(245,193,0,0.04)" }}>
      {icon && <div className="text-xl mb-1.5">{icon}</div>}
      <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-2xl font-black leading-none ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function Bar({ data, color = "#F5C100" }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex flex-col gap-1.5">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-2 text-[11px]">
          <div className="w-20 shrink-0 text-muted-foreground truncate text-right">{d.label}</div>
          <div className="flex-1 bg-muted/60 rounded h-4 overflow-hidden">
            <div className="h-full rounded transition-all duration-500" style={{ width: `${Math.max((d.value / max) * 100, 2)}%`, backgroundColor: color }} />
          </div>
          <div className="w-5 text-right font-bold text-foreground">{d.value}</div>
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true); setError(false);
    apiFetch("/stats").then(r => r.json()).then((d: Stats & { error?: string }) => {
      if ("error" in d) setError(true); else setStats(d);
    }).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <div className="p-6 text-xs text-muted-foreground animate-pulse">Učitavanje…</div>;
  if (error || !stats) return <div className="p-6 text-xs text-destructive">Greška pri dohvatu statistika.</div>;

  const moderated = stats.activeListings + stats.rejectedListings;
  const approvalPct = moderated > 0 ? Math.round((stats.activeListings / moderated) * 100) : null;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-black text-yellow-400 uppercase tracking-widest">Dashboard</h1>
        <button onClick={load} className="text-[11px] text-muted-foreground hover:text-yellow-400 transition-colors px-2 py-1 rounded hover:bg-yellow-500/10">↻ Osvježi</button>
      </div>

      {stats.pendingListings > 0 && (
        <Link href="/listings?status=pending">
          <div className="border border-yellow-500/40 rounded-xl p-2.5 flex items-center gap-3 cursor-pointer hover:bg-yellow-500/10 transition-colors"
               style={{ boxShadow: "0 0 15px rgba(245,193,0,0.08)" }}>
            <span className="text-lg">⚠️</span>
            <div>
              <div className="font-bold text-yellow-400 text-xs">{stats.pendingListings} oglasa čeka moderaciju</div>
              <div className="text-[10px] text-yellow-300/60">Klikni za pregled →</div>
            </div>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <NCard label="Ukupno oglasa" value={stats.totalListings} icon="📋" />
        <NCard label="Aktivni oglasi" value={stats.activeListings} color="text-green-400" icon="✅" />
        <NCard label="Korisnici" value={stats.totalUsers} icon="👥" />
        <NCard label="Banirani" value={stats.bannedUsers} color={stats.bannedUsers > 0 ? "text-red-400" : "text-muted-foreground"} icon="🚫" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <NCard label="Novi oglasi 7d" value={`+${stats.newListings7d}`} color="text-yellow-400" icon="📈" />
        <NCard label="Novi users 7d" value={`+${stats.newUsers7d}`} color="text-cyan-400" icon="🧑" />
        <NCard label="Novi users 30d" value={`+${stats.newUsers30d}`} color="text-cyan-300" icon="📅" sub="30 dana" />
        <NCard label="Early Adopters" value={`${stats.earlyAdopters ?? 0} / 500`} color="text-yellow-300" icon="🌟" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${NC} p-4`} style={{ boxShadow: "0 0 15px rgba(245,193,0,0.04)" }}>
          <div className="text-[10px] text-yellow-400/80 uppercase tracking-widest mb-3">Moderacija</div>
          <div className="space-y-2.5">
            {[
              { label: "Odobreni", value: stats.activeListings, pct: stats.totalListings > 0 ? (stats.activeListings/stats.totalListings)*100 : 0, color: "#22C55E" },
              { label: "Na čekanju", value: stats.pendingListings, pct: stats.totalListings > 0 ? (stats.pendingListings/stats.totalListings)*100 : 0, color: "#F5C100" },
              { label: "Odbijeni", value: stats.rejectedListings, pct: stats.totalListings > 0 ? (stats.rejectedListings/stats.totalListings)*100 : 0, color: "#EF4444" },
            ].map(r => (
              <div key={r.label}>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-semibold" style={{ color: r.color }}>{r.value}</span>
                </div>
                <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${r.pct}%`, backgroundColor: r.color }} />
                </div>
              </div>
            ))}
            {approvalPct != null && (
              <div className="text-[10px] text-center text-muted-foreground mt-1">
                AI odobrava <span className="text-green-400 font-bold">{approvalPct}%</span>
              </div>
            )}
          </div>
        </div>

        <div className={`${NC} p-4`} style={{ boxShadow: "0 0 15px rgba(245,193,0,0.04)" }}>
          <div className="text-[10px] text-yellow-400/80 uppercase tracking-widest mb-3">Top gradovi</div>
          {stats.topCities.length > 0
            ? <Bar data={stats.topCities.map(c => ({ label: c.city || "—", value: c.count }))} color="#38BDF8" />
            : <div className="text-xs text-muted-foreground text-center py-4">Nema podataka</div>}
        </div>

        <div className={`${NC} p-4`} style={{ boxShadow: "0 0 15px rgba(245,193,0,0.04)" }}>
          <div className="text-[10px] text-yellow-400/80 uppercase tracking-widest mb-3">Kategorije</div>
          {stats.categoryBreakdown.length > 0
            ? <Bar data={stats.categoryBreakdown.map(c => ({ label: c.category, value: c.count }))} color="#F5C100" />
            : <div className="text-xs text-muted-foreground text-center py-4">Nema podataka</div>}
        </div>
      </div>

      <div className={`${NC} p-4`} style={{ boxShadow: "0 0 15px rgba(245,193,0,0.04)" }}>
        <div className="text-[10px] text-yellow-400/80 uppercase tracking-widest mb-3">Sažetak platforme</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2">
          {[
            { label: "Ukupno registriranih", value: stats.totalUsers },
            { label: "Novi ovaj tjedan", value: `+${stats.newUsers7d}`, color: "text-cyan-400" },
            { label: "Novi ovaj mjesec", value: `+${stats.newUsers30d}`, color: "text-cyan-300" },
            { label: "Banirani", value: stats.bannedUsers, color: stats.bannedUsers > 0 ? "text-red-400" : undefined },
            { label: "Ukupno oglasa", value: stats.totalListings },
            { label: "Aktivni oglasi", value: stats.activeListings, color: "text-green-400" },
            { label: "Na moderaciji", value: stats.pendingListings, color: stats.pendingListings > 0 ? "text-yellow-400" : undefined },
            { label: "Odbijeni", value: stats.rejectedListings, color: stats.rejectedListings > 0 ? "text-red-400" : undefined },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
              <span className="text-[11px] text-muted-foreground">{r.label}</span>
              <span className={`text-[11px] font-bold ${r.color ?? "text-foreground"}`}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
