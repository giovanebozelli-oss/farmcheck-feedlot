
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateZootecnicoPDF = (data: any[], date: string) => {
  const doc = new jsPDF('landscape');
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(16, 185, 129); // Emerald-600
  doc.text('FarmCheck Feedlot', 14, 20);
  
  doc.setFontSize(14);
  doc.setTextColor(100);
  doc.text('Relatório Zootécnico', 14, 30);
  doc.setFontSize(10);
  doc.text(`Data de referência: ${date.split('-').reverse().join('/')}`, 14, 36);
  
  // Helpers defensivos contra null/undefined/NaN
  const num = (v: any, decimals = 2) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(decimals) : '0.00';
  };
  const fmt = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n)
      ? n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : '0,0';
  };
  const safeStr = (v: any) => (v === null || v === undefined ? '-' : String(v));

  const tableData = data.map(row => [
    safeStr(row.lotName).toUpperCase(),
    safeStr(row.penName),
    safeStr(row.category),
    row.diet || '-',
    Number.isFinite(row.heads) ? row.heads : 0,
    Number.isFinite(row.daysOnFeed) ? row.daysOnFeed : 0,
    fmt(row.entryWeight),
    fmt(row.projWeight),
    num(row.cms_ms_hoje),
    num(row.cms_ms_ontem),
    num(row.cms_ms_5d),
    num(row.cms_ms_period),
    num(row.cms_mn_hoje),
    num(row.cms_mn_ontem),
    num(row.cms_mn_5d),
    num(row.cms_mn_period),
    `${num(row.pv_hoje)}%`,
    `${num(row.pv_ontem)}%`,
    `${num(row.pv_5d)}%`,
    `${num(row.pv_period)}%`,
    `R$ ${num(row.cost_hoje)}`,
    `R$ ${num(row.cost_period)}`,
    safeStr(row.lastScores)
  ]);

  autoTable(doc, {
    startY: 45,
    head: [[
      'Lote', 'Baia', 'Cat', 'Dieta', 'Cab', 'DOF', 'P.Ent', 'P.Proj', 
      'MS H.', 'MS O.', 'MS 5d', 'MS P.', 
      'MN H.', 'MN O.', 'MN 5d', 'MN P.',
      '%PV H.', '%PV O.', '%PV 5d', '%PV P.',
      'C.H.', 'C.P.', 'Cocho'
    ]],
    body: tableData,
    headStyles: { fillColor: [16, 185, 129] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 45 },
    styles: { fontSize: 6, cellPadding: 1.5 }
  });

  doc.save(`relatorio-zootecnico-${date}.pdf`);
};

export const generateFichaTratoPDF = (entries: any[], date: string, treatmentProportions: number[]) => {
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.getWidth();

  // Cabeçalho
  doc.setFontSize(18);
  doc.setTextColor(16, 185, 129);
  doc.text('FarmCheck Feedlot', 14, 18);

  doc.setFontSize(13);
  doc.setTextColor(80);
  doc.text('Ficha de Trato Diária', 14, 26);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Data: ${date.split('-').reverse().join('/')}`, 14, 32);

  // Espaço pra tratador assinar/anotar (canto direito)
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('Tratador: ____________________________', pageWidth - 90, 22);
  doc.text('Hora início: ___:___    Hora fim: ___:___', pageWidth - 90, 30);

  // Headers — alterna "Trato N (X%)" com "Realizado" (vazio para preencher à mão)
  const tratoHeaders: string[] = [];
  treatmentProportions.forEach((prop, i) => {
    tratoHeaders.push(`Trato ${i + 1} (${prop}%)`);
    tratoHeaders.push('Realizado (kg)');
  });

  const headers = ['Baia', 'Lote', 'Cab', 'Dieta Princ.', 'Total MN', ...tratoHeaders, 'Escore'];

  const tableData = entries.map(entry => {
    const predictedTotalMN = entry.predictedTotalMN || 0;
    const tratoValues: string[] = [];

    const dropPredictions: number[] = entry.dropPredictions || (() => {
      const preds: number[] = [];
      treatmentProportions.forEach((prop, i) => {
        const isLast = i === treatmentProportions.length - 1;
        if (!isLast) {
          preds.push(Math.round(predictedTotalMN * (prop / 100)));
        } else {
          const sumPrev = preds.reduce((a, b) => a + b, 0);
          preds.push(Math.max(0, predictedTotalMN - sumPrev));
        }
      });
      return preds;
    })();

    // Dietas por trato (Rodada B implementará step intra-dia)
    const dietsPerTrato: string[] =
      entry.dietsPerTrato && Array.isArray(entry.dietsPerTrato)
        ? entry.dietsPerTrato
        : Array.from({ length: treatmentProportions.length }).map(() => entry.dietName || '');

    treatmentProportions.forEach((_, i) => {
      const qty = predictedTotalMN > 0 ? (dropPredictions[i] || 0).toLocaleString() : '---';
      const dietLabel = dietsPerTrato[i] || '';
      // Linha 1: quantidade prevista | Linha 2: dieta (menor)
      tratoValues.push(qty + (dietLabel ? `\n${dietLabel}` : ''));
      // Coluna "Realizado" fica vazia — para preenchimento manual
      tratoValues.push('');
    });

    return [
      entry.penName,
      entry.lotId.toUpperCase(),
      entry.headCount,
      entry.dietName,
      predictedTotalMN > 0 ? predictedTotalMN.toLocaleString() : '---',
      ...tratoValues,
      '', // Escore (manual)
    ];
  });

  // Larguras das colunas — ajustadas pra caber dieta na linha 2 sem overflow
  // A4 landscape: 297mm. Margens 8mm cada lado = 281mm úteis.
  // Total: 20+16+8+22+16 + 4*(15+18) + 11 = 224mm  ✓
  const escoreWidth = 11;
  const tratoColCount = treatmentProportions.length;
  const previstoW = 15; // espaço pra "Term. 70%" na 2ª linha
  const realizadoW = 18; // espaço maior pra escrever número à mão

  const columnStyles: Record<number, any> = {
    0: { cellWidth: 20 },     // Baia
    1: { cellWidth: 16 },     // Lote
    2: { cellWidth: 8 },      // Cab
    3: { cellWidth: 22 },     // Dieta principal
    4: { cellWidth: 16 },     // Total MN
  };
  // Colunas de trato + realizado
  for (let i = 0; i < tratoColCount; i++) {
    const previstoIdx = 5 + i * 2;
    const realizadoIdx = 6 + i * 2;
    columnStyles[previstoIdx] = {
      cellWidth: previstoW,
      fillColor: [240, 253, 244], // verde clarinho — diferencia previsto
    };
    columnStyles[realizadoIdx] = {
      cellWidth: realizadoW,
      // Mantém branco para escrever à mão
    };
  }
  columnStyles[5 + tratoColCount * 2] = { cellWidth: escoreWidth }; // Escore

  autoTable(doc, {
    startY: 38,
    margin: { left: 8, right: 8 },
    head: [headers],
    body: tableData,
    headStyles: {
      fillColor: [16, 185, 129],
      fontSize: 7,
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 7,
      cellPadding: 1.5,
      minCellHeight: 14, // altura maior pra preenchimento manual
      valign: 'middle',
      lineColor: [180, 180, 180],
      lineWidth: 0.2,
    },
    columnStyles,
    didParseCell: (data) => {
      // "Realizado" e "Escore" ficam em branco (sem fill, com borda visível)
      if (data.section === 'body') {
        const colIdx = data.column.index;
        const isRealizado = colIdx >= 5 && colIdx <= 5 + tratoColCount * 2 - 1 && (colIdx - 5) % 2 === 1;
        const isEscore = colIdx === 5 + tratoColCount * 2;
        if (isRealizado || isEscore) {
          data.cell.styles.fillColor = [255, 255, 255];
        }
      }
    },
  });

  // Rodapé com observações
  const finalY = (doc as any).lastAutoTable?.finalY || 50;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('Obs: preencha "Realizado (kg)" com a quantidade efetivamente fornecida em cada trato.', 14, finalY + 8);
  doc.text('Escore de cocho referente ao DIA: 0 (limpo) | 0,5 (fundo) | 1 (<5%) | 1,5 | 2 (5-25%) | 3 (>25%) | 4 (cheio)', 14, finalY + 13);

  doc.save(`ficha-trato-${date}.pdf`);
};

// ============================================================
// Relatório de Insumos (PDF)
// ============================================================
interface InsumoUsageRow {
  id: string;
  name: string;
  totalQuantity: number;
  totalCost: number;
  pricePerTon: number;
}

export const generateInsumosPDF = (
  data: InsumoUsageRow[],
  startDate: string,
  endDate: string,
  lotName?: string
) => {
  const doc = new jsPDF('portrait');

  doc.setFontSize(18);
  doc.setTextColor(16, 185, 129);
  doc.text('FarmCheck Feedlot', 14, 20);

  doc.setFontSize(13);
  doc.setTextColor(80);
  doc.text('Consumo de Insumos', 14, 28);

  doc.setFontSize(10);
  doc.setTextColor(100);
  const periodo = `${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')}`;
  doc.text(`Período: ${periodo}`, 14, 35);

  if (lotName) {
    doc.setFontSize(11);
    doc.setTextColor(15, 110, 86);
    doc.text(`Lote: ${lotName}`, 14, 42);
  }

  const totalQty = data.reduce((acc, r) => acc + r.totalQuantity, 0);
  const totalCost = data.reduce((acc, r) => acc + r.totalCost, 0);

  const tableData = data.map((row) => [
    row.name,
    row.totalQuantity.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' kg',
    (row.totalQuantity / 1000).toFixed(3) + ' Ton',
    'R$ ' + row.pricePerTon.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    'R$ ' + row.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
  ]);

  // Linha de totais
  tableData.push([
    'TOTAL',
    totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' kg',
    (totalQty / 1000).toFixed(3) + ' Ton',
    '',
    'R$ ' + totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
  ]);

  autoTable(doc, {
    startY: lotName ? 47 : 40,
    head: [['Ingrediente', 'Qtd. (kg MN)', 'Qtd. (Ton MN)', 'R$/Ton', 'Custo Total']],
    body: tableData,
    headStyles: { fillColor: [16, 185, 129], fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3 },
    didParseCell: (cellData) => {
      // Última linha = total — destaca em negrito
      if (cellData.section === 'body' && cellData.row.index === tableData.length - 1) {
        cellData.cell.styles.fillColor = [240, 253, 244];
        cellData.cell.styles.fontStyle = 'bold';
        cellData.cell.styles.textColor = [15, 110, 86];
      }
    },
  });

  const filename = lotName
    ? `consumo-insumos-${lotName.replace(/\s+/g, '-')}-${endDate}.pdf`
    : `consumo-insumos-${startDate}-${endDate}.pdf`;
  doc.save(filename);
};

// ============================================================
// Lançamentos — Histórico de Tratos (Fichas)
// ============================================================
export interface LancamentoTratoRow {
  date: string;
  lotName: string;
  penName: string;
  headCount: number;
  dietName: string;
  actualTotalMN: number;
  mnPerHead: number;
  msPerHead: number;
  msPercentPV: number;
  costPerHead: number;
  totalCost: number;
  bunkScore: number | string;
  deviationPercent: number;
}

export const generateLancamentosTratosPDF = (data: LancamentoTratoRow[]) => {
  const doc = new jsPDF('landscape');

  doc.setFontSize(18);
  doc.setTextColor(16, 185, 129);
  doc.text('FarmCheck Feedlot', 14, 18);
  doc.setFontSize(13);
  doc.setTextColor(80);
  doc.text('Lançamentos — Histórico de Tratos', 14, 26);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`${data.length} registro(s) — gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 32);

  const num = (v: any, d = 2) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(d) : '0.00';
  };

  const tableData = data.map((r) => [
    r.date.split('-').reverse().join('/'),
    r.lotName.toUpperCase(),
    r.penName,
    r.headCount,
    r.dietName,
    num(r.actualTotalMN, 0),
    num(r.mnPerHead, 2),
    num(r.msPerHead, 2),
    `${num(r.msPercentPV, 2)}%`,
    `R$ ${num(r.costPerHead, 2)}`,
    `R$ ${num(r.totalCost, 2)}`,
    String(r.bunkScore),
    `${r.deviationPercent > 0 ? '+' : ''}${num(r.deviationPercent, 1)}%`,
  ]);

  // Totalizador
  const totals = data.reduce(
    (acc, r) => ({
      headCount: acc.headCount + (r.headCount || 0),
      actualTotalMN: acc.actualTotalMN + (r.actualTotalMN || 0),
      totalCost: acc.totalCost + (r.totalCost || 0),
    }),
    { headCount: 0, actualTotalMN: 0, totalCost: 0 }
  );
  tableData.push([
    'TOTAL',
    '',
    '',
    String(totals.headCount),
    '',
    num(totals.actualTotalMN, 0),
    '',
    '',
    '',
    '',
    `R$ ${num(totals.totalCost, 2)}`,
    '',
    '',
  ]);

  autoTable(doc, {
    startY: 38,
    margin: { left: 8, right: 8 },
    head: [[
      'Data', 'Lote', 'Baia', 'Cab', 'Dieta',
      'MN Total', 'MN/cab', 'MS/cab', '%PV',
      'Custo/cab', 'Custo Total', 'Cocho', 'Desvio',
    ]],
    body: tableData,
    headStyles: { fillColor: [16, 185, 129], fontSize: 8, halign: 'center' },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    didParseCell: (cellData) => {
      // Última linha (total) — destacar
      if (cellData.section === 'body' && cellData.row.index === tableData.length - 1) {
        cellData.cell.styles.fillColor = [240, 253, 244];
        cellData.cell.styles.fontStyle = 'bold';
        cellData.cell.styles.textColor = [15, 110, 86];
      }
    },
  });

  doc.save(`lancamentos-tratos-${new Date().toISOString().split('T')[0]}.pdf`);
};

// ============================================================
// Lançamentos — Movimentação Animal
// ============================================================
export interface LancamentoMovimentoRow {
  date: string;
  lotName: string;
  type: string;
  quantity: number;
  originPenName: string;
  destinationPenName: string;
  notes: string;
}

export const generateLancamentosMovimentosPDF = (data: LancamentoMovimentoRow[]) => {
  const doc = new jsPDF('landscape');

  doc.setFontSize(18);
  doc.setTextColor(16, 185, 129);
  doc.text('FarmCheck Feedlot', 14, 18);
  doc.setFontSize(13);
  doc.setTextColor(80);
  doc.text('Lançamentos — Movimentação Animal', 14, 26);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`${data.length} registro(s) — gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 32);

  const tableData = data.map((m) => [
    m.date.split('-').reverse().join('/'),
    m.lotName.toUpperCase(),
    m.type,
    String(m.quantity),
    m.originPenName || '-',
    m.destinationPenName || '-',
    m.notes || '-',
  ]);

  autoTable(doc, {
    startY: 38,
    margin: { left: 8, right: 8 },
    head: [['Data', 'Lote', 'Tipo', 'Qtd', 'Baia origem', 'Baia destino', 'Observações']],
    body: tableData,
    headStyles: { fillColor: [16, 185, 129], fontSize: 9 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      6: { cellWidth: 80 },
    },
  });

  doc.save(`lancamentos-movimentos-${new Date().toISOString().split('T')[0]}.pdf`);
};

// ============================================================
// Fechamento Zootécnico e Financeiro — PDF
// ============================================================
export interface FechamentoExportData {
  // Lote
  lotName: string;
  penName: string;
  entryDate: string;
  closingDate: string;
  // Período
  daysOnFeed: number;
  initialWeightKg: number;
  avgMSConsumptionPerHeadPerDay: number;
  avgNutritionalCostPerHeadPerDay: number;
  // Inputs
  headsSlaughtered: number;
  initialYieldPercent: number;
  purchasePricePerHead: number;
  salePricePerArroba: number;
  finalLiveWeightKg?: number;
  carcassWeightKg?: number;
  carcassWeightArroba?: number;
  operationalCostPerHeadPerDay: number;
  taxesPerHead: number;
  // Resultados
  arrobasInitial: number;
  arrobasFinal: number;
  arrobasProduced: number;
  gmd: number;
  gdc: number;
  biologicalEfficiency: number;
  costPerArrobaProduced: number;
  yieldEstimated: number;
  // Custos detalhados
  msConsumptionTotalPerHead: number;
  nutritionalCostTotalPerHead: number;
  operationalCostTotalPerHead: number;
  // Financeiro
  revenuePerHead: number;
  totalExpensePerHead: number;
  profitPerHead: number;
  profitabilityPeriodPercent: number;
  profitabilityMonthlyPercent: number;
  // Extras
  notes?: string;
}

export const generateFechamentoPDF = (data: FechamentoExportData) => {
  const doc = new jsPDF('portrait');
  const pageWidth = doc.internal.pageSize.getWidth();
  const num = (v: any, d = 2) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(d) : '0.00';
  };
  const fmtMoney = (v: number) => `R$ ${num(v, 2)}`;

  // ===== Cabeçalho =====
  doc.setFontSize(18);
  doc.setTextColor(16, 185, 129);
  doc.text('FarmCheck Feedlot', 14, 18);

  doc.setFontSize(13);
  doc.setTextColor(40, 40, 40);
  doc.text('Fechamento Zootécnico e Financeiro', 14, 26);

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Lote: ${data.lotName} · Baia: ${data.penName}`, 14, 32);
  doc.text(`Entrada: ${data.entryDate.split('-').reverse().join('/')} · Fechamento: ${data.closingDate.split('-').reverse().join('/')}`, 14, 37);

  // ===== Período =====
  let y = 46;
  doc.setFontSize(10);
  doc.setTextColor(16, 185, 129);
  doc.text('DADOS DO PERÍODO', 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Métrica', 'Valor']],
    body: [
      ['Dias no Cocho (DOF)', `${data.daysOnFeed} dias`],
      ['Peso inicial médio', `${num(data.initialWeightKg, 1)} kg`],
      ['MS/cab/dia (consumo médio)', `${num(data.avgMSConsumptionPerHeadPerDay, 2)} kg`],
      ['MS total/cab (período)', `${num(data.msConsumptionTotalPerHead, 0)} kg`],
      ['Custo nutricional/cab/dia (médio)', fmtMoney(data.avgNutritionalCostPerHeadPerDay)],
      ['Custo nutricional total/cab', fmtMoney(data.nutritionalCostTotalPerHead)],
    ],
    headStyles: { fillColor: [16, 185, 129], fontSize: 8, halign: 'left' },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  // ===== Inputs do abate =====
  y = (doc as any).lastAutoTable.finalY + 5;
  doc.setFontSize(10);
  doc.setTextColor(16, 185, 129);
  doc.text('INPUTS DE ABATE E CUSTOS', 14, y);
  y += 4;

  const carcassDisplay = data.carcassWeightKg && data.carcassWeightKg > 0
    ? `${num(data.carcassWeightKg, 1)} kg`
    : data.carcassWeightArroba && data.carcassWeightArroba > 0
      ? `${num(data.carcassWeightArroba, 2)} @`
      : '—';

  autoTable(doc, {
    startY: y,
    head: [['Campo', 'Valor']],
    body: [
      ['Cabeças abatidas', `${data.headsSlaughtered} cab`],
      ['Rendimento (entrada)', `${num(data.initialYieldPercent, 1)}%`],
      ['Preço compra/cab', fmtMoney(data.purchasePricePerHead)],
      ['Preço venda @', `${fmtMoney(data.salePricePerArroba)}/@`],
      ['Peso final vivo', data.finalLiveWeightKg && data.finalLiveWeightKg > 0 ? `${num(data.finalLiveWeightKg, 1)} kg` : '—'],
      ['Peso de carcaça', carcassDisplay],
      ['Custo operacional/cab/dia', fmtMoney(data.operationalCostPerHeadPerDay)],
      ['Impostos abate/cab', fmtMoney(data.taxesPerHead)],
    ],
    headStyles: { fillColor: [100, 116, 139], fontSize: 8 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  // ===== Resultados zootécnicos =====
  y = (doc as any).lastAutoTable.finalY + 5;
  doc.setFontSize(10);
  doc.setTextColor(16, 185, 129);
  doc.text('RESULTADOS ZOOTÉCNICOS', 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Indicador', 'Valor']],
    body: [
      ['GMD (Ganho Médio Diário)', `${num(data.gmd, 2)} kg/dia`],
      ['GDC (Ganho Diário de Carcaça)', `${num(data.gdc, 2)} kg/dia`],
      ['@ inicial', `${num(data.arrobasInitial, 2)} @`],
      ['@ final', `${num(data.arrobasFinal, 2)} @`],
      ['@ produzidas/cab', `${num(data.arrobasProduced, 2)} @`],
      ['Rendimento carcaça estimado', data.yieldEstimated > 0 ? `${num(data.yieldEstimated, 1)}%` : '—'],
      ['Eficiência biológica', `${num(data.biologicalEfficiency, 1)} kg MS/@`],
      ['Custo da @ produzida', fmtMoney(data.costPerArrobaProduced)],
    ],
    headStyles: { fillColor: [16, 185, 129], fontSize: 8 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });

  // ===== Resultados financeiros =====
  y = (doc as any).lastAutoTable.finalY + 5;
  doc.setFontSize(10);
  doc.setTextColor(16, 185, 129);
  doc.text('RESULTADOS FINANCEIROS (POR CABEÇA)', 14, y);
  y += 4;

  const profitColor: [number, number, number] = data.profitPerHead >= 0 ? [16, 185, 129] : [239, 68, 68];

  autoTable(doc, {
    startY: y,
    head: [['Indicador', 'Valor']],
    body: [
      ['Receita/cab', fmtMoney(data.revenuePerHead)],
      ['Custo de compra/cab', fmtMoney(data.purchasePricePerHead)],
      ['Custo nutricional/cab (período)', fmtMoney(data.nutritionalCostTotalPerHead)],
      ['Custo operacional/cab (período)', fmtMoney(data.operationalCostTotalPerHead)],
      ['Impostos/cab', fmtMoney(data.taxesPerHead)],
      ['DESPESA TOTAL/CAB', fmtMoney(data.totalExpensePerHead)],
      [data.profitPerHead >= 0 ? 'LUCRO/CAB' : 'PREJUÍZO/CAB', fmtMoney(data.profitPerHead)],
      ['Rentabilidade no período', `${num(data.profitabilityPeriodPercent, 2)}%`],
      ['Rentabilidade ao mês', `${num(data.profitabilityMonthlyPercent, 2)}%`],
      ['Receita TOTAL (todas as cabeças)', fmtMoney(data.revenuePerHead * data.headsSlaughtered)],
      ['Lucro TOTAL (todas as cabeças)', fmtMoney(data.profitPerHead * data.headsSlaughtered)],
    ],
    headStyles: { fillColor: [100, 116, 139], fontSize: 8 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
    didParseCell: (cell) => {
      // Destacar linhas de DESPESA, LUCRO e Receita Total
      if (cell.section === 'body') {
        const cellText = String(cell.cell.raw || '');
        const rowFirst = String((cell.row.raw as any)[0] || '');
        if (rowFirst.includes('DESPESA TOTAL')) {
          cell.cell.styles.fillColor = [254, 226, 226];
          cell.cell.styles.textColor = [185, 28, 28];
        } else if (rowFirst.includes('LUCRO/CAB') || rowFirst.includes('PREJUÍZO')) {
          cell.cell.styles.fillColor = data.profitPerHead >= 0 ? [220, 252, 231] : [254, 226, 226];
          cell.cell.styles.textColor = profitColor;
        } else if (rowFirst.includes('TOTAL (todas')) {
          cell.cell.styles.fillColor = [241, 245, 249];
        }
      }
    },
  });

  // ===== Observações =====
  if (data.notes && data.notes.trim()) {
    y = (doc as any).lastAutoTable.finalY + 5;
    doc.setFontSize(9);
    doc.setTextColor(16, 185, 129);
    doc.text('OBSERVAÇÕES', 14, y);
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(60);
    const splitNotes = doc.splitTextToSize(data.notes, pageWidth - 28);
    doc.text(splitNotes, 14, y);
  }

  // ===== Rodapé =====
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, pageHeight - 10);
  doc.text('FarmCheck Feedlot', pageWidth - 14, pageHeight - 10, { align: 'right' });

  doc.save(`fechamento-${data.lotName.replace(/\s+/g, '-')}-${data.closingDate}.pdf`);
};

// ============================================================
// Fechamento Consolidado — PDF (todos os lotes com fechamento)
// ============================================================
export interface FechamentoConsolidadoRow {
  lotName: string;
  penName: string;
  closingDate: string;
  heads: number;
  daysOnFeed: number;
  gmd: number;
  gdc: number;
  arrobasProduced: number;
  costPerArrobaProduced: number;
  revenuePerHead: number;
  totalExpensePerHead: number;
  profitPerHead: number;
  profitabilityPeriodPercent: number;
  profitabilityMonthlyPercent: number;
}

export const generateFechamentoConsolidadoPDF = (rows: FechamentoConsolidadoRow[]) => {
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.getWidth();
  const num = (v: any, d = 2) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(d) : '0.00';
  };
  const fmtMoney = (v: number) => `R$ ${num(v, 2)}`;

  // Cabeçalho
  doc.setFontSize(18);
  doc.setTextColor(16, 185, 129);
  doc.text('FarmCheck Feedlot', 14, 18);
  doc.setFontSize(13);
  doc.setTextColor(40);
  doc.text('Fechamento Consolidado — Todos os Lotes', 14, 26);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`${rows.length} lote(s) com fechamento — gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 32);

  // Totais agregados
  const totals = rows.reduce(
    (acc, r) => ({
      heads: acc.heads + r.heads,
      arrobasProduced: acc.arrobasProduced + r.arrobasProduced * r.heads,
      revenueTotal: acc.revenueTotal + r.revenuePerHead * r.heads,
      expenseTotal: acc.expenseTotal + r.totalExpensePerHead * r.heads,
      profitTotal: acc.profitTotal + r.profitPerHead * r.heads,
      gmdWeighted: acc.gmdWeighted + r.gmd * r.heads,
      gdcWeighted: acc.gdcWeighted + r.gdc * r.heads,
      arrobaCostWeighted: acc.arrobaCostWeighted + r.costPerArrobaProduced * r.heads,
    }),
    { heads: 0, arrobasProduced: 0, revenueTotal: 0, expenseTotal: 0, profitTotal: 0, gmdWeighted: 0, gdcWeighted: 0, arrobaCostWeighted: 0 }
  );
  const avgGMD = totals.heads > 0 ? totals.gmdWeighted / totals.heads : 0;
  const avgGDC = totals.heads > 0 ? totals.gdcWeighted / totals.heads : 0;
  const avgArrobaCost = totals.heads > 0 ? totals.arrobaCostWeighted / totals.heads : 0;
  const avgProfitability = totals.expenseTotal > 0 ? (totals.profitTotal / totals.expenseTotal) * 100 : 0;

  // Cards de totais (no topo do doc, antes da tabela)
  const cardY = 38;
  const cardH = 14;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(14, cardY, pageWidth - 28, cardH, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(15, 110, 86);
  const cardItems = [
    { label: 'CAB TOTAIS', value: totals.heads.toString() },
    { label: '@ PRODUZIDAS', value: num(totals.arrobasProduced, 1) + ' @' },
    { label: 'RECEITA TOTAL', value: fmtMoney(totals.revenueTotal) },
    { label: 'DESPESA TOTAL', value: fmtMoney(totals.expenseTotal) },
    { label: totals.profitTotal >= 0 ? 'LUCRO TOTAL' : 'PREJUÍZO TOTAL', value: fmtMoney(totals.profitTotal) },
    { label: 'RENT. MÉDIA', value: num(avgProfitability, 2) + '%' },
  ];
  const cardW = (pageWidth - 28) / cardItems.length;
  cardItems.forEach((item, i) => {
    const x = 14 + i * cardW;
    doc.setTextColor(15, 110, 86);
    doc.setFontSize(6);
    doc.text(item.label, x + 3, cardY + 5);
    doc.setFontSize(10);
    doc.setTextColor(item.label.includes('PREJUÍZO') ? '#b91c1c' : '#04342c');
    doc.text(item.value, x + 3, cardY + 11);
  });

  // Tabela
  const tableData = rows.map(r => [
    r.lotName.toUpperCase(),
    r.penName,
    r.closingDate.split('-').reverse().join('/'),
    r.heads.toString(),
    `${r.daysOnFeed}d`,
    `${num(r.gmd, 2)}`,
    `${num(r.gdc, 2)}`,
    `${num(r.arrobasProduced, 2)} @`,
    fmtMoney(r.costPerArrobaProduced),
    fmtMoney(r.revenuePerHead),
    fmtMoney(r.totalExpensePerHead),
    fmtMoney(r.profitPerHead),
    `${num(r.profitabilityPeriodPercent, 1)}%`,
    `${num(r.profitabilityMonthlyPercent, 1)}%`,
  ]);

  // Linha de totais/médias
  tableData.push([
    'TOTAIS / MÉDIAS',
    '',
    '',
    totals.heads.toString(),
    '',
    num(avgGMD, 2),
    num(avgGDC, 2),
    num(totals.heads > 0 ? totals.arrobasProduced / totals.heads : 0, 2) + ' @',
    fmtMoney(avgArrobaCost),
    fmtMoney(totals.heads > 0 ? totals.revenueTotal / totals.heads : 0),
    fmtMoney(totals.heads > 0 ? totals.expenseTotal / totals.heads : 0),
    fmtMoney(totals.heads > 0 ? totals.profitTotal / totals.heads : 0),
    num(avgProfitability, 1) + '%',
    '',
  ]);

  autoTable(doc, {
    startY: cardY + cardH + 5,
    margin: { left: 8, right: 8 },
    head: [[
      'Lote', 'Baia', 'Fech.', 'Cab', 'DOF',
      'GMD', 'GDC', '@ prod/cab', 'Custo @',
      'Receita/cab', 'Despesa/cab', 'Lucro/cab',
      'Rent. %', 'Rent. /mês'
    ]],
    body: tableData,
    headStyles: { fillColor: [16, 185, 129], fontSize: 7, halign: 'center', valign: 'middle' },
    bodyStyles: { fontSize: 7, cellPadding: 1.5, halign: 'center' },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      1: { halign: 'left' },
    },
    didParseCell: (cell) => {
      if (cell.section === 'body' && cell.row.index === tableData.length - 1) {
        cell.cell.styles.fillColor = [240, 253, 244];
        cell.cell.styles.fontStyle = 'bold';
        cell.cell.styles.textColor = [15, 110, 86];
      }
      // Destacar coluna de lucro (índice 11) com cor pelo sinal
      if (cell.section === 'body' && cell.column.index === 11 && cell.row.index !== tableData.length - 1) {
        const text = String(cell.cell.raw || '');
        if (text.includes('-')) {
          cell.cell.styles.textColor = [185, 28, 28];
        } else {
          cell.cell.styles.textColor = [4, 52, 44];
          cell.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // Rodapé
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text('FarmCheck Feedlot', pageWidth - 14, pageHeight - 8, { align: 'right' });

  doc.save(`fechamento-consolidado-${new Date().toISOString().split('T')[0]}.pdf`);
};



