
import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../context';
import { BunkScore, DailyFeedRecord, Lot } from '../types';
import { 
  calculateProjectedWeight, 
  getAdjustmentForScore,
  calculateDeviation,
  calculateDaysOnFeed,
  calculateConsumptionMetrics,
  getPreviousDayConsumption,
  calculateAllHeadCounts,
  sortLotsByPen
} from '../utils';
import { Calendar, Save, AlertCircle, CheckCircle, Calculator, Info, FileDown, Loader2 } from 'lucide-react';
import { generateFichaTratoPDF } from '../utils/pdfGenerator';
import { useSessionState } from '../lib/useSessionState';

interface SheetEntry {
  lotId: string;
  penName: string;
  headCount: number;
  dietName: string;
  dietId: string;       // dieta principal (rótulo)
  dietMS: number;
  dietCost: number;

  // Step intra-dia: dieta de cada trato. Length = config.numTreatments.
  // Por padrão todos = dietId. Quando alguma posição diverge, "modo step" ativo.
  dietsPerTrato: string[];

  // Logic F-13
  prevConsumptionMS: number; // Consumption from D-1 or Estimate

  bunkScore: BunkScore;
  drops: number[]; // Dynamic number of treatments

  daysOnFeed: number;
  projectedWeight: number;
  isSaved: boolean;
  isSaving?: boolean;
}

const FeedSheet: React.FC = () => {
  const { lots, pens, diets, config, feedHistory, getActiveHeadCount, addFeedRecord, movements, updateLot } = useAppStore();
  const [selectedDate, setSelectedDate] = useSessionState<string>('feedsheet.date', new Date().toISOString().split('T')[0]);
  const [entries, setEntries] = useState<SheetEntry[]>([]);
  
  const headCounts = useMemo(() => {
    return calculateAllHeadCounts(lots, movements, selectedDate);
  }, [lots, movements, selectedDate]);

  // Initialize/Refresh Entries when Date or Dependencies change
  useEffect(() => {
    // Determine active lots, sorted by pen name (natural numeric/alphabetic)
    const activeLots = sortLotsByPen(
      lots.filter(lot => {
        const heads = headCounts[lot.id] || 0;
        return heads > 0 && lot.status !== 'CLOSED';
      }),
      pens
    );

    const newEntries: SheetEntry[] = activeLots.map(lot => {
      const pen = pens.find(p => p.id === lot.currentPenId);
      const diet = diets.find(d => d.id === lot.currentDietId);
      const heads = headCounts[lot.id] || 0;
      
      // Check if we already have a record for this day
      const existingRecord = feedHistory.find(r => r.date === selectedDate && r.lotId === lot.id);

      // F-24: Days on Feed
      const daysOnFeed = calculateDaysOnFeed(lot.entryDate, selectedDate);
      const curve = config.gmdCurves?.find(c => c.id === lot.gmdCurveId);
      const gmd = curve?.gmd || 1.5;
      const projectedWeight = calculateProjectedWeight(lot.initialWeight, gmd, daysOnFeed);
      
      // F-13: Predicted Consumption
      // Try to find D-1 record
      const prevRecord = getPreviousDayConsumption(lot.id, selectedDate, feedHistory);
      
      let prevConsMS = 0;
      if (prevRecord) {
        prevConsMS = prevRecord.actualDryMatterPerHead;
      } else {
        // Fallback if no history: Estimate based on %PV defined at lot registration or global config
        // Initial Startup Calculation
        const initialPV = (lot as Lot).initialConsumptionPV || config.firstTratoMSPercentPV || 1.2;
        prevConsMS = projectedWeight * (initialPV / 100); 
      }

      const numTratos = config.numTreatments || 4;

      if (existingRecord) {
        // Carrega dietsPerTrato do registro salvo (ou inicializa todos = dieta atual se ausente)
        const savedDiets = (existingRecord as any).dietsPerTrato as string[] | undefined;
        const dietsPerTrato =
          savedDiets && savedDiets.length === numTratos
            ? savedDiets
            : Array(numTratos).fill(existingRecord.dietId || diet?.id || '');

        return {
          lotId: lot.id,
          penName: pen?.name || '?',
          headCount: existingRecord.headCount, // Use snapshot from record
          dietName: diet?.name || '?',
          dietId: diet?.id || '',
          dietMS: diet?.calculatedDryMatter || 0,
          dietCost: diet?.calculatedCostPerKg || 0,
          dietsPerTrato,
          prevConsumptionMS: prevConsMS,
          bunkScore: existingRecord.bunkScoreYesterday,
          drops: existingRecord.drops || Array(numTratos).fill(0),
          daysOnFeed,
          projectedWeight,
          isSaved: true,
          isSaving: false
        };
      }

      return {
        lotId: lot.id,
        penName: pen?.name || '?',
        headCount: heads,
        dietName: diet?.name || '?',
        dietId: diet?.id || '',
        dietMS: diet?.calculatedDryMatter || 60, // Fallback safe div
        dietCost: diet?.calculatedCostPerKg || 0,
        dietsPerTrato: Array(numTratos).fill(diet?.id || ''),
        prevConsumptionMS: prevConsMS,
        bunkScore: BunkScore.Zero,
        drops: Array(numTratos).fill(0),
        daysOnFeed,
        projectedWeight,
        isSaved: false,
        isSaving: false
      };
    });

    setEntries(newEntries);
  }, [selectedDate, lots, pens, diets, feedHistory, config, headCounts]); // Inclui headCounts para reatividade a movements

  /**
   * Cálculo MN considerando step intra-dia.
   * - msTotalKg = total de matéria seca alvo no dia
   * - tratoProportions = proporções (em %) de cada trato (somam 100)
   * - dietsPerTrato = ID da dieta usada em cada trato
   * - dietsList = todas as dietas (pra lookup do MS%)
   * Retorna { dropPredictions: kg MN por trato, totalMN: soma }
   */
  const calculateMNWithStep = (
    msTotalKg: number,
    tratoProportions: number[],
    dietsPerTrato: string[],
    dietsList: typeof diets,
    fallbackMSPercent: number
  ): { dropPredictions: number[]; totalMN: number } => {
    const dropPredictions: number[] = tratoProportions.map((prop, i) => {
      const msTrato = msTotalKg * (prop / 100); // kg MS daquele trato
      const dietId = dietsPerTrato[i];
      const dietForTrato = dietsList.find(d => d.id === dietId);
      const msPercent = dietForTrato?.calculatedDryMatter || fallbackMSPercent;
      // kg MN do trato = kg MS / (MS% / 100)
      return Math.round(msTrato / (msPercent / 100));
    });
    const totalMN = dropPredictions.reduce((a, b) => a + b, 0);
    return { dropPredictions, totalMN };
  };

  /** Soma o custo R$/cabeça considerando step intra-dia */
  const calculateCostWithStep = (
    actualDrops: number[],
    dietsPerTrato: string[],
    dietsList: typeof diets,
    headCount: number,
    fallbackCost: number
  ): number => {
    if (headCount <= 0) return 0;
    let totalCost = 0;
    for (let i = 0; i < actualDrops.length; i++) {
      const dropMN = actualDrops[i] || 0;
      const dietForTrato = dietsList.find(d => d.id === dietsPerTrato[i]);
      const costPerKg = dietForTrato?.calculatedCostPerKg ?? fallbackCost;
      totalCost += dropMN * costPerKg;
    }
    return totalCost / headCount;
  };

  const handleTratoDietChange = (entryIndex: number, tratoIndex: number, dietId: string) => {
    setEntries(prev => {
      const n = [...prev];
      const newDietsPerTrato = [...n[entryIndex].dietsPerTrato];
      newDietsPerTrato[tratoIndex] = dietId;
      n[entryIndex] = { ...n[entryIndex], dietsPerTrato: newDietsPerTrato, isSaved: false };
      return n;
    });
  };

  const handleBunkScoreChange = (index: number, value: string) => {
    const score = parseFloat(value) as BunkScore;
    setEntries(prev => {
      const n = [...prev];
      n[index] = { ...n[index], bunkScore: score };
      return n;
    });
  };

  const handleInputChange = (index: number, dropIndex: number, value: string) => {
    const val = parseInt(value) || 0;
    setEntries(prev => {
      const n = [...prev];
      const newDrops = [...n[index].drops];
      newDrops[dropIndex] = val;
      n[index] = { ...n[index], drops: newDrops };
      return n;
    });
  };

  const handleDietChange = async (index: number, dietId: string) => {
    const entry = entries[index];
    const diet = diets.find(d => d.id === dietId);
    if (!diet) return;

    if (window.confirm(`Deseja alterar a dieta do lote ${entry.lotId} para ${diet.name}?`)) {
      await updateLot(entry.lotId, { currentDietId: dietId });
      // Update local entry state to reflect change immediately
      setEntries(prev => {
        const n = [...prev];
        const numTratos = n[index].dietsPerTrato.length || (config.numTreatments || 4);
        n[index] = { 
          ...n[index], 
          dietId: diet.id, 
          dietName: diet.name, 
          dietMS: diet.calculatedDryMatter, 
          dietCost: diet.calculatedCostPerKg,
          // Reseta o step: todos os tratos voltam pra dieta principal
          dietsPerTrato: Array(numTratos).fill(diet.id),
          isSaved: false
        };
        return n;
      });
    }
  };

  const handleSave = async (index: number) => {
    setEntries(prev => {
      const n = [...prev];
      n[index] = { ...n[index], isSaving: true };
      return n;
    });

    // Simulate saving process for UX feedback
    await new Promise(resolve => setTimeout(resolve, 600));

    const entry = entries[index];

    // Recalcula com step intra-dia
    const adjustment = getAdjustmentForScore(entry.bunkScore, config.bunkScoreAdjustments || []);
    const predictedMSPerHead = entry.prevConsumptionMS * (1 + (adjustment / 100));
    const msTotalKg = predictedMSPerHead * entry.headCount; // kg MS total previsto pra hoje

    // Detecta se está em "modo step" (algum trato com dieta diferente da principal)
    const isStepMode = entry.dietsPerTrato.some(d => d !== entry.dietId);

    let predictedTotalMN: number;
    if (isStepMode) {
      const result = calculateMNWithStep(
        msTotalKg,
        config.treatmentProportions || [25, 25, 25, 25],
        entry.dietsPerTrato,
        diets,
        entry.dietMS
      );
      predictedTotalMN = result.totalMN;
    } else {
      // Modo tradicional: 1 dieta o dia inteiro
      const predictedMNPerHead = predictedMSPerHead / (entry.dietMS / 100);
      predictedTotalMN = Math.round(predictedMNPerHead * entry.headCount);
    }

    const actualTotalMN = entry.drops.reduce((a, b) => a + b, 0);
    const deviation = calculateDeviation(actualTotalMN, predictedTotalMN);

    // Métricas: se step ativo, calcula custo por trato; senão usa metric padrão
    let costPerHead: number;
    let actualMSPerHead: number;
    let actualMSPercentPV: number;

    if (isStepMode) {
      costPerHead = calculateCostWithStep(
        entry.drops,
        entry.dietsPerTrato,
        diets,
        entry.headCount,
        entry.dietCost
      );
      // MS real: soma de (drop * MS%/100) por trato
      let msTotalReal = 0;
      for (let i = 0; i < entry.drops.length; i++) {
        const dietForTrato = diets.find(d => d.id === entry.dietsPerTrato[i]);
        const msPercent = dietForTrato?.calculatedDryMatter || entry.dietMS;
        msTotalReal += (entry.drops[i] || 0) * (msPercent / 100);
      }
      actualMSPerHead = entry.headCount > 0 ? msTotalReal / entry.headCount : 0;
      actualMSPercentPV = entry.projectedWeight > 0 ? (actualMSPerHead / entry.projectedWeight) * 100 : 0;
    } else {
      const metrics = calculateConsumptionMetrics(
        actualTotalMN,
        entry.headCount,
        entry.dietMS,
        entry.projectedWeight,
        entry.dietCost
      );
      costPerHead = metrics.costPerHead;
      actualMSPerHead = metrics.msPerHead;
      actualMSPercentPV = metrics.msPercentPV;
    }

    const record: DailyFeedRecord = {
      id: `${selectedDate}_${entry.lotId}`,
      date: selectedDate,
      lotId: entry.lotId,
      penId: lots.find(l => l.id === entry.lotId)?.currentPenId || '',
      dietId: entry.dietId,
      dietsPerTrato: isStepMode ? entry.dietsPerTrato : undefined, // só grava se for diferente
      headCount: entry.headCount,
      daysOnFeed: entry.daysOnFeed,
      projectedWeight: entry.projectedWeight,
      bunkScoreYesterday: entry.bunkScore,
      adjustmentPercentage: adjustment,
      predictedTotalMN,
      actualTotalMN,
      drops: entry.drops,
      actualDryMatterPerHead: actualMSPerHead,
      actualDryMatterPercentPV: actualMSPercentPV,
      costPerHead,
      deviationPercent: deviation
    };

    try {
      await addFeedRecord(record);
    } catch (err) {
      console.error('[handleSave] Erro ao salvar ficha:', err);
      alert('Erro ao salvar a ficha de trato. Verifique sua conexão.');
      setEntries(prev => {
        const n = [...prev];
        n[index] = { ...n[index], isSaving: false };
        return n;
      });
      return;
    }
    
    setEntries(prev => {
      const n = [...prev];
      n[index] = { ...n[index], isSaved: true, isSaving: false };
      return n;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ficha de Fornecimento</h1>
          <p className="text-slate-500">Operação diária • {entries.length} Lotes Ativos</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button 
  onClick={() => {
    const entriesWithPredictions = entries.map(entry => {
      const adjustment = getAdjustmentForScore(entry.bunkScore, config.bunkScoreAdjustments || []);
      const predictedMSPerHead = entry.prevConsumptionMS * (1 + (adjustment / 100));
      const msTotalKg = predictedMSPerHead * entry.headCount;
      const isStepMode = entry.dietsPerTrato.some(d => d !== entry.dietId);

      let predictedTotalMN: number;
      let dropPredictions: number[];

      if (isStepMode) {
        const result = calculateMNWithStep(
          msTotalKg,
          config.treatmentProportions || [25, 25, 25, 25],
          entry.dietsPerTrato,
          diets,
          entry.dietMS
        );
        predictedTotalMN = result.totalMN;
        dropPredictions = result.dropPredictions;
      } else {
        const predictedMNPerHead = predictedMSPerHead / (entry.dietMS / 100);
        predictedTotalMN = Math.round(predictedMNPerHead * entry.headCount);
        dropPredictions = Array.from({ length: config.numTreatments || 4 }).map((_, i) => {
          const isLast = i === (config.numTreatments || 4) - 1;
          if (!isLast) {
            return Math.round(predictedTotalMN * ((config.treatmentProportions[i] || 25) / 100));
          } else {
            return predictedTotalMN - Array.from({ length: i }).reduce<number>(
              (acc, _, idx) => acc + Math.round(predictedTotalMN * ((config.treatmentProportions[idx] || 25) / 100)), 0
            );
          }
        });
      }

      // Mapeia IDs de dieta -> nomes pra exibir no PDF
      const dietsPerTratoNames = entry.dietsPerTrato.map(dId => {
        const d = diets.find(x => x.id === dId);
        return d?.name || entry.dietName;
      });

      return { ...entry, predictedTotalMN, dropPredictions, dietsPerTrato: dietsPerTratoNames };
    });
    generateFichaTratoPDF(entriesWithPredictions, selectedDate, config.treatmentProportions);
  }}
            className="flex items-center gap-2 bg-white border border-slate-300 px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <FileDown size={18} className="text-emerald-600" />
            <span className="font-medium">Exportar PDF</span>
          </button>

          <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
            <Calendar className="text-slate-400" size={20} />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="outline-none text-slate-700 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Main Table — DESKTOP/TABLET (≥ md, evita scroll horizontal em mobile) */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
              <tr>
                <th className="px-4 py-4 min-w-[180px]">Baia / Lote</th>
                <th className="px-4 py-4">Dieta</th>
                <th className="px-4 py-4 text-center min-w-[140px]">Leitura Cocho</th>
                <th className="px-4 py-4 text-center">Previsto (MN)</th>
                {Array.from({ length: config.numTreatments || 4 }).map((_, i) => (
                  <th key={i} className="px-4 py-4 text-center min-w-[100px]">
                    Trato {i + 1} ({config.treatmentProportions[i] || 0}%)
                  </th>
                ))}
                <th className="px-4 py-4 text-center">Realizado</th>
                <th className="px-4 py-4 text-center">Desvio</th>
                <th className="px-4 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    Nenhum lote ativo encontrado para esta data.
                  </td>
                </tr>
              )}
              {entries.map((entry, index) => {
                const adjustment = getAdjustmentForScore(entry.bunkScore, config.bunkScoreAdjustments || []);
                
                // F-13 Calculation Display
                const predictedMSPerHead = (entry.prevConsumptionMS || 0) * (1 + (adjustment / 100));
                // Convert back to MN: MN = MS / (DietMS%/100)
                const dietMSFactor = (entry.dietMS || 60) / 100;
                const predictedMNPerHead = dietMSFactor > 0 ? (predictedMSPerHead / dietMSFactor) : 0;
                
                const isStepMode = entry.dietsPerTrato.some(d => d !== entry.dietId);
                const msTotalKg = predictedMSPerHead * (entry.headCount || 0);

                // Cálculo do total + drop predictions (step-aware)
                const stepResult = isStepMode
                  ? calculateMNWithStep(
                      msTotalKg,
                      config.treatmentProportions || [25, 25, 25, 25],
                      entry.dietsPerTrato,
                      diets,
                      entry.dietMS
                    )
                  : null;

                const predictedTotalMN = stepResult
                  ? stepResult.totalMN
                  : Math.round((isNaN(predictedMNPerHead) ? 0 : predictedMNPerHead) * (entry.headCount || 0));
                
                const totalActual = (entry.drops || []).reduce((a, b) => a + (b || 0), 0);
                const deviation = calculateDeviation(totalActual, predictedTotalMN);
                const isWithinLimits = isNaN(deviation) || (deviation >= (config.loadingLimitLower || -5) && deviation <= (config.loadingLimitUpper || 5));
                
                return (
                  <tr key={entry.lotId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-900">{entry.penName}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        Lote {entry.lotId.toUpperCase()} • {entry.headCount} cab
                        {entry.headCount === 0 && <span className="text-red-500 font-bold">(Vazio)</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        <select 
                          value={entry.dietId}
                          onChange={(e) => handleDietChange(index, e.target.value)}
                          disabled={entry.isSaved}
                          className="bg-blue-50 text-blue-700 px-2 py-1.5 rounded-lg text-xs font-black outline-none border border-blue-200 hover:border-blue-400 cursor-pointer w-full transition-all"
                        >
                          {diets.filter(d => d.status === 'ACTIVE' || d.id === entry.dietId).map(d => (
                            <option key={d.id} value={d.id}>{d.name || 'Sem Nome'}</option>
                          ))}
                        </select>
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter truncate max-w-[120px]" title={entry.dietName}>
                            {entry.dietName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">MS: {entry.dietMS.toFixed(1)}%</span>
                        </div>
                      </div>
                    </td>
                    
                    {/* Bunk Score Input (F-03 Usage) */}
                    <td className="px-4 py-4 text-center">
                      <select 
                        value={entry.bunkScore}
                        onChange={(e) => handleBunkScoreChange(index, e.target.value)}
                        disabled={entry.isSaved}
                        className="w-full p-2 border rounded text-xs text-center font-medium bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                      >
                        {(config.bunkScoreAdjustments || []).map(rule => (
                          <option key={rule.score} value={rule.score}>
                             Sc {rule.score} ({rule.adjustmentPercentage > 0 ? '+' : ''}{rule.adjustmentPercentage}%)
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-4 text-center bg-slate-50/50">
                      <div className="flex flex-col items-center group relative cursor-help">
                        <span className="font-mono text-lg font-semibold text-slate-700">
                          {predictedTotalMN.toLocaleString()}
                        </span>
                        {adjustment !== 0 && (
                          <span className={`text-[10px] font-bold ${adjustment > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {adjustment > 0 ? '▲' : '▼'} {Math.abs(adjustment)}%
                          </span>
                        )}
                        {/* Tooltip for F-13 logic explanation */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block w-48 bg-slate-800 text-white text-xs p-2 rounded z-10 text-left">
                          <p className="font-bold border-b border-slate-600 pb-1 mb-1">Cálculo (F-13)</p>
                          <p>Cons. Anterior (MS): {entry.prevConsumptionMS.toFixed(2)} kg</p>
                          <p>Correção: {adjustment}%</p>
                          <p>Meta MS: {predictedMSPerHead.toFixed(2)} kg</p>
                          <p>Meta MN/cab: {predictedMNPerHead.toFixed(2)} kg</p>
                        </div>
                      </div>
                    </td>

                    {Array.from({ length: config.numTreatments || 4 }).map((_, dropIdx) => {
                      const isLast = dropIdx === (config.numTreatments || 4) - 1;
                      const proportion = config.treatmentProportions[dropIdx] || 25;

                      // Drop prediction com step se aplicável
                      let dropPrediction = 0;
                      if (stepResult) {
                        dropPrediction = stepResult.dropPredictions[dropIdx] || 0;
                      } else if (!isLast) {
                        dropPrediction = Math.round(predictedTotalMN * (proportion / 100));
                      } else {
                        const previousActuals = entry.drops.slice(0, dropIdx).reduce((a, b) => a + b, 0);
                        dropPrediction = Math.max(0, predictedTotalMN - previousActuals);
                      }

                      // Dieta usada nesse trato (lookup pra exibir nome se step ativo)
                      const tratoDietId = entry.dietsPerTrato[dropIdx] || entry.dietId;
                      const tratoDiet = diets.find(d => d.id === tratoDietId);
                      const isDifferentFromMain = tratoDietId !== entry.dietId;

                      return (
                        <td key={dropIdx} className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-bold text-slate-400">
                              Prev: {dropPrediction.toLocaleString()}
                            </span>
                            <input
                                type="number"
                                value={entry.drops[dropIdx] || ''}
                                onChange={(e) => handleInputChange(index, dropIdx, e.target.value)}
                                disabled={entry.isSaved}
                                className={`w-20 px-2 py-1 border rounded text-center focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-slate-100 ${isLast ? 'border-emerald-300 bg-emerald-50/30' : ''}`}
                                placeholder={dropPrediction.toFixed(0)}
                              />
                            {/* Dropdown discreto de dieta por trato (step intra-dia) */}
                            <select
                              value={tratoDietId}
                              onChange={(e) => handleTratoDietChange(index, dropIdx, e.target.value)}
                              disabled={entry.isSaved}
                              title={isDifferentFromMain ? `Step ativo: ${tratoDiet?.name || ''}` : 'Mesma dieta principal — clique pra mudar'}
                              className={`text-[9px] px-1 py-0.5 rounded border max-w-[90px] truncate
                                ${isDifferentFromMain
                                  ? 'border-amber-400 bg-amber-50 text-amber-800 font-bold'
                                  : 'border-slate-200 bg-white text-slate-500'}
                                disabled:opacity-50`}
                            >
                              {diets.filter(d => d.status === 'ACTIVE').map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-4 text-center">
                      <span className={`font-mono text-lg font-bold ${entry.isSaved ? 'text-slate-800' : 'text-slate-400'}`}>
                        {totalActual > 0 ? totalActual.toLocaleString() : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {totalActual > 0 && (
                        <div className={`
                          inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap
                          ${isWithinLimits ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}
                        `}>
                          {isWithinLimits ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                          {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}%
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button 
                        onClick={() => handleSave(index)}
                        disabled={entry.isSaved || entry.isSaving || totalActual === 0}
                        className={`
                          p-2 rounded-lg transition-colors relative flex items-center justify-center mx-auto
                          ${entry.isSaved 
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'}
                          ${entry.isSaving ? 'opacity-80' : ''}
                        `}
                        title="Confirmar Trato"
                      >
                        {entry.isSaving ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Save size={18} />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE — card stack vertical (oculta em md+) */}
      <div className="md:hidden space-y-3">
        {entries.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
            Nenhum lote ativo encontrado para esta data.
          </div>
        )}
        {entries.map((entry, index) => {
          const adjustment = getAdjustmentForScore(entry.bunkScore, config.bunkScoreAdjustments || []);
          const predictedMSPerHead = (entry.prevConsumptionMS || 0) * (1 + (adjustment / 100));
          const dietMSFactor = (entry.dietMS || 60) / 100;
          const predictedMNPerHead = dietMSFactor > 0 ? (predictedMSPerHead / dietMSFactor) : 0;
          const isStepMode = entry.dietsPerTrato.some(d => d !== entry.dietId);
          const msTotalKg = predictedMSPerHead * (entry.headCount || 0);
          const stepResult = isStepMode
            ? calculateMNWithStep(msTotalKg, config.treatmentProportions || [25, 25, 25, 25], entry.dietsPerTrato, diets, entry.dietMS)
            : null;
          const totalPredicted = stepResult ? stepResult.totalMN : Math.round(predictedMNPerHead * (entry.headCount || 0));
          const totalActual = entry.drops.reduce((a, b) => a + (b || 0), 0);
          const deviation = calculateDeviation(totalActual, totalPredicted);
          const isWithinLimits = totalActual === 0 || (deviation >= (config.loadingLimitLower || -5) && deviation <= (config.loadingLimitUpper || 5));

          return (
            <div key={entry.lotId + index} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Cabeçalho */}
              <div className="p-3 bg-slate-50 flex items-center justify-between border-b">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px] font-black">{entry.penName}</div>
                    <div className="font-bold text-slate-900 text-sm">{entry.lotId.toUpperCase()}</div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {entry.headCount} cab · {entry.dietName} · DOF {entry.daysOnFeed}
                  </div>
                </div>
                {entry.isSaved && (
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded">SALVO</span>
                )}
              </div>

              {/* Leitura de cocho */}
              <div className="p-3 border-b">
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Leitura Cocho (escore ontem)</div>
                <select
                  value={entry.bunkScore}
                  onChange={(e) => handleBunkScoreChange(index, e.target.value)}
                  disabled={entry.isSaved}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-slate-100"
                >
                  {[0, 0.5, 1, 1.5, 2, 3, 4].map(s => (
                    <option key={s} value={s}>Escore {s} ({adjustment > 0 && s === entry.bunkScore ? '+' : ''}{getAdjustmentForScore(s as any, config.bunkScoreAdjustments || [])}%)</option>
                  ))}
                </select>
              </div>

              {/* Tratos */}
              <div className="p-3 border-b">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Tratos (kg MN)</div>
                  <div className="text-[10px] text-slate-400">Previsto: <strong className="text-slate-700">{totalPredicted.toLocaleString()}</strong></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {entry.drops.map((drop, dropIdx) => {
                    const tratoDietId = entry.dietsPerTrato[dropIdx] || entry.dietId;
                    const tratoDiet = diets.find(d => d.id === tratoDietId);
                    const isDifferent = tratoDietId !== entry.dietId;
                    const dropPredict = stepResult ? stepResult.dropPredictions[dropIdx] : Math.round(totalPredicted * ((config.treatmentProportions[dropIdx] || 25) / 100));
                    return (
                      <div key={dropIdx} className="border rounded-lg p-2">
                        <div className="text-[9px] font-black text-slate-400 uppercase">Trato {dropIdx + 1} ({config.treatmentProportions[dropIdx] || 0}%)</div>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={drop || ''}
                          onChange={(e) => handleInputChange(index, dropIdx, e.target.value)}
                          disabled={entry.isSaved}
                          placeholder={dropPredict.toString()}
                          className="w-full mt-1 px-2 py-1.5 border rounded text-center font-bold focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-slate-100"
                        />
                        <select
                          value={tratoDietId}
                          onChange={(e) => handleTratoDietChange(index, dropIdx, e.target.value)}
                          disabled={entry.isSaved}
                          className={`w-full mt-1 text-[9px] px-1 py-0.5 rounded border truncate ${isDifferent ? 'border-amber-400 bg-amber-50 text-amber-800 font-bold' : 'border-slate-200 bg-white text-slate-500'} disabled:opacity-50`}
                        >
                          {diets.filter(d => d.status === 'ACTIVE').map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rodapé com totais e ação */}
              <div className="p-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Realizado</div>
                  <div className="font-mono text-lg font-bold text-slate-800">{totalActual > 0 ? totalActual.toLocaleString() : '-'}</div>
                  {totalActual > 0 && (
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1 ${isWithinLimits ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}%
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleSave(index)}
                  disabled={entry.isSaved || entry.isSaving || totalActual === 0}
                  className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 ${entry.isSaved ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'} disabled:opacity-50`}
                >
                  {entry.isSaving ? <Loader2 className="animate-spin" size={16} /> : entry.isSaved ? <CheckCircle size={16} /> : <Save size={16} />}
                  {entry.isSaved ? 'Salvo' : 'Salvar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FeedSheet;
