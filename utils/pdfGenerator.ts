
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
      'Lote', 'Baia', 'Cat', 'Cab', 'DOF', 'P.Ent', 'P.Proj', 
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
  
  doc.setFontSize(20);
  doc.setTextColor(16, 185, 129);
  doc.text('FarmCheck Feedlot', 14, 20);
  
  doc.setFontSize(14);
  doc.setTextColor(100);
  doc.text('Ficha de Trato Diária', 14, 30);
  doc.setFontSize(10);
  doc.text(`Data: ${date.split('-').reverse().join('/')}`, 14, 36);

  // Dynamic headers based on proportions
  const tratoHeaders: string[] = [];
  treatmentProportions.forEach((prop, i) => {
    tratoHeaders.push(`Trato ${i + 1} (${prop}%)`);
    tratoHeaders.push('Realizado');
  });

  const headers = ['Baia', 'Lote', 'Cab', 'Dieta', 'Total MN', ...tratoHeaders, 'Escore'];

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

      treatmentProportions.forEach((_, i) => {
        tratoValues.push(predictedTotalMN > 0 ? (dropPredictions[i] || 0).toLocaleString() : '---');
        tratoValues.push(''); // Manual Actual
      });
      
      return [
        entry.penName,
        entry.lotId.toUpperCase(),
        entry.headCount,
        entry.dietName,
        predictedTotalMN > 0 ? predictedTotalMN.toLocaleString() : '---',
        ...tratoValues,
        '' // Score
      ];
  });

  autoTable(doc, {
    startY: 45,
    head: [headers],
    body: tableData,
    headStyles: { fillColor: [16, 185, 129] },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 20 },
      2: { cellWidth: 10 },
      3: { cellWidth: 25 },
    }
  });

  doc.save(`ficha-trato-${date}.pdf`);
};
