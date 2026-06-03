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

export function SocialPage() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const load = () => {
    setLoading(true);
    apiFetch("/admin/social-posts").then(r => r.json())
      .then((d: { posts: SocialPost[] }) => setPosts(d.posts ?? []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const deletePost = async (id: string, platform: string, postDbId: string) => {
    if (!confirm(`Obriši ovu ${platform} objavu s platforme i iz baze?`)) return;
    setActionId(postDbId);
    await apiFetch(`/admin/social-posts/${postDbId}`, { method: "DELETE" });
    setActionId(null); load();
  };

  const startEdit = (post: SocialPost) => {
    setEditId(post.id);
    setEditCaption(post.caption);
  };

  const saveEdit = async (postDbId: string) => {
    setEditLoading(true);
    await apiFetch(`/admin/social-posts/${postDbId}`, {
      method: "PATCH",
      body: JSON.stringify({ caption: editCaption }),
    });
    setEditLoading(false); setEditId(null); load();
  };

  const testPost = async () => {
    setTestLoading(true); setTestResult(null);
    try {
      const r = await apiFetch("/social/test", { method: "POST" });
      const d = await r.json() as { results?: Record<string, string>; ok?: boolean };
      if (d.results) {
        const lines = Object.entries(d.results).map(([k, v]) => `${k}: ${v}`).join(", ");
        setTestResult(`Test: ${lines}`);
      } else {
        setTestResult("OK");
      }
    } catch {
      setTestResult("Greška veze");
    } finally { setTestLoading(false); }
  };

  const fbCount = posts.filter(p => p.platform === "facebook" && p.status === "published").length;
  const igCount = posts.filter(p => p.platform === "instagram" && p.status === "published").length;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-sm font-black text-yellow-400 uppercase tracking-widest">Social Media Hub</h1>
        <div className="flex gap-2">
          <button onClick={testPost} disabled={testLoading}
            className="text-[11px] bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg font-bold disabled:opacity-40 transition-colors">
            {testLoading ? "Šaljem…" : "📤 Test objava"}
          </button>
          <button onClick={load} className="text-[11px] text-muted-foreground hover:text-yellow-400 transition-colors px-2 py-1 rounded hover:bg-yellow-500/10">↻</button>
        </div>
      </div>

      {testResult && (
        <div className="text-[11px] bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 text-blue-300">{testResult}</div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Ukupno objava", value: posts.filter(p => p.status === "published").length, color: "text-yellow-400", icon: "📊" },
          { label: "Facebook", value: fbCount, color: "text-blue-400", icon: "📘" },
          { label: "Instagram", value: igCount, color: "text-pink-400", icon: "📸" },
        ].map(c => (
          <div key={c.label} className={`${NC} p-3`} style={{ boxShadow: "0 0 10px rgba(245,193,0,0.03)" }}>
            <div className="text-lg mb-1">{c.icon}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">{c.label}</div>
            <div className={`text-2xl font-black ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground animate-pulse">Učitavanje objava…</div>
      ) : posts.length === 0 ? (
        <div className={`${NC} p-10 text-center text-xs text-muted-foreground`}>
          Nema evidentiranih social media objava. Objave se bilježe automatski kad korisnik objavi oglas.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map(post => {
            const isFb = post.platform === "facebook";
            const isDeleted = post.status === "deleted";
            return (
              <div key={post.id} className={`${NC} p-3 ${isDeleted ? "opacity-50" : ""}`} style={{ boxShadow: "0 0 10px rgba(245,193,0,0.03)" }}>
                <div className="flex gap-3">
                  {post.imageUrl && (
                    <img src={post.imageUrl} alt="" className="w-16 h-16 object-cover rounded-lg shrink-0 bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap mb-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${isFb ? "bg-blue-500/15 text-blue-400 border-blue-500/30" : "bg-pink-500/15 text-pink-400 border-pink-500/30"}`}>
                        {isFb ? "📘 Facebook" : "📸 Instagram"}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${post.status === "published" ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-muted text-muted-foreground border-border"}`}>
                        {post.status === "published" ? "✓ Objavljeno" : post.status === "deleted" ? "🗑 Obrisano" : "❌ Greška"}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{fmtDate(post.createdAt)}</span>
                    </div>
                    {post.listingTitle && (
                      <div className="text-[10px] text-yellow-400/70 mb-1">Oglas: {post.listingTitle}</div>
                    )}

                    {editId === post.id ? (
                      <div className="space-y-2">
                        <textarea
                          className="w-full bg-input border border-yellow-500/30 rounded px-2 py-1.5 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-yellow-500/50 resize-none"
                          value={editCaption} onChange={e => setEditCaption(e.target.value)}
                          rows={4}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(post.id)} disabled={editLoading}
                            className="text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 px-3 py-1 rounded font-bold disabled:opacity-40 transition-colors">
                            {editLoading ? "Sprema…" : "✓ Spremi (FB)"}
                          </button>
                          <button onClick={() => setEditId(null)}
                            className="text-[10px] text-muted-foreground hover:text-foreground px-3 py-1 rounded transition-colors">
                            Odustani
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-muted-foreground line-clamp-3 leading-relaxed">{post.caption}</div>
                    )}

                    {post.errorMessage && (
                      <div className="mt-1 text-[10px] text-red-400/80 bg-red-500/5 border border-red-500/20 rounded px-2 py-1">{post.errorMessage}</div>
                    )}
                  </div>
                </div>

                {!isDeleted && editId !== post.id && (
                  <div className="flex gap-1.5 mt-2.5 pt-2.5 border-t border-border/30">
                    {isFb && (
                      <button onClick={() => startEdit(post)}
                        className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 px-2.5 py-1 rounded font-bold transition-colors">
                        ✏️ Uredi tekst (FB)
                      </button>
                    )}
                    <button onClick={() => deletePost(post.id, post.platform, post.id)} disabled={actionId === post.id}
                      className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 px-2.5 py-1 rounded font-bold disabled:opacity-40 transition-colors">
                      🗑 Obriši s platforme
                    </button>
                    <a href={`https://facebook.com/${post.postId}`} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors ml-auto">
                      Otvori ↗
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
