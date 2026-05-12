import React, { useMemo, useState } from 'react';
import { useAppStore } from '../context';
import {
  calculateDaysOnFeed,
  calculateProjectedWeight,
  computeClosingMetrics,
  formatCurrency,
  sortLotsByPen,
} from '../utils';
import { Closing, Lot } from '../types';
import {
  Beef, Calculator, ChevronRight, CircleDollarSign, History, Save, X, ScrollText, FileDown, FileText,
} from 'lucide-react';
import { generateFechamentoPDF, FechamentoExportData } from '../utils/pdfGenerator';
import { generateFechamentoExcel } from '../utils/excelGenerator';

interface Props {
  analysisDate: string;
  headCounts: Record<string, number>;
}

/**
 * Fechamento Zootécnico e Financeiro — substitui a antiga "Simulação de Fechamento".
 *
 * Permite selecionar um lote (ativo ou fechado), preencher dados financeiros e de abate,
 * e ver os resultados (GMD, GDC, @ produzidas, custo da @, lucro, rentabilidade).
 *
 * Persiste em fc_closings via upsertClosing.
 */
const FechamentoFinanceiro: React.FC<Props> = ({ analysisDate, headCounts }) => {
  const {
    lots, pens, feedHistory, diets, closings,
    upsertClosing, deleteClosing, updateLot, getActiveHeadCount,
  } = useAppStore();

  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');

  // Lista de lotes filtrável
  const filteredLots = useMemo(() => {
    let result = lots.filter((l) => {
      const isEntered = new Date(l.entryDate) <= new Date(analysisDate);
      return isEntered;
    });
    if (filter === 'active') result = result.filter((l) => l.status === 'ACTIVE');
    if (filter === 'closed') result = result.filter((l) => l.status === 'CLOSED');
    return sortLotsByPen(result, pens);
  }, [lots, pens, filter, analysisDate]);

  const selectedLot = lots.find((l) => l.id === selectedLotId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Lista de lotes */}
      <aside className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="p-4 border-b">
          <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 mb-3">Selecionar Lote</h3>
          <div className="flex gap-1 text-[10px] font-bold">
            {(['all', 'active', 'closed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 px-2 py-1.5 rounded-md ${filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : 'Fechados'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {filteredLots.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-400 italic">Nenhum lote.</div>
          )}
          {filteredLots.map((lot) => {
            const pen = pens.find((p) => p.id === lot.currentPenId);
            const cab = getActiveHeadCount(lot.id);
            const hasClosing = closings.some((c) => c.lotId === lot.id);
            return (
              <button
                key={lot.id}
                onClick={() => setSelectedLotId(lot.id)}
                className={`w-full text-left p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2 ${
                  selectedLotId === lot.id ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-slate-900 italic uppercase tracking-tighter truncate">
                    {lot.name}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{pen?.name || '-'}</span>
                    <span>·</span>
                    <span>{cab} cab</span>
                    {hasClosing && <span className="text-amber-600 font-bold">●&nbsp;fechado</span>}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                  lot.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {lot.status === 'ACTIVE' ? 'EM CURSO' : 'ABATIDO'}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Painel de cálculos */}
      <main className="lg:col-span-8">
        {selectedLot ? (
          <ClosingPanel
            key={selectedLot.id}
            lot={selectedLot}
            analysisDate={analysisDate}
            headCounts={headCounts}
            existingClosing={closings.find((c) => c.lotId === selectedLot.id)}
            onSave={async (closing, alsoCloseLot) => {
              try {
                await upsertClosing(closing);
                if (alsoCloseLot && selectedLot.status === 'ACTIVE') {
                  await updateLot(selectedLot.id, { status: 'CLOSED' });
                }
                alert('Fechamento salvo com sucesso!');
              } catch (err) {
                console.error('[upsertClosing]', err);
                alert('Erro ao salvar fechamento. Veja o console.');
              }
            }}
            onDelete={async () => {
              const existing = closings.find((c) => c.lotId === selectedLot.id);
              if (!existing) return;
              if (window.confirm('Excluir este fechamento? O lote NÃO será reaberto automaticamente.')) {
                try {
                  await deleteClosing(existing.id);
                } catch (err) {
                  console.error('[deleteClosing]', err);
                  alert('Erro ao excluir fechamento.');
                }
              }
            }}
          />
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <Beef size={48} className="mx-auto text-slate-300 mb-3" />
            <h3 className="text-lg font-bold text-slate-700 mb-1">Selecione um lote</h3>
            <p className="text-sm text-slate-500">
              Escolha um lote na lista ao lado pra preencher os dados de abate e ver o fechamento.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

// ============================================================
// Painel de Fechamento — formulário + resultados
// ============================================================
const ClosingPanel: React.FC<{
  lot: Lot;
  analysisDate: string;
  headCounts: Record<string, number>;
  existingClosing?: Closing;
  onSave: (closing: Closing, alsoCloseLot: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
}> = ({ lot, analysisDate, headCounts, existingClosing, onSave, onDelete }) => {
  const { config, feedHistory, getActiveHeadCount, pens } = useAppStore();

  // Dados do sistema
  const daysOnFeed = calculateDaysOnFeed(lot.entryDate, analysisDate) || 0;
  const curve = config.gmdCurves?.find((c) => c.id === lot.gmdCurveId);
  const gmdCurve = curve?.gmd || 1.5;
  const projWeight = calculateProjectedWeight(lot.initialWeight, gmdCurve, daysOnFeed);

  // Consumo médio MS/cab/dia + custo nutricional médio/cab/dia (do feedHistory desse lote)
  const lotFeedHistory = useMemo(
    () => feedHistory.filter((r) => r.lotId === lot.id),
    [feedHistory, lot.id]
  );

  const avgMSConsumption = useMemo(() => {
    if (lotFeedHistory.length === 0) return 0;
    const sum = lotFeedHistory.reduce((acc, r) => acc + (r.actualDryMatterPerHead || 0), 0);
    return sum / lotFeedHistory.length;
  }, [lotFeedHistory]);

  const avgNutritionalCost = useMemo(() => {
    if (lotFeedHistory.length === 0) return 0;
    const sum = lotFeedHistory.reduce((acc, r) => acc + (r.costPerHead || 0), 0);
    return sum / lotFeedHistory.length;
  }, [lotFeedHistory]);

  // Inputs do usuário (com defaults vindos do existingClosing ou valores razoáveis)
  const cabActive = getActiveHeadCount(lot.id);
  const [headsSlaughtered, setHeadsSlaughtered] = useState<number>(
    existingClosing?.headsSlaughtered ?? cabActive
  );
  const [purchasePrice, setPurchasePrice] = useState<number>(
    existingClosing?.purchasePricePerHead ?? 0
  );
  const [salePrice, setSalePrice] = useState<number>(
    existingClosing?.salePricePerArroba ?? 0
  );
  const [finalLiveWeight, setFinalLiveWeight] = useState<number>(
    existingClosing?.finalLiveWeightKg ?? 0
  );
  const [carcassWeightKg, setCarcassWeightKg] = useState<number>(
    existingClosing?.carcassWeightKg ?? 0
  );
  const [carcassWeightArroba, setCarcassWeightArroba] = useState<number>(
    existingClosing?.carcassWeightArroba ?? 0
  );
  const [opCost, setOpCost] = useState<number>(
    existingClosing?.operationalCostPerHeadPerDay ?? 0
  );
  const [taxes, setTaxes] = useState<number>(existingClosing?.taxesPerHead ?? 0);
  const [yieldPercent, setYieldPercent] = useState<number>(
    existingClosing?.initialYieldPercent ?? 50
  );
  const [notes, setNotes] = useState<string>(existingClosing?.notes ?? '');

  // Calcula resultados em tempo real
  const results = useMemo(
    () =>
      computeClosingMetrics({
        initialWeightKg: lot.initialWeight,
        daysOnFeed,
        avgMSConsumptionPerHeadPerDay: avgMSConsumption,
        avgNutritionalCostPerHeadPerDay: avgNutritionalCost,
        headsSlaughtered,
        purchasePricePerHead: purchasePrice,
        salePricePerArroba: salePrice,
        finalLiveWeightKg: finalLiveWeight || undefined,
        carcassWeightKg: carcassWeightKg || undefined,
        carcassWeightArroba: carcassWeightArroba || undefined,
        operationalCostPerHeadPerDay: opCost,
        taxesPerHead: taxes,
        initialYieldPercent: yieldPercent,
      }),
    [
      lot.initialWeight, daysOnFeed, avgMSConsumption, avgNutritionalCost,
      headsSlaughtered, purchasePrice, salePrice, finalLiveWeight,
      carcassWeightKg, carcassWeightArroba, opCost, taxes, yieldPercent,
    ]
  );

  const handleSave = async () => {
    const alsoClose = lot.status === 'ACTIVE'
      ? window.confirm(`Deseja FECHAR (marcar como ABATIDO) o lote ${lot.name}? Isso impede novos lançamentos de trato.`)
      : false;

    const closing: Closing = {
      id: existingClosing?.id || `cl-${lot.id}-${Date.now()}`,
      lotId: lot.id,
      closingDate: analysisDate,
      headsSlaughtered,
      purchasePricePerHead: purchasePrice,
      salePricePerArroba: salePrice,
      finalLiveWeightKg: finalLiveWeight || undefined,
      carcassWeightKg: carcassWeightKg || undefined,
      carcassWeightArroba: carcassWeightArroba || undefined,
      operationalCostPerHeadPerDay: opCost,
      taxesPerHead: taxes,
      initialYieldPercent: yieldPercent,
      daysOnFeed,
      initialWeightKg: lot.initialWeight,
      avgMSConsumptionPerHeadPerDay: avgMSConsumption,
      avgNutritionalCostPerHeadPerDay: avgNutritionalCost,
      arrobasInitial: results.arrobasInitial,
      arrobasFinal: results.arrobasFinal,
      arrobasProduced: results.arrobasProduced,
      gmd: results.gmd,
      gdc: results.gdc,
      biologicalEfficiency: results.biologicalEfficiency,
      costPerArrobaProduced: results.costPerArrobaProduced,
      revenuePerHead: results.revenuePerHead,
      totalExpensePerHead: results.totalExpensePerHead,
      profitPerHead: results.profitPerHead,
      profitabilityPeriodPercent: results.profitabilityPeriodPercent,
      profitabilityMonthlyPercent: results.profitabilityMonthlyPercent,
      notes,
    };
    await onSave(closing, alsoClose);
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho do lote */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300 mb-1">Fechamento Zootécnico e Financeiro</div>
            <h2 className="text-2xl font-black italic tracking-tighter uppercase">{lot.name}</h2>
          </div>
          {existingClosing && (
            <span className="bg-amber-500/20 text-amber-200 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
              Fechamento salvo
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
          <div>
            <div className="text-slate-400 uppercase font-bold">Entrada</div>
            <div className="font-mono font-bold">{lot.entryDate.split('-').reverse().join('/')}</div>
          </div>
          <div>
            <div className="text-slate-400 uppercase font-bold">DOF</div>
            <div className="font-mono font-bold">{daysOnFeed} dias</div>
          </div>
          <div>
            <div className="text-slate-400 uppercase font-bold">Peso inicial</div>
            <div className="font-mono font-bold">{lot.initialWeight.toFixed(1)} kg</div>
          </div>
          <div>
            <div className="text-slate-400 uppercase font-bold">Peso projetado</div>
            <div className="font-mono font-bold">{projWeight.toFixed(1)} kg</div>
          </div>
        </div>
      </div>

      {/* Dados do sistema (consumo médio) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <History size={16} className="text-emerald-600" />
          <h3 className="text-xs font-black uppercase tracking-tight text-slate-700">Dados Calculados do Período</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <Metric label="MS/cab/dia médio" value={`${avgMSConsumption.toFixed(2)} kg`} />
          <Metric label="Custo nutricional/cab/dia" value={formatCurrency(avgNutritionalCost)} />
          <Metric label="MS total/cab" value={`${results.msConsumptionTotalPerHead.toFixed(0)} kg`} />
          <Metric label="Custo nutricional total/cab" value={formatCurrency(results.nutritionalCostTotalPerHead)} />
        </div>
        {lotFeedHistory.length === 0 && (
          <div className="mt-3 text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded">
            ⚠ Esse lote não tem nenhuma Ficha de Trato salva. Os cálculos derivados ficarão zerados.
          </div>
        )}
      </div>

      {/* Inputs do usuário */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calculator size={16} className="text-emerald-600" />
          <h3 className="text-xs font-black uppercase tracking-tight text-slate-700">Dados de Abate e Custos</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <InputField label="Cabeças abatidas" value={headsSlaughtered} onChange={setHeadsSlaughtered} suffix="cab" />
          <InputField label="Rendimento entrada" value={yieldPercent} onChange={setYieldPercent} suffix="%" step={0.1} hint="Padrão 50%" />
          <InputField label="Preço compra/cab" value={purchasePrice} onChange={setPurchasePrice} prefix="R$" step={0.01} />
          <InputField label="Preço venda @" value={salePrice} onChange={setSalePrice} prefix="R$" step={0.01} suffix="/@" />
          <InputField label="Peso final vivo" value={finalLiveWeight} onChange={setFinalLiveWeight} suffix="kg" step={0.5} hint="p/ GMD" />
          <div className="grid grid-cols-2 gap-2">
            <InputField label="Peso carcaça (kg)" value={carcassWeightKg} onChange={(v) => { setCarcassWeightKg(v); if (v > 0) setCarcassWeightArroba(0); }} suffix="kg" step={0.5} />
            <InputField label="ou em @" value={carcassWeightArroba} onChange={(v) => { setCarcassWeightArroba(v); if (v > 0) setCarcassWeightKg(0); }} suffix="@" step={0.01} />
          </div>
          <InputField label="Custo operacional/cab/dia" value={opCost} onChange={setOpCost} prefix="R$" step={0.01} />
          <InputField label="Impostos abate/cab" value={taxes} onChange={setTaxes} prefix="R$" step={0.01} />
        </div>

        <div className="mt-3">
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Observações (opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
      </div>

      {/* Resultados */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <CircleDollarSign size={16} className="text-emerald-600" />
          <h3 className="text-xs font-black uppercase tracking-tight text-slate-700">Resultados</h3>
        </div>

        {/* Zootécnico */}
        <div className="mb-4">
          <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Zootécnico</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard label="GMD" value={`${results.gmd.toFixed(2)} kg/dia`} accent="emerald" />
            <ResultCard label="GDC" value={`${results.gdc.toFixed(2)} kg/dia`} accent="emerald" />
            <ResultCard label="@ produzidas/cab" value={`${results.arrobasProduced.toFixed(2)} @`} accent="emerald" />
            <ResultCard label="Eficiência biológica" value={`${results.biologicalEfficiency.toFixed(1)} kg MS/@`} accent="emerald" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <ResultCard label="@ inicial" value={`${results.arrobasInitial.toFixed(2)} @`} accent="slate" small />
            <ResultCard label="@ final" value={`${results.arrobasFinal.toFixed(2)} @`} accent="slate" small />
            <ResultCard label="Rend. estimado" value={results.yieldEstimated > 0 ? `${results.yieldEstimated.toFixed(1)}%` : '—'} accent="slate" small />
            <ResultCard label="Custo @ produzida" value={formatCurrency(results.costPerArrobaProduced)} accent="amber" small />
          </div>
        </div>

        {/* Financeiro */}
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Financeiro (por cabeça)</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard label="Receita/cab" value={formatCurrency(results.revenuePerHead)} accent="blue" />
            <ResultCard label="Despesa total/cab" value={formatCurrency(results.totalExpensePerHead)} accent="rose" />
            <ResultCard label={results.profitPerHead >= 0 ? "Lucro/cab" : "Prejuízo/cab"} value={formatCurrency(results.profitPerHead)} accent={results.profitPerHead >= 0 ? "emerald" : "rose"} />
            <ResultCard label="Rentab. período" value={`${results.profitabilityPeriodPercent.toFixed(2)}%`} accent={results.profitabilityPeriodPercent >= 0 ? "emerald" : "rose"} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <ResultCard label="Rentab. ao mês" value={`${results.profitabilityMonthlyPercent.toFixed(2)}%`} accent="emerald" small />
            <ResultCard label="Custo nutricional" value={formatCurrency(results.nutritionalCostTotalPerHead)} accent="slate" small />
            <ResultCard label="Custo operacional" value={formatCurrency(results.operationalCostTotalPerHead)} accent="slate" small />
            <ResultCard label="Receita total" value={formatCurrency(results.revenuePerHead * headsSlaughtered)} accent="slate" small />
          </div>
        </div>
      </div>

      {/* Botões */}
      <div className="flex flex-wrap gap-2 justify-between">
        <div className="flex gap-2">
          {/* Exportar (sempre disponível com os dados atuais em memória) */}
          <button
            onClick={() => {
              const pen = pens.find((p) => p.id === lot.currentPenId);
              const exportData: FechamentoExportData = {
                lotName: lot.name,
                penName: pen?.name || '-',
                entryDate: lot.entryDate,
                closingDate: existingClosing?.closingDate || analysisDate,
                daysOnFeed,
                initialWeightKg: lot.initialWeight,
                avgMSConsumptionPerHeadPerDay: avgMSConsumption,
                avgNutritionalCostPerHeadPerDay: avgNutritionalCost,
                headsSlaughtered,
                initialYieldPercent: yieldPercent,
                purchasePricePerHead: purchasePrice,
                salePricePerArroba: salePrice,
                finalLiveWeightKg: finalLiveWeight || undefined,
                carcassWeightKg: carcassWeightKg || undefined,
                carcassWeightArroba: carcassWeightArroba || undefined,
                operationalCostPerHeadPerDay: opCost,
                taxesPerHead: taxes,
                arrobasInitial: results.arrobasInitial,
                arrobasFinal: results.arrobasFinal,
                arrobasProduced: results.arrobasProduced,
                gmd: results.gmd,
                gdc: results.gdc,
                biologicalEfficiency: results.biologicalEfficiency,
                costPerArrobaProduced: results.costPerArrobaProduced,
                yieldEstimated: results.yieldEstimated,
                msConsumptionTotalPerHead: results.msConsumptionTotalPerHead,
                nutritionalCostTotalPerHead: results.nutritionalCostTotalPerHead,
                operationalCostTotalPerHead: results.operationalCostTotalPerHead,
                revenuePerHead: results.revenuePerHead,
                totalExpensePerHead: results.totalExpensePerHead,
                profitPerHead: results.profitPerHead,
                profitabilityPeriodPercent: results.profitabilityPeriodPercent,
                profitabilityMonthlyPercent: results.profitabilityMonthlyPercent,
                notes,
              };
              try {
                generateFechamentoPDF(exportData);
              } catch (err) {
                console.error('[generateFechamentoPDF]', err);
                alert('Erro ao gerar PDF. Veja o console (F12).');
              }
            }}
            className="px-4 py-2 rounded-lg border-2 border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 flex items-center gap-2"
            title="Exportar PDF do fechamento"
          >
            <FileDown size={16} /> PDF
          </button>
          <button
            onClick={() => {
              const pen = pens.find((p) => p.id === lot.currentPenId);
              try {
                generateFechamentoExcel({
                  lotName: lot.name,
                  penName: pen?.name || '-',
                  entryDate: lot.entryDate,
                  closingDate: existingClosing?.closingDate || analysisDate,
                  daysOnFeed,
                  initialWeightKg: lot.initialWeight,
                  avgMSConsumptionPerHeadPerDay: avgMSConsumption,
                  avgNutritionalCostPerHeadPerDay: avgNutritionalCost,
                  headsSlaughtered,
                  initialYieldPercent: yieldPercent,
                  purchasePricePerHead: purchasePrice,
                  salePricePerArroba: salePrice,
                  finalLiveWeightKg: finalLiveWeight || undefined,
                  carcassWeightKg: carcassWeightKg || undefined,
                  carcassWeightArroba: carcassWeightArroba || undefined,
                  operationalCostPerHeadPerDay: opCost,
                  taxesPerHead: taxes,
                  arrobasInitial: results.arrobasInitial,
                  arrobasFinal: results.arrobasFinal,
                  arrobasProduced: results.arrobasProduced,
                  gmd: results.gmd,
                  gdc: results.gdc,
                  biologicalEfficiency: results.biologicalEfficiency,
                  costPerArrobaProduced: results.costPerArrobaProduced,
                  yieldEstimated: results.yieldEstimated,
                  msConsumptionTotalPerHead: results.msConsumptionTotalPerHead,
                  nutritionalCostTotalPerHead: results.nutritionalCostTotalPerHead,
                  operationalCostTotalPerHead: results.operationalCostTotalPerHead,
                  revenuePerHead: results.revenuePerHead,
                  totalExpensePerHead: results.totalExpensePerHead,
                  profitPerHead: results.profitPerHead,
                  profitabilityPeriodPercent: results.profitabilityPeriodPercent,
                  profitabilityMonthlyPercent: results.profitabilityMonthlyPercent,
                  notes,
                });
              } catch (err) {
                console.error('[generateFechamentoExcel]', err);
                alert('Erro ao gerar Excel. Veja o console (F12).');
              }
            }}
            className="px-4 py-2 rounded-lg border-2 border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 flex items-center gap-2"
            title="Exportar Excel do fechamento"
          >
            <FileText size={16} /> Excel
          </button>
        </div>

        <div className="flex gap-2">
          {existingClosing && (
            <button
              onClick={onDelete}
              className="px-4 py-2 rounded-lg border-2 border-rose-200 text-rose-600 font-bold text-sm hover:bg-rose-50 flex items-center gap-2"
            >
              <X size={16} /> Excluir Fechamento
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 flex items-center gap-2"
          >
            <Save size={16} /> {existingClosing ? 'Atualizar Fechamento' : 'Salvar Fechamento'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Componentes auxiliares
// ============================================================
const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">{label}</div>
    <div className="font-mono text-sm font-bold text-slate-800">{value}</div>
  </div>
);

const InputField: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  hint?: string;
}> = ({ label, value, onChange, prefix, suffix, step = 1, hint }) => (
  <div>
    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
      {label}
      {hint && <span className="ml-1 text-[9px] text-slate-400 normal-case italic">({hint})</span>}
    </label>
    <div className="flex items-center gap-1 border-2 border-slate-200 rounded-lg focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-transparent">
      {prefix && <span className="pl-2 text-slate-400 text-xs">{prefix}</span>}
      <input
        type="number"
        step={step}
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="flex-1 px-2 py-1.5 outline-none bg-transparent text-sm font-mono"
      />
      {suffix && <span className="pr-2 text-slate-400 text-xs">{suffix}</span>}
    </div>
  </div>
);

const ResultCard: React.FC<{ label: string; value: string; accent: 'emerald' | 'slate' | 'amber' | 'blue' | 'rose'; small?: boolean }> = ({ label, value, accent, small }) => {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    rose: 'bg-rose-50 border-rose-200 text-rose-800',
  };
  return (
    <div className={`border rounded-lg p-2.5 ${colors[accent]}`}>
      <div className={`font-black uppercase tracking-wider opacity-70 mb-0.5 ${small ? 'text-[8px]' : 'text-[9px]'}`}>{label}</div>
      <div className={`font-mono font-black ${small ? 'text-xs' : 'text-base'}`}>{value}</div>
    </div>
  );
};

export default FechamentoFinanceiro;
