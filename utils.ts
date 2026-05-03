
import { DailyFeedRecord, Diet, Ingredient, Lot, Pen, BunkScore, BunkScoreAdjustment, AnimalMovement, MovementType } from './types';

// F-07: Calculate Diet Dry Matter % and Cost from MS Base
export const calculateDietMetrics = (diet: Diet, allIngredients: Ingredient[]) => {
  let totalMNWeightFor1kgMS = 0;
  let totalCostFor1kgMS = 0;
  
  const validIngredients: { ingredient: Ingredient, msWeight: number }[] = [];

  diet.ingredients.forEach(item => {
    const ingredient = allIngredients.find(i => i.id === item.ingredientId);
    if (ingredient && ingredient.dryMatterContent > 0) {
      const msFraction = (item.inclusionMSPercentage || 0) / 100;
      const ingredientDM = ingredient.dryMatterContent / 100;
      
      const mnWeight = msFraction / ingredientDM;
      const pricePerKgMN = ingredient.pricePerTon / 1000;
      
      totalMNWeightFor1kgMS += mnWeight;
      totalCostFor1kgMS += (mnWeight * pricePerKgMN);
      
      validIngredients.push({ ingredient, msWeight: msFraction });
    }
  });

  // Diet DM% = (Total MS / Total MN) * 100 = (1 / totalMNWeightFor1kgMS) * 100
  const dietDMPercent = totalMNWeightFor1kgMS > 0 ? (1 / totalMNWeightFor1kgMS) * 100 : 0;
  const costPerKgMN = totalMNWeightFor1kgMS > 0 ? (totalCostFor1kgMS / totalMNWeightFor1kgMS) : 0;

  const ingredientMetrics = validIngredients.map(item => {
    const mnWeight = item.msWeight / (item.ingredient.dryMatterContent / 100);
    const mnPercentage = totalMNWeightFor1kgMS > 0 ? (mnWeight / totalMNWeightFor1kgMS) * 100 : 0;
    
    return {
      ingredientId: item.ingredient.id,
      mnPercentage: mnPercentage,
      msPercentage: item.msWeight * 100,
      costPerKgMN: item.ingredient.pricePerTon / 1000
    };
  });

  return {
    ms: dietDMPercent,
    costPerKgMN: costPerKgMN,
    ingredientMetrics: ingredientMetrics
  };
};

// F-24: Calculate Days on Feed
export const calculateDaysOnFeed = (entryDate: string, currentDate: string): number => {
  const start = new Date(entryDate).getTime();
  const now = new Date(currentDate).getTime();
  const diffTime = now - start;
  
  if (isNaN(diffTime) || diffTime < 0) return 0;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
};

// F-24: Calculate Projected Weight
export const calculateProjectedWeight = (initialWeight: number, gmd: number, daysOnFeed: number): number => {
  return initialWeight + (gmd * daysOnFeed);
};

// F-14: Calculate Actual Consumption Metrics
export const calculateConsumptionMetrics = (
  actualTotalMN: number,
  headCount: number,
  dietMS: number,
  projectedWeight: number,
  dietCostPerKg: number
) => {
  if (headCount === 0) return { mnPerHead: 0, msPerHead: 0, msPercentPV: 0, costPerHead: 0 };

  const mnPerHead = headCount > 0 ? (actualTotalMN / headCount) : 0;
  const msPerHead = mnPerHead * ((dietMS || 0) / 100);
  const msPercentPV = projectedWeight > 0 ? (msPerHead / projectedWeight) * 100 : 0;
  const costPerHead = mnPerHead * (dietCostPerKg || 0);

  return {
    mnPerHead: isNaN(mnPerHead) ? 0 : mnPerHead,
    msPerHead: isNaN(msPerHead) ? 0 : msPerHead,
    msPercentPV: isNaN(msPercentPV) ? 0 : msPercentPV,
    costPerHead: isNaN(costPerHead) ? 0 : costPerHead
  };
};

// F-15: Calculate Deviation
export const calculateDeviation = (actual: number, predicted: number): number => {
  if (predicted === 0) return 0;
  return ((actual - predicted) / predicted) * 100;
};

// F-03: Bunk Score Correction Rule (Using Config)
export const getAdjustmentForScore = (score: BunkScore, rules: BunkScoreAdjustment[]): number => {
  const rule = rules.find(r => r.score == score); // Loose equality for string/number match
  return rule ? rule.adjustmentPercentage : 0;
};

// F-09: Calculate Active Head Count for a Lot based on Movements
// Lógica robusta:
//  - Se houver QUALQUER Entry registrada: o total = soma das Entries - soma de mortes/saídas/transferências/refugos
//  - Se NÃO houver Entry: usa lot.headCount como base + deltas (Transfer/Death/Exit/Refusal subtraem)
export const calculateActiveHeadCount = (
  lotId: string, 
  initialHeads: number, 
  movements: AnimalMovement[],
  asOfDate?: string
): number => {
  let entryTotal = 0;
  let deltaTotal = 0;
  let entryFound = false;

  for (let i = 0; i < movements.length; i++) {
    const mov = movements[i];
    if (mov.lotId !== lotId) continue;
    if (asOfDate && mov.date > asOfDate) continue;

    if (mov.type === MovementType.Entry) {
      entryTotal += mov.quantity;
      entryFound = true;
    } else {
      // Death, Exit, Transfer, Refusal — todos subtraem
      deltaTotal -= mov.quantity;
    }
  }

  if (entryFound) {
    return Math.max(0, entryTotal + deltaTotal);
  }
  return Math.max(0, initialHeads + deltaTotal);
};

// Optimization for bulk processing (Reports, FeedSheet initialization)
export const calculateAllHeadCounts = (
  lots: Lot[],
  movements: AnimalMovement[],
  asOfDate?: string
): Record<string, number> => {
  // Estado por lote: soma de Entries e soma de deltas (sempre <= 0)
  const lotStates: Record<string, { entryTotal: number; deltaTotal: number; foundEntry: boolean; baseHeads: number }> = {};

  // Inicializa com base do lote
  for (let i = 0; i < lots.length; i++) {
    const lot = lots[i];
    lotStates[lot.id] = { entryTotal: 0, deltaTotal: 0, foundEntry: false, baseHeads: lot.headCount };
  }

  // Processa movements
  for (let i = 0; i < movements.length; i++) {
    const mov = movements[i];
    if (asOfDate && mov.date > asOfDate) continue;

    if (!lotStates[mov.lotId]) {
      lotStates[mov.lotId] = { entryTotal: 0, deltaTotal: 0, foundEntry: false, baseHeads: 0 };
    }
    const state = lotStates[mov.lotId];

    if (mov.type === MovementType.Entry) {
      state.entryTotal += mov.quantity;
      state.foundEntry = true;
    } else {
      // Death, Exit, Transfer, Refusal — subtraem
      state.deltaTotal -= mov.quantity;
    }
  }

  const results: Record<string, number> = {};
  for (const id in lotStates) {
    const s = lotStates[id];
    const total = s.foundEntry
      ? s.entryTotal + s.deltaTotal
      : s.baseHeads + s.deltaTotal;
    results[id] = isNaN(total) ? 0 : Math.max(0, total);
  }
  return results;
};

export const calculatePenOccupancy = (
  pens: Pen[],
  lots: Lot[],
  movements: AnimalMovement[]
): Record<string, number> => {
  const headCounts = calculateAllHeadCounts(lots, movements);
  const penOccupancy: Record<string, number> = {};
  
  pens.forEach(pen => {
    penOccupancy[pen.id] = 0;
  });

  lots.forEach(lot => {
    if (lot.status === 'ACTIVE' && penOccupancy[lot.currentPenId] !== undefined) {
      penOccupancy[lot.currentPenId] += headCounts[lot.id] || 0;
    }
  });

  return penOccupancy;
};

export const getPreviousDayConsumption = (
  lotId: string, 
  currentDate: string, 
  history: DailyFeedRecord[]
): DailyFeedRecord | undefined => {
  const current = new Date(currentDate);
  const oneDay = 24 * 60 * 60 * 1000;
  const prevDate = new Date(current.getTime() - oneDay).toISOString().split('T')[0];
  
  return history.find(h => h.lotId === lotId && h.date === prevDate);
};

export const formatCurrency = (val: number) => 
  val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

export const formatNumber = (val: number, digits = 2) => 
  val.toLocaleString('pt-BR', {minimumFractionDigits: digits, maximumFractionDigits: digits});
