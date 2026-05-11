import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  AppConfig,
  Lot,
  Pen,
  Diet,
  Ingredient,
  AnimalMovement,
  DailyFeedRecord,
  MovementType,
  Category,
} from './types';
import { DEFAULT_CONFIG } from './constants';
import {
  calculateActiveHeadCount,
  calculateAllHeadCounts,
  calculateDietMetrics,
  calculatePenOccupancy,
  calculateDaysOnFeed,
  calculateProjectedWeight,
} from './utils';
import {
  supabase,
  authStorage,
  listActiveUsers,
  validateUserPin,
  FcAuthUser,
} from './lib/supabase';
import {
  lotToDb,
  lotFromDb,
  penToDb,
  penFromDb,
  dietToDb,
  dietFromDb,
  ingredientToDb,
  ingredientFromDb,
  categoryToDb,
  categoryFromDb,
  movementToDb,
  movementFromDb,
  feedRecordToDb,
  feedRecordFromDb,
  configFromDb,
  configToDb,
} from './lib/dbMappers';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ----------------------------------------------------------------
// Context shape
// ----------------------------------------------------------------
interface AppContextType {
  // Auth
  user: FcAuthUser | null;
  authLoading: boolean;
  availableUsers: FcAuthUser[];
  refreshAvailableUsers: () => Promise<void>;
  loginWithPin: (userId: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;

  // Config
  config: AppConfig;
  updateConfig: (newConfig: AppConfig) => Promise<void>;

  // Domain data
  lots: Lot[];
  addLot: (lot: Lot) => Promise<void>;
  updateLot: (id: string, updates: Partial<Lot>) => Promise<void>;

  pens: Pen[];
  addPen: (pen: Pen) => Promise<void>;
  removePen: (id: string) => Promise<void>;

  categories: Category[];
  addCategory: (cat: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  diets: Diet[];
  updateDiet: (id: string, updates: Partial<Diet>) => Promise<void>;
  addDiet: (diet: Diet) => Promise<void>;
  removeDiet: (id: string) => Promise<void>;

  ingredients: Ingredient[];
  addIngredient: (ing: Ingredient) => Promise<void>;
  updateIngredient: (id: string, updates: Partial<Ingredient>) => Promise<void>;
  removeIngredient: (id: string) => Promise<void>;

  movements: AnimalMovement[];
  addMovement: (mov: AnimalMovement) => Promise<void>;
  deleteMovement: (id: string) => Promise<void>;

  feedHistory: DailyFeedRecord[];
  addFeedRecord: (record: DailyFeedRecord) => Promise<void>;
  deleteFeedRecord: (id: string) => Promise<void>;

  // Helpers
  getActiveHeadCount: (lotId: string, asOfDate?: string) => number;
  getPenOccupancy: (penId: string) => number;
  deleteLot: (id: string) => Promise<void>;
  clearOperationalData: () => Promise<void>;
  deleteGMDCurve: (id: string) => Promise<void>;
  executeMovement: (movement: Partial<AnimalMovement>) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ----------------------------------------------------------------
// Helper: granular realtime subscription factory
// Cada tabela atualiza APENAS o seu state. Sem refetch geral.
// ----------------------------------------------------------------
function subscribeToTable<T extends { id: string }>(
  table: string,
  setState: React.Dispatch<React.SetStateAction<T[]>>,
  fromDb: (row: Record<string, unknown>) => T
): RealtimeChannel {
  return supabase
    .channel(`fc_${table}_changes`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => {
        const event = payload.eventType;
        if (event === 'INSERT') {
          const row = fromDb(payload.new as Record<string, unknown>);
          setState((prev) => {
            if (prev.some((r) => r.id === row.id)) return prev;
            return [row, ...prev];
          });
        } else if (event === 'UPDATE') {
          const row = fromDb(payload.new as Record<string, unknown>);
          setState((prev) => prev.map((r) => (r.id === row.id ? row : r)));
        } else if (event === 'DELETE') {
          const oldRow = payload.old as { id?: string };
          if (oldRow?.id) {
            setState((prev) => prev.filter((r) => r.id !== oldRow.id));
          }
        }
      }
    )
    .subscribe();
}

// ----------------------------------------------------------------
// Provider
// ----------------------------------------------------------------
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Auth
  const [user, setUser] = useState<FcAuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [availableUsers, setAvailableUsers] = useState<FcAuthUser[]>([]);

  // Domain data
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [lots, setLots] = useState<Lot[]>([]);
  const [pens, setPens] = useState<Pen[]>([]);
  const [diets, setDiets] = useState<Diet[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [movements, setMovements] = useState<AnimalMovement[]>([]);
  const [feedHistory, setFeedHistory] = useState<DailyFeedRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // ----- Auth bootstrap (lê localStorage + carrega usuários disponíveis) -----
  const refreshAvailableUsers = useCallback(async () => {
    const list = await listActiveUsers();
    setAvailableUsers(list);
  }, []);

  useEffect(() => {
    const stored = authStorage.get();
    if (stored) setUser(stored);
    refreshAvailableUsers().finally(() => setAuthLoading(false));
  }, [refreshAvailableUsers]);

  const loginWithPin = useCallback(async (userId: string, pin: string): Promise<boolean> => {
    const ok = await validateUserPin(userId, pin);
    if (!ok) return false;
    const found = availableUsers.find((u) => u.id === userId);
    if (!found) {
      // garante refresh caso o usuário tenha sido cadastrado neste browser
      const refreshed = await listActiveUsers();
      const u = refreshed.find((x) => x.id === userId);
      if (!u) return false;
      authStorage.set(u);
      setUser(u);
      return true;
    }
    authStorage.set(found);
    setUser(found);
    return true;
  }, [availableUsers]);

  const logout = useCallback(async () => {
    authStorage.clear();
    setUser(null);
  }, []);

  // ----- Initial load + Realtime listeners (granulares!) -----
  // Refs pra cleanup correto (evita memory leaks em re-renders)
  const channelsRef = useRef<RealtimeChannel[]>([]);

  useEffect(() => {
    if (!user) {
      // Limpa estado e canais ao sair
      channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
      channelsRef.current = [];
      setLots([]);
      setPens([]);
      setIngredients([]);
      setDiets([]);
      setCategories([]);
      setMovements([]);
      setFeedHistory([]);
      setConfig(DEFAULT_CONFIG);
      return;
    }

    let cancelled = false;

    async function loadAll() {
      // 1. Carga inicial em paralelo
      const [
        cfgRes,
        lotsRes,
        pensRes,
        ingsRes,
        dietsRes,
        catsRes,
        movsRes,
        feedRes,
      ] = await Promise.all([
        supabase.from('fc_config').select('*').eq('id', 'global').maybeSingle(),
        supabase.from('fc_lots').select('*'),
        supabase.from('fc_pens').select('*'),
        supabase.from('fc_ingredients').select('*'),
        supabase.from('fc_diets').select('*'),
        supabase.from('fc_categories').select('*'),
        supabase.from('fc_movements').select('*').order('date', { ascending: false }),
        supabase.from('fc_feed_records').select('*').order('date', { ascending: false }),
      ]);

      if (cancelled) return;

      if (cfgRes.data) setConfig(configFromDb(cfgRes.data as Record<string, unknown>));
      if (lotsRes.data) setLots(lotsRes.data.map((r) => lotFromDb(r as Record<string, unknown>)));
      if (pensRes.data) setPens(pensRes.data.map((r) => penFromDb(r as Record<string, unknown>)));
      if (ingsRes.data)
        setIngredients(ingsRes.data.map((r) => ingredientFromDb(r as Record<string, unknown>)));
      if (dietsRes.data)
        setDiets(dietsRes.data.map((r) => dietFromDb(r as Record<string, unknown>)));
      if (catsRes.data)
        setCategories(catsRes.data.map((r) => categoryFromDb(r as Record<string, unknown>)));
      if (movsRes.data)
        setMovements(movsRes.data.map((r) => movementFromDb(r as Record<string, unknown>)));
      if (feedRes.data)
        setFeedHistory(feedRes.data.map((r) => feedRecordFromDb(r as Record<string, unknown>)));

      // 2. Subscriptions granulares (cada uma só atualiza seu próprio state)
      const channels: RealtimeChannel[] = [
        subscribeToTable<Lot>('fc_lots', setLots, lotFromDb),
        subscribeToTable<Pen>('fc_pens', setPens, penFromDb),
        subscribeToTable<Ingredient>('fc_ingredients', setIngredients, ingredientFromDb),
        subscribeToTable<Diet>('fc_diets', setDiets, dietFromDb),
        subscribeToTable<Category>('fc_categories', setCategories, categoryFromDb),
        subscribeToTable<AnimalMovement>('fc_movements', setMovements, movementFromDb),
        subscribeToTable<DailyFeedRecord>('fc_feed_records', setFeedHistory, feedRecordFromDb),
      ];

      // Config é singleton — listener separado
      const cfgChannel = supabase
        .channel('fc_config_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'fc_config' },
          (payload) => {
            if (payload.new && (payload.new as { id?: string }).id === 'global') {
              setConfig(configFromDb(payload.new as Record<string, unknown>));
            }
          }
        )
        .subscribe();
      channels.push(cfgChannel);

      channelsRef.current = channels;
    }

    loadAll();

    return () => {
      cancelled = true;
      channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
      channelsRef.current = [];
    };
  }, [user]);

  // ----------------------------------------------------------------
  // Mutations (Supabase calls)
  // O state local é atualizado pelo realtime listener, mas em alguns
  // pontos (rapidez de UX, ações em sequência) fazemos optimistic update.
  // ----------------------------------------------------------------
  const updateConfig = async (newConfig: AppConfig) => {
    const { error } = await supabase
      .from('fc_config')
      .update(configToDb(newConfig))
      .eq('id', 'global');
    if (error) throw error;
  };

  // ----- Helpers de cabeças/ocupação (memoizados) -----
  const headCountsMap = useMemo(
    () => calculateAllHeadCounts(lots, movements),
    [lots, movements]
  );

  const getActiveHeadCount = useCallback(
    (lotId: string, asOfDate?: string) => {
      if (asOfDate) {
        const lot = lots.find((l) => l.id === lotId);
        return calculateActiveHeadCount(lotId, lot ? lot.headCount : 0, movements, asOfDate);
      }
      return headCountsMap[lotId] || 0;
    },
    [lots, movements, headCountsMap]
  );

  const penOccupancyMap = useMemo(
    () => calculatePenOccupancy(pens, lots, movements),
    [pens, lots, movements]
  );
  const getPenOccupancy = useCallback(
    (penId: string) => penOccupancyMap[penId] || 0,
    [penOccupancyMap]
  );

  // ----- Lots -----
  // Sempre que um lote é inserido, registra o movement Entry correspondente.
  // Isso garante que `calculateAllHeadCounts` use as movements como fonte da verdade.
  const addLot = async (lot: Lot) => {
    const existingLotInPen = lots.find(
      (l) => l.currentPenId === lot.currentPenId && l.status === 'ACTIVE' && getActiveHeadCount(l.id) > 0
    );

    if (existingLotInPen) {
      // Mescla: cria novo lote ponderado a partir dos dois
      const currentCount = getActiveHeadCount(existingLotInPen.id);
      const newTotalCount = currentCount + lot.headCount;

      const gmd = config.gmdCurves.find((c) => c.id === existingLotInPen.gmdCurveId)?.gmd || 0;
      const dof = calculateDaysOnFeed(existingLotInPen.entryDate, lot.entryDate);
      const currentProjectedWeight = calculateProjectedWeight(
        existingLotInPen.initialWeight,
        gmd,
        dof
      );

      const avgInitialWeight =
        (currentProjectedWeight * currentCount + lot.initialWeight * lot.headCount) /
        newTotalCount;
      const avgDof = (dof * currentCount + 0 * lot.headCount) / newTotalCount;

      const newEntryDate = new Date(
        new Date(lot.entryDate).getTime() - avgDof * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split('T')[0];

      const newLotId = `L-MERGE-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, "0")}`;
      const mergedLot: Lot = {
        ...existingLotInPen,
        id: newLotId,
        name: `${existingLotInPen.name} + Novo`,
        initialWeight: avgInitialWeight,
        entryDate: newEntryDate,
        headCount: newTotalCount,
        status: 'ACTIVE',
      };

      await updateLot(existingLotInPen.id, { status: 'CLOSED' });
      const { error } = await supabase.from('fc_lots').insert(lotToDb(mergedLot));
      if (error) throw error;

      await addMovement({
        id: `m-merge-entry-${Date.now()}`,
        date: lot.entryDate,
        lotId: mergedLot.id,
        type: MovementType.Entry,
        quantity: newTotalCount,
        notes: `Lote combinado criado a partir de ${existingLotInPen.name} e novos animais`,
      });
    } else {
      const { error } = await supabase.from('fc_lots').insert(lotToDb(lot));
      if (error) throw error;

      // Registra Entry inicial do lote (fonte única da verdade)
      await addMovement({
        id: `m-entry-${Date.now()}`,
        date: lot.entryDate,
        lotId: lot.id,
        type: MovementType.Entry,
        quantity: lot.headCount,
        notes: 'Entrada inicial do lote',
      });
    }
  };

  const updateLot = async (id: string, updates: Partial<Lot>) => {
    const lot = lots.find((l) => l.id === id);
    if (updates.currentDietId && lot && updates.currentDietId !== lot.currentDietId) {
      const today = new Date().toISOString();
      const historyEntry = { dietId: lot.currentDietId, date: lot.dietChangeDate || lot.entryDate };
      const currentHistory = lot.dietHistory || [];

      updates.dietChangeDate = today;
      updates.dietHistory = [...currentHistory, historyEntry];
    }
    const { error } = await supabase.from('fc_lots').update(lotToDb(updates)).eq('id', id);
    if (error) throw error;
  };

  const deleteLot = async (id: string) => {
    if (!user) return;
    // FK ON DELETE CASCADE já apaga movements e feed_records relacionados
    const { error } = await supabase.from('fc_lots').delete().eq('id', id);
    if (error) console.error('Error deleting lot:', error);
  };

  // ----- Pens -----
  const addPen = async (pen: Pen) => {
    const { error } = await supabase.from('fc_pens').insert(penToDb(pen));
    if (error) throw error;
  };
  const removePen = async (id: string) => {
    const { error } = await supabase.from('fc_pens').delete().eq('id', id);
    if (error) throw error;
  };

  // ----- Categories -----
  const addCategory = async (cat: Category) => {
    const { error } = await supabase.from('fc_categories').insert(categoryToDb(cat));
    if (error) throw error;
  };
  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from('fc_categories').delete().eq('id', id);
    if (error) throw error;
  };

  // ----- Diets -----
  const addDiet = async (diet: Diet) => {
    const { error } = await supabase.from('fc_diets').insert(dietToDb(diet));
    if (error) throw error;
  };
  const updateDiet = async (id: string, updates: Partial<Diet>) => {
    const { error } = await supabase.from('fc_diets').update(dietToDb(updates)).eq('id', id);
    if (error) throw error;
  };
  const removeDiet = async (id: string) => {
    const { error } = await supabase.from('fc_diets').delete().eq('id', id);
    if (error) throw error;
  };

  // ----- Ingredients -----
  const addIngredient = async (ing: Ingredient) => {
    const { error } = await supabase.from('fc_ingredients').insert(ingredientToDb(ing));
    if (error) throw error;
  };
  const updateIngredient = async (id: string, updates: Partial<Ingredient>) => {
    const { error } = await supabase
      .from('fc_ingredients')
      .update(ingredientToDb(updates))
      .eq('id', id);
    if (error) throw error;

    // Recalcula dietas afetadas
    const updatedIngredients = ingredients.map((ing) =>
      ing.id === id ? { ...ing, ...updates } : ing
    );
    const affectedDiets = diets.filter((diet) =>
      diet.ingredients.some((di) => di.ingredientId === id)
    );

    for (const diet of affectedDiets) {
      const metrics = calculateDietMetrics(diet, updatedIngredients);
      const updatedDietIngredients = diet.ingredients.map((di) => {
        const metric = metrics.ingredientMetrics.find((m) => m.ingredientId === di.ingredientId);
        return {
          ...di,
          inclusionMNPercentage: metric ? metric.mnPercentage : 0,
        };
      });

      await supabase
        .from('fc_diets')
        .update({
          ingredients: updatedDietIngredients,
          calculated_dry_matter: metrics.ms,
          calculated_cost_per_kg: metrics.costPerKgMN,
        })
        .eq('id', diet.id);
    }
  };
  const removeIngredient = async (id: string) => {
    const { error } = await supabase.from('fc_ingredients').delete().eq('id', id);
    if (error) throw error;
  };

  // ----- Movements -----
  const addMovement = async (mov: AnimalMovement) => {
    const { error } = await supabase.from('fc_movements').insert(movementToDb(mov));
    if (error) throw error;
    // Realtime listener vai inserir no state automaticamente
  };
  const deleteMovement = async (id: string) => {
    const { error } = await supabase.from('fc_movements').delete().eq('id', id);
    if (error) throw error;
  };

  // ----- Feed Records -----
  const addFeedRecord = async (record: DailyFeedRecord) => {
    // Upsert: ID determinístico = date_lotId garante sobrescrita no mesmo dia/lote
    const recordId = `${record.date}_${record.lotId}`;
    const finalizedRecord: DailyFeedRecord = { ...record, id: recordId };
    const { error } = await supabase
      .from('fc_feed_records')
      .upsert(feedRecordToDb(finalizedRecord), { onConflict: 'id' });
    if (error) throw error;
  };
  const deleteFeedRecord = async (id: string) => {
    const { error } = await supabase.from('fc_feed_records').delete().eq('id', id);
    if (error) throw error;
  };

  // ----- GMD Curves (within config) -----
  const deleteGMDCurve = async (id: string) => {
    const newCurves = config.gmdCurves.filter((c) => c.id !== id);
    await updateConfig({ ...config, gmdCurves: newCurves });
  };

  // ----- Movement orchestration (split/merge/transfer/exit) -----
  // Lógica de transferência entre baias preservando histórico:
  //   Caso 1: TODOS animais + baia destino vazia       → só muda currentPenId (preserva tudo)
  //   Caso 2: PARCIAL animais + baia destino vazia     → cria split lot mantendo entryDate/initialWeight
  //   Caso 3: TODOS animais + baia destino com lote    → mescla ponderada (fecha origem e destino, cria merge)
  //   Caso 4: PARCIAL animais + baia destino com lote  → mescla ponderada parcial (fecha destino, mantém origem reduzida)
  const executeMovement = async (mov: Partial<AnimalMovement>) => {
    if (!mov.lotId || !mov.type || !mov.date) return;

    const sourceLot = lots.find((l) => l.id === mov.lotId);
    if (!sourceLot) return;

    const quantity = mov.quantity || 0;
    const currentCount = getActiveHeadCount(sourceLot.id);

    // 1. Registra a movement principal (Death/Exit/Refusal/Transfer com lotId = origem)
    const movement: AnimalMovement = {
      id: `m-${Date.now()}`,
      date: mov.date,
      lotId: mov.lotId,
      type: mov.type as MovementType,
      quantity,
      notes: mov.notes,
      originPenId: mov.originPenId || sourceLot.currentPenId,
      destinationPenId: mov.destinationPenId,
    };
    await addMovement(movement);

    // 2. Se NÃO for transferência, verificamos se o lote zerou e auto-fechamos.
    // Death/Exit/Refusal já reduziram via deltaTotal (deltaCount = currentCount - quantity).
    if (mov.type !== MovementType.Transfer || !mov.destinationPenId) {
      const remainingHeads = currentCount - quantity;
      if (remainingHeads <= 0 && sourceLot.status === 'ACTIVE') {
        // Lote zerado: fecha automaticamente (#12)
        await updateLot(sourceLot.id, { status: 'CLOSED' });
      }
      return;
    }

    // 3. Lógica de transferência
    const destinationPenId = mov.destinationPenId;
    // Considera "lote no destino" só se tiver cabeças ativas (status ACTIVE pode estar com 0 cab)
    const existingLotInDest = lots.find(
      (l) =>
        l.currentPenId === destinationPenId &&
        l.status === 'ACTIVE' &&
        l.id !== sourceLot.id &&
        getActiveHeadCount(l.id) > 0
    );
    const isFullTransfer = quantity >= currentCount;

    if (!existingLotInDest) {
      // Baia destino VAZIA
      if (isFullTransfer) {
        // Caso 1: move o lote inteiro pra nova baia (preserva tudo)
        await updateLot(sourceLot.id, { currentPenId: destinationPenId });
      } else {
        // Caso 2: split parcial preservando histórico (entryDate, initialWeight, GMD, dieta)
        const newLotId = `L-SPLIT-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, "0")}`;
        const splitLot: Lot = {
          ...sourceLot,
          id: newLotId,
          name: `${sourceLot.name} (parc.)`,
          headCount: quantity,
          currentPenId: destinationPenId,
          // Preserva histórico — NÃO resetar entryDate nem initialWeight
          entryDate: sourceLot.entryDate,
          initialWeight: sourceLot.initialWeight,
          dietHistory: sourceLot.dietHistory,
          status: 'ACTIVE',
        };

        // Insere o split direto (não passa pelo addLot pra evitar lógica de mescla)
        const { error } = await supabase.from('fc_lots').insert(lotToDb(splitLot));
        if (error) throw error;

        await addMovement({
          id: `m-split-in-${Date.now()}`,
          date: mov.date,
          lotId: newLotId,
          type: MovementType.Entry,
          quantity,
          notes: `Originado por cisão do lote ${sourceLot.name}`,
        });
      }
      return;
    }

    // Baia destino COM lote ativo — mescla ponderada
    const destCount = getActiveHeadCount(existingLotInDest.id);

    // Pesos projetados pra média ponderada
    const sourceGmd = config.gmdCurves.find((c) => c.id === sourceLot.gmdCurveId)?.gmd || 0;
    const sourceDof = calculateDaysOnFeed(sourceLot.entryDate, mov.date);
    const sourceProjectedWeight = calculateProjectedWeight(
      sourceLot.initialWeight,
      sourceGmd,
      sourceDof
    );

    const destGmd = config.gmdCurves.find((c) => c.id === existingLotInDest.gmdCurveId)?.gmd || 0;
    const destDof = calculateDaysOnFeed(existingLotInDest.entryDate, mov.date);
    const destProjectedWeight = calculateProjectedWeight(
      existingLotInDest.initialWeight,
      destGmd,
      destDof
    );

    const newTotalCount = quantity + destCount;
    // Peso médio ponderado por nº de cabeças
    const avgProjectedWeight =
      (sourceProjectedWeight * quantity + destProjectedWeight * destCount) / newTotalCount;
    const avgDof = (sourceDof * quantity + destDof * destCount) / newTotalCount;

    // entryDate ajustado pra refletir DOF médio do grupo
    const newEntryDate = new Date(
      new Date(mov.date).getTime() - avgDof * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split('T')[0];

    const newLotId = `L-MERGE-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, "0")}`;
    const mergedLot: Lot = {
      ...existingLotInDest,
      id: newLotId,
      name: `${existingLotInDest.name} + ${quantity}cab ${sourceLot.name}`,
      // initialWeight = peso projetado médio (no momento da mescla, equivalente a "peso inicial")
      initialWeight: avgProjectedWeight,
      entryDate: newEntryDate,
      headCount: newTotalCount,
      currentPenId: destinationPenId,
      // Mantém a dieta atual do destino (assume que vão pra essa)
      currentDietId: existingLotInDest.currentDietId,
      dietHistory: existingLotInDest.dietHistory,
      dietChangeDate: existingLotInDest.dietChangeDate,
      status: 'ACTIVE',
    };

    // Fecha o lote destino
    await updateLot(existingLotInDest.id, { status: 'CLOSED' });

    // Caso 3: transfer total — fecha também a origem
    if (isFullTransfer) {
      await updateLot(sourceLot.id, { status: 'CLOSED' });
    }
    // Caso 4: parcial — origem mantém ACTIVE com qty reduzida (já registrado pelo movement Transfer acima)

    // Cria o merged lot
    const { error } = await supabase.from('fc_lots').insert(lotToDb(mergedLot));
    if (error) throw error;

    // Entry no merged lot
    await addMovement({
      id: `m-merge-in-entry-${Date.now()}`,
      date: mov.date,
      lotId: mergedLot.id,
      type: MovementType.Entry,
      quantity: newTotalCount,
      notes: `Mescla: ${quantity} cab de ${sourceLot.name} + ${destCount} cab de ${existingLotInDest.name}`,
    });
  };

  // ----- Bulk reset -----
  const clearOperationalData = async () => {
    if (!user) return;
    // Ordem: feed_records / movements primeiro (ou usa CASCADE), depois lots, etc.
    const tables = [
      'fc_feed_records',
      'fc_movements',
      'fc_lots',
      'fc_diets',
      'fc_ingredients',
      'fc_categories',
      'fc_pens',
    ];
    for (const t of tables) {
      // Deleta tudo da tabela: filtro `id != ''` permitido (aplica a todas as linhas)
      const { error } = await supabase.from(t).delete().neq('id', '');
      if (error) console.error(`Error clearing ${t}:`, error);
    }
    await updateConfig(DEFAULT_CONFIG);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        authLoading,
        availableUsers,
        refreshAvailableUsers,
        loginWithPin,
        logout,
        config,
        updateConfig,
        lots,
        addLot,
        updateLot,
        pens,
        addPen,
        removePen,
        categories,
        addCategory,
        deleteCategory,
        diets,
        updateDiet,
        addDiet,
        removeDiet,
        ingredients,
        addIngredient,
        updateIngredient,
        removeIngredient,
        movements,
        addMovement,
        deleteMovement,
        feedHistory,
        addFeedRecord,
        deleteFeedRecord,
        getActiveHeadCount,
        getPenOccupancy,
        deleteLot,
        clearOperationalData,
        deleteGMDCurve,
        executeMovement,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return context;
};
