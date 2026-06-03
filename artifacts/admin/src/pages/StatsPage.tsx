import { useState, useEffect } from "react";
import { apiFetch, NC } from "../lib/api";

interface Stats {
  totalListings: number; activeListings: number; pendingListings: number; rejectedListings: number;
  totalUsers: number; bannedUsers: number;
  newListings7d: number; newUsers7d: number; newUsers30d: number;
  approvalRate: number | null; earlyAdopters?: number;
  categoryBreakdown: { category: string; count: number }[];
  topCities: { city: string; count: number }[];
}

function Bar({ data, color = "#F5C100" }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex flex-col gap-1.5">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-2 text-[11px]">
          <div className="w-24 shrink-0 text-muted-foreground truncate text-right">{d.label}</div>
          <div className="flex-1 bg-muted/60 rounded h-4 overflow-hidden">
            <div className="h-full rounded transition-all duration-500" style={{ width: `${Math.max((d.value / max) * 100, 2)}%`, backgroundColor: color }} />
          </div>
          <div className="w-6 text-right font-bold text-foreground">{d.value}</div>
        </div>
      ))}
    </div>
  );
}

function MetricRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`text-[11px] font-bold ${color ?? "text-foreground"}`}>{value}</span>
    </div>
  );
}

export function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiFetch("/stats").then(r => r.json()).then((d: Stats) => setStats(d)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <div className="p-6 text-xs text-muted-foreground animate-pulse">Učitavanje…</div>;
  if (!stats) return <div className="p-6 text-xs text-destructive">Greška.</div>;

  const moderated = stats.activeListings + stats.rejectedListings;
  const approvalPct = moderated > 0 ? Math.round((stats.activeListings / moderated) * 100) : null;
  const pendingPct = stats.totalListings > 0 ? Math.round((stats.pendingListings / stats.totalListings) * 100) : 0;
  const rejectedPct = moderated > 0 ? Math.round((stats.rejectedListings / moderated) * 100) : 0;
  const bannedPct = stats.totalUsers > 0 ? ((stats.bannedUsers / stats.totalUsers) * 100).toFixed(1) : "0";

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-black text-yellow-400 uppercase tracking-widest">Statistike platforme</h1>
        <button onClick={load} className="text-[11px] text-muted-foreground hover:text-yellow-400 transition-colors px-2 py-1 rounded hover:bg-yellow-500/10">↻ Osvježi</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${NC} p-4`} style={{ boxShadow: "0 0 15px rgba(245,193,0,0.04)" }}>
          <div className="text-[10px] text-yellow-400/80 uppercase tracking-widest mb-3">Korisnici</div>
          <MetricRow label="Ukupno registriranih" value={stats.totalUsers} />
          <MetricRow label="Novi (7 dana)" value={`+${stats.newUsers7d}`} color="text-cyan-400" />
          <MetricRow label="Novi (30 dana)" value={`+${stats.newUsers30d}`} color="text-cyan-300" />
          <MetricRow label="Banirani" value={`${stats.bannedUsers} (${bannedPct}%)`} color={stats.bannedUsers > 0 ? "text-red-400" : undefined} />
          <MetricRow label="Early Adopters" value={`${stats.earlyAdopters ?? 0} / 500`} color="text-yellow-300" />
        </div>

        <div className={`${NC} p-4`} style={{ boxShadow: "0 0 15px rgba(245,193,0,0.04)" }}>
          <div className="text-[10px] text-yellow-400/80 uppercase tracking-widest mb-3">Oglasi</div>
          <MetricRow label="Ukupno" value={stats.totalListings} />
          <MetricRow label="Aktivni" value={`${stats.activeListings}`} color="text-green-400" />
          <MetricRow label="Na moderaciji" value={`${stats.pendingListings} (${pendingPct}%)`} color={stats.pendingListings > 0 ? "text-yellow-400" : undefined} />
          <MetricRow label="Odbijeni" value={`${stats.rejectedListings} (${rejectedPct}%)`} color={stats.rejectedListings > 0 ? "text-red-400" : undefined} />
          <MetricRow label="Novi (7 dana)" value={`+${stats.newListings7d}`} color="text-yellow-400" />
        </div>

        <div className={`${NC} p-4`} style={{ boxShadow: "0 0 15px rgba(245,193,0,0.04)" }}>
          <div className="text-[10px] text-yellow-400/80 uppercase tracking-widest mb-3">Moderacija AI</div>
          <div className="space-y-2.5 mt-1">
            {[
              { label: "Odobreni", pct: stats.totalListings > 0 ? (stats.activeListings / stats.totalListings) * 100 : 0, color: "#22C55E", val: `${approvalPct ?? "—"}%` },
              { label: "Odbijeni", pct: stats.totalListings > 0 ? (stats.rejectedListings / stats.totalListings) * 100 : 0, color: "#EF4444", val: `${rejectedPct}%` },
              { label: "Na čekanju", pct: stats.totalListings > 0 ? (stats.pendingListings / stats.totalListings) * 100 : 0, color: "#F5C100", val: `${pendingPct}%` },
            ].map(r => (
              <div key={r.label}>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-bold" style={{ color: r.color }}>{r.val}</span>
                </div>
                <div className="h-1.5 bg-muted/60 rounded-full">
                  <div className="h-full rounded-full" style={{ width: `${r.pct}%`, backgroundColor: r.color }} />
                </div>
              </div>
            ))}
            <div className="text-[10px] text-center text-muted-foreground pt-1">
              AI odobrava <span className="text-green-400 font-bold">{approvalPct ?? "—"}%</span> moderiranih
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`${NC} p-4`} style={{ boxShadow: "0 0 15px rgba(245,193,0,0.04)" }}>
          <div className="text-[10px] text-yellow-400/80 uppercase tracking-widest mb-3">Kategorije</div>
          {stats.categoryBreakdown.length > 0
            ? <Bar data={stats.categoryBreakdown.map(c => ({ label: c.category, value: c.count }))} color="#F5C100" />
            : <div className="text-xs text-muted-foreground text-center py-4">Nema podataka</div>}
        </div>
        <div className={`${NC} p-4`} style={{ boxShadow: "0 0 15px rgba(245,193,0,0.04)" }}>
          <div className="text-[10px] text-yellow-400/80 uppercase tracking-widest mb-3">Top gradovi</div>
          {stats.topCities.length > 0
            ? <Bar data={stats.topCities.map(c => ({ label: c.city || "—", value: c.count }))} color="#38BDF8" />
            : <div className="text-xs text-muted-foreground text-center py-4">Nema podataka</div>}
        </div>
      </div>

      <div className={`${NC} p-4`} style={{ boxShadow: "0 0 15px rgba(245,193,0,0.04)" }}>
        <div className="text-[10px] text-yellow-400/80 uppercase tracking-widest mb-2">Napomena o metrikama</div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Zadržavanje (7d/30d), funnel konverzije i geografska koncentracija bit će dostupni nakon dužeg prikupljanja podataka.
          Trenutno se prate: registracije, aktivni oglasi, moderacija, te early adopter kampanja.
        </p>
      </div>
    </div>
  );
}
