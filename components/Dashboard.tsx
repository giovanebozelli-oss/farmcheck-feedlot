
import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Bar
} from 'recharts';
import { useAppStore } from '../context';
import { TrendingUp, AlertTriangle, Activity, Scale, Users, Skull } from 'lucide-react';
import { MovementType } from '../types';

const Dashboard: React.FC = () => {
  const { feedHistory, lots, config, movements, getActiveHeadCount } = useAppStore();

  // Calculate dynamic KPIs
  const kpis = React.useMemo(() => {
    const activeLots = lots.filter(l => l.status === 'ACTIVE');
    const totalHeads = activeLots.reduce((acc, curr) => acc + getActiveHeadCount(curr.id), 0);
    const totalDeaths = movements.filter(m => m.type === MovementType.Death).reduce((acc, curr) => acc + curr.quantity, 0);

    if (feedHistory.length === 0) {
      return { 
        cmsPVHoje: "0,00 %",
        cmsPV5d: "0,00 %",
        totalHeads: totalHeads.toString(),
        totalDeaths: totalDeaths.toString(),
        avgCost: "R$ 0,00" 
      };
    }

    // Sort unique dates descending
    const uniqueDates = [...new Set(feedHistory.map(h => h.date))].sort((a, b) => b.localeCompare(a));
    const latestDate = uniqueDates[0];
    const latest5Dates = uniqueDates.slice(0, 5);

    const latestRecords = feedHistory.filter(h => h.date === latestDate);
    const cmsPVHojeVal = latestRecords.length > 0
      ? latestRecords.reduce((acc, curr) => acc + curr.actualDryMatterPercentPV, 0) / latestRecords.length
      : 0;

    const last5DaysRecords = feedHistory.filter(h => latest5Dates.includes(h.date));
    const cmsPV5dVal = last5DaysRecords.length > 0
      ? last5DaysRecords.reduce((acc, curr) => acc + curr.actualDryMatterPercentPV, 0) / last5DaysRecords.length
      : 0;

    // Custo Médio/Cab (latest date average)
    const avgCostValue = latestRecords.length > 0
      ? latestRecords.reduce((acc, curr) => acc + curr.costPerHead, 0) / latestRecords.length
      : 0;

    return {
      cmsPVHoje: `${cmsPVHojeVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`,
      cmsPV5d: `${cmsPV5dVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`,
      totalHeads: totalHeads.toLocaleString('pt-BR'),
      totalDeaths: totalDeaths.toLocaleString('pt-BR'),
      avgCost: avgCostValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    };
  }, [feedHistory, lots, movements]);

  // Aggregate data for charts
  const chartData = React.useMemo(() => {
    // Group by Date
    const grouped: Record<string, { date: string, consumptionPV: number, count: number, deviation: number }> = {};
    
    // Use last 30 days
    feedHistory.forEach(record => {
      if (!grouped[record.date]) {
        grouped[record.date] = { date: record.date.slice(5), consumptionPV: 0, count: 0, deviation: 0 };
      }
      grouped[record.date].consumptionPV += record.actualDryMatterPercentPV;
      grouped[record.date].deviation += record.deviationPercent;
      grouped[record.date].count += 1;
    });

    return Object.values(grouped)
      .map(item => ({
        date: item.date,
        avgConsumption: Number((item.consumptionPV / item.count).toFixed(2)),
        avgDeviation: Number((item.deviation / item.count).toFixed(2))
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [feedHistory]);

  const kpiData = [
    { title: "CMS %PV (Hoje)", value: kpis.cmsPVHoje, sub: "Último registro", icon: <Activity className="text-blue-500" />, color: "blue" },
    { title: "CMS %PV (5 dias)", value: kpis.cmsPV5d, sub: "Média móvel", icon: <TrendingUp className="text-emerald-500" />, color: "emerald" },
    { title: "Total de Cabeças", value: kpis.totalHeads, sub: "Animais ativos", icon: <Users className="text-purple-500" />, color: "purple" },
    { title: "Total de Mortes", value: kpis.totalDeaths, sub: "Acumulado histórico", icon: <Skull className="text-red-500" />, color: "red" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão à Vista</h1>
          <p className="text-slate-500">Indicadores gerais de desempenho e fornecimento (F-18 a F-21)</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi, idx) => (
          <div key={idx} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">{kpi.title}</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-1">{kpi.value}</h3>
              </div>
              <div className={`p-2 rounded-lg bg-${kpi.color}-50`}>
                {kpi.icon}
              </div>
            </div>
            <div className="text-xs text-slate-400 mt-2">
              {kpi.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* F-21: Consumo Geral (%PV) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Tendência de Consumo (% PV)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{fontSize: 12}} stroke="#64748b" />
                <YAxis domain={[1.5, 3]} tick={{fontSize: 12}} stroke="#64748b" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Legend />
                <ReferenceLine y={2.0} label="Meta Min" stroke="#10b981" strokeDasharray="3 3" />
                <Line 
                  type="monotone" 
                  dataKey="avgConsumption" 
                  name="Média Consumo MS %PV" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={{r: 4, strokeWidth: 2}} 
                  activeDot={{r: 6}} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* F-27: Desvio de Fornecimento */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Desvio de Fornecimento (%)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{fontSize: 12}} stroke="#64748b" />
                <YAxis tick={{fontSize: 12}} stroke="#64748b" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Legend />
                <ReferenceLine y={config.loadingLimitUpper || 5} stroke="#ef4444" strokeDasharray="3 3" />
                <ReferenceLine y={config.loadingLimitLower || -5} stroke="#ef4444" strokeDasharray="3 3" />
                <Bar dataKey="avgDeviation" name="Desvio Médio %" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
