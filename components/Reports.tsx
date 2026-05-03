
import React, { useState } from 'react';
import { useAppStore } from '../context';
import { calculateDaysOnFeed, calculateProjectedWeight, formatCurrency, calculateAllHeadCounts } from '../utils';
import { FileDown, FileText, Lock, Unlock, X, TrendingUp, ChevronRight, Trash2, Wheat } from 'lucide-react';
import { generateZootecnicoPDF } from '../utils/pdfGenerator';
import { MovementType } from '../types';
import { generateZootecnicoExcel } from '../utils/excelGenerator';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts';

const Reports: React.FC = () => {
  const { lots, pens, diets, feedHistory, categories, movements, deleteFeedRecord, deleteMovement, config } = useAppStore();
  const [activeTab, setActiveTab] = useState<'zootecnico' | 'fechamento' | 'insumos' | 'registros'>('zootecnico');
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [selectedPenId, setSelectedPenId] = useState<string | null>(null);
  
  const today = new Date().toISOString().split('T')[0];
  const [analysisDate, setAnalysisDate] = useState(today);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today);
  
  const headCounts = React.useMemo(() => {
    return calculateAllHeadCounts(lots, movements, analysisDate);
  }, [lots, movements, analysisDate]);

  const zootecnicoData = React.useMemo(() => {
    return lots.map(lot => {
      const lotHistory = feedHistory.filter(h => h.lotId === lot.id).sort((a,b) => b.date.localeCompare(a.date));
      const todayRecord = lotHistory.find(h => h.date === analysisDate);
      
      const heads = headCounts[lot.id] || 0;
      
      // If no animals on this date and it's not the entry date or there are no records, skip
      if (heads <= 0) return null;

      const penId = lot.currentPenId;
      const pen = pens.find(p => p.id === penId);
      const diet = diets.find(d => d.id === (todayRecord?.dietId || lot.currentDietId));
      const category = categories.find(c => c.id === lot.categoryId);
      const daysOnFeed = calculateDaysOnFeed(lot.entryDate, analysisDate);
      
      // If the lot hasn't even entered by analysisDate, skip (though headCount usually covers this, 
      // sometimes headCount might be positive if mock data is weird, so we double check entry date)
      if (new Date(lot.entryDate) > new Date(analysisDate)) return null;

      const lotGmd = config.gmdCurves.find(c => c.id === lot.gmdCurveId)?.gmd || 1.5;
      const projWeight = calculateProjectedWeight(lot.initialWeight, lotGmd, daysOnFeed);

      // Find day before (nearest date in history < analysisDate)
      const sortedHistoryDates = [...new Set(feedHistory.map(h => h.date))].sort().reverse();
      const prevDate = sortedHistoryDates.find(d => d < analysisDate) || null;
      const prevRecord = lotHistory.find(h => h.date === prevDate);
      
      const last5DaysRecords = lotHistory
        .filter(h => h.date <= analysisDate)
        .slice(0, 5);
      
      const avgCMS_MS_5d = last5DaysRecords.length > 0 
        ? last5DaysRecords.reduce((acc, curr) => acc + curr.actualDryMatterPerHead, 0) / last5DaysRecords.length
        : 0;

      const avgCMS_MN_5d = last5DaysRecords.length > 0 
        ? last5DaysRecords.reduce((acc, curr) => acc + (heads > 0 ? curr.actualTotalMN / heads : 0), 0) / last5DaysRecords.length
        : 0;

      const avgPV_5d = last5DaysRecords.length > 0
        ? last5DaysRecords.reduce((acc, curr) => acc + curr.actualDryMatterPercentPV, 0) / last5DaysRecords.length
        : 0;
      
      const periodRecords = feedHistory.filter(h => h.lotId === lot.id && h.date <= analysisDate);
      const avgCMS_MS_Period = periodRecords.length > 0
        ? periodRecords.reduce((acc, curr) => acc + curr.actualDryMatterPerHead, 0) / periodRecords.length
        : 0;

      const avgCMS_MN_Period = periodRecords.length > 0
        ? periodRecords.reduce((acc, curr) => acc + (heads > 0 ? curr.actualTotalMN / heads : 0), 0) / periodRecords.length
        : 0;

      const avgCost_Period = periodRecords.length > 0
        ? periodRecords.reduce((acc, curr) => acc + curr.costPerHead, 0) / periodRecords.length
        : 0;

      const avgPV_Period = periodRecords.length > 0
        ? periodRecords.reduce((acc, curr) => acc + curr.actualDryMatterPercentPV, 0) / periodRecords.length
        : 0;

      return {
        lotId: lot.id,
        lotName: lot.name,
        penId: lot.currentPenId,
        penName: pen?.name || '?',
        category: category?.name || '?',
        heads,
        daysOnFeed,
        entryWeight: lot.initialWeight,
        projWeight,
        cms_ms_hoje: (todayRecord?.actualDryMatterPerHead || 0),
        cms_mn_hoje: (todayRecord && heads > 0) ? (todayRecord.actualTotalMN / heads) : 0,
        cms_ms_ontem: (prevRecord?.actualDryMatterPerHead || 0),
        cms_mn_ontem: (prevRecord && heads > 0) ? (prevRecord.actualTotalMN / heads) : 0,
        cms_ms_5d: isNaN(avgCMS_MS_5d) ? 0 : avgCMS_MS_5d,
        cms_mn_5d: isNaN(avgCMS_MN_5d) ? 0 : avgCMS_MN_5d,
        cms_ms_period: isNaN(avgCMS_MS_Period) ? 0 : avgCMS_MS_Period,
        cms_mn_period: isNaN(avgCMS_MN_Period) ? 0 : avgCMS_MN_Period,
        pv_hoje: (todayRecord?.actualDryMatterPercentPV || 0),
        pv_ontem: (prevRecord?.actualDryMatterPercentPV || 0),
        pv_5d: isNaN(avgPV_5d) ? 0 : avgPV_5d,
        pv_period: isNaN(avgPV_Period) ? 0 : avgPV_Period,
        cost_hoje: (todayRecord?.costPerHead || 0),
        cost_period: isNaN(avgCost_Period) ? 0 : avgCost_Period,
        diet: diet?.name,
        lastScores: lotHistory.filter(h => h.date <= analysisDate).slice(0, 3).map(h => h.bunkScoreYesterday).join(' | ') || '-'
      };
    }).filter(r => r !== null && r.heads > 0) as any[];
  }, [lots, pens, diets, feedHistory, analysisDate, categories, headCounts]);

  const consumptionHistory = React.useMemo(() => {
    if (!selectedLotId) return [];
    return feedHistory
      .filter(h => h.lotId === selectedLotId)
      .sort((a,b) => a.date.localeCompare(b.date))
      .map(h => ({
        date: h.date.split('-').slice(1).reverse().join('/'),
        cms: Number(h.actualDryMatterPerHead.toFixed(2)),
        pv: Number(h.actualDryMatterPercentPV.toFixed(2)),
        score: h.bunkScoreYesterday
      }));
  }, [selectedLotId, feedHistory]);

  const selectedLotData = zootecnicoData.find(d => d.lotId === selectedLotId);

  const penHistoryData = React.useMemo(() => {
    if (!selectedPenId) return [];
    
    const lotsInPen = zootecnicoData.filter(row => row.penId === selectedPenId);
    if (lotsInPen.length === 0) return [];

    const last7Days = [];
    const baseDate = new Date(analysisDate + 'T12:00:00Z');
    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      last7Days.push(d.toISOString().split('T')[0]);
    }

    return last7Days.map(date => {
      const entry: any = { 
        date: date.split('-').slice(1).reverse().join('/')
      };
      lotsInPen.forEach(row => {
          const record = feedHistory.find(h => h.lotId === row.lotId && h.date === date);
          entry[row.lotName] = record ? Number(record.actualDryMatterPercentPV.toFixed(2)) : 0;
      });
      return entry;
    });
  }, [selectedPenId, analysisDate, zootecnicoData, feedHistory]);

  const selectedPenLots = React.useMemo(() => {
    if (!selectedPenId) return [];
    return zootecnicoData.filter(row => row.penId === selectedPenId);
  }, [selectedPenId, zootecnicoData]);

  const [showExportOptions, setShowExportOptions] = useState(false);

  const handleExportPDF = () => {
    if (activeTab === 'zootecnico') {
      generateZootecnicoPDF(zootecnicoData, analysisDate);
    }
    setShowExportOptions(false);
  };

  const handleExportExcel = () => {
    if (activeTab === 'zootecnico') {
      generateZootecnicoExcel(zootecnicoData, analysisDate);
    }
    setShowExportOptions(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter">Relatórios</h1>
            <div className="flex gap-6 mt-3">
              <button 
                onClick={() => setActiveTab('zootecnico')}
                className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${activeTab === 'zootecnico' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                Acompanhamento Zootécnico
              </button>
              <button 
                onClick={() => setActiveTab('fechamento')}
                className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${activeTab === 'fechamento' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                Simulação de Fechamento
              </button>
              <button 
                onClick={() => setActiveTab('insumos')}
                className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${activeTab === 'insumos' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                Consumo de Insumos
              </button>
              <button 
                onClick={() => setActiveTab('registros')}
                className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${activeTab === 'registros' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                Lançamentos
              </button>
            </div>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 px-3 border-r border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase">Data de Análise:</span>
            <input 
              type="date" 
              value={analysisDate} 
              onChange={e => setAnalysisDate(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-transparent outline-none"
            />
          </div>
          {activeTab === 'insumos' && (
            <>
              <div className="flex items-center gap-2 px-3 border-r border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase">De:</span>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)}
                  className="text-xs font-bold text-slate-700 bg-transparent outline-none"
                />
              </div>
              <div className="flex items-center gap-2 px-3">
                <span className="text-[10px] font-black text-slate-400 uppercase">Até:</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)}
                  className="text-xs font-bold text-slate-700 bg-transparent outline-none"
                />
              </div>
            </>
          )}
        </div>
        <div className="flex gap-3 relative">
            <button 
                onClick={() => setShowExportOptions(!showExportOptions)}
                className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl hover:bg-emerald-700 shadow-lg font-bold transition-all underline-none"
            >
                <FileDown size={18} />
                <span>Exportar Relatório</span>
            </button>

            {showExportOptions && (
              <div className="absolute top-full mt-2 right-0 w-48 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                <button 
                  onClick={handleExportPDF}
                  className="w-full px-4 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileText size={14} className="text-red-500" />
                  Exportar em PDF
                </button>
                <button 
                  onClick={handleExportExcel}
                  className="w-full px-4 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileDown size={14} className="text-emerald-500" />
                  Exportar em Excel
                </button>
              </div>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className={`${(selectedLotId || selectedPenId) ? 'lg:col-span-8' : 'lg:col-span-12'} transition-all duration-300`}>
          {activeTab === 'zootecnico' ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-slate-900 text-white font-bold">
                    <tr>
                      <th rowSpan={2} className="px-4 py-4 sticky left-0 bg-slate-900 z-10 border-r border-slate-700">Lote / Baia</th>
                      <th rowSpan={2} className="px-4 py-4 text-center">Cat.</th>
                      <th rowSpan={2} className="px-4 py-4 text-center">Dieta</th>
                      <th rowSpan={2} className="px-4 py-4 text-center">Cab.</th>
                      <th rowSpan={2} className="px-4 py-4 text-center">DOF</th>
                      <th rowSpan={2} className="px-4 py-4 text-center">Entrada</th>
                      <th rowSpan={2} className="px-4 py-4 text-center">Peso Atual</th>
                      <th colSpan={4} className="px-4 py-2 text-center bg-emerald-800 border-b border-white/20">Consumo MS (kg/cab)</th>
                      <th colSpan={4} className="px-4 py-2 text-center bg-emerald-700 border-b border-white/20">Consumo MN (kg/cab)</th>
                      <th colSpan={4} className="px-4 py-2 text-center bg-blue-800 border-b border-white/20">% PV</th>
                      <th colSpan={2} className="px-4 py-2 text-center bg-amber-800 border-b border-white/20">Custo (R$/cab)</th>
                      <th rowSpan={2} className="px-4 py-4 text-center">Cocho</th>
                    </tr>
                    <tr className="bg-slate-800">
                      <th className="px-2 py-2 text-center bg-emerald-900">Hoje</th>
                      <th className="px-2 py-2 text-center bg-emerald-900">Ontem</th>
                      <th className="px-2 py-2 text-center bg-emerald-900">M.5d</th>
                      <th className="px-2 py-2 text-center bg-emerald-900">M.Per</th>
                      <th className="px-2 py-2 text-center bg-emerald-800">Hoje</th>
                      <th className="px-2 py-2 text-center bg-emerald-800">Ontem</th>
                      <th className="px-2 py-2 text-center bg-emerald-800">M.5d</th>
                      <th className="px-2 py-2 text-center bg-emerald-800">M.Per</th>
                      <th className="px-2 py-2 text-center bg-blue-900">Hoje</th>
                      <th className="px-2 py-2 text-center bg-blue-900">Ontem</th>
                      <th className="px-2 py-2 text-center bg-blue-900">M.5d</th>
                      <th className="px-2 py-2 text-center bg-blue-900">M.Per</th>
                      <th className="px-2 py-2 text-center bg-amber-900">Hoje</th>
                      <th className="px-2 py-2 text-center bg-amber-900">M.Per</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {zootecnicoData.length === 0 ? (
                      <tr><td colSpan={19} className="p-12 text-center text-slate-400 italic">Nenhum dado ativo para esta data...</td></tr>
                    ) : zootecnicoData.map((row) => (
                      <tr 
                        key={row.lotId} 
                        onClick={() => {
                          setSelectedLotId(selectedLotId === row.lotId ? null : row.lotId);
                          setSelectedPenId(null);
                        }}
                        className={`hover:bg-emerald-50 transition-colors cursor-pointer group ${(selectedLotId === row.lotId || (selectedPenId === row.penId && !selectedLotId)) ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-500' : ''}`}
                      >
                        <td className="px-4 py-4 sticky left-0 bg-white font-bold text-slate-900 border-r group-hover:bg-emerald-50 transition-colors">
                          <div className="flex items-center gap-2">
                             <div 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setSelectedPenId(selectedPenId === row.penId ? null : row.penId);
                                 setSelectedLotId(null);
                               }}
                               className={`w-8 h-8 rounded flex items-center justify-center text-[10px] font-black transition-colors ${selectedPenId === row.penId ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-emerald-200 hover:text-emerald-700'}`}
                             >
                               {row.penName}
                             </div>
                             <div>
                                <div>{row.lotName}</div>
                             </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-slate-500 uppercase tracking-tighter text-[10px]">{row.category}</td>
                        <td className="px-3 py-4 text-center text-[10px] font-bold text-emerald-700 truncate max-w-[120px]" title={row.diet || '-'}>{row.diet || '-'}</td>
                        <td className="px-4 py-4 text-center font-bold">{isNaN(row.heads) ? 0 : row.heads}</td>
                        <td className="px-4 py-4 text-center">{isNaN(row.daysOnFeed) ? 0 : row.daysOnFeed}</td>
                        <td className="px-4 py-4 text-center text-slate-500">{row.entryWeight.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg</td>
                        <td className="px-4 py-4 text-center font-black text-slate-800">{row.projWeight.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg</td>
                        
                        <td className="px-2 py-4 text-center bg-emerald-50/50 font-bold">{row.cms_ms_hoje.toFixed(2)}</td>
                        <td className="px-2 py-4 text-center">{row.cms_ms_ontem.toFixed(2)}</td>
                        <td className="px-2 py-4 text-center font-bold text-emerald-700">{row.cms_ms_5d.toFixed(2)}</td>
                        <td className="px-2 py-4 text-center">{row.cms_ms_period.toFixed(2)}</td>

                        <td className="px-2 py-4 text-center bg-emerald-50/30 font-bold">{row.cms_mn_hoje.toFixed(2)}</td>
                        <td className="px-2 py-4 text-center">{row.cms_mn_ontem.toFixed(2)}</td>
                        <td className="px-2 py-4 text-center font-bold text-emerald-800">{row.cms_mn_5d.toFixed(2)}</td>
                        <td className="px-2 py-4 text-center">{row.cms_mn_period.toFixed(2)}</td>

                        <td className="px-2 py-4 text-center bg-blue-50/50 font-bold text-blue-700">{row.pv_hoje.toFixed(2)}%</td>
                        <td className="px-2 py-4 text-center">{row.pv_ontem.toFixed(2)}%</td>
                        <td className="px-2 py-4 text-center text-blue-800">{row.pv_5d.toFixed(2)}%</td>
                        <td className="px-2 py-4 text-center">{row.pv_period.toFixed(2)}%</td>

                        <td className="px-2 py-4 text-center font-bold text-slate-900">{formatCurrency(row.cost_hoje)}</td>
                        <td className="px-2 py-4 text-center text-slate-500">{formatCurrency(row.cost_period)}</td>

                        <td className="px-4 py-4 text-center text-slate-500 font-mono tracking-tighter">{row.lastScores}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === 'fechamento' ? (
            <FechamentoReport analysisDate={analysisDate} headCounts={headCounts} />
          ) : activeTab === 'insumos' ? (
            <InsumosReport startDate={startDate} endDate={endDate} />
          ) : (
            <RegistrosTab />
          )}
        </div>

        {(selectedLotId || selectedPenId) && (
          <div className="lg:col-span-4 space-y-6">
             <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-6 relative animate-in fade-in slide-in-from-right-4">
                <button 
                  onClick={() => {
                    setSelectedLotId(null);
                    setSelectedPenId(null);
                  }}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>

                {selectedLotId ? (
                  <>
                    <div className="mb-6">
                      <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Análise de Consumo</div>
                      <h3 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase">{selectedLotData?.lotName}</h3>
                      <div className="text-xs text-slate-400">Baia atual: {selectedLotData?.penName}</div>
                      {selectedLotData?.diet && (
                        <div className="mt-3 inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                          <Wheat size={14} className="text-emerald-700" />
                          <div>
                            <div className="text-[9px] font-black text-emerald-700 uppercase tracking-wider">Dieta Atual</div>
                            <div className="text-xs font-bold text-emerald-900">{selectedLotData.diet}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="h-[250px] w-full mb-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={consumptionHistory}>
                          <defs>
                            <linearGradient id="colorCms" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 10}} 
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 10}}
                          />
                          <Tooltip 
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                            itemStyle={{fontWeight: 'bold', fontSize: '12px'}}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="cms" 
                            name="CMS (kg/cab)" 
                            stroke="#10b981" 
                            strokeWidth={3} 
                            fillOpacity={1} 
                            fill="url(#colorCms)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Consumo %PV Médio</div>
                          <div className="text-xl font-black text-slate-800">{selectedLotData?.pv_5d.toFixed(2)}%</div>
                       </div>
                       <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Custo Total/Cab</div>
                          <div className="text-xl font-black text-emerald-600">
                            {formatCurrency(selectedLotData?.cost_period || 0 * (selectedLotData?.daysOnFeed || 1))}
                          </div>
                       </div>
                    </div>

                    <button 
                      className="w-full mt-6 bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-md group"
                    >
                      <TrendingUp size={18} className="group-hover:translate-y-[-2px] transition-transform" />
                      <span>Ver Projeção de Ganho</span>
                      <ChevronRight size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mb-6">
                      <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Baia {selectedPenLots[0]?.penName}</div>
                      <h3 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase">Consumo por Lote</h3>
                      <div className="text-xs text-slate-400">Histórico de Consumo (% PV)</div>
                    </div>

                    <div className="h-[300px] w-full mb-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={penHistoryData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 10}} 
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 10}} 
                          />
                          <Tooltip 
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                            itemStyle={{fontWeight: 'bold', fontSize: '10px'}}
                          />
                          <Legend wrapperStyle={{fontSize: '9px', fontWeight: 'black', paddingTop: '10px'}} />
                          {selectedPenLots.map((row, idx) => (
                            <Bar 
                              key={row.lotId} 
                              dataKey={row.lotName} 
                              name={row.lotName}
                              fill={['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5]} 
                              radius={[4, 4, 0, 0]}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-3">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Resumo da Baia</h4>
                       {selectedPenLots.map(row => (
                         <div key={row.lotId} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div>
                               <div className="text-xs font-black text-slate-700">{row.lotName}</div>
                               <div className="text-[9px] text-slate-400 uppercase">{row.category}</div>
                            </div>
                            <div className="text-right">
                               <div className="text-sm font-black text-emerald-600">{row.pv_hoje.toFixed(2)}%</div>
                               <div className="text-[9px] text-slate-400 uppercase">PV Atual</div>
                            </div>
                         </div>
                       ))}
                    </div>
                  </>
                )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

const FechamentoReport: React.FC<{ analysisDate: string, headCounts: Record<string, number> }> = ({ analysisDate, headCounts }) => {
  const { lots, updateLot, categories } = useAppStore();
  const closedLots = lots.filter(l => {
    // Only show lots that were already entered on the analysis date AND had animals at that time
    const isEntered = new Date(l.entryDate) <= new Date(analysisDate);
    const hasAnimals = headCounts[l.id] > 0;
    return isEntered && hasAnimals && (l.status === 'CLOSED' || l.status === 'ACTIVE');
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
       <div className="overflow-x-auto">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="bg-slate-900 text-white font-bold border-b border-slate-700">
                <tr>
                  <th className="px-6 py-4">Lote</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Entrada</th>
                  <th className="px-6 py-4">Saída (Proj)</th>
                  <th className="px-6 py-4 text-center">Peso Ent.</th>
                  <th className="px-6 py-4 text-center">Peso Saída</th>
                  <th className="px-6 py-4 text-center">GMD</th>
                  <th className="px-6 py-4 text-center">Produção @</th>
                  <th className="px-6 py-4 text-center bg-amber-900">Margem Est.</th>
                  <th className="px-6 py-4 text-right">Status</th>
                  <th className="px-6 py-4 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {closedLots.map(lot => {
                  const daysOnFeed = calculateDaysOnFeed(lot.entryDate, analysisDate) || 0;
                  const projWeight = calculateProjectedWeight(lot.initialWeight || 0, 1.6, daysOnFeed) || 0;
                  const prodArrobasVal = (projWeight * 0.54 - (lot.initialWeight || 0) * 0.50) / 15;
                  const prodArrobas = isNaN(prodArrobasVal) ? 0 : prodArrobasVal;
                  
                  return (
                    <tr key={lot.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-black">{lot.name}</td>
                      <td className="px-6 py-4 text-slate-500 font-bold text-[10px] uppercase">
                        {categories.find(c => c.id === lot.categoryId)?.name || '-'}
                      </td>
                      <td className="px-6 py-4 text-slate-500">{lot.entryDate.split('-').reverse().join('/')}</td>
                      <td className="px-6 py-4 text-slate-500">{analysisDate.split('-').reverse().join('/')}</td>
                      <td className="px-6 py-4 text-center font-mono">{lot.initialWeight.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg</td>
                      <td className="px-6 py-4 text-center font-black text-slate-800">{projWeight.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg</td>
                      <td className="px-6 py-4 text-center text-emerald-600 font-black">1.60</td>
                      <td className="px-6 py-4 text-center font-bold tracking-tighter">{prodArrobas.toFixed(2)} @</td>
                      <td className="px-6 py-4 text-center bg-amber-50/50 text-amber-700 font-black">
                        R$ 485,00/cab
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${lot.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {lot.status === 'ACTIVE' ? 'EM DESEMPENHO' : 'FINALIZADO'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {lot.status === 'ACTIVE' ? (
                          <button 
                            onClick={() => updateLot(lot.id, { status: 'CLOSED' })}
                            className="bg-slate-800 text-white p-2 rounded-lg hover:bg-slate-700 transition"
                            title="Encerrar Lote"
                          >
                            <Lock size={16} />
                          </button>
                        ) : (
                          <button 
                            onClick={() => updateLot(lot.id, { status: 'ACTIVE' })}
                            className="text-slate-400 hover:text-emerald-600 transition p-2"
                            title="Reabrir Lote"
                          >
                            <Unlock size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
       </div>
    </div>
  );
}

const InsumosReport: React.FC<{ startDate: string, endDate: string }> = ({ startDate, endDate }) => {
  const { ingredients, diets, feedHistory } = useAppStore();

  const usageData = React.useMemo(() => {
    const usage: Record<string, { quantity: number, cost: number }> = {};
    
    feedHistory
      .filter(record => record.date >= startDate && record.date <= endDate)
      .forEach(record => {
        const diet = diets.find(d => d.id === record.dietId);
        if (!diet) return;

        diet.ingredients.forEach(item => {
          const ing = ingredients.find(i => i.id === item.ingredientId);
          if (!ing) return;

          const amount = record.actualTotalMN * (item.inclusionMNPercentage / 100);
          const cost = amount * (ing.pricePerTon / 1000);

          if (!usage[ing.id]) {
            usage[ing.id] = { quantity: 0, cost: 0 };
          }
          usage[ing.id].quantity += amount;
          usage[ing.id].cost += cost;
        });
      });

    return Object.entries(usage).map(([id, data]) => {
      const ing = ingredients.find(i => i.id === id);
      return {
        id,
        name: ing?.name || '?',
        totalQuantity: data.quantity,
        totalCost: data.cost,
        pricePerTon: ing?.pricePerTon || 0
      };
    }).sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [ingredients, diets, feedHistory, startDate, endDate]);

  const totalPeriodCost = usageData.reduce((acc, curr) => acc + curr.totalCost, 0);
  const totalPeriodQty = usageData.reduce((acc, curr) => acc + curr.totalQuantity, 0);

  return (
    <div className="space-y-6">
       {/* Summary Cards */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Custo Total em Insumos</div>
             <div className="text-3xl font-black text-emerald-600">{formatCurrency(totalPeriodCost)}</div>
             <div className="text-[10px] text-slate-400 mt-1">No período de {startDate.split('-').reverse().join('/')} a {endDate.split('-').reverse().join('/')}</div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Volume Total Distribuído</div>
             <div className="text-3xl font-black text-slate-900">{(totalPeriodQty / 1000).toFixed(2)} <span className="text-sm font-bold text-slate-400">Ton MN</span></div>
             <div className="text-[10px] text-slate-400 mt-1">Média de {(totalPeriodQty / usageData.length / 1000 || 0).toFixed(2)} Ton por ingrediente</div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center">
             <div className="text-center">
                <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Impacto Financeiro</div>
                <div className="flex items-center gap-2">
                   <TrendingUp size={24} className="text-emerald-500" />
                   <span className="text-2xl font-black text-slate-900">{(totalPeriodCost / (totalPeriodQty || 1) * 1000).toFixed(2)}</span>
                   <span className="text-[10px] font-black text-slate-400 font-mono">R$/Ton MN</span>
                </div>
             </div>
          </div>
       </div>

       {/* Usage Details */}
       <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
             <h3 className="text-sm font-black text-slate-700 uppercase tracking-tighter">Consumo Detalhado por Ingrediente</h3>
             <span className="text-[10px] font-bold text-slate-400 uppercase">Período: {startDate.split('-').reverse().join('/')} - {endDate.split('-').reverse().join('/')}</span>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-white font-bold">
                   <tr>
                      <th className="px-6 py-4">Ingrediente</th>
                      <th className="px-6 py-4 text-center">Qtd. Total (kg MN)</th>
                      <th className="px-6 py-4 text-center">Qtd. Total (Ton MN)</th>
                      <th className="px-6 py-4 text-center">Preço Médio (R$/Ton)</th>
                      <th className="px-6 py-4 text-right">Custo Total</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {usageData.length === 0 ? (
                      <tr><td colSpan={5} className="p-12 text-center text-slate-400 italic">Nenhum registro de trato encontrado no período selecionado.</td></tr>
                   ) : usageData.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                         <td className="px-6 py-4 font-black text-slate-900 border-l-4 border-emerald-500 italic uppercase">{row.name}</td>
                         <td className="px-6 py-4 text-center font-mono">{row.totalQuantity.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kg</td>
                         <td className="px-6 py-4 text-center font-bold">{(row.totalQuantity / 1000).toFixed(3)} Ton</td>
                         <td className="px-6 py-4 text-center text-slate-500">{formatCurrency(row.pricePerTon)}</td>
                         <td className="px-6 py-4 text-right font-black text-emerald-700">{formatCurrency(row.totalCost)}</td>
                      </tr>
                   ))}
                </tbody>
                {usageData.length > 0 && (
                   <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-black">
                      <tr>
                         <td className="px-6 py-4 uppercase">Totais Aditados</td>
                         <td className="px-6 py-4 text-center">{totalPeriodQty.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kg</td>
                         <td className="px-6 py-4 text-center">{(totalPeriodQty / 1000).toFixed(3)} Ton</td>
                         <td></td>
                         <td className="px-6 py-4 text-right text-emerald-600">{formatCurrency(totalPeriodCost)}</td>
                      </tr>
                   </tfoot>
                )}
             </table>
          </div>
       </div>
    </div>
  );
}

export default Reports;

const RegistrosTab: React.FC = () => {
  const { feedHistory, movements, lots, deleteFeedRecord, deleteMovement } = useAppStore();
  const [activeSubTab, setActiveSubTab] = useState<'tratos' | 'movimentos'>('tratos');

  const sortedFeedHistory = [...feedHistory].sort((a,b) => b.date.localeCompare(a.date));
  const sortedMovements = [...movements].sort((a,b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
       <div className="flex gap-4 bg-white p-1 rounded-xl border border-slate-200 w-fit">
          <button 
            onClick={() => setActiveSubTab('tratos')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'tratos' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Histórico de Tratos
          </button>
          <button 
            onClick={() => setActiveSubTab('movimentos')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'movimentos' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Movimentação Animal
          </button>
       </div>

       {activeSubTab === 'tratos' ? (
         <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-widest">
                     <tr>
                        <th className="px-6 py-4">Data</th>
                        <th className="px-6 py-4">Lote</th>
                        <th className="px-6 py-4 text-center">MN Total (kg)</th>
                        <th className="px-6 py-4 text-center">MS/Cab (kg)</th>
                        <th className="px-6 py-4 text-right">Ação</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {sortedFeedHistory.map((record) => {
                       const lot = lots.find(l => l.id === record.lotId);
                       return (
                        <tr key={record.id} className="hover:bg-slate-50 group">
                           <td className="px-6 py-4 font-bold text-slate-700">{record.date.split('-').reverse().join('/')}</td>
                           <td className="px-6 py-4 italic font-black text-slate-900 uppercase tracking-tighter">{lot?.name || 'Lote Removido'}</td>
                           <td className="px-6 py-4 text-center font-mono">{record.actualTotalMN.toFixed(0)}</td>
                           <td className="px-6 py-4 text-center font-bold text-emerald-600">{record.actualDryMatterPerHead.toFixed(2)}</td>
                           <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => {
                                  if (window.confirm('Excluir este registro de trato permanentemente?')) {
                                    deleteFeedRecord(record.id);
                                  }
                                }}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={16} />
                              </button>
                           </td>
                        </tr>
                       );
                     })}
                  </tbody>
               </table>
            </div>
         </div>
       ) : (
         <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-widest">
                     <tr>
                        <th className="px-6 py-4">Data</th>
                        <th className="px-6 py-4">Lote</th>
                        <th className="px-6 py-4">Tipo</th>
                        <th className="px-6 py-4 text-center">Qtd</th>
                        <th className="px-6 py-4 text-right">Ação</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {sortedMovements.map((mov, idx) => {
                       const lot = lots.find(l => l.id === mov.lotId);
                       return (
                        <tr key={idx} className="hover:bg-slate-50 group">
                           <td className="px-6 py-4 font-bold text-slate-700">{mov.date.split('T')[0].split('-').reverse().join('/')}</td>
                           <td className="px-6 py-4 italic font-black text-slate-900 uppercase tracking-tighter">{lot?.name || 'Lote Removido'}</td>
                           <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded font-black uppercase text-[10px] ${
                                mov.type === MovementType.Death ? 'bg-red-100 text-red-600' : 
                                mov.type === MovementType.Entry ? 'bg-emerald-100 text-emerald-600' : 
                                'bg-blue-100 text-blue-600'
                              }`}>
                                {mov.type === MovementType.Death ? 'MORTE' : mov.type === MovementType.Entry ? 'ENTRADA' : 'TRANSFERÊNCIA'}
                              </span>
                           </td>
                           <td className="px-6 py-4 text-center font-black">{mov.quantity}</td>
                           <td className="px-6 py-4 text-right">
                              {/* Movements are often mock in this demo, but we allow deleting if they have ID in Firestore */}
                              <button 
                                onClick={() => {
                                  if (window.confirm('Excluir este lançamento de movimentação?')) {
                                    // In a real scenario, mov.id would exist.
                                    // Our addMovement uses addDoc which creates an ID.
                                    if(mov.id) deleteMovement(mov.id);
                                    else alert("Este lançamento não pode ser excluído manualmente nesta versão.");
                                  }
                                }}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={16} />
                              </button>
                           </td>
                        </tr>
                       );
                     })}
                  </tbody>
               </table>
            </div>
         </div>
       )}
    </div>
  );
};
