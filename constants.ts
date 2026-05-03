
import { AppConfig, Diet, Ingredient, Lot, Pen, DailyFeedRecord, BunkScore, AnimalMovement, MovementType } from './types';
import { calculateDietMetrics } from './utils';

// F-01, F-02, F-03: Configuration Defaults
export const DEFAULT_CONFIG: AppConfig = {
  numTreatments: 4,
  treatmentProportions: [30, 20, 20, 30],
  firstTratoMSPercentPV: 1.2,
  bunkScoreAdjustments: [
    { score: BunkScore.Zero, adjustmentPercentage: 10 },
    { score: BunkScore.Half, adjustmentPercentage: 5 },
    { score: BunkScore.One, adjustmentPercentage: 0 },
    { score: BunkScore.OneHalf, adjustmentPercentage: -2.5 },
    { score: BunkScore.Two, adjustmentPercentage: -5 },
    { score: BunkScore.Three, adjustmentPercentage: -10 },
    { score: BunkScore.Four, adjustmentPercentage: -15 },
  ],
  loadingLimitLower: -5,
  loadingLimitUpper: 5,
  gmdCurves: [
    { id: 'curva_padrao', name: 'Curva Padrão (F-22)', gmd: 1.5 },
    { id: 'curva_alta', name: 'Alto Desempenho', gmd: 1.8 },
    { id: 'curva_baixa', name: 'Baixo Desempenho', gmd: 1.2 }
  ],
};

export const MOCK_INGREDIENTS: Ingredient[] = [];

// Helper to create diet with calcs
const createDiet = (id: string, name: string, ingredients: {id: string, pct: number}[]): Diet => {
  const d: Diet = {
    id,
    name,
    ingredients: ingredients.map(i => ({ 
      ingredientId: i.id, 
      inclusionMSPercentage: i.pct,
      inclusionMNPercentage: 0 
    })),
    calculatedCostPerKg: 0,
    calculatedDryMatter: 0
  };
  const metrics = calculateDietMetrics(d, MOCK_INGREDIENTS);
  
  // Update MN percentages from metrics
  d.ingredients = d.ingredients.map(ing => {
    const metric = metrics.ingredientMetrics.find(m => m.ingredientId === ing.ingredientId);
    return { ...ing, inclusionMNPercentage: metric ? metric.mnPercentage : 0 };
  });

  d.calculatedCostPerKg = metrics.costPerKgMN;
  d.calculatedDryMatter = metrics.ms;
  return d;
};

export const MOCK_DIETS: Diet[] = [];

export const MOCK_PENS: Pen[] = [];

export const MOCK_LOTS: Lot[] = [];

export const MOCK_MOVEMENTS: AnimalMovement[] = [];

// Generate some history for charts
export const generateHistory = (): DailyFeedRecord[] => {
  return [];
};

export const MOCK_HISTORY: DailyFeedRecord[] = [];
