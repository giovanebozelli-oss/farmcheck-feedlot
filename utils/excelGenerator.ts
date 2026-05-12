
import * as XLSX from 'xlsx';

export const generateZootecnicoExcel = (data: any[], date: string) => {
  const safeNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const fmt = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n)
      ? n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : '0,0';
  };

  const worksheetData = data.map(row => ({
    'Lote': row.lotName || '-',
    'Baia': row.penName || '-',
    'Categoria': row.category || '-',
    'Dieta': row.diet || '-',
    'Cabeças': safeNum(row.heads),
    'Dias no Cocho (DOF)': safeNum(row.daysOnFeed),
    'Peso Entrada (kg)': fmt(row.entryWeight),
    'Peso Projetado (kg)': fmt(row.projWeight),
    'CMS MS Hoje (kg)': safeNum(row.cms_ms_hoje),
    'CMS MS Ontem (kg)': safeNum(row.cms_ms_ontem),
    'CMS MS 5d (kg)': safeNum(row.cms_ms_5d),
    'CMS MS Período (kg)': safeNum(row.cms_ms_period),
    'CMS MN Hoje (kg)': safeNum(row.cms_mn_hoje),
    'CMS MN Ontem (kg)': safeNum(row.cms_mn_ontem),
    'CMS MN 5d (kg)': safeNum(row.cms_mn_5d),
    'CMS MN Período (kg)': safeNum(row.cms_mn_period),
    '% PV Hoje': safeNum(row.pv_hoje),
    '% PV Ontem': safeNum(row.pv_ontem),
    '% PV 5d': safeNum(row.pv_5d),
    'Custo Hoje (R$)': safeNum(row.cost_hoje),
    'Custo Período (R$)': safeNum(row.cost_period),
    'Escores': row.lastScores || '-'
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Zootécnico');

  XLSX.writeFile(workbook, `relatorio-zootecnico-${date}.xlsx`);
};

// ============================================================
// Relatório de Insumos (Excel)
// ============================================================
interface InsumoUsageRow {
  id: string;
  name: string;
  totalQuantity: number;
  totalCost: number;
  pricePerTon: number;
}

export const generateInsumosExcel = (
  data: InsumoUsageRow[],
  startDate: string,
  endDate: string,
  lotName?: string
) => {
  const totalQty = data.reduce((acc, r) => acc + r.totalQuantity, 0);
  const totalCost = data.reduce((acc, r) => acc + r.totalCost, 0);

  const worksheetData = data.map(row => ({
    'Ingrediente': row.name,
    'Quantidade (kg MN)': Number(row.totalQuantity.toFixed(2)),
    'Quantidade (Ton MN)': Number((row.totalQuantity / 1000).toFixed(3)),
    'Preço Médio (R$/Ton)': row.pricePerTon,
    'Custo Total (R$)': Number(row.totalCost.toFixed(2)),
  }));

  worksheetData.push({
    'Ingrediente': 'TOTAL',
    'Quantidade (kg MN)': Number(totalQty.toFixed(2)),
    'Quantidade (Ton MN)': Number((totalQty / 1000).toFixed(3)),
    'Preço Médio (R$/Ton)': 0,
    'Custo Total (R$)': Number(totalCost.toFixed(2)),
  });

  const ws = XLSX.utils.json_to_sheet(worksheetData);
  ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }];

  const wb = XLSX.utils.book_new();
  const sheetName = lotName ? `Consumo - ${lotName}`.slice(0, 31) : 'Consumo de Insumos';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Aba de metadados
  const metaSheet = XLSX.utils.json_to_sheet([
    { Campo: 'Período Início', Valor: startDate },
    { Campo: 'Período Fim', Valor: endDate },
    { Campo: 'Filtro de Lote', Valor: lotName || 'Todos os lotes' },
    { Campo: 'Total kg MN', Valor: Number(totalQty.toFixed(2)) },
    { Campo: 'Total Ton MN', Valor: Number((totalQty / 1000).toFixed(3)) },
    { Campo: 'Custo Total (R$)', Valor: Number(totalCost.toFixed(2)) },
    { Campo: 'Gerado em', Valor: new Date().toLocaleString('pt-BR') },
  ]);
  metaSheet['!cols'] = [{ wch: 25 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, metaSheet, 'Resumo');

  const filename = lotName
    ? `consumo-insumos-${lotName.replace(/\s+/g, '-')}-${endDate}.xlsx`
    : `consumo-insumos-${startDate}-${endDate}.xlsx`;
  XLSX.writeFile(wb, filename);
};

// ============================================================
// Lançamentos — Excel
// ============================================================
export interface LancamentoTratoRowXLS {
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

export const generateLancamentosTratosExcel = (data: LancamentoTratoRowXLS[]) => {
  const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const worksheetData = data.map((r) => ({
    'Data': r.date.split('-').reverse().join('/'),
    'Lote': r.lotName,
    'Baia': r.penName,
    'Cabeças': num(r.headCount),
    'Dieta': r.dietName,
    'MN Total (kg)': num(r.actualTotalMN),
    'MN/Cab (kg)': num(r.mnPerHead),
    'MS/Cab (kg)': num(r.msPerHead),
    '% PV': num(r.msPercentPV),
    'Custo/Cab (R$)': num(r.costPerHead),
    'Custo Total (R$)': num(r.totalCost),
    'Escore Cocho': r.bunkScore,
    'Desvio %': num(r.deviationPercent),
  }));

  // Total
  const totals = data.reduce(
    (acc, r) => ({
      headCount: acc.headCount + (r.headCount || 0),
      actualTotalMN: acc.actualTotalMN + (r.actualTotalMN || 0),
      totalCost: acc.totalCost + (r.totalCost || 0),
    }),
    { headCount: 0, actualTotalMN: 0, totalCost: 0 }
  );
  worksheetData.push({
    'Data': 'TOTAL',
    'Lote': '',
    'Baia': '',
    'Cabeças': totals.headCount,
    'Dieta': '',
    'MN Total (kg)': Number(totals.actualTotalMN.toFixed(2)),
    'MN/Cab (kg)': 0,
    'MS/Cab (kg)': 0,
    '% PV': 0,
    'Custo/Cab (R$)': 0,
    'Custo Total (R$)': Number(totals.totalCost.toFixed(2)),
    'Escore Cocho': '',
    'Desvio %': 0,
  });

  const ws = XLSX.utils.json_to_sheet(worksheetData);
  ws['!cols'] = [
    { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 9 }, { wch: 20 },
    { wch: 13 }, { wch: 12 }, { wch: 12 }, { wch: 8 },
    { wch: 13 }, { wch: 14 }, { wch: 12 }, { wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tratos');

  XLSX.writeFile(wb, `lancamentos-tratos-${new Date().toISOString().split('T')[0]}.xlsx`);
};

export interface LancamentoMovimentoRowXLS {
  date: string;
  lotName: string;
  type: string;
  quantity: number;
  originPenName: string;
  destinationPenName: string;
  notes: string;
}

export const generateLancamentosMovimentosExcel = (data: LancamentoMovimentoRowXLS[]) => {
  const worksheetData = data.map((m) => ({
    'Data': m.date.split('-').reverse().join('/'),
    'Lote': m.lotName,
    'Tipo': m.type,
    'Quantidade': m.quantity,
    'Baia Origem': m.originPenName || '-',
    'Baia Destino': m.destinationPenName || '-',
    'Observações': m.notes || '-',
  }));

  const ws = XLSX.utils.json_to_sheet(worksheetData);
  ws['!cols'] = [
    { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 12 },
    { wch: 14 }, { wch: 14 }, { wch: 40 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimentação');

  XLSX.writeFile(wb, `lancamentos-movimentos-${new Date().toISOString().split('T')[0]}.xlsx`);
};

// ============================================================
// Fechamento Zootécnico e Financeiro — Excel
// ============================================================
export interface FechamentoExportDataXLS {
  lotName: string;
  penName: string;
  entryDate: string;
  closingDate: string;
  daysOnFeed: number;
  initialWeightKg: number;
  avgMSConsumptionPerHeadPerDay: number;
  avgNutritionalCostPerHeadPerDay: number;
  headsSlaughtered: number;
  initialYieldPercent: number;
  purchasePricePerHead: number;
  salePricePerArroba: number;
  finalLiveWeightKg?: number;
  carcassWeightKg?: number;
  carcassWeightArroba?: number;
  operationalCostPerHeadPerDay: number;
  taxesPerHead: number;
  arrobasInitial: number;
  arrobasFinal: number;
  arrobasProduced: number;
  gmd: number;
  gdc: number;
  biologicalEfficiency: number;
  costPerArrobaProduced: number;
  yieldEstimated: number;
  msConsumptionTotalPerHead: number;
  nutritionalCostTotalPerHead: number;
  operationalCostTotalPerHead: number;
  revenuePerHead: number;
  totalExpensePerHead: number;
  profitPerHead: number;
  profitabilityPeriodPercent: number;
  profitabilityMonthlyPercent: number;
  notes?: string;
}

export const generateFechamentoExcel = (data: FechamentoExportDataXLS) => {
  const safeNum = (v: any) => (Number.isFinite(Number(v)) ? Number(Number(v).toFixed(4)) : 0);

  // Aba 1: Resumo (tabular vertical, Métrica/Valor)
  const resumoRows: Array<{ Bloco: string; Métrica: string; Valor: any; Unidade: string }> = [
    { Bloco: 'Identificação', Métrica: 'Lote', Valor: data.lotName, Unidade: '' },
    { Bloco: 'Identificação', Métrica: 'Baia', Valor: data.penName, Unidade: '' },
    { Bloco: 'Identificação', Métrica: 'Data de entrada', Valor: data.entryDate.split('-').reverse().join('/'), Unidade: '' },
    { Bloco: 'Identificação', Métrica: 'Data de fechamento', Valor: data.closingDate.split('-').reverse().join('/'), Unidade: '' },

    { Bloco: 'Período', Métrica: 'Dias no Cocho (DOF)', Valor: data.daysOnFeed, Unidade: 'dias' },
    { Bloco: 'Período', Métrica: 'Peso inicial médio', Valor: safeNum(data.initialWeightKg), Unidade: 'kg' },
    { Bloco: 'Período', Métrica: 'MS/cab/dia (médio)', Valor: safeNum(data.avgMSConsumptionPerHeadPerDay), Unidade: 'kg' },
    { Bloco: 'Período', Métrica: 'MS total/cab', Valor: safeNum(data.msConsumptionTotalPerHead), Unidade: 'kg' },
    { Bloco: 'Período', Métrica: 'Custo nutricional/cab/dia médio', Valor: safeNum(data.avgNutritionalCostPerHeadPerDay), Unidade: 'R$' },
    { Bloco: 'Período', Métrica: 'Custo nutricional total/cab', Valor: safeNum(data.nutritionalCostTotalPerHead), Unidade: 'R$' },

    { Bloco: 'Inputs', Métrica: 'Cabeças abatidas', Valor: data.headsSlaughtered, Unidade: 'cab' },
    { Bloco: 'Inputs', Métrica: 'Rendimento entrada', Valor: safeNum(data.initialYieldPercent), Unidade: '%' },
    { Bloco: 'Inputs', Métrica: 'Preço compra/cab', Valor: safeNum(data.purchasePricePerHead), Unidade: 'R$' },
    { Bloco: 'Inputs', Métrica: 'Preço venda @', Valor: safeNum(data.salePricePerArroba), Unidade: 'R$/@' },
    { Bloco: 'Inputs', Métrica: 'Peso final vivo', Valor: data.finalLiveWeightKg ? safeNum(data.finalLiveWeightKg) : 0, Unidade: 'kg' },
    { Bloco: 'Inputs', Métrica: 'Peso de carcaça (kg)', Valor: data.carcassWeightKg ? safeNum(data.carcassWeightKg) : 0, Unidade: 'kg' },
    { Bloco: 'Inputs', Métrica: 'Peso de carcaça (@)', Valor: data.carcassWeightArroba ? safeNum(data.carcassWeightArroba) : 0, Unidade: '@' },
    { Bloco: 'Inputs', Métrica: 'Custo operacional/cab/dia', Valor: safeNum(data.operationalCostPerHeadPerDay), Unidade: 'R$' },
    { Bloco: 'Inputs', Métrica: 'Impostos abate/cab', Valor: safeNum(data.taxesPerHead), Unidade: 'R$' },

    { Bloco: 'Zootécnico', Métrica: 'GMD', Valor: safeNum(data.gmd), Unidade: 'kg/dia' },
    { Bloco: 'Zootécnico', Métrica: 'GDC', Valor: safeNum(data.gdc), Unidade: 'kg/dia' },
    { Bloco: 'Zootécnico', Métrica: '@ inicial', Valor: safeNum(data.arrobasInitial), Unidade: '@' },
    { Bloco: 'Zootécnico', Métrica: '@ final', Valor: safeNum(data.arrobasFinal), Unidade: '@' },
    { Bloco: 'Zootécnico', Métrica: '@ produzidas/cab', Valor: safeNum(data.arrobasProduced), Unidade: '@' },
    { Bloco: 'Zootécnico', Métrica: 'Rendimento estimado', Valor: data.yieldEstimated > 0 ? safeNum(data.yieldEstimated) : 0, Unidade: '%' },
    { Bloco: 'Zootécnico', Métrica: 'Eficiência biológica', Valor: safeNum(data.biologicalEfficiency), Unidade: 'kg MS/@' },
    { Bloco: 'Zootécnico', Métrica: 'Custo da @ produzida', Valor: safeNum(data.costPerArrobaProduced), Unidade: 'R$' },

    { Bloco: 'Financeiro/cab', Métrica: 'Receita/cab', Valor: safeNum(data.revenuePerHead), Unidade: 'R$' },
    { Bloco: 'Financeiro/cab', Métrica: 'Custo de compra/cab', Valor: safeNum(data.purchasePricePerHead), Unidade: 'R$' },
    { Bloco: 'Financeiro/cab', Métrica: 'Custo nutricional/cab (período)', Valor: safeNum(data.nutritionalCostTotalPerHead), Unidade: 'R$' },
    { Bloco: 'Financeiro/cab', Métrica: 'Custo operacional/cab (período)', Valor: safeNum(data.operationalCostTotalPerHead), Unidade: 'R$' },
    { Bloco: 'Financeiro/cab', Métrica: 'Impostos/cab', Valor: safeNum(data.taxesPerHead), Unidade: 'R$' },
    { Bloco: 'Financeiro/cab', Métrica: 'DESPESA TOTAL/CAB', Valor: safeNum(data.totalExpensePerHead), Unidade: 'R$' },
    { Bloco: 'Financeiro/cab', Métrica: 'LUCRO/PREJUÍZO/CAB', Valor: safeNum(data.profitPerHead), Unidade: 'R$' },
    { Bloco: 'Financeiro/cab', Métrica: 'Rentabilidade no período', Valor: safeNum(data.profitabilityPeriodPercent), Unidade: '%' },
    { Bloco: 'Financeiro/cab', Métrica: 'Rentabilidade ao mês', Valor: safeNum(data.profitabilityMonthlyPercent), Unidade: '%' },

    { Bloco: 'Financeiro total', Métrica: 'Receita TOTAL (todas as cab)', Valor: safeNum(data.revenuePerHead * data.headsSlaughtered), Unidade: 'R$' },
    { Bloco: 'Financeiro total', Métrica: 'Despesa TOTAL (todas as cab)', Valor: safeNum(data.totalExpensePerHead * data.headsSlaughtered), Unidade: 'R$' },
    { Bloco: 'Financeiro total', Métrica: 'Lucro TOTAL (todas as cab)', Valor: safeNum(data.profitPerHead * data.headsSlaughtered), Unidade: 'R$' },
  ];

  if (data.notes && data.notes.trim()) {
    resumoRows.push({ Bloco: 'Observações', Métrica: 'Notas', Valor: data.notes, Unidade: '' });
  }

  const ws = XLSX.utils.json_to_sheet(resumoRows);
  ws['!cols'] = [{ wch: 18 }, { wch: 38 }, { wch: 16 }, { wch: 10 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fechamento');

  // Aba 2: Metadados
  const metaRows = [
    { Campo: 'Gerado em', Valor: new Date().toLocaleString('pt-BR') },
    { Campo: 'Lote', Valor: data.lotName },
    { Campo: 'Aplicativo', Valor: 'FarmCheck Feedlot' },
  ];
  const wsMeta = XLSX.utils.json_to_sheet(metaRows);
  wsMeta['!cols'] = [{ wch: 20 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Metadados');

  XLSX.writeFile(wb, `fechamento-${data.lotName.replace(/\s+/g, '-')}-${data.closingDate}.xlsx`);
};

// ============================================================
// Fechamento Consolidado — Excel
// ============================================================
export interface FechamentoConsolidadoRowXLS {
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

export const generateFechamentoConsolidadoExcel = (rows: FechamentoConsolidadoRowXLS[]) => {
  const safeNum = (v: any) => (Number.isFinite(Number(v)) ? Number(Number(v).toFixed(4)) : 0);

  const worksheetData = rows.map(r => ({
    'Lote': r.lotName,
    'Baia': r.penName,
    'Data Fechamento': r.closingDate.split('-').reverse().join('/'),
    'Cabeças': r.heads,
    'DOF (dias)': r.daysOnFeed,
    'GMD (kg/dia)': safeNum(r.gmd),
    'GDC (kg/dia)': safeNum(r.gdc),
    '@ Produzidas/cab': safeNum(r.arrobasProduced),
    'Custo @ Produzida (R$)': safeNum(r.costPerArrobaProduced),
    'Receita/cab (R$)': safeNum(r.revenuePerHead),
    'Despesa Total/cab (R$)': safeNum(r.totalExpensePerHead),
    'Lucro/cab (R$)': safeNum(r.profitPerHead),
    'Rentab. Período (%)': safeNum(r.profitabilityPeriodPercent),
    'Rentab. Mês (%)': safeNum(r.profitabilityMonthlyPercent),
    'Receita Total Lote (R$)': safeNum(r.revenuePerHead * r.heads),
    'Despesa Total Lote (R$)': safeNum(r.totalExpensePerHead * r.heads),
    'Lucro Total Lote (R$)': safeNum(r.profitPerHead * r.heads),
  }));

  // Totais
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

  worksheetData.push({
    'Lote': 'TOTAIS / MÉDIAS',
    'Baia': '',
    'Data Fechamento': '',
    'Cabeças': totals.heads,
    'DOF (dias)': 0,
    'GMD (kg/dia)': safeNum(avgGMD),
    'GDC (kg/dia)': safeNum(avgGDC),
    '@ Produzidas/cab': safeNum(totals.heads > 0 ? totals.arrobasProduced / totals.heads : 0),
    'Custo @ Produzida (R$)': safeNum(avgArrobaCost),
    'Receita/cab (R$)': safeNum(totals.heads > 0 ? totals.revenueTotal / totals.heads : 0),
    'Despesa Total/cab (R$)': safeNum(totals.heads > 0 ? totals.expenseTotal / totals.heads : 0),
    'Lucro/cab (R$)': safeNum(totals.heads > 0 ? totals.profitTotal / totals.heads : 0),
    'Rentab. Período (%)': safeNum(avgProfitability),
    'Rentab. Mês (%)': 0,
    'Receita Total Lote (R$)': safeNum(totals.revenueTotal),
    'Despesa Total Lote (R$)': safeNum(totals.expenseTotal),
    'Lucro Total Lote (R$)': safeNum(totals.profitTotal),
  });

  const ws = XLSX.utils.json_to_sheet(worksheetData);
  ws['!cols'] = [
    { wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 9 }, { wch: 11 },
    { wch: 13 }, { wch: 13 }, { wch: 15 }, { wch: 18 },
    { wch: 15 }, { wch: 18 }, { wch: 14 }, { wch: 15 }, { wch: 14 },
    { wch: 20 }, { wch: 20 }, { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fechamentos');

  // Aba de resumo
  const resumoRows = [
    { Métrica: 'Lotes fechados', Valor: rows.length },
    { Métrica: 'Cabeças totais', Valor: totals.heads },
    { Métrica: '@ produzidas totais', Valor: safeNum(totals.arrobasProduced) },
    { Métrica: 'GMD médio (ponderado)', Valor: safeNum(avgGMD) },
    { Métrica: 'GDC médio (ponderado)', Valor: safeNum(avgGDC) },
    { Métrica: 'Custo @ produzida médio', Valor: safeNum(avgArrobaCost) },
    { Métrica: 'Receita total agregada (R$)', Valor: safeNum(totals.revenueTotal) },
    { Métrica: 'Despesa total agregada (R$)', Valor: safeNum(totals.expenseTotal) },
    { Métrica: 'Lucro total agregado (R$)', Valor: safeNum(totals.profitTotal) },
    { Métrica: 'Rentabilidade média (%)', Valor: safeNum(avgProfitability) },
    { Métrica: 'Gerado em', Valor: new Date().toLocaleString('pt-BR') },
  ];
  const wsResumo = XLSX.utils.json_to_sheet(resumoRows);
  wsResumo['!cols'] = [{ wch: 35 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  XLSX.writeFile(wb, `fechamento-consolidado-${new Date().toISOString().split('T')[0]}.xlsx`);
};



