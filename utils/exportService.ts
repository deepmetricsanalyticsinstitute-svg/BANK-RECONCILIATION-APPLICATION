import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReconciliationResult } from '../types';

export interface ExportOptions {
  includeSummary: boolean;
  includeMatches: boolean;
  includeUnmatchedBank: boolean;
  includeUnmatchedLedger: boolean;
}

const formatCurrency = (val: number) => {
  return `GHS ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return dateStr;
};

const generateCSVContent = (result: ReconciliationResult): string => {
  let csv = "data:text/csv;charset=utf-8,";
  csv += "Status,Source,Date,Description,Amount,Type,Match ID,Match Reason\n";

  // Matches
  result.matches.forEach(m => {
    const reason = `"${m.reason.replace(/"/g, '""')}"`;
    m.bank.forEach(t => {
      csv += `Matched,Bank,${t.date},"${t.description.replace(/"/g, '""')}",${t.amount},${t.type},${m.id},${reason}\n`;
    });
    m.ledger.forEach(t => {
      csv += `Matched,Ledger,${t.date},"${t.description.replace(/"/g, '""')}",${t.amount},${t.type},${m.id},${reason}\n`;
    });
  });

  // Unmatched Bank
  result.unmatchedBank.forEach(t => {
    csv += `Unmatched,Bank,${t.date},"${t.description.replace(/"/g, '""')}",${t.amount},${t.type},,\n`;
  });

  // Unmatched Ledger
  result.unmatchedLedger.forEach(t => {
    csv += `Unmatched,Ledger,${t.date},"${t.description.replace(/"/g, '""')}",${t.amount},${t.type},,\n`;
  });

  return csv;
};

export const downloadCSV = (result: ReconciliationResult) => {
  const content = generateCSVContent(result);
  const encodedUri = encodeURI(content);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `reconciliation_report_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const downloadPDF = (
    result: ReconciliationResult, 
    companyName: string = "Company Name",
    options: ExportOptions = { includeSummary: true, includeMatches: true, includeUnmatchedBank: true, includeUnmatchedLedger: true }
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const today = new Date();
  const generatedDateStr = `${today.toLocaleDateString()}, ${today.toLocaleTimeString()}`;

  // --- Header Section (Page 1) ---
  // Blue Background
  doc.setFillColor(44, 82, 219); // Approx #2c52db based on screenshot
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Title
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Reconciliation Report", 15, 18);

  // Subtitle (Company Name)
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(companyName || "Adehyeman Savings and Loans", 15, 28);

  // Right side metadata
  doc.setFontSize(9);
  doc.text("Classification: Protected", pageWidth - 15, 15, { align: 'right' });
  doc.text(`Generated: ${generatedDateStr}`, pageWidth - 15, 22, { align: 'right' });

  let finalY = 50;
  let sectionCounter = 1;

  // --- 1. Executive Summary ---
  if (options.includeSummary) {
      doc.setFontSize(14);
      doc.setTextColor(33, 33, 33);
      doc.setFont("helvetica", "bold");
      doc.text(`${sectionCounter}. Executive Summary`, 15, finalY);
      
      finalY += 8;

      const matchedTotal = result.matches.reduce((sum, m) => sum + m.bank.reduce((s, t) => s + t.amount, 0), 0);
      const outstandingBankTotal = result.unmatchedBank.reduce((sum, t) => sum + t.amount, 0);
      const outstandingLedgerTotal = result.unmatchedLedger.reduce((sum, t) => sum + t.amount, 0);

      autoTable(doc, {
        startY: finalY,
        head: [['Metric', 'Transaction Count', 'Net Value (GHS)']],
        body: [
          [
            'Successfully Matched', 
            result.matches.length.toString(), 
            { content: formatCurrency(matchedTotal), styles: { fontStyle: 'bold' } }
          ],
          [
            'Outstanding Bank Items', 
            result.unmatchedBank.length.toString(), 
            { content: formatCurrency(outstandingBankTotal), styles: { fontStyle: 'bold' } }
          ],
          [
            'Outstanding Ledger Items', 
            result.unmatchedLedger.length.toString(), 
            { content: formatCurrency(outstandingLedgerTotal), styles: { fontStyle: 'bold' } }
          ]
        ],
        theme: 'plain',
        headStyles: { 
            fillColor: [20, 25, 35], // Dark header
            textColor: 255,
            fontStyle: 'bold',
            halign: 'left',
            cellPadding: 6
        },
        columnStyles: {
            0: { cellWidth: 80, minCellHeight: 12, valign: 'middle' },
            1: { cellWidth: 50, valign: 'middle' },
            2: { halign: 'right', valign: 'middle' }
        },
        bodyStyles: {
            lineColor: [230, 230, 230],
            lineWidth: 0.1, // horizontal lines
            minCellHeight: 12,
            valign: 'middle'
        },
        didParseCell: function(data) {
            if (data.section === 'body') {
                data.cell.styles.lineWidth = { bottom: 0.1, top: 0, left: 0, right: 0 };
            }
        }
      });

      // @ts-ignore
      finalY = doc.lastAutoTable.finalY + 15;
      sectionCounter++;
  }

  // --- 2. Verified Matches ---
  if (options.includeMatches) {
      doc.setFontSize(14);
      doc.setTextColor(16, 185, 129); // Green-500
      doc.text(`${sectionCounter}. Verified Matches (${result.matches.length})`, 15, finalY);
      
      finalY += 6;

      const matchRows = result.matches.map(m => {
        const bankDate = m.bank.map(t => formatDate(t.date)).join('\n');
        const bankDesc = m.bank.map(t => t.description).join('\n+ ');
        const ledgerDate = m.ledger.map(t => formatDate(t.date)).join('\n');
        const ledgerDesc = m.ledger.map(t => t.description).join('\n+ ');
        
        const amount = m.bank.reduce((sum, t) => sum + t.amount, 0);

        return [
            bankDate,
            bankDesc,
            ledgerDate,
            ledgerDesc,
            formatCurrency(amount)
        ];
      });

      autoTable(doc, {
        startY: finalY,
        head: [['Bank\nDate', 'Statement Narrative', 'Ledger\nDate', 'Internal Reference', 'Amount']],
        body: matchRows,
        theme: 'grid',
        headStyles: {
            fillColor: [16, 185, 129], // Green
            textColor: 255,
            fontStyle: 'bold',
            valign: 'middle',
            halign: 'left'
        },
        columnStyles: {
            0: { cellWidth: 25 }, // Bank Date
            1: { cellWidth: 'auto' }, // Narrative
            2: { cellWidth: 25 }, // Ledger Date
            3: { cellWidth: 'auto' }, // Internal Ref
            4: { halign: 'right', fontStyle: 'bold', cellWidth: 35 } // Amount
        },
        styles: {
            fontSize: 9,
            cellPadding: 4,
            overflow: 'linebreak'
        },
        alternateRowStyles: {
            fillColor: [245, 255, 250] // Very light green
        }
      });

      // @ts-ignore
      finalY = doc.lastAutoTable.finalY + 15;
      sectionCounter++;
  }

  // --- 3. Unmatched Bank Items ---
  if (options.includeUnmatchedBank) {
      doc.setFontSize(14);
      doc.setTextColor(245, 158, 11); // Orange-500
      doc.text(`${sectionCounter}. Unmatched Bank Statement Items (${result.unmatchedBank.length})`, 15, finalY);

      finalY += 6;

      const bankRows = result.unmatchedBank.map(t => [
          formatDate(t.date),
          t.description,
          formatCurrency(t.amount)
      ]);

      autoTable(doc, {
        startY: finalY,
        head: [['Date', 'Transaction Description', 'Value']],
        body: bankRows,
        theme: 'grid',
        headStyles: {
            fillColor: [245, 158, 11], // Orange
            textColor: 255,
            fontStyle: 'bold'
        },
        columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 'auto' },
            2: { halign: 'right', fontStyle: 'bold', cellWidth: 40 }
        },
        styles: { fontSize: 9, cellPadding: 4 },
        alternateRowStyles: { fillColor: [255, 251, 235] } // Light orange
      });

       // @ts-ignore
       finalY = doc.lastAutoTable.finalY + 15;
       sectionCounter++;
  }

  // --- 4. Unmatched Ledger Items ---
  if (options.includeUnmatchedLedger) {
      doc.setFontSize(14);
      doc.setTextColor(99, 102, 241); // Indigo-500
      doc.text(`${sectionCounter}. Unmatched Internal Ledger Entries (${result.unmatchedLedger.length})`, 15, finalY);

      finalY += 6;

      const ledgerRows = result.unmatchedLedger.map(t => [
          formatDate(t.date),
          t.description,
          formatCurrency(t.amount)
      ]);

      autoTable(doc, {
        startY: finalY,
        head: [['Date', 'General Ledger Description', 'Value']],
        body: ledgerRows,
        theme: 'grid',
        headStyles: {
            fillColor: [99, 102, 241], // Indigo
            textColor: 255,
            fontStyle: 'bold'
        },
        columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 'auto' },
            2: { halign: 'right', fontStyle: 'bold', cellWidth: 40 }
        },
        styles: { fontSize: 9, cellPadding: 4 },
        alternateRowStyles: { fillColor: [238, 242, 255] } // Light indigo
      });
      sectionCounter++;
  }

  // --- Footer (Page Numbers) ---
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100);
    
    // Bottom Left
    doc.text(`${companyName || 'Adehyeman Savings and Loans'} | Reconciliation Report Pro`, 15, doc.internal.pageSize.height - 10);
    
    // Bottom Center
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    
    // Bottom Right
    doc.text(`Export Date: ${today.toLocaleDateString()}`, pageWidth - 15, doc.internal.pageSize.height - 10, { align: 'right' });
  }

  doc.save(`reconciliation_report_${today.toISOString().split('T')[0]}.pdf`);
};