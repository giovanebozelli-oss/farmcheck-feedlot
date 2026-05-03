import React, { useState } from 'react';
import { MovementType, AnimalMovement, Lot } from '../types';
import { useAppStore } from '../context';
import { ArrowRight, PlusCircle, AlertCircle, History, Info, MapPin, Gauge, Scaling, Beef, User, Calendar as CalendarIcon, ClipboardList, Trash2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const AnimalMovementPage: React.FC = () => {
  const { lots, movements, addMovement, addLot, pens, categories, config, diets, getActiveHeadCount, executeMovement } = useAppStore();
  const [activeTab, setActiveTab] = useState<'register_lot' | 'movements' | 'history'>('register_lot');
  
  const gmdCurves = config.gmdCurves || [];
  // Lot Registration State
  const [newLot, setNewLot] = useState<Partial<Lot>>({
    name: '',
    entryDate: new Date().toISOString().split('T')[0],
    initialWeight: 0,
    breed: 'Nelore',
    currentPenId: '',
    headCount: 0,
    initialConsumptionPV: 1.2,
    categoryId: '',
    gender: 'MACHO',
    gmdCurveId: 'curva_padrao',
  });

  const [movementForm, setMovementForm] = useState({
    date: new Date().toISOString().split('T')[0],
    lotId: '',
    type: MovementType.Death,
    quantity: 0,
    originPenId: '',
    destinationPenId: '',
    notes: ''
  });

  const { updateLot } = useAppStore();

  const handleLotChange = (lotId: string) => {
    const lot = lots.find(l => l.id === lotId);
    setMovementForm(prev => ({
      ...prev,
      lotId,
      originPenId: lot?.currentPenId || '',
      quantity: lot ? getActiveHeadCount(lot.id) : 0
    }));
  };

  const [historyLotId, setHistoryLotId] = useState<string>('');

  const handleRegisterLot = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newLot.name || !newLot.currentPenId || !newLot.headCount) return;

    const lotId = `L${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
    const lot: Lot = {
      id: lotId,
      name: newLot.name,
      entryDate: newLot.entryDate || '',
      initialWeight: Number(newLot.initialWeight) || 0,
      breed: newLot.breed || '',
      categoryId: newLot.categoryId || categories[0]?.id || '',
      gender: newLot.gender as 'MACHO' | 'FEMEA',
      gmdCurveId: newLot.gmdCurveId || 'curva_padrao',
      currentPenId: newLot.currentPenId,
      headCount: Number(newLot.headCount),
      currentDietId: diets.find(d => d.status === 'ACTIVE')?.id || diets[0]?.id || '',
      initialConsumptionPV: Number(newLot.initialConsumptionPV) || 1.2,
      status: 'ACTIVE'
    };

    try {
      await addLot(lot);
      // Entry inicial é criado dentro de addLot (fonte única da verdade)
    } catch (err) {
      console.error('[handleRegisterLot]', err);
      alert('Erro ao cadastrar lote. Tente novamente.');
      return;
    }

    setNewLot({
      name: '',
      entryDate: new Date().toISOString().split('T')[0],
      initialWeight: 0,
      breed: 'Nelore',
      currentPenId: '',
      headCount: 0,
      initialConsumptionPV: 1.2,
      categoryId: '',
      gender: 'MACHO',
      gmdCurveId: 'curva_padrao',
    });
    setActiveTab('movements');
  };

  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementForm.lotId || (movementForm.type !== MovementType.Transfer && movementForm.quantity <= 0)) return;
    if (movementForm.type === MovementType.Transfer && (!movementForm.originPenId || !movementForm.destinationPenId)) return;

    const currentCount = getActiveHeadCount(movementForm.lotId);
    if (movementForm.quantity > currentCount) {
      alert(`Quantidade insuficiente! O lote possui apenas ${currentCount} cabeças.`);
      return;
    }

    await executeMovement(movementForm);
    setMovementForm(prev => ({ ...prev, quantity: 0, notes: '', destinationPenId: '' }));
  };

  const getTypeColor = (type: MovementType) => {
    switch(type) {
      case MovementType.Entry: return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case MovementType.Death: return 'text-red-600 bg-red-50 border-red-100';
      case MovementType.Exit: return 'text-blue-600 bg-blue-50 border-blue-100';
      case MovementType.Transfer: return 'text-amber-600 bg-amber-50 border-amber-100';
      default: return 'text-slate-600 bg-slate-50 border-slate-100';
    }
  };

  const tabs = [
    { id: 'register_lot', label: 'Cadastrar Lote', icon: <PlusCircle size={14} /> },
    { id: 'movements', label: 'Registrar Evento', icon: <Info size={14} /> },
    { id: 'history', label: 'Vida do Lote', icon: <History size={14} /> },
  ] as const;

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase">
            Movimentação <span className="text-emerald-500">de Rebanho</span>
          </h1>
          <p className="text-slate-500 font-medium">Controle de entradas, saídas e rastreabilidade total do rebanho</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl shadow-inner border border-slate-200/50">
           {tabs.map(tab => (
             <button 
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-emerald-700 shadow-md ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
             >
               {tab.icon}
               {tab.label}
             </button>
           ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'register_lot' && (
          <motion.div 
            key="register"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            <div className="lg:col-span-8 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                  <Beef size={120} />
               </div>

               <form onSubmit={handleRegisterLot} className="space-y-8">
                  {/* Seção: Identificação */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-400">
                       <ClipboardList size={16} />
                       <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Capa do Lote & Identificação</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="md:col-span-1">
                          <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">Nome / Identificação</label>
                          <input 
                            className="w-full p-4 border rounded-2xl bg-slate-50/50 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none border-slate-200 font-bold" 
                            value={newLot.name} 
                            onChange={e=>setNewLot({...newLot, name:e.target.value})} 
                            placeholder="Ex: LOTE 01 - 2024" 
                          />
                       </div>
                       <div>
                          <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">Data de Entrada</label>
                          <div className="relative">
                            <input 
                              type="date" 
                              className="w-full p-4 border rounded-2xl bg-slate-50/50 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none border-slate-200 font-bold" 
                              value={newLot.entryDate} 
                              onChange={e=>setNewLot({...newLot, entryDate:e.target.value})} 
                            />
                          </div>
                       </div>
                    </div>
                  </div>

                  {/* Seção: Características */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-400">
                       <Beef size={16} />
                       <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Características Genéticas & Biológicas</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <div>
                          <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">Raça</label>
                          <input className="w-full p-4 border rounded-2xl bg-slate-50/50 border-slate-200 font-bold" value={newLot.breed} onChange={e=>setNewLot({...newLot, breed:e.target.value})} placeholder="Nelore" />
                       </div>
                       <div>
                          <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">Sexo</label>
                          <select className="w-full p-4 border rounded-2xl bg-slate-50/50 border-slate-200 font-bold appearance-none" value={newLot.gender} onChange={e=>setNewLot({...newLot, gender:e.target.value as any})}>
                            <option value="MACHO">MACHO</option>
                            <option value="FEMEA">FÊMEA</option>
                          </select>
                       </div>
                       <div>
                          <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">Categoria</label>
                          <select className="w-full p-4 border rounded-2xl bg-slate-50/50 border-slate-200 font-bold appearance-none" value={newLot.categoryId} onChange={e=>setNewLot({...newLot, categoryId:e.target.value})}>
                            <option value="">SELECIONE...</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                       </div>
                    </div>
                  </div>

                  {/* Seção: Planejamento */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-400">
                       <Gauge size={16} />
                       <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Metas & Planejamento de Performance</h3>
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">Curva de GMD (Ganho Médio Diário)</label>
                       <select className="w-full p-4 border rounded-2xl bg-slate-50/50 border-slate-200 font-bold" value={newLot.gmdCurveId} onChange={e=>setNewLot({...newLot, gmdCurveId:e.target.value})}>
                         <option value="">Selecione a curva esperada...</option>
                         {gmdCurves.map(curve => (
                           <option key={curve.id} value={curve.id}>
                             {curve.name} — Meta: {curve.gmd.toFixed(3)} kg/dia
                           </option>
                         ))}
                       </select>
                    </div>
                  </div>

                  {/* Seção: Distribuição Inicial */}
                  <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 space-y-6">
                    <div className="flex items-center gap-2 text-emerald-700">
                       <Scaling size={16} />
                       <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Distribuição & Início da Operação</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       <div className="col-span-2 md:col-span-1">
                          <label className="block text-[9px] font-black text-emerald-600 mb-1.5 uppercase tracking-wider">Baia Habitat</label>
                          <select className="w-full p-3 border border-emerald-200 rounded-xl bg-white font-bold text-xs text-emerald-800" value={newLot.currentPenId} onChange={e=>setNewLot({...newLot, currentPenId:e.target.value})}>
                            <option value="">ONDE?</option>
                            {pens.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                       </div>
                       <div>
                          <label className="block text-[9px] font-black text-emerald-600 mb-1.5 uppercase tracking-wider">Cab. Iniciais</label>
                          <input type="number" className="w-full p-3 border border-emerald-200 rounded-xl bg-white font-bold text-xs text-emerald-800" value={newLot.headCount || ''} onChange={e=>setNewLot({...newLot, headCount:Number(e.target.value)})} placeholder="0" />
                       </div>
                       <div>
                          <label className="block text-[9px] font-black text-emerald-600 mb-1.5 uppercase tracking-wider">P. Médio (kg)</label>
                          <input type="number" className="w-full p-3 border border-emerald-200 rounded-xl bg-white font-bold text-xs text-emerald-800" value={newLot.initialWeight || ''} onChange={e=>setNewLot({...newLot, initialWeight:Number(e.target.value)})} placeholder="0.0" />
                       </div>
                       <div>
                          <label className="block text-[9px] font-black text-emerald-600 mb-1.5 uppercase tracking-wider">1º Cons. (%PV)</label>
                          <input type="number" step="0.1" className="w-full p-3 border border-emerald-200 rounded-xl bg-white font-bold text-xs text-emerald-800" value={newLot.initialConsumptionPV || ''} onChange={e=>setNewLot({...newLot, initialConsumptionPV:Number(e.target.value)})} placeholder="1.2" />
                       </div>
                    </div>
                  </div>

                  <div className="pt-4">
                     <button type="submit" className="w-full bg-emerald-600 text-white py-5 rounded-3xl font-black uppercase tracking-[0.2em] text-sm hover:bg-emerald-700 shadow-[0_10px_30px_-10px_rgba(5,150,105,0.4)] hover:shadow-[0_15px_35px_-10px_rgba(5,150,105,0.5)] active:scale-[0.98] transition-all flex justify-center items-center gap-3">
                        Efetivar Entrada <ArrowRight size={18} />
                     </button>
                  </div>
               </form>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Informação Estratégica</h3>
                  <h4 className="text-xl font-black italic tracking-tighter mb-4">Por que cadastrar corretamente?</h4>
                  <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium">
                    A precisão nos dados de entrada garante que o sistema calcule a curva de crescimento correta e forneça a dieta ideal desde o primeiro dia.
                  </p>
                  <div className="space-y-3">
                    {[
                      { icon: <MapPin size={14} />, text: 'Rastreabilidade por Baia' },
                      { icon: <Gauge size={14} />, text: 'Análise de GMD Esperado' },
                      { icon: <Scaling size={14} />, text: 'Custo Alimentar Preciso' }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs font-bold text-slate-300">
                         <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                           {item.icon}
                         </div>
                         {item.text}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl"></div>
              </div>

              <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex items-start gap-4">
                 <div className="p-3 bg-white rounded-2xl shadow-sm text-emerald-600">
                    <AlertCircle size={20} />
                 </div>
                 <div>
                    <h5 className="font-bold text-emerald-900 text-sm mb-1">Atenção no PV</h5>
                    <p className="text-emerald-700/70 text-xs leading-relaxed font-medium">
                      O consumo de matéria seca no primeiro dia impacta diretamente na adaptação metabólica. O valor padrão é 1.2% do Peso Vivo.
                    </p>
                 </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'movements' && (
          <motion.div 
            key="movements"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
             <div className="lg:col-span-1 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-fit sticky top-6">
                <div className="flex items-center gap-2 mb-6">
                   <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white">
                      <AlertCircle size={14} />
                   </div>
                   <h2 className="text-lg font-black text-slate-800 uppercase italic tracking-tighter">Registrar Ocorrência</h2>
                </div>
                <form onSubmit={handleMovementSubmit} className="space-y-6">
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Selecione o Lote Alvo</label>
                      <select 
                        className="w-full p-4 border rounded-2xl bg-slate-50 focus:ring-2 focus:ring-slate-900 outline-none border-slate-200 font-bold appearance-none text-sm" 
                        value={movementForm.lotId} 
                        onChange={e=>handleLotChange(e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        {lots.map(l => (
                          <option key={l.id} value={l.id}>
                            {l.name} — Baia {pens.find(p=>p.id===l.currentPenId)?.name}
                          </option>
                        ))}
                      </select>
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest text-center">Tipo de Evento</label>
                   </div>

                   {movementForm.type === MovementType.Transfer && (
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Baia de Origem</label>
                            <div className="w-full p-4 border rounded-2xl bg-slate-100 border-slate-200 font-bold text-sm text-slate-500">
                               {pens.find(p => p.id === movementForm.originPenId)?.name || 'N/A'}
                            </div>
                         </div>
                         <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Baia de Destino</label>
                            <select 
                              className="w-full p-4 border rounded-2xl bg-emerald-50 focus:ring-2 focus:ring-emerald-500 outline-none border-emerald-200 font-bold appearance-none text-sm text-emerald-900"
                              value={movementForm.destinationPenId}
                              onChange={e => setMovementForm({...movementForm, destinationPenId: e.target.value})}
                            >
                               <option value="">Escolher...</option>
                               {pens.filter(p => p.id !== movementForm.originPenId).map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                               ))}
                            </select>
                         </div>
                      </div>
                   )}

                   <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest text-center">Tipo de Evento</label>
                      <div className="grid grid-cols-2 gap-3">
                         {Object.values(MovementType).filter(t => t !== MovementType.Entry).map(type => (
                           <button 
                             key={type} 
                             type="button"
                             onClick={() => setMovementForm({...movementForm, type})}
                             className={`py-4 px-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${movementForm.type === type ? 'bg-slate-900 text-white border-slate-900 shadow-lg scale-[1.03]' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'}`}
                           >
                             {type}
                           </button>
                         ))}
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Data</label>
                        <input type="date" className="w-full p-4 border rounded-2xl bg-slate-50 border-slate-200 font-bold text-sm" value={movementForm.date} onChange={e=>setMovementForm({...movementForm, date:e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">
                           Qtd (Animais)
                        </label>
                        <input 
                          type="number" 
                          className="w-full p-4 border rounded-2xl border-slate-200 font-black text-lg text-center bg-slate-50 text-slate-900" 
                          value={movementForm.quantity || ''} 
                          onChange={e=>setMovementForm({...movementForm, quantity:Number(e.target.value)})} 
                          placeholder="0" 
                        />
                      </div>
                   </div>
                   <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black uppercase tracking-[0.2em] text-xs hover:bg-black shadow-xl active:scale-[0.98] transition-all">Confirmar Registro</button>
                </form>
             </div>
             
             <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between mb-2">
                   <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Timeline de Movimentações</h2>
                   <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{movements.length} Registros</span>
                </div>
                <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                   {movements.sort((a,b)=>b.date.localeCompare(a.date)).map((mov, idx) => {
                     const lot = lots.find(l => l.id === mov.lotId);
                     return (
                       <motion.div 
                         key={mov.id} 
                         initial={{ opacity: 0, x: 10 }}
                         animate={{ opacity: 1, x: 0 }}
                         transition={{ delay: idx * 0.05 }}
                         className="p-6 flex items-center justify-between hover:bg-slate-50/80 transition-colors border-b last:border-0 group"
                       >
                          <div className="flex items-center gap-5">
                             <div className="text-center font-black text-[10px] bg-slate-100 px-3 py-2 rounded-xl text-slate-500 w-16 group-hover:bg-white group-hover:shadow-sm border border-transparent group-hover:border-slate-200 transition-all">
                               {mov.date.split('-').reverse().join('/')}
                             </div>
                             <div>
                                <div className="flex items-center gap-2 mb-1">
                                   <span className="font-black text-slate-900 uppercase italic tracking-tighter text-sm">{lot?.name}</span> 
                                   <ChevronRight size={12} className="text-slate-300" />
                                   <span className={`font-black tracking-widest ${getTypeColor(mov.type)} px-2.5 py-0.5 rounded-lg text-[9px] uppercase border`}>
                                      {mov.type}
                                   </span>
                                </div>
                                <div className="text-xs text-slate-400 font-medium">{mov.notes || 'Nenhuma observação registrada'}</div>
                             </div>
                          </div>
                          <div className={`text-xl font-black italic tracking-tighter ${mov.type === MovementType.Entry ? 'text-emerald-500' : 'text-slate-900'}`}>
                             {mov.type === MovementType.Entry ? '+' : '-'}{mov.quantity}
                          </div>
                       </motion.div>
                     );
                   })}
                </div>
             </div>
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div 
            key="history"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8"
          >
             <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1 w-full">
                   <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Rastreabilidade Total</label>
                   <div className="relative">
                     <select 
                       className="w-full p-4 border rounded-2xl bg-slate-50 font-black uppercase italic tracking-tighter text-lg border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 appearance-none outline-none pr-12" 
                       value={historyLotId} 
                       onChange={e=>setHistoryLotId(e.target.value)}
                     >
                       <option value="">Escolha um lote...</option>
                       {lots.map(l => <option key={l.id} value={l.id}>{l.name} (UUID: {l.id})</option>)}
                     </select>
                     <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <History size={20} />
                     </div>
                   </div>
                </div>
                <div className="hidden md:block w-px h-12 bg-slate-100"></div>
                <div className="flex gap-4 items-center">
                   <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Eventos</p>
                      <p className="text-2xl font-black text-slate-900 italic tracking-tighter">
                        {historyLotId ? movements.filter(m => m.lotId === historyLotId).length : '--'}
                      </p>
                   </div>
                </div>
             </div>

             {historyLotId ? (
               <div className="relative pl-12 border-l-4 border-emerald-100/50 space-y-10 ml-6 pb-10">
                  {movements.filter(m => m.lotId === historyLotId).sort((a,b) => a.date.localeCompare(b.date)).map((mov, idx) => (
                    <motion.div 
                      key={mov.id} 
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      className="relative"
                    >
                       {/* Marker */}
                       <div className={`absolute -left-[70px] top-4 w-12 h-12 rounded-2xl border-[6px] border-emerald-50 shadow-lg flex items-center justify-center font-black text-sm z-10 transition-transform hover:scale-110 active:rotate-12 ${getTypeColor(mov.type)}`}>
                          {idx + 1}
                       </div>
                       
                       <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm group hover:border-emerald-200 transition-all">
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                             <div className="flex items-center gap-6">
                                <div className="p-4 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                                   {mov.type === MovementType.Entry && <PlusCircle size={24} />}
                                   {mov.type === MovementType.Death && <AlertCircle size={24} />}
                                   {mov.type === MovementType.Exit && <ArrowRight size={24} />}
                                   {mov.type === MovementType.Transfer && <Scaling size={24} />}
                                </div>
                                <div>
                                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-2">
                                      <CalendarIcon size={12} />
                                      {mov.date.split('-').reverse().join('/')}
                                   </div>
                                   <div className="text-2xl font-black text-slate-900 italic uppercase italic tracking-tighter group-hover:text-emerald-900 transition-colors">
                                      {mov.type}
                                   </div>
                                </div>
                             </div>
                             <div className="flex flex-col items-end">
                                <div className={`text-4xl font-black italic tracking-tighter ${mov.type === MovementType.Entry ? 'text-emerald-600' : 'text-slate-900'}`}>
                                   {mov.quantity} <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest not-italic">CAB</span>
                                </div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Impacto no Lote</div>
                             </div>
                          </div>
                          
                          <div className="mt-8 pt-6 border-t border-slate-50 relative">
                             <div className="absolute -top-3 left-6 px-3 bg-white text-[9px] font-black text-slate-300 uppercase tracking-widest">Observações Técnicas</div>
                             <p className="text-slate-500 font-medium italic leading-relaxed text-sm">
                                {mov.notes || 'Registro operacional efetuado sem observações adicionais pelo curral.'}
                             </p>
                          </div>
                       </div>
                    </motion.div>
                  ))}
               </div>
             ) : (
               <div className="h-96 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-100 shadow-inner group">
                  <div className="w-24 h-24 rounded-[2rem] bg-white shadow-xl flex items-center justify-center text-slate-200 group-hover:scale-110 group-hover:rotate-12 transition-all mb-6">
                     <History size={48} />
                  </div>
                  <h3 className="text-xl font-black text-slate-400 italic uppercase tracking-tighter">Linha do Tempo Inativa</h3>
                  <p className="text-sm font-medium mt-2">Selecione um lote no seletor acima para carregar o histórico</p>
               </div>
             )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AnimalMovementPage;
