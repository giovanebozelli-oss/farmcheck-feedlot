
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

