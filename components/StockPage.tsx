import React, { useMemo, useState } from 'react';
import { useAppStore } from '../context';
import { StockMovement, StockLedgerEvent } from '../utils/stock';
import {
  Plus, Minus, Trash2, FileDown, FileSpreadsheet, Loader2,
  Warehouse, PackagePlus, SlidersHorizontal, X,
} from 'lucide-react';
import { useSessionState } from '../lib/useSessionState';
import { generateEstoquePDF } from '../utils/pdfGenerator';
import { generateEstoqueExcel } from '../utils/excelGenerator';

const br = (v: number, dec = 2) =>
  (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const fmtDate = (iso: string) => iso.split('-').reverse().join('/');

const kindLabel: Record<StockLedgerEvent['kind'], string> = {
  entry: 'Entrada',
  adjust_in: 'Ajuste (+)',
  adjust_out: 'Ajuste (−)',
  consumption: 'Consumo',
};

const kindColor: Record<StockLedgerEvent['kind'], string> = {
  entry: 'bg-emerald-100 text-emerald-700',
  adjust_in: 'bg-blue-100 text-blue-700',
  adjust_out: 'bg-amber-100 text-amber-700',
  consumption: 'bg-slate-100 text-slate-600',
};

const today = () => new Date().toISOString().split('T')[0];

const StockPage: React.FC = () => {
  const {
    ingredients, addIngredient, stockLedgers, stockMovements,
    addStockMovement, deleteStockMovement,
  } = useAppStore();

  const [modal, setModal] = useState<'entry' | 'adjust' | 'newfood' | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useSessionState<string>('stock.selectedIng', '');

  // ---- form: entrada ----
  const [fEntry, setFEntry] = useState({ date: today(), ingredientId: '', quantityKg: '', pricePerKg: '', invoice: '', supplier: '' });
  // ---- form: ajuste ----
  const [fAdj, setFAdj] = useState({ date: today(), ingredientId: '', direction: 'in' as 'in' | 'out', quantityKg: '', pricePerKg: '', notes: '' });
  // ---- form: novo alimento ----
  const [fFood, setFFood] = useState({ name: '', dryMatterContent: '', pricePerTon: '' });

  /**
   * Parser pt-BR: vírgula é decimal; ponto é milhar (ex: "10.000" = 10000),
   * exceto quando é claramente decimal (ex: "1.20" = 1,20; "0.5" = 0,5).
   */
  const parseNum = (v: string): number | null => {
    const t = v.trim();
    if (t === '') return null;
    let sNorm: string;
    if (t.includes(',')) {
      sNorm = t.replace(/\./g, '').replace(',', '.');
    } else {
      const dotMatches = t.match(/\./g) || [];
      if (dotMatches.length === 1 && !/\.\d{3}$/.test(t)) {
        sNorm = t; // decimal com ponto (1.20, 0.5)
      } else {
        sNorm = t.replace(/\./g, ''); // milhar (10.000, 1.000.000)
      }
    }
    const n = parseFloat(sNorm);
    return isNaN(n) ? null : n;
  };

  const sortedIngredients = useMemo(
    () => [...ingredients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [ingredients]
  );

  const balances = useMemo(() => {
    return sortedIngredients.map((ing) => {
      const info = stockLedgers.get(ing.id);
      return {
        ingredient: ing,
        hasStock: !!info?.hasStock,
        balanceKg: info?.balanceKg ?? 0,
        avgPrice: info?.avgPricePerKg ?? 0,
        totalValue: (info?.balanceKg ?? 0) * (info?.avgPricePerKg ?? 0),
        events: info?.events ?? [],
      };
    });
  }, [sortedIngredients, stockLedgers]);

  const anyStock = balances.some((b) => b.hasStock);

  const selectedInfo = balances.find((b) => b.ingredient.id === selectedIngredient);

  const saveEntry = async () => {
    const qty = parseNum(fEntry.quantityKg);
    const price = parseNum(fEntry.pricePerKg);
    if (!fEntry.ingredientId) return alert('Selecione o insumo.');
    if (!qty || qty <= 0) return alert('Informe a quantidade em kg.');
    if (price === null || price < 0) return alert('Informe o preço por kg.');
    setSaving(true);
    try {
      await addStockMovement({
        id: `stk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        date: fEntry.date,
        ingredientId: fEntry.ingredientId,
        type: 'entry',
        quantityKg: qty,
        pricePerKg: price,
        invoice: fEntry.invoice.trim() || null,
        supplier: fEntry.supplier.trim() || null,
        notes: null,
      });
      setFEntry({ date: today(), ingredientId: '', quantityKg: '', pricePerKg: '', invoice: '', supplier: '' });
      setModal(null);
    } catch (err) {
      console.error('[Stock] entrada:', err);
      alert('Erro ao salvar a entrada. Verifique sua conexão.');
    } finally {
      setSaving(false);
    }
  };

  const saveAdjust = async () => {
    const qty = parseNum(fAdj.quantityKg);
    const price = parseNum(fAdj.pricePerKg);
    if (!fAdj.ingredientId) return alert('Selecione o insumo.');
    if (!qty || qty <= 0) return alert('Informe a quantidade em kg.');
    if (fAdj.direction === 'in' && (price === null || price < 0)) {
      return alert('Informe o preço por kg da inclusão (retirada sai pelo preço médio).');
    }
    setSaving(true);
    try {
      await addStockMovement({
        id: `stk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        date: fAdj.date,
        ingredientId: fAdj.ingredientId,
        type: fAdj.direction === 'in' ? 'adjust_in' : 'adjust_out',
        quantityKg: qty,
        pricePerKg: fAdj.direction === 'in' ? price : null,
        invoice: null,
        supplier: null,
        notes: fAdj.notes.trim() || null,
      });
      setFAdj({ date: today(), ingredientId: '', direction: 'in', quantityKg: '', pricePerKg: '', notes: '' });
      setModal(null);
    } catch (err) {
      console.error('[Stock] ajuste:', err);
      alert('Erro ao salvar o ajuste. Verifique sua conexão.');
    } finally {
      setSaving(false);
    }
  };

  const saveFood = async () => {
    const dm = parseNum(fFood.dryMatterContent);
    const price = parseNum(fFood.pricePerTon);
    if (!fFood.name.trim()) return alert('Informe o nome do alimento.');
    if (!dm || dm <= 0 || dm > 100) return alert('Informe a %MS (entre 0 e 100).');
    setSaving(true);
    try {
      await addIngredient({
        id: `ing-${Date.now()}`,
        name: fFood.name.trim(),
        dryMatterContent: dm,
        pricePerTon: price || 0,
      });
      setFFood({ name: '', dryMatterContent: '', pricePerTon: '' });
      setModal(null);
    } catch (err) {
      console.error('[Stock] alimento:', err);
      alert('Erro ao cadastrar o alimento.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMovement = async (movementId: string) => {
    if (!window.confirm('Excluir esta movimentação? O saldo e o preço médio serão recalculados.')) return;
    try {
      await deleteStockMovement(movementId);
    } catch (err) {
      console.error('[Stock] excluir:', err);
      alert('Erro ao excluir a movimentação.');
    }
  };

  const exportData = () => ({
    saldo: balances
      .filter((b) => b.hasStock)
      .map((b) => ({
        insumo: b.ingredient.name,
        saldoKg: b.balanceKg,
        precoMedio: b.avgPrice,
        valorTotal: b.totalValue,
      })),
    extrato: balances
      .filter((b) => b.hasStock)
      .flatMap((b) =>
        b.events.map((e) => ({
          data: e.date,
          insumo: b.ingredient.name,
          tipo: kindLabel[e.kind],
          quantidadeKg: e.quantityKg,
          precoKg: e.pricePerKg,
          valor: e.quantityKg * e.pricePerKg,
          saldoAposKg: e.balanceAfter,
          precoMedioApos: e.avgPriceAfter,
          nota: e.invoice || '',
          fornecedor: e.supplier || '',
          obs: e.notes || '',
        }))
      )
      .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0)),
  });

  const inputCls = 'w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none';
  const labelCls = 'block text-xs font-bold text-slate-500 uppercase mb-1';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Warehouse className="text-emerald-600" size={26} />
            Estoque de Insumos
          </h1>
          <p className="text-slate-500">
            Entradas, ajustes e saldo por média ponderada • saída automática pelo consumo das fichas
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setModal('entry')} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 shadow-sm font-bold">
            <PackagePlus size={18} /> Entrada
          </button>
          <button onClick={() => setModal('adjust')} className="flex items-center gap-2 bg-white border border-slate-300 px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-50 shadow-sm font-medium">
            <SlidersHorizontal size={18} className="text-emerald-600" /> Ajuste
          </button>
          <button onClick={() => setModal('newfood')} className="flex items-center gap-2 bg-white border border-slate-300 px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-50 shadow-sm font-medium">
            <Plus size={18} className="text-emerald-600" /> Novo Alimento
          </button>
          <button
            onClick={() => { const d = exportData(); generateEstoquePDF(d.saldo, d.extrato, today()); }}
            disabled={!anyStock}
            className="flex items-center gap-2 bg-white border border-slate-300 px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-50 shadow-sm font-medium disabled:opacity-40"
            title="Relatório PDF: saldo + entradas/saídas"
          >
            <FileDown size={18} className="text-red-500" /> PDF
          </button>
          <button
            onClick={() => { const d = exportData(); generateEstoqueExcel(d.saldo, d.extrato, today()); }}
            disabled={!anyStock}
            className="flex items-center gap-2 bg-white border border-slate-300 px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-50 shadow-sm font-medium disabled:opacity-40"
            title="Relatório Excel: saldo + entradas/saídas"
          >
            <FileSpreadsheet size={18} className="text-emerald-600" /> Excel
          </button>
        </div>
      </div>

      {/* Saldo por insumo */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b text-sm font-bold text-slate-700">Saldo de Estoque</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
              <tr>
                <th className="px-4 py-3">Insumo</th>
                <th className="px-4 py-3 text-right">Saldo (kg)</th>
                <th className="px-4 py-3 text-right">Preço médio (R$/kg)</th>
                <th className="px-4 py-3 text-right">Valor em estoque</th>
                <th className="px-4 py-3 text-center">Preço nas dietas</th>
                <th className="px-4 py-3 text-center">Extrato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {balances.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhum alimento cadastrado. Use "Novo Alimento".</td></tr>
              )}
              {balances.map((b) => (
                <tr key={b.ingredient.id} className={`hover:bg-slate-50 ${selectedIngredient === b.ingredient.id ? 'bg-emerald-50/40' : ''}`}>
                  <td className="px-4 py-3 font-bold text-slate-800">{b.ingredient.name}</td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${b.hasStock ? (b.balanceKg < 0 ? 'text-red-600' : 'text-slate-800') : 'text-slate-300'}`}>
                    {b.hasStock ? br(b.balanceKg, 0) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{b.hasStock ? br(b.avgPrice, 4) : '—'}</td>
                  <td className="px-4 py-3 text-right font-mono">{b.hasStock ? `R$ ${br(b.totalValue, 2)}` : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {b.hasStock ? (
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full">estoque</span>
                    ) : (
                      <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-full">cadastro</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setSelectedIngredient(selectedIngredient === b.ingredient.id ? '' : b.ingredient.id)}
                      disabled={!b.hasStock}
                      className="text-xs font-bold text-blue-600 hover:underline disabled:text-slate-300 disabled:no-underline"
                    >
                      {selectedIngredient === b.ingredient.id ? 'fechar' : 'ver'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extrato do insumo selecionado */}
      {selectedInfo && selectedInfo.hasStock && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b text-sm font-bold text-slate-700">
            Extrato — {selectedInfo.ingredient.name}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2 text-right">Qtd (kg)</th>
                  <th className="px-3 py-2 text-right">R$/kg</th>
                  <th className="px-3 py-2 text-right">Saldo (kg)</th>
                  <th className="px-3 py-2 text-right">Preço médio</th>
                  <th className="px-3 py-2">Nota / Fornecedor / Obs</th>
                  <th className="px-3 py-2 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...selectedInfo.events].reverse().map((e, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(e.date)}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${kindColor[e.kind]}`}>{kindLabel[e.kind]}</span>
                    </td>
                    <td className={`px-3 py-2 text-right font-mono font-bold ${e.quantityKg < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {e.quantityKg > 0 ? '+' : ''}{br(e.quantityKg, 1)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{br(e.pricePerKg, 4)}</td>
                    <td className="px-3 py-2 text-right font-mono">{br(e.balanceAfter, 1)}</td>
                    <td className="px-3 py-2 text-right font-mono">{br(e.avgPriceAfter, 4)}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {[e.invoice, e.supplier, e.notes].filter(Boolean).join(' • ') || (e.kind === 'consumption' ? 'Fichas de trato do dia' : '-')}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {e.movementId && (
                        <button onClick={() => handleDeleteMovement(e.movementId!)} className="text-red-300 hover:text-red-600 p-1" title="Excluir movimentação">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- MODAIS ---------- */}
      {modal && (
        <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">
                {modal === 'entry' ? 'Entrada de Estoque' : modal === 'adjust' ? 'Ajuste de Estoque' : 'Novo Alimento'}
              </h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
            </div>

            {modal === 'entry' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Data</label>
                    <input type="date" value={fEntry.date} max={today()} onChange={(e) => setFEntry({ ...fEntry, date: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Nota (opcional)</label>
                    <input type="text" value={fEntry.invoice} onChange={(e) => setFEntry({ ...fEntry, invoice: e.target.value })} placeholder="NF 1234" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Fornecedor (opcional)</label>
                  <input type="text" value={fEntry.supplier} onChange={(e) => setFEntry({ ...fEntry, supplier: e.target.value })} placeholder="Ex: Cooperativa Agro" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Insumo</label>
                  <select value={fEntry.ingredientId} onChange={(e) => setFEntry({ ...fEntry, ingredientId: e.target.value })} className={inputCls}>
                    <option value="">Selecione…</option>
                    {sortedIngredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Quantidade (kg)</label>
                    <input type="text" inputMode="decimal" value={fEntry.quantityKg} onChange={(e) => setFEntry({ ...fEntry, quantityKg: e.target.value })} placeholder="10.000" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Preço (R$/kg)</label>
                    <input type="text" inputMode="decimal" value={fEntry.pricePerKg} onChange={(e) => setFEntry({ ...fEntry, pricePerKg: e.target.value })} placeholder="1,20" className={inputCls} />
                  </div>
                </div>
                <button onClick={saveEntry} disabled={saving} className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <PackagePlus size={18} />} Lançar Entrada
                </button>
              </div>
            )}

            {modal === 'adjust' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setFAdj({ ...fAdj, direction: 'in' })}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold border flex items-center justify-center gap-1 ${fAdj.direction === 'in' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'}`}
                  >
                    <Plus size={15} /> Inclusão
                  </button>
                  <button
                    onClick={() => setFAdj({ ...fAdj, direction: 'out' })}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold border flex items-center justify-center gap-1 ${fAdj.direction === 'out' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-300'}`}
                  >
                    <Minus size={15} /> Retirada
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Data</label>
                    <input type="date" value={fAdj.date} max={today()} onChange={(e) => setFAdj({ ...fAdj, date: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Insumo</label>
                    <select value={fAdj.ingredientId} onChange={(e) => setFAdj({ ...fAdj, ingredientId: e.target.value })} className={inputCls}>
                      <option value="">Selecione…</option>
                      {sortedIngredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Quantidade (kg)</label>
                    <input type="text" inputMode="decimal" value={fAdj.quantityKg} onChange={(e) => setFAdj({ ...fAdj, quantityKg: e.target.value })} placeholder="500" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Preço (R$/kg){fAdj.direction === 'out' ? ' — usa o médio' : ''}</label>
                    <input
                      type="text" inputMode="decimal" value={fAdj.pricePerKg}
                      onChange={(e) => setFAdj({ ...fAdj, pricePerKg: e.target.value })}
                      placeholder={fAdj.direction === 'out' ? 'preço médio' : '1,20'}
                      disabled={fAdj.direction === 'out'}
                      className={`${inputCls} disabled:bg-slate-100 disabled:text-slate-400`}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Motivo / Observação (opcional)</label>
                  <input type="text" value={fAdj.notes} onChange={(e) => setFAdj({ ...fAdj, notes: e.target.value })} placeholder="Ex: correção de inventário" className={inputCls} />
                </div>
                <button onClick={saveAdjust} disabled={saving} className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <SlidersHorizontal size={18} />} Lançar Ajuste
                </button>
              </div>
            )}

            {modal === 'newfood' && (
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Nome do alimento</label>
                  <input type="text" value={fFood.name} onChange={(e) => setFFood({ ...fFood, name: e.target.value })} placeholder="Ex: Milho grão moído" className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>%MS</label>
                    <input type="text" inputMode="decimal" value={fFood.dryMatterContent} onChange={(e) => setFFood({ ...fFood, dryMatterContent: e.target.value })} placeholder="88" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Preço cadastro (R$/ton)</label>
                    <input type="text" inputMode="decimal" value={fFood.pricePerTon} onChange={(e) => setFFood({ ...fFood, pricePerTon: e.target.value })} placeholder="1200" className={inputCls} />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  O preço do cadastro é usado enquanto o insumo não tiver movimentação de estoque. Com estoque, vale o preço médio ponderado.
                </p>
                <button onClick={saveFood} disabled={saving} className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />} Cadastrar Alimento
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StockPage;
