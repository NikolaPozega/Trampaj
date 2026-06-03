import { useState } from "react";
import { apiFetch, NC } from "../lib/api";

export function PushPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ sent: number; errors: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!title.trim() || !message.trim()) return;
    if (!confirm(`Pošalji push svim korisnicima?\n\nNaslov: ${title}\nPoruka: ${message}`)) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const r = await apiFetch("/push-broadcast", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), body: message.trim() }),
      });
      const d = await r.json() as { sent?: number; errors?: number; error?: string };
      if (!r.ok) { setError(d.error ?? "Greška"); return; }
      setResult({ sent: d.sent ?? 0, errors: d.errors ?? 0 });
      setTitle(""); setMessage("");
    } catch {
      setError("Greška veze.");
    } finally { setLoading(false); }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <h1 className="text-sm font-black text-yellow-400 uppercase tracking-widest">Push poruke</h1>

      <div className={`${NC} p-4 space-y-3`} style={{ boxShadow: "0 0 20px rgba(245,193,0,0.05)" }}>
        <div className="text-[10px] text-yellow-400/80 uppercase tracking-widest mb-1">Nova broadcast poruka</div>

        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Naslov</label>
          <input
            className="w-full bg-input border border-yellow-500/20 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-yellow-500/50 transition-all"
            placeholder="npr. Novo na Trampaj.hr!"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={50}
          />
          <div className="text-[9px] text-muted-foreground text-right mt-0.5">{title.length}/50</div>
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Poruka</label>
          <textarea
            className="w-full bg-input border border-yellow-500/20 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-yellow-500/50 transition-all resize-none"
            placeholder="npr. Pogledaj najnovije ponude za trampu!"
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={4}
            maxLength={200}
          />
          <div className="text-[9px] text-muted-foreground text-right mt-0.5">{message.length}/200</div>
        </div>

        <button
          onClick={send}
          disabled={loading || !title.trim() || !message.trim()}
          className="w-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 hover:bg-yellow-500/30 font-bold rounded-lg py-2.5 text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ boxShadow: loading ? "none" : "0 0 15px rgba(245,193,0,0.1)" }}
        >
          {loading ? "Šaljem…" : "📨 Pošalji svim korisnicima"}
        </button>

        {error && (
          <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">❌ {error}</div>
        )}
        {result && (
          <div className="text-[11px] bg-green-500/10 border border-green-500/20 rounded-lg p-2.5 space-y-0.5">
            <div className="text-green-400 font-bold">✅ Push poruka poslana!</div>
            <div className="text-muted-foreground">Uspješno: <span className="text-green-400 font-bold">{result.sent}</span> korisnika</div>
            {result.errors > 0 && <div className="text-muted-foreground">Neuspješno: <span className="text-red-400 font-bold">{result.errors}</span></div>}
          </div>
        )}
      </div>

      <div className={`${NC} p-4`} style={{ boxShadow: "0 0 10px rgba(245,193,0,0.03)" }}>
        <div className="text-[10px] text-yellow-400/80 uppercase tracking-widest mb-2">Info</div>
        <ul className="text-[11px] text-muted-foreground space-y-1.5">
          <li>• Poruka se šalje svim korisnicima koji imaju instaliranu app i uključene push notifikacije</li>
          <li>• Koristiti samo za važne obavijesti (novi feature, akcija, tech problem)</li>
          <li>• Previše poruka = korisnici isključe notifikacije</li>
        </ul>
      </div>
    </div>
  );
}
