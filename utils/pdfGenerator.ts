
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
  
  const tableData = data.map(row => [
    row.lotName.toUpperCase(),
    row.penName,
    row.category,
    row.diet || '-',
    row.heads,
    row.daysOnFeed,
    row.entryWeight.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    row.projWeight.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    row.cms_ms_hoje.toFixed(2),
    row.cms_ms_ontem.toFixed(2),
    row.cms_ms_5d.toFixed(2),
    row.cms_ms_period.toFixed(2),
    row.cms_mn_hoje.toFixed(2),
    row.cms_mn_ontem.toFixed(2),
    row.cms_mn_5d.toFixed(2),
    row.cms_mn_period.toFixed(2),
    `${row.pv_hoje.toFixed(2)}%`,
    `${row.pv_ontem.toFixed(2)}%`,
    `${row.pv_5d.toFixed(2)}%`,
    `${row.pv_period.toFixed(2)}%`,
    `R$ ${row.cost_hoje.toFixed(2)}`,
    `R$ ${row.cost_period.toFixed(2)}`,
    row.lastScores
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
