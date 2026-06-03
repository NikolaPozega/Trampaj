import { useState, useEffect } from "react";
import { apiFetch, fmtDate, NC } from "../lib/api";

interface AdminUser {
  id: string; username: string; email: string;
  isAdmin: boolean; isBanned: boolean; isVerified: boolean;
  earlyAdopter?: boolean; deliveryDiscountUsed?: boolean;
  createdAt: number;
}

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    apiFetch("/users").then(r => r.json())
      .then((d: { users: AdminUser[] }) => setUsers(d.users ?? []))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const patch = async (id: string, data: Partial<AdminUser>) => {
    setActionId(id);
    await apiFetch(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    setActionId(null); load();
  };

  const del = async (id: string, username: string) => {
    if (!confirm(`Obriši korisnika @${username}? Ovo će obrisati sve njihove podatke.`)) return;
    setActionId(id + "_del");
    await apiFetch(`/users/${id}`, { method: "DELETE" });
    setActionId(null); load();
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-sm font-black text-yellow-400 uppercase tracking-widest">Korisnici</h1>
        <span className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full border border-border">{users.length} ukupno</span>
        <input className="ml-auto bg-input border border-yellow-500/20 rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-yellow-500/50 w-44"
          placeholder="Pretraži…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground animate-pulse">Učitavanje…</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className={`hidden md:block ${NC} overflow-hidden`} style={{ boxShadow: "0 0 20px rgba(245,193,0,0.04)" }}>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-yellow-500/10">
                  <th className="text-left px-3 py-2 text-[10px] text-yellow-400/70 uppercase tracking-widest">Korisnik</th>
                  <th className="text-left px-3 py-2 text-[10px] text-yellow-400/70 uppercase tracking-widest">Status</th>
                  <th className="text-left px-3 py-2 text-[10px] text-yellow-400/70 uppercase tracking-widest">Registriran</th>
                  <th className="text-right px-3 py-2 text-[10px] text-yellow-400/70 uppercase tracking-widest">Akcije</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => (
                  <tr key={u.id} className={`border-b border-border/30 ${i % 2 === 0 ? "" : "bg-accent/10"} hover:bg-yellow-500/5 transition-colors`}>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-foreground">@{u.username}</div>
                      <div className="text-[10px] text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 flex-wrap">
                        {u.isAdmin && <span className="text-[9px] bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full font-bold">Admin</span>}
                        {u.isBanned && <span className="text-[9px] bg-red-500/15 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-bold">Baniran</span>}
                        {u.isVerified && <span className="text-[9px] bg-green-500/15 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full font-bold">✓</span>}
                        {u.earlyAdopter && <span className="text-[9px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded-full font-bold">🌟 EA</span>}
                        {u.earlyAdopter && u.deliveryDiscountUsed && <span className="text-[9px] bg-purple-500/15 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded-full font-bold">✓ Disk.</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[10px] text-muted-foreground">{fmtDate(u.createdAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end">
                        <button disabled={actionId === u.id} onClick={() => patch(u.id, { isBanned: !u.isBanned })}
                          className={`text-[10px] px-2 py-0.5 rounded font-bold transition-colors disabled:opacity-50 ${u.isBanned ? "bg-green-500/10 text-green-400 border border-green-500/30" : "bg-red-500/10 text-red-400 border border-red-500/30"}`}>
                          {u.isBanned ? "Odbani" : "Baniraj"}
                        </button>
                        <button disabled={actionId === u.id} onClick={() => patch(u.id, { isAdmin: !u.isAdmin })}
                          className="text-[10px] px-2 py-0.5 rounded font-bold bg-muted/60 text-muted-foreground border border-border transition-colors disabled:opacity-50">
                          {u.isAdmin ? "−Admin" : "+Admin"}
                        </button>
                        <button disabled={actionId === u.id + "_del"} onClick={() => del(u.id, u.username)}
                          className="text-[10px] px-2 py-0.5 rounded font-bold bg-red-500/5 text-red-500/60 border border-red-500/20 hover:text-red-400 transition-colors disabled:opacity-50">
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="text-center text-xs text-muted-foreground py-8">Nema korisnika.</div>}
          </div>

          {/* Mobile cards */}
          <div className="md:hidden flex flex-col gap-2">
            {filtered.map(u => (
              <div key={u.id} className={`${NC} p-3`} style={{ boxShadow: "0 0 10px rgba(245,193,0,0.03)" }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-bold text-xs text-foreground">@{u.username}</div>
                    <div className="text-[10px] text-muted-foreground">{u.email}</div>
                    <div className="text-[10px] text-muted-foreground">{fmtDate(u.createdAt)}</div>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {u.isAdmin && <span className="text-[9px] bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full font-bold">Admin</span>}
                    {u.isBanned && <span className="text-[9px] bg-red-500/15 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-bold">Baniran</span>}
                    {u.earlyAdopter && <span className="text-[9px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded-full font-bold">🌟 EA</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button disabled={actionId === u.id} onClick={() => patch(u.id, { isBanned: !u.isBanned })}
                    className={`text-[10px] px-2 py-0.5 rounded font-bold ${u.isBanned ? "bg-green-500/10 text-green-400 border border-green-500/30" : "bg-red-500/10 text-red-400 border border-red-500/30"} disabled:opacity-50`}>
                    {u.isBanned ? "Odbani" : "Baniraj"}
                  </button>
                  <button disabled={actionId === u.id} onClick={() => patch(u.id, { isAdmin: !u.isAdmin })}
                    className="text-[10px] px-2 py-0.5 rounded font-bold bg-muted/60 text-muted-foreground border border-border disabled:opacity-50">
                    {u.isAdmin ? "−Admin" : "+Admin"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
