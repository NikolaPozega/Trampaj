import { useState, useEffect } from "react";
import { apiFetch, fmtDate, NC } from "../lib/api";

interface EAUser {
  id: string; username: string; email: string;
  earlyAdopter: boolean; deliveryDiscountUsed: boolean; createdAt: number;
}

interface EAData {
  count: number; limit: number; remaining: number; users: EAUser[];
}

export function EarlyAdoptersPage() {
  const [data, setData] = useState<EAData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    apiFetch("/early-adopters").then(r => r.json())
      .then((d: EAData) => setData(d))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggleDiscount = async (id: string, used: boolean) => {
    setActionId(id);
    await apiFetch(`/users/${id}`, { method: "PATCH", body: JSON.stringify({ deliveryDiscountUsed: !used }) });
    setActionId(null); load();
  };

  if (loading) return <div className="p-6 text-xs text-muted-foreground animate-pulse">Učitavanje…</div>;
  if (!data) return <div className="p-6 text-xs text-destructive">Greška.</div>;

  const pct = Math.min((data.count / data.limit) * 100, 100);
  const discountUsed = data.users.filter(u => u.deliveryDiscountUsed).length;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-black text-yellow-400 uppercase tracking-widest">Early Adopters</h1>
        <button onClick={load} className="text-[11px] text-muted-foreground hover:text-yellow-400 transition-colors px-2 py-1 rounded hover:bg-yellow-500/10">↻ Osvježi</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: "Ukupno Early Adopters", value: `${data.count} / ${data.limit}`, color: "text-yellow-400", icon: "🌟" },
          { label: "Preostalih mjesta", value: data.remaining, color: data.remaining < 50 ? "text-red-400" : "text-green-400", icon: "🎟️" },
          { label: "Diskont iskorišten", value: `${discountUsed} / ${data.count}`, color: "text-cyan-400", icon: "🎁" },
        ].map(c => (
          <div key={c.label} className={`${NC} p-3`} style={{ boxShadow: "0 0 15px rgba(245,193,0,0.04)" }}>
            <div className="text-xl mb-1.5">{c.icon}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{c.label}</div>
            <div className={`text-2xl font-black ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className={`${NC} p-4`} style={{ boxShadow: "0 0 15px rgba(245,193,0,0.04)" }}>
        <div className="flex justify-between text-[11px] mb-1.5">
          <span className="text-muted-foreground">Popunjenost kampanje</span>
          <span className="text-yellow-400 font-bold">{pct.toFixed(1)}%</span>
        </div>
        <div className="h-2.5 bg-muted/60 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
               style={{ width: `${pct}%`, background: "linear-gradient(90deg, #F5C100, #FFD740)" }} />
        </div>
        <div className="text-[10px] text-muted-foreground mt-1.5">
          {data.remaining > 0 ? `Još ${data.remaining} mjesta dostupno` : "🎉 Kampanja je popunjena! Svih 500 mjesta iskorišteno."}
        </div>
      </div>

      {data.users.length === 0 ? (
        <div className={`${NC} p-8 text-center text-xs text-muted-foreground`}>
          Još nema early adopters. Korisnici postaju early adopters kad registriraju račun i objave prvi oglas (dok ima mjesta).
        </div>
      ) : (
        <div className={`${NC} overflow-hidden`} style={{ boxShadow: "0 0 15px rgba(245,193,0,0.04)" }}>
          <div className="px-4 py-2.5 border-b border-yellow-500/10">
            <span className="text-[10px] text-yellow-400/80 uppercase tracking-widest">Lista Early Adopters ({data.count})</span>
          </div>
          <div className="hidden md:block">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left px-4 py-2 text-[10px] text-muted-foreground uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-2 text-[10px] text-muted-foreground uppercase tracking-wider">Korisnik</th>
                  <th className="text-left px-4 py-2 text-[10px] text-muted-foreground uppercase tracking-wider">Registriran</th>
                  <th className="text-center px-4 py-2 text-[10px] text-muted-foreground uppercase tracking-wider">Diskont</th>
                  <th className="text-right px-4 py-2 text-[10px] text-muted-foreground uppercase tracking-wider">Akcija</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u, i) => (
                  <tr key={u.id} className={`border-b border-border/20 hover:bg-yellow-500/5 transition-colors ${i % 2 ? "bg-accent/5" : ""}`}>
                    <td className="px-4 py-2 text-muted-foreground font-mono">#{i + 1}</td>
                    <td className="px-4 py-2">
                      <div className="font-semibold text-foreground">@{u.username}</div>
                      <div className="text-[10px] text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-2 text-center">
                      {u.deliveryDiscountUsed
                        ? <span className="text-[9px] bg-green-500/15 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-bold">✓ Iskorišten</span>
                        : <span className="text-[9px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full font-bold">Dostupan</span>
                      }
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        disabled={actionId === u.id}
                        onClick={() => toggleDiscount(u.id, u.deliveryDiscountUsed)}
                        className="text-[10px] px-2 py-0.5 rounded border font-bold disabled:opacity-40 transition-colors bg-muted/30 text-muted-foreground border-border hover:text-foreground"
                      >
                        {u.deliveryDiscountUsed ? "Poništi" : "Označi iskorišten"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile */}
          <div className="md:hidden divide-y divide-border/30">
            {data.users.map((u, i) => (
              <div key={u.id} className="px-4 py-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-bold text-foreground">#{i + 1} @{u.username}</div>
                  <div className="text-[10px] text-muted-foreground">{u.email} · {fmtDate(u.createdAt)}</div>
                </div>
                <div className="text-right">
                  {u.deliveryDiscountUsed
                    ? <span className="text-[9px] bg-green-500/15 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full font-bold">✓</span>
                    : <span className="text-[9px] bg-yellow-500/10 text-yellow-400/70 border border-yellow-500/20 px-1.5 py-0.5 rounded-full">↗</span>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
