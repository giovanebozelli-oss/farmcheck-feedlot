import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../context';
import {
  listAllProfiles,
  blockUser,
  unblockUser,
  setUserAdmin,
  type UserProfile,
} from '../lib/supabase';
import {
  Users, Shield, ShieldOff, Lock, Unlock, RefreshCw, AlertCircle, Search, Crown, UserCheck, Loader2,
} from 'lucide-react';

const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const UserManagement: React.FC = () => {
  const { user: currentUser } = useAppStore();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'blocked' | 'admin'>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const all = await listAllProfiles();
      setProfiles(all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  // Bloqueio total — só admin acessa essa tela
  if (currentUser?.role !== 'admin') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-rose-200 p-10 text-center">
        <AlertCircle size={48} className="mx-auto text-rose-400 mb-3" />
        <h2 className="text-lg font-bold text-slate-800 mb-1">Acesso negado</h2>
        <p className="text-sm text-slate-500">Apenas administradores podem gerenciar usuários.</p>
      </div>
    );
  }

  const filtered = useMemo(() => {
    let r = profiles;
    if (filter === 'active') r = r.filter((p) => !p.isBlocked);
    if (filter === 'blocked') r = r.filter((p) => p.isBlocked);
    if (filter === 'admin') r = r.filter((p) => p.role === 'admin');
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.phone.toLowerCase().includes(q)
      );
    }
    return r;
  }, [profiles, filter, search]);

  const counts = useMemo(
    () => ({
      total: profiles.length,
      active: profiles.filter((p) => !p.isBlocked).length,
      blocked: profiles.filter((p) => p.isBlocked).length,
      admins: profiles.filter((p) => p.role === 'admin').length,
    }),
    [profiles]
  );

  const handleBlock = async (p: UserProfile) => {
    if (p.id === currentUser?.id) {
      alert('Você não pode bloquear a si mesmo.');
      return;
    }
    const reason = window.prompt(`Motivo do bloqueio de ${p.name} (opcional):`, '');
    if (reason === null) return;
    setBusyId(p.id);
    const { error } = await blockUser(p.id, reason || undefined);
    setBusyId(null);
    if (error) {
      alert(`Erro ao bloquear: ${error}`);
      return;
    }
    refresh();
  };

  const handleUnblock = async (p: UserProfile) => {
    if (!window.confirm(`Desbloquear ${p.name}?`)) return;
    setBusyId(p.id);
    const { error } = await unblockUser(p.id);
    setBusyId(null);
    if (error) {
      alert(`Erro ao desbloquear: ${error}`);
      return;
    }
    refresh();
  };

  const handleToggleAdmin = async (p: UserProfile) => {
    const action = p.role === 'admin' ? 'rebaixar a usuário comum' : 'promover a administrador';
    if (p.id === currentUser?.id && p.role === 'admin') {
      alert('Você não pode se rebaixar a si mesmo.');
      return;
    }
    if (!window.confirm(`Deseja ${action} ${p.name}?`)) return;
    setBusyId(p.id);
    const { error } = await setUserAdmin(p.id, p.role !== 'admin');
    setBusyId(null);
    if (error) {
      alert(`Erro ao alterar papel: ${error}`);
      return;
    }
    refresh();
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users size={24} className="text-emerald-600" /> Usuários
          </h1>
          <p className="text-slate-500 text-sm">Gerencie os usuários do sistema FarmCheck</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-white border-2 border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CountCard icon={<Users size={18} />} label="Total" value={counts.total} accent="slate" />
        <CountCard icon={<UserCheck size={18} />} label="Ativos" value={counts.active} accent="emerald" />
        <CountCard icon={<Lock size={18} />} label="Bloqueados" value={counts.blocked} accent="rose" />
        <CountCard icon={<Crown size={18} />} label="Admins" value={counts.admins} accent="amber" />
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="flex gap-1 bg-slate-50 rounded-lg p-1">
          {(['all', 'active', 'blocked', 'admin'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                filter === f ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : f === 'blocked' ? 'Bloqueados' : 'Admins'}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome, e-mail ou telefone…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading && profiles.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            <Loader2 size={24} className="mx-auto animate-spin text-emerald-500 mb-2" />
            Carregando usuários…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400 italic">
            Nenhum usuário corresponde aos filtros.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 text-left">Usuário</th>
                  <th className="px-4 py-3 text-left">Contato</th>
                  <th className="px-4 py-3 text-center">Papel</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Último acesso</th>
                  <th className="px-4 py-3 text-center">Criado em</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => {
                  const isMe = p.id === currentUser?.id;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white ${p.role === 'admin' ? 'bg-amber-500' : 'bg-emerald-600'}`}>
                            {p.name.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">
                              {p.name || '(sem nome)'}
                              {isMe && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">VOCÊ</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700">{p.email}</div>
                        <div className="text-slate-400 text-[11px]">{p.phone || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                          p.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {p.role === 'admin' ? 'ADMIN' : 'USUÁRIO'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.isBlocked ? (
                          <span title={p.blockedReason || 'Bloqueado'} className="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-700">
                            BLOQUEADO
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-700">
                            ATIVO
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 font-mono text-[11px]">
                        {formatDate(p.lastLoginAt)}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 font-mono text-[11px]">
                        {formatDate(p.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end items-center gap-1">
                          {/* Botão bloquear/desbloquear */}
                          {p.isBlocked ? (
                            <button
                              onClick={() => handleUnblock(p)}
                              disabled={busyId === p.id}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-30"
                              title="Desbloquear"
                            >
                              {busyId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBlock(p)}
                              disabled={busyId === p.id || isMe}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed"
                              title={isMe ? 'Você não pode bloquear a si mesmo' : 'Bloquear'}
                            >
                              {busyId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                            </button>
                          )}

                          {/* Botão promover/rebaixar */}
                          <button
                            onClick={() => handleToggleAdmin(p)}
                            disabled={busyId === p.id || (isMe && p.role === 'admin')}
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={
                              isMe && p.role === 'admin'
                                ? 'Você não pode se rebaixar'
                                : p.role === 'admin'
                                ? 'Rebaixar a usuário'
                                : 'Promover a admin'
                            }
                          >
                            {p.role === 'admin' ? <ShieldOff size={14} /> : <Shield size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
        <div className="flex items-center gap-2"><Lock size={12} className="text-rose-500" /> Bloqueia: impede o usuário de logar (sessão atual é encerrada na próxima ação).</div>
        <div className="flex items-center gap-2"><Shield size={12} className="text-amber-500" /> Promover: dá acesso ao gerenciamento de usuários e operações administrativas.</div>
        <div className="flex items-center gap-2"><AlertCircle size={12} className="text-slate-400" /> Você não pode bloquear nem rebaixar a si mesmo (por segurança).</div>
      </div>
    </div>
  );
};

// Card de contagem
const CountCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: 'slate' | 'emerald' | 'rose' | 'amber';
}> = ({ icon, label, value, accent }) => {
  const colors: Record<string, string> = {
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    rose: 'bg-rose-50 border-rose-200 text-rose-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
  };
  return (
    <div className={`border rounded-xl p-3 ${colors[accent]}`}>
      <div className="opacity-70 mb-1">{icon}</div>
      <div className="text-[9px] font-black uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-2xl font-black tracking-tight font-mono">{value}</div>
    </div>
  );
};

export default UserManagement;
