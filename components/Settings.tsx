
import React, { useState } from 'react';
import { useAppStore } from '../context';
import { Settings as SettingsIcon, Warehouse, Plus, Trash2, Minus } from 'lucide-react';
import { Pen, Lot, Ingredient } from '../types';
import { DEFAULT_CONFIG } from '../constants';
import { useSessionState } from '../lib/useSessionState';

// Tab Components using Context
const GeneralParamsTab = () => {
  const { config, updateConfig, categories, addCategory, deleteCategory, deleteGMDCurve } = useAppStore();

  const [showGMDForm, setShowGMDForm] = useState(false);
  const [newGMD, setNewGMD] = useState({ name: '', gmd: 1.5 });

  const [showCatForm, setShowCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const [showBunkForm, setShowBunkForm] = useState(false);
  const [newBunk, setNewBunk] = useState({ score: 0, adjustmentPercentage: 0 });

  const handleChange = (field: keyof typeof config, value: any) => {
    updateConfig({ ...config, [field]: value });
  };

  const handleScoreAdjustmentChange = (index: number, val: number) => {
    const newAdjustments = [...config.bunkScoreAdjustments];
    newAdjustments[index].adjustmentPercentage = val;
    updateConfig({ ...config, bunkScoreAdjustments: newAdjustments });
  };

  const handleScoreKgChange = (index: number, val: number) => {
    const newAdjustments = [...config.bunkScoreAdjustments];
    newAdjustments[index].adjustmentKgMS = val;
    updateConfig({ ...config, bunkScoreAdjustments: newAdjustments });
  };

  const isKgMode = config.bunkAdjustmentMode === 'kg';

  const deleteBunkScore = (index: number) => {
    const newAdjustments = [...config.bunkScoreAdjustments];
    newAdjustments.splice(index, 1);
    updateConfig({ ...config, bunkScoreAdjustments: newAdjustments });
  };

  const addBunkScore = () => {
    const entry = config.bunkAdjustmentMode === 'kg'
      ? { score: newBunk.score, adjustmentPercentage: 0, adjustmentKgMS: newBunk.adjustmentPercentage }
      : { score: newBunk.score, adjustmentPercentage: newBunk.adjustmentPercentage, adjustmentKgMS: 0 };
    const newAdjustments = [...config.bunkScoreAdjustments, entry];
    // Sort by score
    newAdjustments.sort((a, b) => a.score - b.score);
    updateConfig({ ...config, bunkScoreAdjustments: newAdjustments });
    setNewBunk({ score: 0, adjustmentPercentage: 0 });
    setShowBunkForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b">Limites Operacionais (F-01)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Lim. Carregamento Inf (%)</label>
            <input 
              type="number" 
              value={config.loadingLimitLower} 
              onChange={e => handleChange('loadingLimitLower', parseFloat(e.target.value))}
              className="w-full p-2 border rounded bg-slate-50" 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Lim. Carregamento Sup (%)</label>
            <input 
              type="number" 
              value={config.loadingLimitUpper} 
              onChange={e => handleChange('loadingLimitUpper', parseFloat(e.target.value))}
              className="w-full p-2 border rounded bg-slate-50" 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">MS Meta 1º Dia (%PV)</label>
            <input 
              type="number" 
              step="0.1"
              value={config.firstTratoMSPercentPV} 
              onChange={e => handleChange('firstTratoMSPercentPV', parseFloat(e.target.value))}
              className="w-full p-2 border rounded bg-slate-50" 
            />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b">Configuração de Tratos (F-02)</h2>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div>
             <label className="text-sm font-bold text-slate-700 block mb-2">Quantidade de Tratos</label>
             <select 
               className="w-full p-2 border rounded mb-4" 
               value={config.numTreatments}
               onChange={e => {
                 const count = parseInt(e.target.value);
                 const newProps = Array(count).fill(Math.floor(100/count));
                 // Adjust last to make 100
                 newProps[count-1] = 100 - (newProps[0] * (count-1));
                 updateConfig({ ...config, numTreatments: count, treatmentProportions: newProps });
               }}
             >
               {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} Tratos</option>)}
             </select>
           </div>
           <div>
             <label className="text-sm font-bold text-slate-700 block mb-2">Proporção por Trato (%)</label>
             <div className="flex gap-4">
              {config.treatmentProportions.map((split, idx) => (
                  <div key={idx} className="flex-1">
                    <span className="text-xs text-slate-500 block">Trato {idx + 1}</span>
                    <input 
                      type="number" 
                      value={split} 
                      onChange={(e) => {
                        const newProps = [...config.treatmentProportions];
                        newProps[idx] = parseFloat(e.target.value);
                        handleChange('treatmentProportions', newProps);
                      }}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-emerald-500" 
                    />
                </div>
              ))}
             </div>
             <div className="mt-2 text-xs text-right font-bold text-slate-500">
               Soma: {config.treatmentProportions.reduce((a,b) => a+b, 0)}% (Deve ser 100%)
             </div>
           </div>
         </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-4 pb-2 border-b">
          <h2 className="text-lg font-bold text-slate-800">Escala de Leitura de Cocho (F-03)</h2>
          <button 
            onClick={() => setShowBunkForm(!showBunkForm)}
            className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold flex items-center gap-1 hover:bg-emerald-200"
          >
            <Plus size={14} /> Novo Escore
          </button>
        </div>

        {/* Tipo de correção: % do dia anterior ou kg de MS por cabeça */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase">Tipo de correção:</span>
          <div className="flex gap-2">
            <button
              onClick={() => handleChange('bunkAdjustmentMode', 'percent')}
              className={`px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${!isKgMode ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
            >
              % do dia anterior
            </button>
            <button
              onClick={() => handleChange('bunkAdjustmentMode', 'kg')}
              className={`px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${isKgMode ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
            >
              kg de MS por cabeça
            </button>
          </div>
          <span className="text-[11px] text-slate-400 sm:ml-2">
            {isKgMode
              ? 'Ex: +0,200 kg ou -1,000 kg de MS/cab em relação ao dia anterior'
              : 'Ex: +5% ou -10% sobre o consumo de MS do dia anterior'}
          </span>
        </div>

        {showBunkForm && (
           <div className="mb-4 p-4 bg-emerald-50 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4 items-end border border-emerald-100 shadow-inner">
             <div>
               <label className="text-xs font-bold text-emerald-800 uppercase">Escore (Número)</label>
               <div className="flex items-center gap-2">
                 <button 
                   onClick={() => setNewBunk(prev => ({ ...prev, score: Number((prev.score - 0.5).toFixed(1)) }))}
                   className="p-2 bg-white border border-emerald-200 rounded shadow-sm hover:bg-emerald-100 text-emerald-700"
                 >
                   <Minus size={16} strokeWidth={3} />
                 </button>
                 <input 
                   type="number"
                   step="0.1"
                   className="w-full p-2 rounded border border-emerald-200 text-center font-bold" 
                   value={newBunk.score} 
                   onChange={e=>setNewBunk({...newBunk, score: Number(e.target.value)})} 
                 />
                 <button 
                   onClick={() => setNewBunk(prev => ({ ...prev, score: Number((prev.score + 0.5).toFixed(1)) }))}
                   className="p-2 bg-white border border-emerald-200 rounded shadow-sm hover:bg-emerald-100 text-emerald-700"
                 >
                   <Plus size={16} strokeWidth={3} />
                 </button>
               </div>
             </div>
             <div>
               <label className="text-xs font-bold text-emerald-800 uppercase">{isKgMode ? 'Ajuste (kg MS/cab)' : 'Correção (%)'}</label>
               <div className="flex items-center gap-2">
                 <button 
                   onClick={() => setNewBunk(prev => ({ ...prev, adjustmentPercentage: Number((prev.adjustmentPercentage - (isKgMode ? 0.1 : 1)).toFixed(3)) }))}
                   className="p-2 bg-white border border-emerald-200 rounded shadow-sm hover:bg-emerald-100 text-emerald-700"
                 >
                   <Minus size={16} strokeWidth={3} />
                 </button>
                 <input 
                   type="number" 
                   step={isKgMode ? 0.001 : 0.5}
                   className="w-full p-2 rounded border border-emerald-200 text-center font-bold" 
                   value={newBunk.adjustmentPercentage} 
                   onChange={e=>setNewBunk({...newBunk, adjustmentPercentage:Number(e.target.value)})} 
                 />
                 <button 
                   onClick={() => setNewBunk(prev => ({ ...prev, adjustmentPercentage: Number((prev.adjustmentPercentage + (isKgMode ? 0.1 : 1)).toFixed(3)) }))}
                   className="p-2 bg-white border border-emerald-200 rounded shadow-sm hover:bg-emerald-100 text-emerald-700"
                 >
                   <Plus size={16} strokeWidth={3} />
                 </button>
               </div>
             </div>
             <button 
               onClick={addBunkScore} 
               className="bg-emerald-600 text-white px-6 h-10 rounded font-bold hover:bg-emerald-700 shadow-md"
             >
               Salvar Escore
             </button>
           </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-2">Escore</th>
                <th className="p-2">Descrição</th>
                <th className="p-2 text-right">{isKgMode ? 'Ajuste (kg MS/cab)' : 'Correção (%)'}</th>
                <th className="p-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {config.bunkScoreAdjustments.map((rule, idx) => {
                let desc = rule.score === 0 ? "Cocho Limpo" : rule.score === 0.5 ? "Fundo / Lamido" : rule.score === 4 ? "Cheio" : `Sobra Nível ${rule.score}`;
                return (
                  <tr key={idx}>
                    <td className="p-2 font-mono font-bold">{rule.score}</td>
                    <td className="p-2 text-slate-600">{desc}</td>
                    <td className="p-2 text-right">
                      {isKgMode ? (
                        <input
                          type="number"
                          step="0.001"
                          value={rule.adjustmentKgMS ?? 0}
                          onChange={(e) => handleScoreKgChange(idx, parseFloat(e.target.value) || 0)}
                          className={`w-24 p-1 border rounded text-right font-bold ${(rule.adjustmentKgMS ?? 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}
                        />
                      ) : (
                        <input
                          type="number"
                          step="0.5"
                          value={rule.adjustmentPercentage}
                          onChange={(e) => handleScoreAdjustmentChange(idx, parseFloat(e.target.value))}
                          className={`w-20 p-1 border rounded text-right font-bold ${rule.adjustmentPercentage < 0 ? 'text-red-600' : 'text-emerald-600'}`}
                        />
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <button 
                        onClick={() => deleteBunkScore(idx)}
                        className="text-red-400 hover:text-red-600 p-1"
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

      {/* Curvas de GMD */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-4 pb-2 border-b">
          <h2 className="text-lg font-bold text-slate-800 italic uppercase tracking-tighter">Curvas de GMD (Ganhos Previstos)</h2>
          <button 
            onClick={() => setShowGMDForm(!showGMDForm)}
            className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold flex items-center gap-1 hover:bg-emerald-200"
          >
            <Plus size={14} /> Nova Curva
          </button>
        </div>

        {showGMDForm && (
           <div className="mb-4 p-4 bg-emerald-50 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4 items-end border border-emerald-100">
             <div>
               <label className="text-xs font-bold text-emerald-800 uppercase">Nome da Curva</label>
               <input 
                 className="w-full p-2 rounded border border-emerald-200" 
                 value={newGMD.name} 
                 onChange={e=>setNewGMD({...newGMD, name:e.target.value})} 
                 placeholder="Ex: GMD Alto" 
               />
             </div>
             <div>
               <label className="text-xs font-bold text-emerald-800 uppercase">GMD Correspondente (kg/dia)</label>
               <input 
                 type="number" 
                 step="0.01"
                 className="w-full p-2 rounded border border-emerald-200" 
                 value={newGMD.gmd} 
                 onChange={e=>setNewGMD({...newGMD, gmd:Number(e.target.value)})} 
               />
             </div>
             <button 
               onClick={() => {
                 if (newGMD.name) {
                   const curves = [...(config.gmdCurves || [])];
                   curves.push({ id: `gmd_${Date.now()}`, name: newGMD.name, gmd: newGMD.gmd });
                   updateConfig({ ...config, gmdCurves: curves });
                   setNewGMD({ name: '', gmd: 1.5 });
                   setShowGMDForm(false);
                 }
               }} 
               className="bg-emerald-600 text-white px-6 h-10 rounded font-bold hover:bg-emerald-700 shadow-md"
             >
               Salvar Curva
             </button>
           </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {(config.gmdCurves || []).map(curve => (
              <div key={curve.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center group hover:border-emerald-300 transition-all">
                 <div>
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Nomeação</div>
                    <div className="font-black text-slate-800 italic uppercase">{curve.name}</div>
                 </div>
                 <div className="text-right flex flex-col items-end gap-2">
                    <div>
                      <div className="text-xs font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">GMD (kg/dia)</div>
                      <div className="text-lg font-black text-slate-900">{curve.gmd.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    <button 
                      onClick={() => {
                        if (window.confirm(`Excluir curva ${curve.name}?`)) {
                          deleteGMDCurve(curve.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                 </div>
              </div>
            ))}
        </div>
      </div>

      {/* Categorias */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-4 pb-2 border-b">
          <h2 className="text-lg font-bold text-slate-800 italic uppercase tracking-tighter">Categorias Animais</h2>
          <button 
            onClick={() => setShowCatForm(!showCatForm)}
            className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold flex items-center gap-1 hover:bg-emerald-200"
          >
            <Plus size={14} /> Nova Categoria
          </button>
        </div>

        {showCatForm && (
           <div className="mb-4 p-4 bg-emerald-50 rounded-lg flex gap-4 items-end border border-emerald-100 shadow-inner">
             <div className="flex-1">
               <label className="text-xs font-bold text-emerald-800 uppercase">Nome da Categoria</label>
               <input className="w-full p-2 rounded border border-emerald-200" value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="Ex: Garrote" />
             </div>
             <button 
               onClick={() => {
                 if (newCatName) {
                   addCategory({ id: `c${Date.now()}`, name: newCatName });
                   setNewCatName('');
                   setShowCatForm(false);
                 }
               }} 
               className="bg-emerald-600 text-white px-6 h-10 rounded font-bold hover:bg-emerald-700 shadow-md"
             >
               Salvar
             </button>
           </div>
        )}

        <div className="flex flex-wrap gap-3">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-black text-slate-700 italic uppercase hover:border-emerald-300 transition-all">
              <span>{cat.name}</span>
              <button 
                onClick={() => {
                  if (window.confirm(`Tem certeza que deseja excluir permanentemente a categoria "${cat.name}"?`)) {
                    deleteCategory(cat.id);
                  }
                }}
                className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                title="Excluir Categoria"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StructuresTab = () => {
  const { pens, addPen, removePen } = useAppStore();
  
  const [showPenForm, setShowPenForm] = useState(false);
  const [newPen, setNewPen] = useState<Partial<Pen>>({});

  const handleSavePen = () => {
    if(newPen.name && newPen.capacity) {
      addPen({
        id: `p${Date.now()}`,
        name: newPen.name,
        moduleId: newPen.moduleId || 'M1',
        capacity: Number(newPen.capacity)
      });
      setNewPen({});
      setShowPenForm(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Baias */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-4 pb-2 border-b">
          <h2 className="text-lg font-bold text-slate-800">Cadastro de Baias / Currais</h2>
          <button 
            onClick={() => setShowPenForm(!showPenForm)}
            className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold flex items-center gap-1 hover:bg-emerald-200"
          >
            <Plus size={14} /> Nova Baia
          </button>
        </div>

        {showPenForm && (
          <div className="mb-4 p-4 bg-emerald-50 rounded-lg grid grid-cols-4 gap-4 items-end border border-emerald-100 shadow-inner">
             <div><label className="text-xs font-bold text-emerald-800">Nome/Número</label><input className="w-full p-2 rounded border border-emerald-200" value={newPen.name||''} onChange={e=>setNewPen({...newPen, name:e.target.value})} placeholder="Ex: Baia 10" /></div>
             <div><label className="text-xs font-bold text-emerald-800">Módulo/Setor</label><input className="w-full p-2 rounded border border-emerald-200" value={newPen.moduleId||''} onChange={e=>setNewPen({...newPen, moduleId:e.target.value})} placeholder="Engorda 1" /></div>
             <div><label className="text-xs font-bold text-emerald-800">Capacidade (Cab)</label><input type="number" className="w-full p-2 rounded border border-emerald-200" value={newPen.capacity||''} onChange={e=>setNewPen({...newPen, capacity:Number(e.target.value)})} placeholder="150" /></div>
             <button onClick={handleSavePen} className="bg-emerald-600 text-white p-2 rounded font-bold hover:bg-emerald-700 h-10 shadow-md">Salvar Baia</button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {pens.map(pen => (
            <div key={pen.id} className="p-4 border border-slate-200 rounded-xl bg-white flex justify-between items-center hover:border-emerald-300 transition-all cursor-default group relative">
              <div>
                <div className="font-bold text-slate-800 group-hover:text-emerald-700">{pen.name}</div>
                <div className="text-xs text-slate-500 uppercase tracking-tight">{pen.moduleId}</div>
                <div className="mt-1 text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded inline-block">
                  {pen.capacity} CAB
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                  <Warehouse size={16} />
                </div>
                <button 
                  onClick={() => {
                    if (window.confirm(`Excluir a baia ${pen.name}?`)) {
                      removePen(pen.id);
                    }
                  }}
                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                  title="Excluir Baia"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useSessionState<'geral' | 'estruturas'>('settings.tab', 'geral');

  const tabs = [
    { id: 'geral', label: 'Parâmetros Gerais', icon: <SettingsIcon size={18} /> },
    { id: 'estruturas', label: 'Estruturas', icon: <Warehouse size={18} /> },
  ];

  const { clearOperationalData } = useAppStore();
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    const typed = window.prompt(
      "ATENÇÃO: isso excluirá os Lotes, Movimentações, Fichas de Trato, Estruturas, Categorias, Dietas e Ingredientes DO SEU confinamento (dados de outros usuários não são afetados).\n\nEsta ação NÃO pode ser desfeita.\n\nPara confirmar, digite: ZERAR"
    );
    if (typed !== null && typed.trim().toUpperCase() === 'ZERAR') {
      setResetting(true);
      try {
        await clearOperationalData();
        alert("Base de dados totalmente zerada!");
      } catch (err) {
        alert("Erro ao resetar sistema.");
      } finally {
        setResetting(false);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-slate-500">Gerencie todos os cadastros e parâmetros do sistema (F-01 a F-05)</p>
      </div>

      <div className="flex border-b border-slate-200 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`
              flex items-center gap-2 px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors border-b-2
              ${activeTab === tab.id 
                ? 'border-emerald-500 text-emerald-700' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'geral' && <GeneralParamsTab />}
        {activeTab === 'estruturas' && <StructuresTab />}
      </div>

      {/* Danger Zone */}
      <div className="mt-12 pt-12 border-t border-red-100 flex flex-col gap-6">
         <div className="bg-red-50 p-6 rounded-2xl border border-red-100 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
               <h3 className="text-red-800 font-black uppercase italic tracking-tighter text-lg">Zona de Perigo: Redefinição Total</h3>
               <p className="text-red-600 text-sm font-medium">Isso apagará permanentemente os registros do SEU confinamento (Lotes, Dietas, Baias, Histórico). É necessário digitar ZERAR para confirmar. 
               <br/><span className="font-bold">Atenção:</span> Esta ação não pode ser desfeita.</p>
            </div>
            <button 
              disabled={resetting}
              onClick={handleReset}
              className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-lg ${resetting ? 'bg-slate-300 text-slate-500' : 'bg-red-600 text-white hover:bg-red-700 active:scale-95'}`}
            >
              {resetting ? 'Resetando...' : 'Zerar Meus Dados'}
            </button>
         </div>
      </div>
    </div>
  );
};

export default Settings;
