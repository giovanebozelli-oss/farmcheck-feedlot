import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAppStore } from '../context';
import {
  Users, Activity, Wheat, CircleDollarSign, AlertCircle, Scale, TrendingUp,
} from 'lucide-react';
import {
  calculateDaysOnFeed,
  calculateProjectedWeight,
  calculateAllHeadCounts,
  formatCurrency,
  sortLotsByPen,
} from '../utils';

const Dashboard: React.FC = () => {
  const { lots, pens, diets, feedHistory, config, movements } = useAppStore();

  // Cabeças ativas por lote
  const headCounts = useMemo(
    () => calculateAllHeadCounts(lots, movements),
    [lots, movements]
  );

  // Lotes ativos (com cabeças > 0)
  const activeLots = useMemo(() => {
    return sortLotsByPen(
      lots.filter((l) => l.status === 'ACTIVE' && (headCounts[l.id] || 0) > 0),
      pens
    );
  }, [lots, pens, headCounts]);

  // KPIs principais
  const kpis = useMemo(() => {
    const totalHeads = activeLots.reduce((acc, l) => acc + (headCounts[l.id] || 0), 0);
    const today = new Date().toISOString().split('T')[0];

    // Último registro de cada lote (média ponderada)
    let weightedMSSum = 0;
    let weightedCostSum = 0;
    let weightedHeads = 0;

    activeLots.forEach((lot) => {
      const lotRecords = feedHistory
        .filter((r) => r.lotId === lot.id)
        .sort((a, b) => b.date.localeCompare(a.date));
      const latest = lotRecords[0];
      const heads = headCounts[lot.id] || 0;
      if (latest && heads > 0) {
        weightedMSSum += (latest.actualDryMatterPerHead || 0) * heads;
        weightedCostSum += (latest.costPerHead || 0) * heads;
        weightedHeads += heads;
      }
    });

    const avgMS = weightedHeads > 0 ? weightedMSSum / weightedHeads : 0;
    const avgCost = weightedHeads > 0 ? weightedCostSum / weightedHeads : 0;

    // Alertas: escores >= 2 nos últimos 3 dias
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

    const recentBadScores = feedHistory.filter(
      (r) =>
        r.date >= threeDaysAgoStr &&
        r.date <= today &&
        Number(r.bunkScoreYesterday) >= 2
    );

    const lotsWithAlert = new Set(recentBadScores.map((r) => r.lotId));
    const activeAlertLots = activeLots.filter((l) => lotsWithAlert.has(l.id));

    // Próximos abates: DOF >= 90 OU peso projetado >= 480kg
    const nearSlaughter = activeLots.filter((lot) => {
      const dof = calculateDaysOnFeed(lot.entryDate, today);
      const curve = config.gmdCurves?.find((c) => c.id === lot.gmdCurveId);
      const gmd = curve?.gmd || 1.5;
      const projW = calculateProjectedWeight(lot.initialWeight, gmd, dof);
      return dof >= 90 || projW >= 480;
    });

    return {
      totalHeads,
      activeLotsCount: activeLots.length,
      avgMS,
      avgCost,
      alertCount: activeAlertLots.length,
      nearSlaughterCount: nearSlaughter.length,
    };
  }, [activeLots, feedHistory, headCounts, config]);

  // Gráfico de evolução — CMS médio diário (últimos 30 dias)
  const evolutionData = useMemo(() => {
    const today = new Date();
    const days: { date: string; label: string; cms: number; cost: number }[] = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const records = feedHistory.filter((r) => r.date === dateStr);
      if (records.length === 0) {
        days.push({
          date: dateStr,
          label: dateStr.split('-').slice(1).reverse().join('/'),
          cms: 0,
          cost: 0,
        });
        continue;
      }
      let msSum = 0;
      let costSum = 0;
      let headsSum = 0;
      for (const r of records) {
        const h = r.headCount || 0;
        msSum += (r.actualDryMatterPerHead || 0) * h;
        costSum += (r.costPerHead || 0) * h;
        headsSum += h;
      }
      days.push({
        date: dateStr,
        label: dateStr.split('-').slice(1).reverse().join('/'),
        cms: headsSum > 0 ? Number((msSum / headsSum).toFixed(2)) : 0,
        cost: headsSum > 0 ? Number((costSum / headsSum).toFixed(2)) : 0,
      });
    }
    return days;
  }, [feedHistory]);

  const hasEvolutionData = evolutionData.some((d) => d.cms > 0);

  // Tabela de lotes ativos
  const lotsTableData = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return activeLots.map((lot) => {
      const pen = pens.find((p) => p.id === lot.currentPenId);
      const records = feedHistory
        .filter((r) => r.lotId === lot.id)
        .sort((a, b) => b.date.localeCompare(a.date));
      const latest = records[0];
      const diet = diets.find((d) => d.id === (latest?.dietId || lot.currentDietId));
      const dof = calculateDaysOnFeed(lot.entryDate, today);
      const curve = config.gmdCurves?.find((c) => c.id === lot.gmdCurveId);
      const gmd = curve?.gmd || 1.5;
      const projW = calculateProjectedWeight(lot.initialWeight, gmd, dof);

      return {
        lotId: lot.id,
        lotName: lot.name,
        penName: pen?.name || '-',
        heads: headCounts[lot.id] || 0,
        dof,
        projW,
        dietName: diet?.name || '-',
        cms: latest?.actualDryMatterPerHead || 0,
        pv: latest?.actualDryMatterPercentPV || 0,
        bunkScore: latest?.bunkScoreYesterday,
        hasAlert: Number(latest?.bunkScoreYesterday) >= 2,
        nearSlaughter: dof >= 90 || projW >= 480,
      };
    });
  }, [activeLots, pens, diets, feedHistory, config, headCounts]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm">
          Visão geral da operação — {new Date().toLocaleDateString('pt-BR')}
        </p>
      </div>

      {/* CARDS DE KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          icon={<Users size={18} />}
          label="Cabeças Totais"
          value={kpis.totalHeads.toLocaleString('pt-BR')}
          accent="emerald"
        />
        <KpiCard
          icon={<Activity size={18} />}
          label="Lotes Ativos"
          value={kpis.activeLotsCount.toString()}
          accent="blue"
        />
        <KpiCard
          icon={<Wheat size={18} />}
          label="MS/Cab/Dia"
          value={`${kpis.avgMS.toFixed(2)} kg`}
          accent="emerald"
          subtitle="média ponderada"
        />
        <KpiCard
          icon={<CircleDollarSign size={18} />}
          label="Custo/Cab/Dia"
          value={formatCurrency(kpis.avgCost)}
          accent="emerald"
          subtitle="média ponderada"
        />
        <KpiCard
          icon={<AlertCircle size={18} />}
          label="Alertas Cocho"
          value={kpis.alertCount.toString()}
          accent={kpis.alertCount > 0 ? 'rose' : 'slate'}
          subtitle="escore ≥ 2 (3d)"
        />
        <KpiCard
          icon={<Scale size={18} />}
          label="Próximos Abates"
          value={kpis.nearSlaughterCount.toString()}
          accent={kpis.nearSlaughterCount > 0 ? 'amber' : 'slate'}
          subtitle="DOF ≥ 90d ou ≥ 480kg"
        />
      </div>

      {/* GRÁFICO DE EVOLUÇÃO */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-emerald-600" />
          <h3 className="text-xs font-black uppercase tracking-tight text-slate-700">
            Evolução do Consumo — últimos 30 dias
          </h3>
        </div>
        {hasEvolutionData ? (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  interval={Math.max(1, Math.floor(evolutionData.length / 8))}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  label={{
                    value: 'kg MS/cab',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: 10, fill: '#94a3b8' },
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={{
                        background: 'white',
                        borderRadius: 10,
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        padding: 10,
                        fontSize: 11,
                      }}>
                        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{d.date.split('-').reverse().join('/')}</div>
                        <div style={{ color: '#64748b' }}>
                          CMS: <strong style={{ color: '#0f172a' }}>{d.cms.toFixed(2)} kg</strong>
                        </div>
                        <div style={{ color: '#64748b' }}>
                          Custo: <strong style={{ color: '#0f172a' }}>{formatCurrency(d.cost)}</strong>
                        </div>
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="cms"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[180px] flex items-center justify-center text-sm text-slate-400 italic">
            Sem dados de ficha de trato nos últimos 30 dias.
          </div>
        )}
      </div>

      {/* TABELA DE LOTES ATIVOS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2">
          <Activity size={16} className="text-emerald-600" />
          <h3 className="text-xs font-black uppercase tracking-tight text-slate-700">
            Lotes Ativos ({activeLots.length})
          </h3>
        </div>
        {activeLots.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400 italic">
            Nenhum lote ativo. Cadastre um lote em Movimentação de Rebanho.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 text-left">Baia / Lote</th>
                  <th className="px-4 py-3 text-center">Cab</th>
                  <th className="px-4 py-3 text-center">DOF</th>
                  <th className="px-4 py-3 text-center">Peso Proj.</th>
                  <th className="px-4 py-3 text-left">Dieta</th>
                  <th className="px-4 py-3 text-center">CMS hoje</th>
                  <th className="px-4 py-3 text-center">% PV</th>
                  <th className="px-4 py-3 text-center">Escore</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lotsTableData.map((row) => (
                  <tr key={row.lotId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[9px] font-black">
                          {row.penName}
                        </span>
                        <span className="font-bold text-slate-800 uppercase tracking-tighter italic">
                          {row.lotName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold">{row.heads}</td>
                    <td className="px-4 py-3 text-center font-mono">{row.dof}d</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-slate-700">
                      {row.projW.toFixed(0)} kg
                    </td>
                    <td className="px-4 py-3 text-emerald-700 font-bold text-[11px]">{row.dietName}</td>
                    <td className="px-4 py-3 text-center font-mono">
                      {row.cms > 0 ? `${row.cms.toFixed(2)} kg` : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-mono">
                      {row.pv > 0 ? `${row.pv.toFixed(2)}%` : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.bunkScore !== undefined ? (
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-[10px] ${
                          row.hasAlert
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {row.bunkScore}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {row.hasAlert && (
                          <span className="bg-rose-100 text-rose-700 text-[9px] font-bold px-1.5 py-0.5 rounded" title="Escore de cocho ≥ 2">
                            COCHO
                          </span>
                        )}
                        {row.nearSlaughter && (
                          <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded" title="DOF ≥ 90d ou peso ≥ 480kg">
                            ABATE
                          </span>
                        )}
                        {!row.hasAlert && !row.nearSlaughter && (
                          <span className="text-slate-300 text-[10px]">OK</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// Card de KPI
// ============================================================
const KpiCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: 'emerald' | 'blue' | 'amber' | 'rose' | 'slate';
  subtitle?: string;
}> = ({ icon, label, value, accent, subtitle }) => {
  const accents: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', icon: 'text-emerald-600' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', icon: 'text-blue-600' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', icon: 'text-amber-600' },
    rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-900', icon: 'text-rose-600' },
    slate: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', icon: 'text-slate-500' },
  };
  const c = accents[accent];
  return (
    <div className={`${c.bg} ${c.border} border rounded-xl p-3`}>
      <div className={`${c.icon} mb-1`}>{icon}</div>
      <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-0.5">{label}</div>
      <div className={`${c.text} text-lg font-black tracking-tight font-mono`}>{value}</div>
      {subtitle && <div className="text-[9px] text-slate-400 italic mt-0.5">{subtitle}</div>}
    </div>
  );
};

export default Dashboard;
