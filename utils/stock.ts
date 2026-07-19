import { Diet, DailyFeedRecord, Ingredient } from '../types';

// ============================================================
// Estoque de Insumos — lógica pura (testável)
// Média ponderada móvel: entradas recalculam o preço médio;
// saídas baixam quantidade pelo preço médio vigente (não alteram a média).
// ============================================================

export interface StockMovement {
  id: string;
  date: string; // YYYY-MM-DD
  ingredientId: string;
  /** entry = compra/nota; adjust_in = inclusão manual; adjust_out = retirada manual */
  type: 'entry' | 'adjust_in' | 'adjust_out';
  quantityKg: number;
  /** Preço da carga (entrada/inclusão). Retiradas saem pelo preço médio. */
  pricePerKg: number | null;
  invoice?: string | null;
  supplier?: string | null;
  notes?: string | null;
  createdAt?: string;
}

export interface StockLedgerEvent {
  date: string;
  kind: 'entry' | 'adjust_in' | 'adjust_out' | 'consumption';
  /** positivo = entrada; negativo = saída */
  quantityKg: number;
  /** preço aplicado ao evento (entrada: da carga; saída: médio vigente) */
  pricePerKg: number;
  balanceAfter: number;
  avgPriceAfter: number;
  invoice?: string | null;
  supplier?: string | null;
  notes?: string | null;
  movementId?: string;
}

export interface IngredientStockInfo {
  ingredientId: string;
  balanceKg: number;
  avgPricePerKg: number;
  /** true se o insumo tem QUALQUER movimentação (usa o módulo de estoque) */
  hasStock: boolean;
  events: StockLedgerEvent[];
}

/**
 * Consumo diário por insumo (kg MN), derivado das fichas de trato:
 * kg fornecidos de cada dieta × % inclusão MN de cada insumo.
 * Considera step intra-dia (dietsPerTrato) quando presente.
 * Retorna Map<date, Map<ingredientId, kg>>.
 */
export function calculateDailyIngredientConsumption(
  records: DailyFeedRecord[],
  diets: Diet[]
): Map<string, Map<string, number>> {
  const dietById = new Map(diets.map((d) => [d.id, d]));
  const result = new Map<string, Map<string, number>>();

  const addKg = (date: string, ingredientId: string, kg: number) => {
    if (kg <= 0) return;
    let day = result.get(date);
    if (!day) {
      day = new Map<string, number>();
      result.set(date, day);
    }
    day.set(ingredientId, (day.get(ingredientId) || 0) + kg);
  };

  for (const rec of records) {
    const drops = rec.drops || [];
    // kg fornecidos por dieta neste registro
    const kgPerDiet = new Map<string, number>();
    const stepDiets = rec.dietsPerTrato;
    if (stepDiets && stepDiets.length === drops.length) {
      drops.forEach((kg, i) => {
        const dId = stepDiets[i] || rec.dietId;
        kgPerDiet.set(dId, (kgPerDiet.get(dId) || 0) + (kg || 0));
      });
    } else {
      const total = drops.reduce((a, b) => a + (b || 0), 0);
      kgPerDiet.set(rec.dietId, total);
    }

    kgPerDiet.forEach((kgDiet, dietId) => {
      if (kgDiet <= 0) return;
      const diet = dietById.get(dietId);
      if (!diet) return;
      for (const item of diet.ingredients || []) {
        const mnPct = item.inclusionMNPercentage || 0;
        if (mnPct > 0) addKg(rec.date, item.ingredientId, kgDiet * (mnPct / 100));
      }
    });
  }

  return result;
}

interface RawEvent {
  date: string;
  kind: StockLedgerEvent['kind'];
  qty: number; // sempre positivo
  price: number | null;
  invoice?: string | null;
  supplier?: string | null;
  notes?: string | null;
  movementId?: string;
  /** ordem intra-dia: entradas antes das saídas */
  order: number;
  createdAt?: string;
}

/**
 * Monta o extrato (ledger) de cada insumo em ordem cronológica.
 * No mesmo dia: entradas/inclusões primeiro, depois consumo/retiradas —
 * assim uma carga que chega no dia já precifica o consumo daquele dia.
 */
export function buildStockLedgers(
  movements: StockMovement[],
  consumption: Map<string, Map<string, number>>
): Map<string, IngredientStockInfo> {
  const eventsByIngredient = new Map<string, RawEvent[]>();

  const push = (ingredientId: string, ev: RawEvent) => {
    let list = eventsByIngredient.get(ingredientId);
    if (!list) {
      list = [];
      eventsByIngredient.set(ingredientId, list);
    }
    list.push(ev);
  };

  for (const m of movements) {
    const isIn = m.type === 'entry' || m.type === 'adjust_in';
    push(m.ingredientId, {
      date: m.date,
      kind: m.type,
      qty: Math.abs(m.quantityKg || 0),
      price: m.pricePerKg ?? null,
      invoice: m.invoice ?? null,
      supplier: m.supplier ?? null,
      notes: m.notes ?? null,
      movementId: m.id,
      order: isIn ? 0 : 2,
      createdAt: m.createdAt,
    });
  }

  consumption.forEach((byIngredient, date) => {
    byIngredient.forEach((kg, ingredientId) => {
      if (kg > 0) push(ingredientId, { date, kind: 'consumption', qty: kg, price: null, order: 1 });
    });
  });

  const result = new Map<string, IngredientStockInfo>();

  eventsByIngredient.forEach((events, ingredientId) => {
    events.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.order !== b.order) return a.order - b.order;
      return (a.createdAt || '') < (b.createdAt || '') ? -1 : 1;
    });

    let balance = 0;
    let avg = 0;
    const ledger: StockLedgerEvent[] = [];

    for (const ev of events) {
      let applied = 0;
      if (ev.kind === 'entry' || ev.kind === 'adjust_in') {
        const price = ev.price ?? avg; // inclusão sem preço entra pelo médio
        const newBalance = balance + ev.qty;
        if (newBalance > 0) {
          // se o saldo estava negativo, a média reinicia pelo preço da carga
          avg = balance > 0 ? (balance * avg + ev.qty * price) / newBalance : price;
        }
        balance = newBalance;
        applied = price;
        ledger.push({
          date: ev.date, kind: ev.kind, quantityKg: ev.qty, pricePerKg: applied,
          balanceAfter: balance, avgPriceAfter: avg,
          invoice: ev.invoice, supplier: ev.supplier, notes: ev.notes, movementId: ev.movementId,
        });
      } else {
        // consumo / retirada: sai pelo preço médio vigente, média não muda
        balance -= ev.qty;
        applied = avg;
        ledger.push({
          date: ev.date, kind: ev.kind, quantityKg: -ev.qty, pricePerKg: applied,
          balanceAfter: balance, avgPriceAfter: avg,
          invoice: ev.invoice, supplier: ev.supplier, notes: ev.notes, movementId: ev.movementId,
        });
      }
    }

    result.set(ingredientId, {
      ingredientId,
      balanceKg: balance,
      avgPricePerKg: avg,
      hasStock: events.length > 0,
      events: ledger,
    });
  });

  return result;
}

/**
 * Preço efetivo do insumo (R$/ton):
 * com movimentação de estoque → preço médio ponderado × 1000;
 * sem movimentação → preço digitado no cadastro.
 */
export function effectivePricePerTon(ingredient: Ingredient, info?: IngredientStockInfo): number {
  if (info && info.hasStock) return info.avgPricePerKg * 1000;
  return ingredient.pricePerTon;
}

/** Ingredientes com preço efetivo aplicado (pra usar em calculateDietMetrics) */
export function withEffectivePrices(
  ingredients: Ingredient[],
  ledgers: Map<string, IngredientStockInfo>
): Ingredient[] {
  return ingredients.map((ing) => {
    const info = ledgers.get(ing.id);
    if (info && info.hasStock) {
      return { ...ing, pricePerTon: info.avgPricePerKg * 1000 };
    }
    return ing;
  });
}
