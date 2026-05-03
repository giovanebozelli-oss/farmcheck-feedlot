
import * as XLSX from 'xlsx';

export const generateZootecnicoExcel = (data: any[], date: string) => {
  const worksheetData = data.map(row => ({
    'Lote': row.lotName,
    'Baia': row.penName,
    'Categoria': row.category,
    'Cabeças': row.heads,
    'Dias no Cocho (DOF)': row.daysOnFeed,
    'Peso Entrada (kg)': row.entryWeight.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    'Peso Projetado (kg)': row.projWeight.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    'Dieta': row.diet || '-',
    'CMS MS Hoje (kg)': row.cms_ms_hoje,
    'CMS MS Ontem (kg)': row.cms_ms_ontem,
    'CMS MS 5d (kg)': row.cms_ms_5d,
    'CMS MS Período (kg)': row.cms_ms_period,
    'CMS MN Hoje (kg)': row.cms_mn_hoje,
    'CMS MN Ontem (kg)': row.cms_mn_ontem,
    'CMS MN 5d (kg)': row.cms_mn_5d,
    'CMS MN Período (kg)': row.cms_mn_period,
    '% PV Hoje': row.pv_hoje,
    '% PV Ontem': row.pv_ontem,
    '% PV 5d': row.pv_5d,
    'Custo Hoje (R$)': row.cost_hoje,
    'Custo Período (R$)': row.cost_period,
    'Escores': row.lastScores
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Zootécnico');

  XLSX.writeFile(workbook, `relatorio-zootecnico-${date}.xlsx`);
};
