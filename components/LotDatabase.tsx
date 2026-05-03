
import React, { useState } from 'react';
import { useAppStore } from '../context';
import { Database, Search, ChevronRight, Scale, Calendar, Beef, Info, History, Warehouse, Activity, TrendingUp } from 'lucide-react';
import { Lot, Pen, MovementType, AnimalMovement } from '../types';
import { Trash2 } from 'lucide-react';

const LotDatabase: React.FC = () => {
  const { lots, diets, getActiveHeadCount, updateLot, categories, pens, getPenOccupancy, config, movements, deleteLot } = useAppStore();
  const [activeTab, setActiveTab] = useState<'lots' | 'pens'>('lots');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [historyView, setHistoryView] = useState(false);

  const handleDeleteLot = async (e: React.MouseEvent, lot: Lot) => {
    e.stopPropagation(); // Prevent selecting the lot when clicking delete
    if (window.confirm(`DESEJA EXCLUIR O LOTE ${lot.name}?\n\nEsta ação é IRREVERSÍVEL e apagará TODO o histórico de consumo e movimentações vinculado a este lote.`)) {
      await deleteLot(lot.id);
      if (selectedLotId === lot.id) setSelectedLotId(null);
    }
  };

  const filteredLots = lots.filter(lot => 
    lot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lot.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedLot = lots.find(l => l.id === selectedLotId);
  const isClosed = selectedLot?.status === 'CLOSED';

  const lotMovements = selectedLot 
    ? movements.filter(m => m.lotId === selectedLot.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const combinedHistory = selectedLot ? [
    ...lotMovements.map(m => ({
      type: 'MOVEMENT',
      date: m.date,
      data: m as AnimalMovement
    })),
    ...(selectedLot.dietHistory || []).map(d => ({
      type: 'DIET',
      date: d.date,
      data: d as { dietId: string; date: string }
    }))
  ].sort((a, b) => {
    // Primary sort by date descending
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    // Secondary sort by type to group same-day events consistently if needed
    return a.type.localeCompare(b.type);
  }) : [];

  const PenDatabaseContent = () => {
    const totalCapacity = pens.reduce((acc, p) => acc + (p.capacity || 0), 0);
    const totalOccupancy = pens.reduce((acc, p) => acc + (getPenOccupancy(p.id) || 0), 0);
    const totalBalance = totalCapacity - totalOccupancy;
    const globalOccupancyRate = totalCapacity > 0 ? (totalOccupancy / totalCapacity) * 100 : 0;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="relative z-10 space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Capacidade Total</p>
              <p className="text-2xl font-black text-slate-900 italic tracking-tighter">{totalCapacity} <span className="text-xs text-slate-400 font-bold not-italic">CAB</span></p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <Warehouse size={24} />
            </div>
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-8 -mt-8"></div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="relative z-10 space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Disponível (Vagas)</p>
              <p className="text-2xl font-black text-emerald-600 italic tracking-tighter">{totalBalance} <span className="text-xs text-emerald-400 font-bold not-italic">CAB</span></p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:rotate-12 transition-transform">
              <TrendingUp size={24} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="relative z-10 space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Taxa de Ocupação Média</p>
              <p className="text-2xl font-black text-slate-900 italic tracking-tighter">{globalOccupancyRate.toFixed(1)}<span className="text-xs text-slate-400 font-bold not-italic">%</span></p>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-100">
               <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${Math.min(100, globalOccupancyRate)}%` }}></div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors">
              <Activity size={24} />
            </div>
          </div>
        </div>

        {/* Pens Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Baia / Curral</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Módulo</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Capacidade</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Lotação Atual</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Saldo</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ocupação %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pens.map(pen => {
                  const occupancy = getPenOccupancy(pen.id);
                  const balance = pen.capacity - occupancy;
                  const rate = pen.capacity > 0 ? (occupancy / pen.capacity) * 100 : 0;
                  
                  return (
                    <tr key={pen.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4">
                        <div className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors uppercase tracking-tight italic">{pen.name}</div>
                        <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest">ID: {pen.id}</div>
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase">{pen.moduleId}</span>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-400">{pen.capacity}</td>
                      <td className="p-4 text-right">
                        <div className="font-mono font-bold text-slate-900">{occupancy}</div>
                        <div className="text-[9px] text-slate-400 uppercase font-bold">Cabeças</div>
                      </td>
                      <td className={`p-4 text-right font-mono font-bold ${balance > 10 ? 'text-emerald-600' : balance > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                        {balance}
                      </td>
                      <td className="p-4 text-right">
                         <div className="flex items-center justify-end gap-3">
                            <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                               <div 
                                 className={`h-full transition-all duration-500 ${rate > 95 ? 'bg-red-500' : rate > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                 style={{ width: `${Math.min(100, rate)}%` }}
                               ></div>
                            </div>
                            <span className={`text-xs font-black w-8 ${rate > 95 ? 'text-red-600' : 'text-slate-700'}`}>{rate.toFixed(0)}%</span>
                         </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pens.length === 0 && (
             <div className="p-12 text-center text-slate-400 italic">
                Nenhuma baia cadastrada no sistema.
             </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-2 italic uppercase">
            Farm<span className="text-emerald-500">Database</span>
          </h1>
          <p className="text-slate-500 font-medium">Gestão centralizada de lotes, estruturas e parâmetros biológicos</p>
        </div>
        
        <div className="bg-slate-100 p-1 rounded-xl flex gap-1 shadow-inner">
           <button 
             onClick={() => setActiveTab('lots')}
             className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'lots' ? 'bg-white text-emerald-700 shadow-md ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
           >
             <Beef size={14} /> Lotes
           </button>
           <button 
             onClick={() => setActiveTab('pens')}
             className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'pens' ? 'bg-white text-emerald-700 shadow-md ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
           >
             <Warehouse size={14} /> Baias
           </button>
        </div>
      </div>

      {activeTab === 'pens' ? (
         <PenDatabaseContent />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {/* Lots List */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b bg-slate-50 space-y-3">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Pesquisar lote..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
             </div>
             <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                <span>Lote</span>
                <span>Cab.</span>
             </div>
          </div>
          
          <div className="divide-y overflow-y-auto flex-1">
            {filteredLots.length > 0 ? (
              filteredLots.map(lot => {
                const heads = getActiveHeadCount(lot.id);
                const isActive = selectedLotId === lot.id;
                return (
                  <div 
                    key={lot.id} 
                    onClick={() => setSelectedLotId(lot.id)}
                    className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors flex items-center justify-between border-l-4 ${isActive ? 'border-emerald-500 bg-emerald-50' : 'border-transparent'}`}
                  >
                    <div>
                      <div className="font-bold text-slate-800">{lot.name}</div>
                      <div className="text-xs text-slate-500">{lot.breed} • {categories.find(c => c.id === lot.categoryId)?.name}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-100 px-3 py-1 rounded-full text-xs font-black text-slate-600">
                        {heads}
                      </div>
                      <button 
                        onDoubleClick={(e) => handleDeleteLot(e, lot)}
                        title="Dê um duplo clique para excluir o lote"
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400 text-sm">Nenhum lote encontrado</div>
            )}
          </div>
        </div>

        {/* Lot Detail / Diet Editor */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-[600px] flex flex-col">
          {selectedLot ? (
            <div className="flex-1 flex flex-col">
              {/* Header */}
              <div className="p-8 border-b bg-gradient-to-r from-slate-50 to-white flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest shadow-sm">ID: {selectedLot.id}</span>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">{selectedLot.name}</h2>
                  </div>
                  <div className="flex items-center gap-4 text-slate-500">
                    <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full text-xs font-bold">
                       <Calendar size={14} className="text-emerald-500"/> 
                       Entrada: {new Date(selectedLot.entryDate).toLocaleDateString('pt-BR')}
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full text-xs font-bold">
                       <Scale size={14} className="text-emerald-500"/> 
                       Peso Inicial: {selectedLot.initialWeight} kg
                    </div>
                    <button 
                      onClick={() => setHistoryView(!historyView)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black transition-all uppercase tracking-tighter ${historyView ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-200 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700'}`}
                    >
                       <History size={14}/> 
                       {historyView ? 'Voltar' : 'Histórico'}
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status do Lote</div>
                  <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black italic uppercase border-2 ${
                    selectedLot.status === 'ACTIVE' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${selectedLot.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                    {selectedLot.status === 'ACTIVE' ? 'Em Confinamento' : 'Lote Baixado'}
                  </span>
                </div>
              </div>

              {isClosed && (
                <div className="mx-8 mt-4 bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3 text-amber-800">
                   <div className="shrink-0">
                     <Info size={20} />
                   </div>
                   <div className="text-xs font-bold uppercase tracking-tight">
                     Este lote está BAIXADO/FECHADO. Alterações de dieta e parâmetros biológicos não são permitidas.
                   </div>
                </div>
              )}

              {/* View Content */}
              {historyView ? (
                <div className="p-8 space-y-6 overflow-y-auto flex-1 bg-slate-50/50">
                   <div className="flex items-center gap-2 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                        <History size={20} />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-800 uppercase tracking-[0.2em] text-xs">Histórico Cronológico</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Movimentações e Trocas de Dieta</p>
                      </div>
                   </div>
                   <div className="space-y-4">
                      {combinedHistory.length > 0 ? combinedHistory.map((item, idx) => {
                        const isMovement = item.type === 'MOVEMENT';
                        const movement = isMovement ? item.data as AnimalMovement : null;
                        const dietChange = !isMovement ? item.data as { dietId: string; date: string } : null;
                        const diet = dietChange ? diets.find(d => d.id === dietChange.dietId) : null;

                        return (
                          <div key={idx} className={`bg-white p-5 rounded-2xl border-l-8 shadow-sm flex items-start gap-4 transition-all hover:shadow-md ${isMovement ? 'border-l-blue-500 border-slate-200' : 'border-l-amber-500 border-slate-200'}`}>
                             <div className={`p-3 rounded-xl ${isMovement ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                {isMovement ? <Activity size={20}/> : <Beef size={20}/>}
                             </div>
                             <div className="flex-1">
                                <div className="flex justify-between items-start">
                                   <div>
                                      <div className="flex items-center gap-2 mb-1">
                                         <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${isMovement ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {isMovement ? 'Movimentação' : 'Alteração Dieta'}
                                         </span>
                                         {isMovement && (
                                           <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase">
                                              {movement?.type}
                                           </span>
                                         )}
                                      </div>
                                      <h4 className="font-black text-slate-800 uppercase italic tracking-tight text-lg">
                                         {isMovement 
                                            ? movement?.type === MovementType.Transfer
                                               ? `Transferência: ${pens.find(p => p.id === movement.originPenId)?.name || 'Origem'} → ${pens.find(p => p.id === movement.destinationPenId)?.name || 'Destino'}`
                                               : `${movement?.quantity} Cabeças - ${movement?.type}`
                                            : `Encerramento Dieta: ${diet?.name || 'Não encontrada'}`
                                         }
                                      </h4>
                                   </div>
                                   <div className="text-right">
                                      <div className="text-sm font-black text-slate-900 border-b border-slate-100 pb-1">{new Date(item.date).toLocaleDateString('pt-BR')}</div>
                                      <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">Data Registro</div>
                                   </div>
                                </div>
                                
                                {isMovement && movement?.notes && (
                                   <p className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg italic border border-slate-100">
                                      "{movement.notes}"
                                   </p>
                                )}
                                
                                {!isMovement && diet && (
                                   <div className="mt-3 grid grid-cols-2 gap-4">
                                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                         <div className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Custo kg/MN</div>
                                         <div className="text-xs font-bold text-slate-700">R$ {diet.calculatedCostPerKg.toFixed(2)}</div>
                                      </div>
                                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                         <div className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Matéria Seca</div>
                                         <div className="text-xs font-bold text-slate-700">{diet.calculatedDryMatter.toFixed(1)}%</div>
                                      </div>
                                   </div>
                                )}
                             </div>
                          </div>
                        );
                      }) : (
                        <div className="p-12 text-center text-slate-400 italic bg-white rounded-2xl border border-dashed border-slate-200">
                           Nenhum registro histórico disponível para este lote.
                        </div>
                      )}
                   </div>
                </div>
              ) : (
                <div className="p-8 space-y-10 overflow-y-auto flex-1 bg-slate-50/30">
                {/* 1. Identificação e Características */}
                <section>
                   <div className="flex items-center gap-2 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                        <Info size={20} />
                      </div>
                      <h3 className="font-black text-slate-800 uppercase tracking-[0.2em] text-xs">Características do Lote</h3>
                   </div>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-200 transition-colors">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Categoria</p>
                        <p className="text-sm font-bold text-slate-800 uppercase italic">{categories.find(c => c.id === selectedLot.categoryId)?.name || 'N/A'}</p>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-200 transition-colors">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Raça</p>
                        <p className="text-sm font-bold text-slate-800 uppercase italic">{selectedLot.breed}</p>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-200 transition-colors">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sexo</p>
                        <p className="text-sm font-bold text-slate-800 uppercase italic">{selectedLot.gender}</p>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-200 transition-colors">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cabeças Atual</p>
                        <p className="text-xl font-black text-emerald-600 italic tracking-tighter">{getActiveHeadCount(selectedLot.id)} <span className="text-[10px] not-italic text-slate-400">UN</span></p>
                      </div>
                   </div>
                </section>

                {/* 2. Localização e Nutrição */}
                <section>
                   <div className="flex items-center gap-2 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                        <Database size={20} />
                      </div>
                      <h3 className="font-black text-slate-800 uppercase tracking-[0.2em] text-xs">Localização & Nutrição Atual</h3>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 shadow-sm relative group overflow-hidden">
                        <p className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-2">Baia / Curral</p>
                        <p className="text-2xl font-black text-emerald-900 italic tracking-tighter uppercase">{pens.find(p => p.id === selectedLot.currentPenId)?.name || 'N/A'}</p>
                        <Warehouse className="absolute bottom-2 right-2 text-emerald-600/10 group-hover:scale-125 transition-transform" size={48} />
                      </div>
                      <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 shadow-sm relative group overflow-hidden">
                        <p className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-2">Dieta Vigente</p>
                        <p className="text-2xl font-black text-emerald-900 italic tracking-tighter uppercase">{diets.find(d => d.id === selectedLot.currentDietId)?.name || 'N/A'}</p>
                        <Beef className="absolute bottom-2 right-2 text-emerald-600/10 group-hover:scale-125 transition-transform" size={48} />
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">GMD Previsto</p>
                        <div className="flex items-end gap-1">
                           <p className="text-2xl font-black text-slate-800 italic tracking-tighter">
                             {config.gmdCurves.find(c => c.id === selectedLot.gmdCurveId)?.gmd || 1.5}
                           </p>
                           <span className="text-[10px] font-bold text-slate-400 mb-1">KG/DIA</span>
                        </div>
                      </div>
                   </div>
                </section>

                <hr className="border-slate-200" />

                <section>
                   <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <Beef size={18} />
                      </div>
                      <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Plano de Nutrição</h3>
                   </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                           <label className="block text-xs font-bold text-slate-400 uppercase">Dieta Atual</label>
                           {selectedLot.dietChangeDate && (
                              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                Início: {new Date(selectedLot.dietChangeDate).toLocaleDateString('pt-BR')}
                              </span>
                           )}
                        </div>
                        <select 
                          className={`w-full p-3 border rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-sm ${isClosed ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
                          value={selectedLot.currentDietId}
                          onChange={e => updateLot(selectedLot.id, { currentDietId: e.target.value })}
                          disabled={isClosed}
                        >
                          <option value="">Selecione uma dieta...</option>
                          {diets.filter(d => d.status === 'ACTIVE' || d.id === selectedLot.currentDietId).map(diet => (
                            <option key={diet.id} value={diet.id}>
                              {diet.name} (R$ {diet.calculatedCostPerKg.toFixed(2)}/kg) {diet.status === 'INACTIVE' ? '(INATIVA)' : ''}
                            </option>
                          ))}
                        </select>
                        <div className="flex justify-between items-center mt-2 px-1">
                           <p className="text-[10px] text-slate-500 italic">Previsão automática baseada na dieta.</p>

                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="flex items-start gap-3">
                           <Info className="text-slate-400 shrink-0 mt-1" size={16} />
                           <div>
                              <p className="text-xs font-bold text-slate-700 mb-1">Informações da Dieta</p>
                              {diets.find(d => d.id === selectedLot.currentDietId) && (
                                <div className="text-xs text-slate-500 space-y-1">
                                   <div className="flex justify-between"><span>Matéria Seca:</span> <span className="font-mono">{diets.find(d => d.id === selectedLot.currentDietId)?.calculatedDryMatter.toFixed(1)}%</span></div>
                                   <div className="flex justify-between"><span>Inclusão ingredientes:</span> <span className="font-mono">{diets.find(d => d.id === selectedLot.currentDietId)?.ingredients.length} itens</span></div>
                                </div>
                              )}
                           </div>
                        </div>
                      </div>
                   </div>

                </section>

                <hr className="border-slate-100" />

                <section>
                   <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <Scale size={18} />
                      </div>
                      <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Parâmetros Biológicos</h3>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">GMD Planejado (kg/dia)</label>
                        <input 
                          type="number" 
                          step="0.05"
                          className={`w-full p-3 border rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono ${isClosed ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
                          value={(selectedLot as any).projectedGMD || 1.5}
                          onChange={e => updateLot(selectedLot.id, { projectedGMD: Number(e.target.value) } as any)}
                          disabled={isClosed}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Meta de Peso Final (kg)</label>
                        <input 
                          type="number" 
                          className="w-full p-3 border rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                          placeholder="Ex: 580"
                        />
                      </div>
                   </div>
                </section>
              </div>
              )}

              {/* Actions */}
              {!historyView && (
                <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
                   <button 
                     disabled={isClosed}
                     className={`px-6 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-200 transition-colors ${isClosed ? 'opacity-50 cursor-not-allowed' : ''}`}
                   >
                     Descartar
                   </button>
                   <button 
                     disabled={isClosed}
                     className={`px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-md ${isClosed ? 'opacity-50 cursor-not-allowed' : ''}`}
                   >
                     Salvar Alterações
                   </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 italic">
               <Database size={48} className="mb-4 opacity-20" />
               <p>Selecione um lote lateral para gerenciar dados fixos</p>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);
};

export default LotDatabase;
