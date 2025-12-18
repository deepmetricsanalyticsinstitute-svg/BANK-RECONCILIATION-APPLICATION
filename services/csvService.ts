import Papa from 'papaparse';
import { Transaction } from '../types';

// Helper: Parse amount string to number
// Handles: "$1,200.00", "(500.00)", "1.000,00" (basic support), etc.
const parseAmount = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  
  let str = String(val).trim();
  
  // Handle accounting format (123.45) -> -123.45
  const isNegativeParen = str.startsWith('(') && str.endsWith(')');
  
  // Remove currency symbols, spaces, and commas (assuming comma is thousands separator for now)
  // Note: This assumes standard US/UK format (1,000.00). 
  // For robustness, one might check if ',' appears after '.' but simple stripping is usually 90% effective for EN inputs.
  str = str.replace(/[^0-9.-]/g, '');
  
  let num = parseFloat(str);
  if (isNaN(num)) return 0;
  
  return isNegativeParen ? -Math.abs(num) : num;
};

// Helper: Parse date string to ISO YYYY-MM-DD
const parseDate = (val: any): string => {
  if (!val) return '';
  const str = String(val).trim();

  // Try standard ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);

  // Try parsing parts for slash/dot formats
  // Supported: MM/DD/YYYY, DD/MM/YYYY, YYYY/MM/DD
  const parts = str.split(/[\/\-\.]/);
  
  if (parts.length === 3) {
    const n1 = parseInt(parts[0]);
    const n2 = parseInt(parts[1]);
    const n3 = parseInt(parts[2]);

    // Check valid parsed numbers
    if (!isNaN(n1) && !isNaN(n2) && !isNaN(n3)) {
        // YYYY-MM-DD or YYYY/MM/DD
        if (n1 > 1000) { 
           return `${n1}-${String(n2).padStart(2,'0')}-${String(n3).padStart(2,'0')}`;
        }
        // DD/MM/YYYY or MM/DD/YYYY
        // If year is last (n3 > 1000)
        if (n3 > 1000) {
            // Ambiguity check: if n1 > 12, it must be Day. (DD/MM/YYYY)
            if (n1 > 12) {
                return `${n3}-${String(n2).padStart(2,'0')}-${String(n1).padStart(2,'0')}`;
            }
            // If n2 > 12, it must be Day. (MM/DD/YYYY)
            if (n2 > 12) {
                 return `${n3}-${String(n1).padStart(2,'0')}-${String(n2).padStart(2,'0')}`;
            }
            // If both <= 12, default to US format (MM/DD/YYYY) as it's most common in generic parsers
            // or perhaps user local preference? Defaulting to MM/DD/YYYY here.
            return `${n3}-${String(n1).padStart(2,'0')}-${String(n2).padStart(2,'0')}`;
        }
    }
  }

  // Fallback to JS Date parser
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  
  // Return original if failed, or today? 
  // Let's return empty to filter it out later
  return '';
};

const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

const detectColumns = (headers: string[]) => {
    const normalized = headers.map(normalizeHeader);
    
    // Find index of key columns
    const dateIdx = normalized.findIndex(h => h.includes('date') || h === 'dt');
    const descIdx = normalized.findIndex(h => 
        h.includes('description') || h.includes('desc') || h.includes('memo') || h.includes('details') || h.includes('narrative') || h.includes('particulars')
    );
    const amountIdx = normalized.findIndex(h => h === 'amount' || h.includes('value') || h === 'amt');
    
    // Explicit Debit/Credit columns
    const debitIdx = normalized.findIndex(h => h === 'debit' || h.includes('withdrawal') || h.includes('dr'));
    const creditIdx = normalized.findIndex(h => h === 'credit' || h.includes('deposit') || h.includes('cr'));

    return { dateIdx, descIdx, amountIdx, debitIdx, creditIdx };
};

export const parseCSV = (file: File, source: 'bank' | 'ledger'): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false, // parsing as arrays to detect header row manually
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const data = results.data as string[][];
          if (!data || data.length === 0) throw new Error("File is empty");

          // 1. Detect Header Row
          // Scan first 10 rows for a row that looks like a header (contains 'date' AND 'amount' or similar)
          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(data.length, 20); i++) {
             const row = data[i].map(c => String(c).toLowerCase());
             const hasDate = row.some(c => c.includes('date'));
             const hasAmount = row.some(c => c.includes('amount') || c.includes('debit') || c.includes('credit') || c.includes('value'));
             
             if (hasDate && hasAmount) {
                 headerRowIndex = i;
                 break;
             }
          }

          // If no header found, assume row 0 if it has > 1 columns, or fail
          if (headerRowIndex === -1) {
              // Fallback: Use row 0
              headerRowIndex = 0;
          }

          const headers = data[headerRowIndex].map(String);
          const { dateIdx, descIdx, amountIdx, debitIdx, creditIdx } = detectColumns(headers);

          if (dateIdx === -1) throw new Error("Could not detect a 'Date' column.");
          
          // 2. Parse Rows
          const transactions: Transaction[] = [];
          
          for (let i = headerRowIndex + 1; i < data.length; i++) {
             const row = data[i];
             // Skip malformed rows
             if (row.length < 2) continue; 

             const rawDate = row[dateIdx];
             const date = parseDate(rawDate);
             if (!date) continue; // Skip invalid dates

             let description = descIdx !== -1 ? row[descIdx] : 'No Description';
             // Clean description
             description = description.replace(/\s+/g, ' ').trim();

             let amount = 0;
             let type: 'credit' | 'debit' = 'debit'; // default

             // Logic for Amount / Debit / Credit columns
             if (debitIdx !== -1 && creditIdx !== -1) {
                 // Separate columns
                 const debitVal = parseAmount(row[debitIdx]);
                 const creditVal = parseAmount(row[creditIdx]);
                 
                 if (debitVal > 0) {
                     amount = debitVal;
                     type = 'debit';
                 } else if (creditVal > 0) {
                     amount = creditVal;
                     type = 'credit';
                 }
             } else if (amountIdx !== -1) {
                 // Single Amount column
                 const val = parseAmount(row[amountIdx]);
                 amount = Math.abs(val);
                 // Heuristic: Negative is usually debit, positive is credit (or vice versa depending on bank)
                 // Assumption: Negative = Debit (Expense), Positive = Credit (Income)
                 // Unless it's a credit card statement where Positive = Payment (Credit), Negative = Purchase.
                 // Standard Logic: < 0 is outflow (debit).
                 type = val < 0 ? 'debit' : 'credit';
             }

             if (amount === 0) continue; // Skip zero value rows

             transactions.push({
                 id: `${source}-${i}-${Math.random().toString(36).substr(2, 9)}`,
                 date,
                 description,
                 amount,
                 type,
                 source,
                 originalRow: row
             });
          }

          resolve(transactions);
        } catch (e: any) {
          reject(new Error(e.message || "Failed to parse CSV"));
        }
      },
      error: (err) => reject(new Error("CSV Parsing Error: " + err.message)),
    });
  });
};
