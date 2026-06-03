import { useState, useEffect, useCallback } from "react";
import { apiFetch, fmtDate, NC } from "../lib/api";

interface AdminListing {
  id: string; title: string; category: string; status: string;
  moderationStatus: string; moderationNote: string | null;
  imageUris: string[]; createdAt: number; userName: string; userId: string;
}

const SC: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border border-green-500/30",
  pending: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30",
  rejected: "bg-red-500/10 text-red-400 border border-red-500/30",
};
const SL: Record<string, string> = { active: "Aktivan", pending: "Čeka", rejected: "Odbijen" };

export function ListingsPage() {
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [actionId, setActionId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteId, setNoteId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/listings?status=${filter}`)
      .then(r => r.json())
      .then((d: { listings: AdminListing[] }) => setListings(d.listings ?? []))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(load, [load]);

  const moderate = async (id: string, status: "active" | "rejected", noteText?: string) => {
    setActionId(id);
    await apiFetch(`/listings/${id}`, { method: "PATCH", body: JSON.stringify({ moderationStatus: status, moderationNote: noteText ?? null }) });
    setActionId(null); setNoteId(null); setNote(""); load();
  };

  const del = async (id: string) => {
    if (!confirm("Obriši oglas?")) return;
    setActionId(id + "_d");
    await apiFetch(`/listings/${id}`, { method: "DELETE" });
    setActionId(null); load();
  };

  const tabs = ["pending", "active", "rejected"] as const;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-sm font-black text-yellow-400 uppercase tracking-widest">Oglasi</h1>
        <div className="flex gap-0.5 bg-muted/60 rounded-lg p-0.5 ml-auto">
          {tabs.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${filter === s ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40" : "text-muted-foreground hover:text-foreground"}`}>
              {s === "pending" ? "Na čekanju" : s === "active" ? "Aktivni" : "Odbijeni"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground animate-pulse">Učitavanje…</div>
      ) : listings.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-16">Nema oglasa u ovoj kategoriji.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {listings.map(l => (
            <div key={l.id} className={`${NC} p-3 flex gap-3`} style={{ boxShadow: "0 0 10px rgba(245,193,0,0.03)" }}>
              {l.imageUris[0] ? (
                <img src={l.imageUris[0]} alt="" className="w-14 h-14 object-cover rounded-lg shrink-0 bg-muted" />
              ) : (
                <div className="w-14 h-14 rounded-lg shrink-0 bg-muted/60 flex items-center justify-center text-xl">📦</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                  <div className="min-w-0">
                    <div className="font-bold text-foreground text-xs truncate">{l.title}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">@{l.userName} · {l.category} · {fmtDate(l.createdAt)}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SC[l.moderationStatus] ?? "bg-muted text-muted-foreground"}`}>
                    {SL[l.moderationStatus] ?? l.moderationStatus}
                  </span>
                </div>
                {l.moderationNote && (
                  <div className="text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-0.5 mb-1">{l.moderationNote}</div>
                )}
                {noteId === l.id && (
                  <input className="w-full bg-input border border-yellow-500/30 rounded px-2 py-0.5 text-[11px] text-foreground mb-1 focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                    placeholder="Razlog odbijanja" value={note} onChange={e => setNote(e.target.value)} />
                )}
                <div className="flex gap-1.5 flex-wrap">
                  {l.moderationStatus !== "active" && (
                    <button onClick={() => moderate(l.id, "active")} disabled={actionId === l.id}
                      className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 rounded px-2.5 py-0.5 font-semibold disabled:opacity-50 transition-colors">
                      ✓ Odobri
                    </button>
                  )}
                  {l.moderationStatus !== "rejected" && (
                    noteId === l.id ? (
                      <button onClick={() => moderate(l.id, "rejected", note)} disabled={actionId === l.id}
                        className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 rounded px-2.5 py-0.5 font-semibold disabled:opacity-50 transition-colors">
                        ✕ Potvrdi odbijanje
                      </button>
                    ) : (
                      <button onClick={() => { setNoteId(l.id); setNote(""); }}
                        className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 rounded px-2.5 py-0.5 font-semibold transition-colors">
                        ✕ Odbij
                      </button>
                    )
                  )}
                  {noteId === l.id && (
                    <button onClick={() => setNoteId(null)}
                      className="text-[10px] text-muted-foreground hover:text-foreground rounded px-2 py-0.5 transition-colors">
                      Odustani
                    </button>
                  )}
                  <button onClick={() => del(l.id)} disabled={actionId === l.id + "_d"}
                    className="text-[10px] text-muted-foreground hover:text-red-400 rounded px-2 py-0.5 transition-colors disabled:opacity-50 ml-auto">
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
