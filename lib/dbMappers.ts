// ----------------------------------------------------------------
// Mappers: TypeScript camelCase  <->  Postgres snake_case
// Mantemos os componentes intocados (camelCase) e traduzimos só
// no momento de leitura/escrita no Supabase.
// ----------------------------------------------------------------

import {
  Lot,
  Pen,
  Diet,
  Ingredient,
  Category,
  AnimalMovement,
  DailyFeedRecord,
  AppConfig,
} from '../types';

// Helper genérico de mapeamento ----------------------------------
type Mapping = Record<string, string>; // tsKey -> dbKey

function objToDb<T extends object>(obj: Partial<T>, mapping: Mapping): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const tsKey of Object.keys(obj) as (keyof T)[]) {
    const dbKey = mapping[tsKey as string];
    if (!dbKey) continue;
    const val = (obj as Record<string, unknown>)[tsKey as string];
    if (val !== undefined) out[dbKey] = val;
  }
  return out;
}

function dbToObj<T>(row: Record<string, unknown>, mapping: Mapping): T {
  const reverse: Mapping = {};
  for (const tsKey in mapping) reverse[mapping[tsKey]] = tsKey;
  const out: Record<string, unknown> = {};
  for (const dbKey of Object.keys(row)) {
    const tsKey = reverse[dbKey];
    if (tsKey) out[tsKey] = row[dbKey];
  }
  return out as T;
}

// ---- Lot ----
const lotMap: Mapping = {
  id: 'id',
  name: 'name',
  entryDate: 'entry_date',
  initialWeight: 'initial_weight',
  breed: 'breed',
  categoryId: 'category_id',
  gender: 'gender',
  gmdCurveId: 'gmd_curve_id',
  origin: 'origin',
  currentPenId: 'current_pen_id',
  headCount: 'head_count',
  currentDietId: 'current_diet_id',
  initialConsumptionPV: 'initial_consumption_pv',
  dietChangeDate: 'diet_change_date',
  dietHistory: 'diet_history',
  foodPlanning: 'food_planning',
  status: 'status',
};
export const lotToDb = (lot: Partial<Lot>) => objToDb<Lot>(lot, lotMap);
export const lotFromDb = (row: Record<string, unknown>) => dbToObj<Lot>(row, lotMap);

// ---- Pen ----
const penMap: Mapping = {
  id: 'id',
  name: 'name',
  moduleId: 'module_id',
  capacity: 'capacity',
};
export const penToDb = (pen: Partial<Pen>) => objToDb<Pen>(pen, penMap);
export const penFromDb = (row: Record<string, unknown>) => dbToObj<Pen>(row, penMap);

// ---- Diet ----
const dietMap: Mapping = {
  id: 'id',
  name: 'name',
  status: 'status',
  ingredients: 'ingredients',
  calculatedDryMatter: 'calculated_dry_matter',
  calculatedCostPerKg: 'calculated_cost_per_kg',
};
export const dietToDb = (d: Partial<Diet>) => objToDb<Diet>(d, dietMap);
export const dietFromDb = (row: Record<string, unknown>) => dbToObj<Diet>(row, dietMap);

// ---- Ingredient ----
const ingredientMap: Mapping = {
  id: 'id',
  name: 'name',
  dryMatterContent: 'dry_matter_content',
  pricePerTon: 'price_per_ton',
};
export const ingredientToDb = (i: Partial<Ingredient>) => objToDb<Ingredient>(i, ingredientMap);
export const ingredientFromDb = (row: Record<string, unknown>) =>
  dbToObj<Ingredient>(row, ingredientMap);

// ---- Category ----
const categoryMap: Mapping = { id: 'id', name: 'name' };
export const categoryToDb = (c: Partial<Category>) => objToDb<Category>(c, categoryMap);
export const categoryFromDb = (row: Record<string, unknown>) =>
  dbToObj<Category>(row, categoryMap);

// ---- AnimalMovement ----
const movementMap: Mapping = {
  id: 'id',
  date: 'date',
  lotId: 'lot_id',
  type: 'type',
  quantity: 'quantity',
  notes: 'notes',
  originPenId: 'origin_pen_id',
  destinationPenId: 'destination_pen_id',
};
export const movementToDb = (m: Partial<AnimalMovement>) =>
  objToDb<AnimalMovement>(m, movementMap);
export const movementFromDb = (row: Record<string, unknown>) =>
  dbToObj<AnimalMovement>(row, movementMap);

// ---- DailyFeedRecord ----
const feedRecordMap: Mapping = {
  id: 'id',
  date: 'date',
  lotId: 'lot_id',
  penId: 'pen_id',
  dietId: 'diet_id',
  headCount: 'head_count',
  daysOnFeed: 'days_on_feed',
  projectedWeight: 'projected_weight',
  bunkScoreYesterday: 'bunk_score_yesterday',
  adjustmentPercentage: 'adjustment_percentage',
  predictedTotalMN: 'predicted_total_mn',
  actualTotalMN: 'actual_total_mn',
  drops: 'drops',
  actualDryMatterPerHead: 'actual_dry_matter_per_head',
  actualDryMatterPercentPV: 'actual_dry_matter_percent_pv',
  costPerHead: 'cost_per_head',
  deviationPercent: 'deviation_percent',
};
export const feedRecordToDb = (r: Partial<DailyFeedRecord>) =>
  objToDb<DailyFeedRecord>(r, feedRecordMap);
export const feedRecordFromDb = (row: Record<string, unknown>) =>
  dbToObj<DailyFeedRecord>(row, feedRecordMap);

// ---- Config ----
// Os campos do AppConfig são quase todos snake_case já, então mapeamos manual.
export function configFromDb(row: Record<string, unknown>): AppConfig {
  return {
    numTreatments: row.num_treatments as number,
    treatmentProportions: row.treatment_proportions as number[],
    firstTratoMSPercentPV: row.first_trato_ms_percent_pv as number,
    bunkScoreAdjustments: row.bunk_score_adjustments as AppConfig['bunkScoreAdjustments'],
    loadingLimitLower: row.loading_limit_lower as number,
    loadingLimitUpper: row.loading_limit_upper as number,
    gmdCurves: row.gmd_curves as AppConfig['gmdCurves'],
  };
}

export function configToDb(cfg: AppConfig): Record<string, unknown> {
  return {
    num_treatments: cfg.numTreatments,
    treatment_proportions: cfg.treatmentProportions,
    first_trato_ms_percent_pv: cfg.firstTratoMSPercentPV,
    bunk_score_adjustments: cfg.bunkScoreAdjustments,
    loading_limit_lower: cfg.loadingLimitLower,
    loading_limit_upper: cfg.loadingLimitUpper,
    gmd_curves: cfg.gmdCurves,
  };
}
