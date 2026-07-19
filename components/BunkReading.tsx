import React, { useMemo, useState } from 'react';
import { useAppStore } from '../context';
import { BunkScore, BunkReading as BunkReadingType } from '../types';
import {
  calculateAllHeadCounts,
  sortLotsByPen,
  getAdjustmentForScore,
  getAdjustmentKgForScore,
} from '../utils';
import { Calendar, Save, CheckCircle, Loader2, Copy, History, ClipboardCheck, FileDown } from 'lucide-react';
import { generateLeituraCochoPDF } from '../utils/pdfGenerator';
import { useSessionState } from '../lib/useSessionState';
import PenReorderControls from './PenReorderControls';

/** Formata 'YYYY-MM-DD' → 'dd/mm' */
const shortDate = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

const fmtScore = (n: number) => String(n).replace('.', ',');

interface RowState {
  score: BunkScore;
  manualKg: number | null;
  dirty: boolean;
  saving: boolean;
}

const BunkReadingPage: React.FC = () => {
  const { lots, pens, config, movements, bunkReadings, feedHistory, saveBunkReading } = useAppStore();
  const [selectedDate, setSelectedDate] = useSessionState<string>(
    'bunkreading.date',
    new Date().toISOString().split('T')[0]
  );
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [replicateModal, setReplicateModal] = useState<{ open: boolean; lotId?: string }>({ open: false });
  const [replicateSourceDate, setReplicateSourceDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });
  const [savingAll, setSavingAll] = useState(false);

  const headCounts = useMemo(
    () => calculateAllHeadCounts(lots, movements, selectedDate),
    [lots, movements, selectedDate]
  );

  const activeLots = useMemo(
    () =>
      sortLotsByPen(
        lots.filter((lot) => (headCounts[lot.id] || 0) > 0 && lot.status !== 'CLOSED'),
        pens
      ),
    [lots, pens, headCounts]
  );

  // Ordenação de baias (mesma lógica da Ficha de Trato): setas aparecem
  // no primeiro lote de cada baia; ordem é global (compartilhada entre telas).
  const penReorderHelpers = useMemo(() => {
    const uniquePens: string[] = [];
    const firstOfPenLotIds = new Set<string>();
    for (const lot of activeLots) {
      const pid = lot.currentPenId || '';
      if (!pid) continue;
      if (!uniquePens.includes(pid)) {
        uniquePens.push(pid);
        firstOfPenLotIds.add(lot.id);
      }
    }
    return { uniquePens, firstOfPenLotIds };
  }, [activeLots]);

  const getPenReorderInfo = (lotId: string, penId: string | undefined) => {
    const pid = penId || '';
    const showControls = pid && penReorderHelpers.firstOfPenLotIds.has(lotId);
    const idx = penReorderHelpers.uniquePens.indexOf(pid);
    return {
      showControls,
      isFirst: idx === 0,
      isLast: idx === penReorderHelpers.uniquePens.length - 1,
      penId: pid,
    };
  };

  /** Leitura salva no banco pra lote+data */
  const savedReadingFor = (lotId: string, date: string): BunkReadingType | undefined =>
    bunkReadings.find((r) => r.lotId === lotId && r.date === date);

  /** Score efetivo exibido na linha (estado local > salvo > histórico > 0) */
  const scoreFor = (lotId: string): BunkScore => {
    const local = rowState[lotId];
    if (local) return local.score;
    const saved = savedReadingFor(lotId, selectedDate);
    if (saved) return saved.score as BunkScore;
    const rec = feedHistory.find((r) => r.date === selectedDate && r.lotId === lotId);
    if (rec) return rec.bunkScoreYesterday;
    return BunkScore.Zero;
  };

  /** MS total pontual efetivo (estado local > salvo > null) */
  const manualFor = (lotId: string): number | null => {
    const local = rowState[lotId];
    if (local) return local.manualKg;
    const saved = savedReadingFor(lotId, selectedDate);
    return (saved?.manualMsTotalKg ?? null) as number | null;
  };

  const isSavedFor = (lotId: string): boolean => {
    const local = rowState[lotId];
    if (local?.dirty) return false;
    return !!savedReadingFor(lotId, selectedDate);
  };

  /**
   * Últimas 3 leituras ANTES da data selecionada.
   * Junta fc_bunk_readings + histórico das fichas, dedup por data.
   */
  const lastReadings = (lotId: string): { date: string; score: number }[] => {
    const byDate = new Map<string, number>();
    feedHistory
      .filter((r) => r.lotId === lotId && r.date < selectedDate)
      .forEach((r) => byDate.set(r.date, r.bunkScoreYesterday));
    bunkReadings
      .filter((r) => r.lotId === lotId && r.date < selectedDate)
      .forEach((r) => byDate.set(r.date, r.score));
    return Array.from(byDate.entries())
      .map(([date, score]) => ({ date, score }))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 3);
  };

  const setScore = (lotId: string, value: string) => {
    const score = parseFloat(value) as BunkScore;
    setRowState((prev) => ({
      ...prev,
      [lotId]: { score, manualKg: prev[lotId]?.manualKg ?? manualFor(lotId), dirty: true, saving: false },
    }));
  };

  const setManualKg = (lotId: string, value: string) => {
    const parsed = value.trim() === '' ? null : parseFloat(value.replace(',', '.'));
    const manualKg = parsed !== null && isNaN(parsed) ? null : parsed;
    setRowState((prev) => ({
      ...prev,
      [lotId]: { score: prev[lotId]?.score ?? scoreFor(lotId), manualKg, dirty: true, saving: false },
    }));
  };

  const saveOne = async (lotId: string) => {
    const score = scoreFor(lotId);
    const manualKg = manualFor(lotId);
    setRowState((prev) => ({ ...prev, [lotId]: { score, manualKg, dirty: true, saving: true } }));
    try {
      await saveBunkReading({ id: `${selectedDate}_${lotId}`, date: selectedDate, lotId, score, manualMsTotalKg: manualKg });
      setRowState((prev) => {
        const n = { ...prev };
        delete n[lotId];
        return n;
      });
    } catch (err) {
      console.error('[BunkReading] erro ao salvar:', err);
      alert('Erro ao salvar a leitura. Verifique sua conexão.');
      setRowState((prev) => ({ ...prev, [lotId]: { score, manualKg, dirty: true, saving: false } }));
    }
  };

  const saveAll = async () => {
    setSavingAll(true);
    try {
      for (const lot of activeLots) {
        const score = scoreFor(lot.id);
        await saveBunkReading({
          id: `${selectedDate}_${lot.id}`, date: selectedDate, lotId: lot.id, score,
          manualMsTotalKg: manualFor(lot.id),
        });
      }
      setRowState({});
    } catch (err) {
      console.error('[BunkReading] erro ao salvar todos:', err);
      alert('Erro ao salvar as leituras. Verifique sua conexão.');
    } finally {
      setSavingAll(false);
    }
  };

  /** Replica score de outra data (um lote ou todos) */
  const handleConfirmReplicate = () => {
    if (!replicateSourceDate || replicateSourceDate >= selectedDate) {
      alert('Escolha uma data ANTERIOR à data atual.');
      return;
    }
    const targets = replicateModal.lotId
      ? activeLots.filter((l) => l.id === replicateModal.lotId)
      : activeLots;
    let applied = 0;
    setRowState((prev) => {
      const n = { ...prev };
      for (const lot of targets) {
        const src =
          bunkReadings.find((r) => r.lotId === lot.id && r.date === replicateSourceDate) ||
          (() => {
            const rec = feedHistory.find((r) => r.lotId === lot.id && r.date === replicateSourceDate);
            return rec ? { score: rec.bunkScoreYesterday } : undefined;
          })();
        if (src) {
          n[lot.id] = {
            score: src.score as BunkScore,
            manualKg: n[lot.id]?.manualKg ?? manualFor(lot.id),
            dirty: true,
            saving: false,
          };
          applied++;
        }
      }
      return n;
    });
    setReplicateModal({ open: false });
    if (applied === 0) alert('Nenhuma leitura encontrada na data de origem.');
  };

  const scoreOptions = config.bunkScoreAdjustments || [];
  const isKgMode = config.bunkAdjustmentMode === 'kg';

  /** Rótulo do ajuste do escore conforme o modo da escala */
  const adjLabelFor = (score: BunkScore): { label: string; value: number } => {
    if (isKgMode) {
      const kg = getAdjustmentKgForScore(score, scoreOptions);
      return {
        label: `${kg > 0 ? '+' : ''}${kg.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`,
        value: kg,
      };
    }
    const pct = getAdjustmentForScore(score, scoreOptions);
    return { label: `${pct > 0 ? '+' : ''}${fmtScore(pct)}%`, value: pct };
  };

  const handleExportPDF = () => {
    const rows = activeLots.map((lot) => {
      const pen = pens.find((p) => p.id === lot.currentPenId);
      const hasToday = !!rowState[lot.id] || !!savedReadingFor(lot.id, selectedDate) ||
        !!feedHistory.find((r) => r.date === selectedDate && r.lotId === lot.id);
      const score = hasToday ? scoreFor(lot.id) : null;
      return {
        penName: pen?.name || '?',
        lotId: lot.id,
        headCount: headCounts[lot.id] || 0,
        lastReadings: lastReadings(lot.id),
        todayScore: score,
        adjustmentLabel: score !== null ? adjLabelFor(score as BunkScore).label : '',
      };
    });
    generateLeituraCochoPDF(rows, selectedDate);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="text-emerald-600" size={26} />
            Leitura de Cocho
          </h1>
          <p className="text-slate-500">Escore de cocho do dia • {activeLots.length} lotes ativos</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportPDF}
            disabled={activeLots.length === 0}
            className="flex items-center gap-2 bg-white border border-slate-300 px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            title="Exportar a ficha de leitura em PDF"
          >
            <FileDown size={18} className="text-emerald-600" />
            <span className="font-medium">Exportar PDF</span>
          </button>

          <button
            onClick={() => setReplicateModal({ open: true })}
            disabled={activeLots.length === 0}
            className="flex items-center gap-2 bg-white border border-slate-300 px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            title="Replicar escores de outra data para TODOS os lotes"
          >
            <Copy size={18} className="text-emerald-600" />
            <span className="font-medium">Replicar Todos</span>
          </button>

          <button
            onClick={saveAll}
            disabled={activeLots.length === 0 || savingAll}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 font-bold"
          >
            {savingAll ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Salvar Todas
          </button>

          <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
            <Calendar className="text-slate-400" size={20} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="outline-none text-slate-700 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Modal de Replicação */}
      {replicateModal.open && (
        <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 mb-2">Replicar leitura</h3>
            <p className="text-sm text-slate-600 mb-4">
              {replicateModal.lotId ? (
                <>Replica o escore do lote <strong>{replicateModal.lotId.toUpperCase()}</strong> a partir da data escolhida.</>
              ) : (
                <>Replica os escores de <strong>TODOS</strong> os lotes a partir da data escolhida.</>
              )}
              <br />
              <span className="text-xs text-slate-500 italic">Depois de replicar, confira e clique em Salvar.</span>
            </p>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Data de origem</label>
            <input
              type="date"
              value={replicateSourceDate}
              max={selectedDate}
              onChange={(e) => setReplicateSourceDate(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setReplicateModal({ open: false })}
                className="flex-1 px-4 py-2 rounded-lg border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReplicate}
                className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700"
              >
                Replicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabela empilhada — uma baia/lote por linha (funciona bem no celular) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Cabeçalho (só em telas médias+) */}
        <div className="hidden md:grid grid-cols-[auto_minmax(130px,1.2fr)_minmax(180px,1.6fr)_minmax(170px,1.4fr)_auto] gap-3 items-center px-4 py-3 bg-slate-50 border-b text-[11px] font-bold text-slate-500 uppercase">
          <span className="w-5"></span>
          <span>Baia / Lote</span>
          <span>Últimas leituras</span>
          <span>Escore de hoje</span>
          <span className="text-center">Ações</span>
        </div>

        <div className="divide-y divide-slate-100">
          {activeLots.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-sm">
              Nenhum lote ativo encontrado para esta data.
            </div>
          )}
          {activeLots.map((lot) => {
            const pen = pens.find((p) => p.id === lot.currentPenId);
            const score = scoreFor(lot.id);
            const adj = adjLabelFor(score);
            const manualKg = manualFor(lot.id);
            const hasManual = manualKg !== null;
            const saved = isSavedFor(lot.id);
            const saving = rowState[lot.id]?.saving || false;
            const history = lastReadings(lot.id);
            const reorder = getPenReorderInfo(lot.id, lot.currentPenId);

            return (
              <div
                key={lot.id}
                className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_minmax(130px,1.2fr)_minmax(180px,1.6fr)_minmax(170px,1.4fr)_auto] gap-x-3 gap-y-2 items-center px-3 md:px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                {/* Setas de ordenação da baia */}
                <div className="w-5 flex justify-center row-span-2 md:row-span-1">
                  {reorder.showControls && reorder.penId ? (
                    <PenReorderControls
                      penId={reorder.penId}
                      isFirst={reorder.isFirst}
                      isLast={reorder.isLast}
                      compact
                    />
                  ) : (
                    <span className="w-4" />
                  )}
                </div>

                {/* Baia / lote */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px] font-black shrink-0">
                      {pen?.name || '?'}
                    </span>
                    {saved && (
                      <span className="text-emerald-600 shrink-0" title="Leitura salva">
                        <CheckCircle size={13} />
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {lot.id.toUpperCase()} • {headCounts[lot.id] || 0} cab
                  </div>
                </div>

                {/* Ações (no mobile ficam na primeira linha, à direita) */}
                <div className="flex items-center gap-1.5 justify-end md:order-last">
                  <button
                    onClick={() => setReplicateModal({ open: true, lotId: lot.id })}
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 transition-colors"
                    title="Replicar este lote de outra data"
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    onClick={() => saveOne(lot.id)}
                    disabled={saving || saved}
                    className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
                      saved
                        ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                    }`}
                    title={saved ? 'Salvo' : 'Salvar leitura'}
                  >
                    {saving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : saved ? (
                      <CheckCircle size={16} />
                    ) : (
                      <Save size={16} />
                    )}
                  </button>
                </div>

                {/* Últimas 3 leituras */}
                <div className="col-span-2 md:col-span-1 min-w-0 md:col-start-3">
                  <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5 flex items-center gap-1 md:hidden">
                    <History size={10} /> Últimas leituras
                  </div>
                  {history.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">Sem leituras anteriores</span>
                  ) : (
                    <div className="flex gap-1 flex-wrap">
                      {history.map((h) => (
                        <span
                          key={h.date}
                          className="bg-slate-100 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded"
                          title={`Leitura de ${shortDate(h.date)}`}
                        >
                          {shortDate(h.date)}: <span className="text-emerald-700">Sc {fmtScore(h.score)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Escore de hoje + MS total pontual (discreto) */}
                <div className="col-span-2 md:col-span-1 md:col-start-4">
                  <div className="flex items-center gap-2">
                    <select
                      value={score}
                      onChange={(e) => setScore(lot.id, e.target.value)}
                      className="flex-1 min-w-0 px-2 py-1.5 border rounded-lg text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                    >
                      {scoreOptions.map((rule) => (
                        <option key={rule.score} value={rule.score}>
                          Sc {fmtScore(rule.score)} ({adjLabelFor(rule.score).label})
                        </option>
                      ))}
                    </select>
                    <span
                      className={`text-[11px] font-bold whitespace-nowrap ${
                        hasManual ? 'text-amber-500 line-through opacity-60' : adj.value > 0 ? 'text-emerald-600' : adj.value < 0 ? 'text-red-500' : 'text-slate-400'
                      }`}
                      title={hasManual ? 'Ignorado: MS total pontual definido' : undefined}
                    >
                      {adj.value > 0 ? '▲ ' : adj.value < 0 ? '▼ ' : ''}
                      {adj.label}
                    </span>
                  </div>
                  <div className={`mt-1 flex items-center gap-1.5 ${hasManual ? '' : 'opacity-70'}`}>
                    <span className="text-[9px] text-slate-400 uppercase font-bold whitespace-nowrap">MS total pontual:</span>
                    <input
                      type="number"
                      step="0.001"
                      inputMode="decimal"
                      value={manualKg ?? ''}
                      onChange={(e) => setManualKg(lot.id, e.target.value)}
                      placeholder="—"
                      title="MS total a fornecer (kg/cab) — se preenchido, substitui o cálculo do escore neste lote"
                      className={`w-20 px-1.5 py-0.5 border rounded text-center text-[11px] outline-none focus:ring-1 focus:ring-amber-400 ${hasManual ? 'border-amber-400 bg-amber-50 font-bold text-amber-800' : 'border-dashed border-slate-300 text-slate-500'}`}
                    />
                    <span className="text-[9px] text-slate-400">kg/cab</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BunkReadingPage;
