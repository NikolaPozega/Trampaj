import { useState, useEffect } from "react";
import { NC } from "../lib/api";

interface SocialPost {
  id: string; platform: string; postId: string;
  listingId: string | null; listingTitle: string;
  caption: string; imageUrl: string | null;
  status: string; errorMessage: string | null;
  createdAt: number;
}

function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("admin_token");
  return fetch(`/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts?.headers },
  });
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("hr-HR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const PLATFORM_META: Record<string, { label: string; icon: string; color: string; cls: string }> = {
  facebook:  { label: "Facebook",  icon: "📘", color: "#1877F2", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  instagram: { label: "Instagram", icon: "📸", color: "#E1306C", cls: "bg-pink-500/15 text-pink-400 border-pink-500/30" },
  tiktok:    { label: "TikTok",    icon: "🎵", color: "#010101", cls: "bg-white/10 text-white border-white/20" },
};

const PLATFORM_LINK: Record<string, (postId: string) => string> = {
  facebook:  id => `https://www.facebook.com/${id}`,
  instagram: id => `https://www.instagram.com/p/${id}/`,
  tiktok:    id => id.startsWith("http") ? id : `https://www.tiktok.com/@trampajhr/video/${id}`,
};

export function SocialPage() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  // TikTok manual log modal
  const [tiktokOpen, setTiktokOpen] = useState(false);
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [tiktokCaption, setTiktokCaption] = useState("");
  const [tiktokLoading, setTiktokLoading] = useState(false);
  const [tiktokErr, setTiktokErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    apiFetch("/admin/social-posts").then(r => r.json())
      .then((d: { posts: SocialPost[] }) => setPosts(d.posts ?? []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const deletePost = async (id: string) => {
    if (!confirm("Obriši ovu objavu s platforme i iz baze?")) return;
    setActionId(id);
    await apiFetch(`/admin/social-posts/${id}`, { method: "DELETE" });
    setActionId(null); load();
  };

  const startEdit = (post: SocialPost) => { setEditId(post.id); setEditCaption(post.caption); };

  const saveEdit = async (id: string) => {
    setEditLoading(true);
    await apiFetch(`/admin/social-posts/${id}`, { method: "PATCH", body: JSON.stringify({ caption: editCaption }) });
    setEditLoading(false); setEditId(null); load();
  };

  const testPost = async () => {
    setTestLoading(true); setTestResult(null);
    try {
      const r = await apiFetch("/social/test", { method: "POST" });
      const d = await r.json() as { results?: Record<string, string> };
      if (d.results) setTestResult(Object.entries(d.results).map(([k, v]) => `${k}: ${v}`).join(", "));
      else setTestResult("OK");
    } catch { setTestResult("Greška veze"); }
    finally { setTestLoading(false); }
  };

  const logTiktok = async () => {
    if (!tiktokUrl.trim()) { setTiktokErr("Unesite URL videa."); return; }
    setTiktokLoading(true); setTiktokErr(null);
    try {
      const r = await apiFetch("/admin/social-posts/manual", {
        method: "POST",
        body: JSON.stringify({
          platform: "tiktok",
          postId: tiktokUrl.trim(),
          caption: tiktokCaption.trim(),
        }),
      });
      const d = await r.json() as { ok?: boolean; error?: string };
      if (!d.ok) { setTiktokErr(d.error ?? "Greška"); return; }
      setTiktokOpen(false); setTiktokUrl(""); setTiktokCaption(""); load();
    } catch { setTiktokErr("Greška veze."); }
    finally { setTiktokLoading(false); }
  };

  const byPlatform = (pl: string) => posts.filter(p => p.platform === pl && p.status === "published").length;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-sm font-black text-yellow-400 uppercase tracking-widest">Social Media Hub</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setTiktokOpen(true)}
            className="text-[11px] bg-white/10 text-white border border-white/20 hover:bg-white/20 px-3 py-1.5 rounded-lg font-bold transition-colors">
            🎵 Log TikTok objavu
          </button>
          <button onClick={testPost} disabled={testLoading}
            className="text-[11px] bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg font-bold disabled:opacity-40 transition-colors">
            {testLoading ? "Šaljem…" : "📤 Test FB/IG"}
          </button>
          <button onClick={load} className="text-[11px] text-muted-foreground hover:text-yellow-400 px-2 py-1 rounded hover:bg-yellow-500/10 transition-colors">↻</button>
        </div>
      </div>

      {testResult && (
        <div className="text-[11px] bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 text-blue-300">{testResult}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Ukupno", value: posts.filter(p => p.status === "published").length, color: "text-yellow-400", icon: "📊" },
          { label: "Facebook", value: byPlatform("facebook"), color: "text-blue-400", icon: "📘" },
          { label: "Instagram", value: byPlatform("instagram"), color: "text-pink-400", icon: "📸" },
          { label: "TikTok", value: byPlatform("tiktok"), color: "text-white", icon: "🎵" },
        ].map(c => (
          <div key={c.label} className={`${NC} p-3`} style={{ boxShadow: "0 0 10px rgba(245,193,0,0.03)" }}>
            <div className="text-base mb-1">{c.icon}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">{c.label}</div>
            <div className={`text-xl font-black ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Posts list */}
      {loading ? (
        <div className="text-xs text-muted-foreground animate-pulse">Učitavanje objava…</div>
      ) : posts.length === 0 ? (
        <div className={`${NC} p-10 text-center text-xs text-muted-foreground`}>
          Nema evidentiranih social media objava.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map(post => {
            const pm = PLATFORM_META[post.platform] ?? { label: post.platform, icon: "📱", cls: "bg-muted text-muted-foreground border-border" };
            const isDeleted = post.status === "deleted";
            const isFb = post.platform === "facebook";
            const postLink = PLATFORM_LINK[post.platform]?.(post.postId);

            return (
              <div key={post.id} className={`${NC} p-3 ${isDeleted ? "opacity-50" : ""}`} style={{ boxShadow: "0 0 10px rgba(245,193,0,0.03)" }}>
                <div className="flex gap-3">
                  {post.imageUrl && (
                    <img src={post.imageUrl} alt="" className="w-14 h-14 object-cover rounded-lg shrink-0 bg-muted" />
                  )}
                  {!post.imageUrl && post.platform === "tiktok" && (
                    <div className="w-14 h-14 rounded-lg shrink-0 bg-black/60 flex items-center justify-center text-2xl">🎵</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-1.5 flex-wrap mb-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${pm.cls}`}>{pm.icon} {pm.label}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                        post.status === "published" ? "bg-green-500/10 text-green-400 border-green-500/30"
                          : post.status === "deleted" ? "bg-muted text-muted-foreground border-border"
                          : "bg-red-500/10 text-red-400 border-red-500/30"
                      }`}>
                        {post.status === "published" ? "✓ Objavljeno" : post.status === "deleted" ? "🗑 Obrisano" : "❌ Greška"}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{fmtDate(post.createdAt)}</span>
                    </div>
                    {post.listingTitle && (
                      <div className="text-[10px] text-yellow-400/70 mb-0.5">Oglas: {post.listingTitle}</div>
                    )}

                    {editId === post.id ? (
                      <div className="space-y-2">
                        <textarea className="w-full bg-input border border-yellow-500/30 rounded px-2 py-1.5 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-yellow-500/50 resize-none"
                          value={editCaption} onChange={e => setEditCaption(e.target.value)} rows={4} />
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(post.id)} disabled={editLoading}
                            className="text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 px-3 py-1 rounded font-bold disabled:opacity-40">
                            {editLoading ? "Sprema…" : "✓ Spremi"}
                          </button>
                          <button onClick={() => setEditId(null)} className="text-[10px] text-muted-foreground px-2 py-1 rounded">Odustani</button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{post.caption}</div>
                    )}

                    {post.errorMessage && (
                      <div className="mt-1 text-[10px] text-red-400/80 bg-red-500/5 border border-red-500/20 rounded px-2 py-1">{post.errorMessage}</div>
                    )}
                  </div>
                </div>

                {!isDeleted && editId !== post.id && (
                  <div className="flex gap-1.5 mt-2 pt-2 border-t border-border/30">
                    {isFb && (
                      <button onClick={() => startEdit(post)}
                        className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 px-2.5 py-1 rounded font-bold transition-colors">
                        ✏️ Uredi (FB)
                      </button>
                    )}
                    <button onClick={() => deletePost(post.id)} disabled={actionId === post.id}
                      className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 px-2.5 py-1 rounded font-bold disabled:opacity-40 transition-colors">
                      🗑 Obriši
                    </button>
                    {postLink && (
                      <a href={postLink} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors ml-auto">
                        Otvori ↗
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TikTok log modal */}
      {tiktokOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setTiktokOpen(false)} />
          <div className={`relative ${NC} p-5 w-full max-w-md`} style={{ boxShadow: "0 0 40px rgba(245,193,0,0.08)" }}>
            <h2 className="text-sm font-black text-white mb-4">🎵 Logiraj TikTok objavu</h2>
            <p className="text-[11px] text-muted-foreground mb-4">
              TikTok API ne podržava automatske objave — ručno objavi video na TikToku, zatim upiši URL i caption ovdje za evidenciju.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">URL TikTok videa *</label>
                <input className="w-full bg-input border border-white/20 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-white/40 transition-all"
                  placeholder="https://www.tiktok.com/@trampajhr/video/..."
                  value={tiktokUrl} onChange={e => setTiktokUrl(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Caption (opis)</label>
                <textarea className="w-full bg-input border border-white/20 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-white/40 resize-none transition-all"
                  placeholder="Tekst koji si koristio u opisu videa…"
                  value={tiktokCaption} onChange={e => setTiktokCaption(e.target.value)}
                  rows={3} />
              </div>
              {tiktokErr && <div className="text-[11px] text-red-400">{tiktokErr}</div>}
              <div className="flex gap-2 pt-1">
                <button onClick={logTiktok} disabled={tiktokLoading}
                  className="flex-1 bg-white/15 text-white border border-white/30 hover:bg-white/25 font-bold rounded-lg py-2 text-sm disabled:opacity-40 transition-colors">
                  {tiktokLoading ? "Logira…" : "✓ Logiraj objavu"}
                </button>
                <button onClick={() => setTiktokOpen(false)} className="text-muted-foreground text-sm px-4 rounded-lg hover:text-foreground transition-colors">
                  Odustani
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
