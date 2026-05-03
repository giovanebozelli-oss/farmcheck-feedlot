
import React, { useState, useMemo } from 'react';
import { useAppStore } from '../context';
import { Database, Wheat, Plus, Trash2, Save, CheckCircle2, Circle, AlertCircle, X, Edit2 } from 'lucide-react';
import { Ingredient, Diet, DietIngredient } from '../types';
import { calculateDietMetrics } from '../utils';

const IngredientsTab = () => {
  const { ingredients, addIngredient, removeIngredient, updateIngredient } = useAppStore();
  const [isAdding, setIsAdding] = useState(false);
  const [editingIngId, setEditingIngId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<Ingredient>>({});
  const [newIng, setNewIng] = useState<Partial<Ingredient>>({});

  const handleSave = async () => {
    if (newIng.name && newIng.dryMatterContent && newIng.pricePerTon) {
       await addIngredient({
         id: `ing-${Date.now()}`,
         name: newIng.name,
         dryMatterContent: Number(newIng.dryMatterContent),
         pricePerTon: Number(newIng.pricePerTon)
       });
       setNewIng({});
       setIsAdding(false);
    }
  };

  const handleUpdate = async () => {
    if (editingIngId && editingItem.name && editingItem.dryMatterContent !== undefined && editingItem.pricePerTon !== undefined) {
      await updateIngredient(editingIngId, {
        name: editingItem.name,
        dryMatterContent: Number(editingItem.dryMatterContent),
        pricePerTon: Number(editingItem.pricePerTon)
      });
      setEditingIngId(null);
      setEditingItem({});
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Deseja realmente excluir este ingrediente?')) {
      await removeIngredient(id);
    }
  };

  const startEditing = (ing: Ingredient) => {
    setEditingIngId(ing.id);
    setEditingItem(ing);
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-6 pb-2 border-b">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Cadastro de Ingredientes (F-06)</h2>
            <p className="text-xs text-slate-500">Defina os ingredientes disponíveis para as dietas</p>
          </div>
          <button 
            onClick={() => setIsAdding(true)} 
            className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus size={16} /> Novo Ingrediente
          </button>
        </div>
        
        {isAdding && (
          <div className="bg-emerald-50 p-6 rounded-xl mb-6 border border-emerald-100 shadow-inner">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-emerald-800 mb-1">Nome do Ingrediente</label>
                  <input 
                    className="w-full p-2.5 rounded-lg border border-emerald-200 bg-white focus:ring-2 focus:ring-emerald-500 outline-none" 
                    placeholder="Ex: Milho Moído" 
                    value={newIng.name || ''} 
                    onChange={e => setNewIng({...newIng, name: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-emerald-800 mb-1">Teor de MS (%)</label>
                  <input 
                    type="number" 
                    className="w-full p-2.5 rounded-lg border border-emerald-200 bg-white focus:ring-2 focus:ring-emerald-500 outline-none" 
                    placeholder="88" 
                    value={newIng.dryMatterContent || ''} 
                    onChange={e => setNewIng({...newIng, dryMatterContent: Number(e.target.value)})} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-emerald-800 mb-1">Preço MN (R$ / Ton)</label>
                  <input 
                    type="number" 
                    className="w-full p-2.5 rounded-lg border border-emerald-200 bg-white focus:ring-2 focus:ring-emerald-500 outline-none" 
                    placeholder="1100" 
                    value={newIng.pricePerTon || ''} 
                    onChange={e => setNewIng({...newIng, pricePerTon: Number(e.target.value)})} 
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSave} className="flex-1 bg-emerald-600 text-white p-2.5 rounded-lg font-bold hover:bg-emerald-700 transition-colors">Salvar</button>
                  <button onClick={() => setIsAdding(false)} className="bg-white text-slate-500 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50"><X size={20}/></button>
                </div>
             </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-widest">
              <tr>
                <th className="text-left py-3 px-4 italic">Ingrediente</th>
                <th className="text-center py-3 px-4">Matéria Seca (MS)</th>
                <th className="text-center py-3 px-4">Preço MN (Ton)</th>
                <th className="text-right py-3 px-4">R$ / kg MN</th>
                <th className="text-right py-3 px-4 bg-emerald-50/50">R$ / kg MS</th>
                <th className="text-right py-3 px-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ingredients.map(ing => (
                <tr key={ing.id} className="hover:bg-slate-50 group">
                  {editingIngId === ing.id ? (
                    <>
                      <td className="py-4 px-4">
                        <input 
                          className="w-full p-2 border rounded font-black uppercase text-sm"
                          value={editingItem.name || ''}
                          onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                        />
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input 
                            type="number"
                            className="w-16 p-2 border rounded text-right font-mono"
                            value={editingItem.dryMatterContent || ''}
                            onChange={e => setEditingItem({...editingItem, dryMatterContent: Number(e.target.value)})}
                          />
                          <span className="text-slate-400 font-bold">%</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <input 
                          type="number"
                          className="w-24 p-2 border rounded text-right"
                          value={editingItem.pricePerTon || ''}
                          onChange={e => setEditingItem({...editingItem, pricePerTon: Number(e.target.value)})}
                        />
                      </td>
                      <td colSpan={2} className="py-2 px-4 italic text-xs text-slate-400 text-center">
                        Calculado ao salvar
                      </td>
                      <td className="py-4 px-4 text-right flex gap-1 justify-end">
                        <button 
                          onClick={handleUpdate}
                          className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-700"
                        >
                          <Save size={18} />
                        </button>
                        <button 
                          onClick={() => setEditingIngId(null)}
                          className="bg-slate-200 text-slate-600 p-2 rounded-lg hover:bg-slate-300"
                        >
                          <X size={18} />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-4 px-4 font-black text-slate-700 uppercase italic tracking-tighter">{ing.name}</td>
                      <td className="py-4 px-4 text-center">
                        <span className="bg-slate-100 px-2 py-1 rounded text-slate-600 font-black font-mono">{ing.dryMatterContent}%</span>
                      </td>
                      <td className="py-4 px-4 text-center text-slate-500 font-medium">
                        {ing.pricePerTon.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', minimumFractionDigits: 0})}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-bold text-slate-700 text-xs">
                        R$ {(ing.pricePerTon / 1000).toFixed(4)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-black text-emerald-700 bg-emerald-50/20">
                        R$ {(ing.pricePerTon / 1000 / (ing.dryMatterContent / 100)).toFixed(4)}
                      </td>
                      <td className="py-4 px-4 text-right flex gap-1 justify-end">
                        <button 
                          onClick={() => startEditing(ing)}
                          className="text-slate-300 hover:text-emerald-600 p-2 rounded-lg hover:bg-emerald-50 transition-all"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(ing.id)}
                          className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {ingredients.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 italic">Nenhum ingrediente cadastrado</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
    </div>
  );
};

const DietsTab = () => {
  const { diets, ingredients, addDiet, updateDiet, removeDiet } = useAppStore();
  const [activeDietId, setActiveDietId] = useState<string | null>(diets[0]?.id || null);
  const [editingDiet, setEditingDiet] = useState<Diet | null>(null);
  
  const selectedDiet = useMemo(() => diets.find(d => d.id === activeDietId), [diets, activeDietId]);

  const handleStartEdit = (diet: Diet) => {
    setEditingDiet(JSON.parse(JSON.stringify(diet))); // Deep clone
  };

  const handleAddDiet = async () => {
    const name = window.prompt('Nome da nova dieta:');
    if (name) {
      const newDiet: Diet = {
        id: `diet-${Date.now()}`,
        name,
        ingredients: [],
        status: 'ACTIVE',
        calculatedDryMatter: 0,
        calculatedCostPerKg: 0
      };
      await addDiet(newDiet);
      setActiveDietId(newDiet.id);
      handleStartEdit(newDiet);
    }
  };

  const handleDeleteDiet = async (id: string) => {
    if (window.confirm('Excluir esta dieta permanentemente?')) {
      await removeDiet(id);
      setActiveDietId(null);
    }
  };

  const handleToggleStatus = async (diet: Diet) => {
    await updateDiet(diet.id, { status: diet.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
  };

  const updateDietIngredient = (idx: number, percentage: number) => {
    if (!editingDiet) return;
    const newIngs = [...editingDiet.ingredients];
    newIngs[idx].inclusionMSPercentage = percentage;
    
    // Recalculate totals and get MN percentages
    const { dm, cost, ingredientMetrics } = calculateDietTotals(newIngs);
    
    // Update MN percentages for each ingredient
    const updatedIngs = newIngs.map(ing => {
      const metric = ingredientMetrics.find(m => m.ingredientId === ing.ingredientId);
      return {
        ...ing,
        inclusionMNPercentage: metric ? metric.mnPercentage : 0
      };
    });

    setEditingDiet({
      ...editingDiet,
      ingredients: updatedIngs,
      calculatedDryMatter: dm,
      calculatedCostPerKg: cost
    });
  };

  const removeDietIngredient = (idx: number) => {
    if (!editingDiet) return;
    const newIngs = editingDiet.ingredients.filter((_, i) => i !== idx);
    const { dm, cost } = calculateDietTotals(newIngs);
    setEditingDiet({
      ...editingDiet,
      ingredients: newIngs,
      calculatedDryMatter: dm,
      calculatedCostPerKg: cost
    });
  };

  const addIngredientToDiet = (ingredientId: string) => {
    if (!editingDiet) return;
    if (editingDiet.ingredients.some(i => i.ingredientId === ingredientId)) {
      alert('Ingrediente já está na dieta');
      return;
    }
    const newIngs = [...editingDiet.ingredients, { ingredientId, inclusionMSPercentage: 0, inclusionMNPercentage: 0 }];
    const { dm, cost, ingredientMetrics } = calculateDietTotals(newIngs);
    
    // Update MN percentages
    const updatedIngs = newIngs.map(ing => {
      const metric = ingredientMetrics.find(m => m.ingredientId === ing.ingredientId);
      return {
        ...ing,
        inclusionMNPercentage: metric ? metric.mnPercentage : 0
      };
    });

    setEditingDiet({
      ...editingDiet,
      ingredients: updatedIngs,
      calculatedDryMatter: dm,
      calculatedCostPerKg: cost
    });
  };

   const calculateDietTotals = (dietIngs: DietIngredient[]) => {
    const metrics = calculateDietMetrics({ ingredients: dietIngs } as Diet, ingredients);
    
    // Total % MS
    const totalMSPercentage = dietIngs.reduce((acc, curr) => acc + curr.inclusionMSPercentage, 0);

    return { 
      dm: Number(metrics.ms.toFixed(2)), 
      cost: Number(metrics.costPerKgMN.toFixed(4)),
      totalPerc: Number(totalMSPercentage.toFixed(2)),
      ingredientMetrics: metrics.ingredientMetrics
    };
  };

  const handleSaveDiet = async () => {
    if (!editingDiet) return;
    const totals = calculateDietTotals(editingDiet.ingredients);
    if (totals.totalPerc !== 100) {
      if (!window.confirm(`A soma das inclusões (${totals.totalPerc}%) não é 100%. Deseja salvar mesmo assim?`)) {
        return;
      }
    }
    try {
      await updateDiet(editingDiet.id, editingDiet);
      setEditingDiet(null);
    } catch (error) {
      console.error("Error saving diet:", error);
      alert("Erro ao salvar dieta.");
    }
  };

  const currentTotalPerc = editingDiet ? calculateDietTotals(editingDiet.ingredients).totalPerc : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Sidebar List */}
      <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
        <div className="p-4 border-b bg-slate-50 font-bold text-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Wheat size={18} className="text-emerald-600" />
            <span>Formulário de Dietas</span>
          </div>
          <button 
            onClick={handleAddDiet}
            className="text-[10px] uppercase tracking-widest bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition shadow-sm font-black"
          >
            Nova Dieta
          </button>
        </div>
        <div className="divide-y overflow-y-auto">
          {diets.map(diet => (
            <div 
              key={diet.id} 
              onClick={() => { setActiveDietId(diet.id); setEditingDiet(null); }}
              className={`p-5 cursor-pointer hover:bg-slate-50 transition-colors border-l-4 relative group ${activeDietId === diet.id ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-transparent text-slate-700'}`}
            >
              <div className="flex justify-between items-start">
                <div className="font-black text-base uppercase tracking-tight">{diet.name}</div>
                <div className="flex gap-1">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleToggleStatus(diet); }}
                    className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${diet.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}
                  >
                    {diet.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteDiet(diet.id); }}
                    className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                    title="Excluir Dieta"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 mt-2 flex justify-between font-bold">
                <span className="bg-white/50 px-1.5 rounded border border-slate-100">MS: {diet.calculatedDryMatter.toFixed(1)}%</span>
                <span className="text-emerald-600">R$ {diet.calculatedCostPerKg.toFixed(3)}/kg MN</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Editor */}
      <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[600px] flex flex-col overflow-hidden">
        {editingDiet ? (
          <div className="flex flex-col h-full">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
               <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase">Editando: {editingDiet.name}</h3>
                  <div className="flex gap-4 mt-2">
                    <div className="text-xs font-bold text-slate-500">MS Projetada: <span className="text-emerald-600 font-black">{editingDiet.calculatedDryMatter}%</span></div>
                    <div className="text-xs font-bold text-slate-500 underline decoration-dotted">Custo p/ Kg MS: <span className="text-emerald-700 font-black">R$ {editingDiet.calculatedDryMatter > 0 ? (editingDiet.calculatedCostPerKg / (editingDiet.calculatedDryMatter / 100)).toFixed(4) : '0.0000'}</span></div>
                    <div className="text-xs font-bold text-slate-500">Custo p/ Kg MN: <span className="text-emerald-600 font-black">R$ {editingDiet.calculatedCostPerKg.toFixed(4)}</span></div>
                  </div>
               </div>
               <div className="flex gap-2">
                  <button onClick={() => setEditingDiet(null)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
                  <button onClick={handleSaveDiet} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 transition-shadow shadow-md shadow-emerald-200/50">
                    <Save size={18} /> Salvar Alterações
                  </button>
               </div>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
               <div className="flex justify-between items-center mb-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest italic">Formulação Base MS (F-07)</h4>
                  <div className={`text-xs font-black px-3 py-1 rounded-full ${currentTotalPerc === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    Total MS: {currentTotalPerc}% 
                    {currentTotalPerc !== 100 && <span className="ml-2 italic">(Ajuste para 100%)</span>}
                  </div>
               </div>

               <div className="space-y-3">
                  {editingDiet.ingredients.map((item, idx) => {
                    const ing = ingredients.find(i => i.id === item.ingredientId);
                    const mnPct = calculateDietTotals(editingDiet.ingredients).ingredientMetrics.find(m => m.ingredientId === item.ingredientId)?.mnPercentage || 0;
                    return (
                      <div key={idx} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all">
                        <div className="flex-1">
                          <div className="text-sm font-black text-slate-800 italic uppercase">{ing?.name || 'Desconhecido'}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase">MS: {ing?.dryMatterContent}% | Custo MN: R$ {(ing?.pricePerTon || 0) / 1000}/kg</div>
                        </div>
                        <div className="flex items-center gap-8">
                           <div className="text-right">
                              <div className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Inclusão MN (CALC)</div>
                              <div className="text-sm font-black text-slate-400">{mnPct.toFixed(2)}%</div>
                           </div>
                           <div className="relative">
                              <div className="absolute -top-3 left-0 text-[10px] font-bold text-emerald-600 uppercase">Input % MS</div>
                              <input 
                                 type="number" 
                                 value={item.inclusionMSPercentage}
                                 onChange={(e) => updateDietIngredient(idx, Number(e.target.value))}
                                 className="w-24 p-2 text-right font-black text-emerald-700 border-2 border-emerald-100 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none pr-7"
                              />
                              <span className="absolute right-2 top-2 text-slate-400 font-bold">%</span>
                           </div>
                           <button 
                             onClick={() => removeDietIngredient(idx)}
                             className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                           >
                             <Trash2 size={18} />
                           </button>
                        </div>
                      </div>
                    );
                  })}
               </div>

                  <div className="mt-8 pt-6 border-t">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Adicionar Ingrediente</label>
                    <div className="flex gap-3">
                      <select 
                        className="flex-1 p-2.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                        onChange={(e) => {
                          if (e.target.value) {
                            addIngredientToDiet(e.target.value);
                            e.target.value = '';
                          }
                        }}
                      >
                        <option value="">Selecione um ingrediente novo...</option>
                        {ingredients
                          .filter(ing => !editingDiet.ingredients.some(di => di.ingredientId === ing.id))
                          .map(ing => (
                            <option key={ing.id} value={ing.id}>{ing.name}</option>
                          ))
                        }
                      </select>
                    </div>
                  </div>
               </div>
            </div>
        ) : selectedDiet ? (
          <div className="p-8 h-full flex flex-col">
            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">{selectedDiet.name}</h2>
                  <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${selectedDiet.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {selectedDiet.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                <p className="text-slate-500 text-sm font-medium">Composição Atual (Base Matéria Natural)</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleStartEdit(selectedDiet)} 
                  className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition shadow-lg flex items-center gap-2"
                >
                  <Save size={18} /> Editar Composição
                </button>
                <button 
                  onClick={() => handleDeleteDiet(selectedDiet.id)} 
                  className="p-3 text-slate-400 hover:text-red-600 transition"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
               <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <Database size={24} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Matéria Seca (MS)</div>
                    <div className="text-2xl font-black text-emerald-900">{selectedDiet.calculatedDryMatter}%</div>
                  </div>
               </div>
               <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center gap-4 text-white">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Custo p/ kg MN</div>
                    <div className="text-2xl font-black text-white leading-none">R$ {selectedDiet.calculatedCostPerKg.toFixed(4)}</div>
                  </div>
               </div>
               <div className="bg-emerald-800 p-5 rounded-2xl border border-emerald-700 flex items-center gap-4 text-white shadow-lg">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white">
                    <Plus size={24} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-emerald-300 uppercase tracking-widest leading-none mb-1">Custo p/ kg MS</div>
                    <div className="text-2xl font-black text-white leading-none">R$ {selectedDiet.calculatedDryMatter > 0 ? (selectedDiet.calculatedCostPerKg / (selectedDiet.calculatedDryMatter / 100)).toFixed(4) : '0.0000'}</div>
                  </div>
               </div>
            </div>

            <div className="border rounded-2xl overflow-hidden flex-1 flex flex-col">
              <div className="bg-slate-50 px-6 py-3 border-b text-[10px] font-black text-slate-500 uppercase tracking-widest flex justify-between">
                <span>Ingrediente</span>
                <div className="flex gap-12 text-right">
                  <span className="w-20 text-center">% MS</span>
                  <span className="w-20 bg-emerald-100/50 px-1 rounded text-emerald-700">% MN (CALC)</span>
                  <span className="w-24">R$ / kg MN</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {(() => {
                  const metrics = calculateDietMetrics(selectedDiet, ingredients);
                  return selectedDiet.ingredients.map((item, idx) => {
                    const ing = ingredients.find(i => i.id === item.ingredientId);
                    const mnPct = metrics.ingredientMetrics.find(m => m.ingredientId === item.ingredientId)?.mnPercentage || 0;
                    return (
                      <div key={idx} className="px-6 py-4 flex justify-between items-center hover:bg-slate-50">
                        <div className="font-bold text-slate-700 italic uppercase">{ing?.name}</div>
                        <div className="flex gap-12 items-center">
                          <div className="w-20 text-center font-bold text-slate-400">{item.inclusionMSPercentage}%</div>
                          <div className="w-20 text-center font-black text-emerald-600">{mnPct.toFixed(2)}%</div>
                          <div className="w-24 text-right font-mono text-xs text-slate-500">
                            R$ {((ing ? ing.pricePerTon / 1000 : 0) * (mnPct / 100)).toFixed(4)}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
            <Wheat size={64} className="opacity-20" />
            <p className="font-bold italic">Selecione ou crie uma dieta para gerenciar</p>
          </div>
        )}
      </div>
    </div>
  );
};

const Nutrition: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ingredientes' | 'dietas'>('ingredientes');

  const tabs = [
    { id: 'ingredientes', label: 'Cadastro de Ingredientes', icon: <Database size={18} /> },
    { id: 'dietas', label: 'Formulação de Dietas', icon: <Wheat size={18} /> },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 md:px-0">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 italic tracking-tighter uppercase">Módulo de Nutrição</h1>
          <p className="text-slate-500 font-medium">Controle total de insumos e formulação técnica (F-06 / F-07)</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
           {tabs.map(tab => (
             <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               {tab.icon}
               {tab.label}
             </button>
           ))}
        </div>
      </div>

      <div className="min-h-[600px] mt-8">
        {activeTab === 'ingredientes' && <IngredientsTab />}
        {activeTab === 'dietas' && <DietsTab />}
      </div>
    </div>
  );
};

export default Nutrition;

