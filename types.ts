
// Enums
export enum BunkScore {
  Zero = 0,    // '0' - Cocho limpo
  Half = 0.5,  // '0.5' - Fundo de cocho
  One = 1,     // '1' - < 5%
  OneHalf = 1.5, // '1.5'
  Two = 2,     // '2' - 5-25%
  Three = 3,   // '3' - > 25%
  Four = 4     // '4' - Cocho cheio
}

export enum FeedStatus {
  Underfed = 'UNDERFED',
  Optimal = 'OPTIMAL',
  Overfed = 'OVERFED'
}

export enum MovementType {
  Entry = 'ENTRADA',
  Exit = 'SAIDA', // Abate
  Death = 'MORTE',
  Transfer = 'TRANSFERENCIA',
  Refusal = 'REFUGO' // New
}

export interface Category {
  id: string;
  name: string; // ex: macho nelore, vaca, etc.
}

export interface GMDCurve {
  id: string;
  name: string;
  gmd: number; // kg/cab./dia
}

export interface Ingredient {
  id: string;
  name: string;
  dryMatterContent: number; // % MS
  pricePerTon: number;
}

export interface DietIngredient {
  ingredientId: string;
  inclusionMSPercentage: number; // % MS (Base Matéria Seca)
  inclusionMNPercentage: number; // % MN (Base Matéria Natural) - AUTOMATICAMENTE GERADO
}

export interface Diet {
  id: string;
  name: string;
  ingredients: DietIngredient[];
  status?: 'ACTIVE' | 'INACTIVE';
  // Calculated properties
  calculatedDryMatter: number;
  calculatedCostPerKg: number;
}

export interface Pen {
  id: string;
  name: string;
  moduleId: string;
  capacity: number;
}

export interface DietHistoryEntry {
  dietId: string;
  date: string; // ISO
}

export interface Lot {
  id: string;
  name: string;
  entryDate: string; // ISO Date
  initialWeight: number; // kg
  breed: string;
  categoryId: string;
  gender: 'MACHO' | 'FEMEA';
  gmdCurveId: string; // For GMD projection
  origin?: string;
  currentPenId: string;
  headCount: number;
  currentDietId: string;
  initialConsumptionPV?: number;
  dietChangeDate?: string;
  dietHistory?: DietHistoryEntry[];
  foodPlanning?: string; // e.g., "15d Adaptação, 7d Transição"
  status: 'ACTIVE' | 'CLOSED';
}

export interface AnimalMovement {
  id: string;
  date: string;
  lotId: string;
  type: MovementType;
  quantity: number;
  notes?: string;
  originPenId?: string;
  destinationPenId?: string;
}

export interface BunkScoreAdjustment {
  score: BunkScore;
  adjustmentPercentage: number; // percentage (e.g., -5 for -5%)
}

export interface DailyFeedRecord {
  id: string;
  date: string;
  lotId: string;
  penId: string;
  dietId: string; // dieta principal (rótulo)
  /**
   * Step intra-dia: dieta de cada trato.
   * Se undefined ou todas as posições === dietId, é fluxo tradicional (1 dieta/dia).
   * Quando alguma posição é diferente, o MN é calculado por trato.
   */
  dietsPerTrato?: string[];
  headCount: number;
  
  // Weights and Days
  daysOnFeed: number;
  projectedWeight: number;

  // Bunk Management
  bunkScoreYesterday: BunkScore;
  adjustmentPercentage: number; // Derived from bunk score rule
  
  // Consumption
  predictedTotalMN: number; // Total Predicted Natural Matter
  actualTotalMN: number; // Total Actual Natural Matter (Sum of drops)
  
  // Splits (Tratos) - simplified to array of amounts
  drops: number[]; 
  
  // Calculated Metrics (stored for historical speed)
  actualDryMatterPerHead: number;
  actualDryMatterPercentPV: number;
  costPerHead: number;
  deviationPercent: number;
}

export interface AppConfig {
  numTreatments: number; // 1, 2, 3, 4, 5, 6
  treatmentProportions: number[]; // sum must be 100
  firstTratoMSPercentPV: number; // Predicted MS for first day
  bunkScoreAdjustments: BunkScoreAdjustment[];
  // Loading limits for UI warnings
  loadingLimitLower: number;
  loadingLimitUpper: number;
  gmdCurves: GMDCurve[];
}
