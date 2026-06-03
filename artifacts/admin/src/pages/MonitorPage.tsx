import { useState, useEffect } from "react";
import { NC } from "../lib/api";

interface Check { name: string; status: "ok" | "error" | "warn"; detail?: string; latencyMs: number }
interface MonitorStatus { ok: boolean; checks: Check[] }

const DOT: Record<string, string> = { ok: "bg-green-500", error: "bg-red-500", warn: "bg-yellow-400" };

function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("admin_token");
  return fetch(`/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts?.headers },
  });
}

export function MonitorPage() {
  const [data, setData] = useState<MonitorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [tgTestLoading, setTgTestLoading] = useState(false);
  const [tgTestResult, setTgTestResult] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/monitor/status");
      const d = await r.json() as MonitorStatus;
      setData(d); setLastRefresh(new Date());
    } catch { setData(null); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, []);

  const sendTestAlert = async () => {
    setTestLoading(true); setTestResult(null);
    try {
      const r = await apiFetch("/monitor/test-alert", { method: "POST" });
      const d = await r.json() as { ok: boolean; message?: string };
      setTestResult(d.ok ? "✅ Test email poslan!" : `❌ ${d.message ?? "Greška"}`);
    } catch { setTestResult("❌ Greška slanja"); }
    finally { setTestLoading(false); }
  };

  const sendTgTest = async () => {
    setTgTestLoading(true); setTgTestResult(null);
    try {
      const r = await apiFetch("/monitor/test-telegram", { method: "POST" });
      const d = await r.json() as { ok: boolean; message?: string };
      setTgTestResult(d.ok ? "✅ Telegram poruka poslana!" : `❌ ${d.message ?? "TELEGRAM_BOT_TOKEN ili TELEGRAM_CHAT_ID nije postavljen"}`);
    } catch { setTgTestResult("❌ Greška slanja"); }
    finally { setTgTestLoading(false); }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-black text-yellow-400 uppercase tracking-widest">Monitor</h1>
        <div className={`w-2.5 h-2.5 rounded-full ${data ? (data.ok ? "bg-green-500" : "bg-red-500") : "bg-muted"} animate-pulse`} />
        <span className="text-[11px] text-muted-foreground">{data?.ok ? "Sve radi" : data ? "Greška" : "Provjera…"}</span>
        <button onClick={refresh} className="ml-auto text-[11px] text-muted-foreground hover:text-yellow-400 px-2 py-1 rounded hover:bg-yellow-500/10 transition-colors">↻ Osvježi</button>
      </div>

      {lastRefresh && (
        <div className="text-[10px] text-muted-foreground">Zadnja provjera: {lastRefresh.toLocaleTimeString("hr-HR")} · auto svakih 30s</div>
      )}

      {loading && !data ? (
        <div className="text-xs text-muted-foreground animate-pulse">Provjera servisa…</div>
      ) : data ? (
        <div className={`${NC} overflow-hidden`} style={{ boxShadow: "0 0 20px rgba(245,193,0,0.04)" }}>
          {data.checks.map((c, i) => (
            <div key={c.name} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border/30" : ""} hover:bg-yellow-500/5 transition-colors`}>
              <div className={`w-2 h-2 rounded-full shrink-0 ${DOT[c.status] ?? "bg-muted"}`} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground">{c.name}</div>
                {c.detail && <div className="text-[10px] text-muted-foreground mt-0.5">{c.detail}</div>}
              </div>
              <div className="text-right shrink-0">
                <div className={`text-xs font-bold ${c.status === "ok" ? "text-green-400" : c.status === "warn" ? "text-yellow-400" : "text-red-400"}`}>
                  {c.status === "ok" ? "OK" : c.status === "warn" ? "UPOZORENJE" : "GREŠKA"}
                </div>
                {c.latencyMs > 0 && <div className="text-[10px] text-muted-foreground">{c.latencyMs}ms</div>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-xs">❌ Ne mogu dohvatiti status servera</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`${NC} p-4 space-y-2.5`} style={{ boxShadow: "0 0 10px rgba(245,193,0,0.03)" }}>
          <div className="text-[10px] text-yellow-400/80 uppercase tracking-widest">📧 Email alert</div>
          <p className="text-[11px] text-muted-foreground">Auto-šalje se kad server ima grešku (max 1× / 15 min).</p>
          <button onClick={sendTestAlert} disabled={testLoading}
            className="text-xs bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 font-bold rounded-lg px-4 py-2 hover:bg-yellow-500/25 disabled:opacity-50 transition-colors">
            {testLoading ? "Šaljem…" : "Pošalji test email"}
          </button>
          {testResult && <div className="text-[11px] font-medium">{testResult}</div>}
        </div>

        <div className={`${NC} p-4 space-y-2.5`} style={{ boxShadow: "0 0 10px rgba(245,193,0,0.03)" }}>
          <div className="text-[10px] text-yellow-400/80 uppercase tracking-widest">💬 Telegram bot</div>
          <p className="text-[11px] text-muted-foreground">Notifikacije za: novi user, flagged oglas, sistemska greška.</p>
          <button onClick={sendTgTest} disabled={tgTestLoading}
            className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold rounded-lg px-4 py-2 hover:bg-cyan-500/20 disabled:opacity-50 transition-colors">
            {tgTestLoading ? "Šaljem…" : "Pošalji test poruku"}
          </button>
          {tgTestResult && <div className="text-[11px] font-medium">{tgTestResult}</div>}
        </div>
      </div>
    </div>
  );
}
