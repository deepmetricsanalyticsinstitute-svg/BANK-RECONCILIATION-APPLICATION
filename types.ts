export interface Transaction {
  id: string;
  date: string; // ISO string YYYY-MM-DD
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  source: 'bank' | 'ledger';
  originalRow?: any;
}

export interface MatchGroup {
  id: string;
  bank: Transaction[];
  ledger: Transaction[];
  confidence: number;
  reason: string;
  type: 'exact' | 'fuzzy' | '1-to-N' | 'N-to-1';
}

export interface ReconciliationResult {
  matches: MatchGroup[];
  unmatchedBank: Transaction[];
  unmatchedLedger: Transaction[];
  stats: {
    totalBank: number;
    totalLedger: number;
    matchedBankCount: number;
    matchedLedgerCount: number;
    unmatchedBankCount: number;
    unmatchedLedgerCount: number;
    matchRate: number; // Percentage of total items reconciled
  };
}

export type FileType = 'bank' | 'ledger';

export interface UploadedFile {
  file: File;
  type: FileType;
  parsedData?: Transaction[];
  status: 'idle' | 'parsing' | 'ready' | 'error';
  errorMessage?: string;
}
