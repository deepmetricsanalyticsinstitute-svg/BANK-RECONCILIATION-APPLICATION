import React, { useState, useCallback, useMemo } from 'react';
import { 
  FileText, CheckCircle, AlertOctagon, BarChart3, RefreshCw, Zap, 
  Download, Eye, EyeOff, Trash2, Loader2, LayoutDashboard, ListChecks, 
  AlertCircle, TrendingUp, DollarSign, Wallet, CloudUpload, Calendar,
  ChevronRight, ArrowUpRight, ArrowDownLeft, Search, ChevronDown, CheckSquare, Square,
  X, Layers
} from 'lucide-react';
import { UploadedFile, ReconciliationResult, Transaction } from './types';
import { parseCSV } from './services/csvService';
import { parseFileWithGemini } from './services/geminiService';
import { reconcileTransactions } from './utils/reconciliationLogic';
import { downloadCSV, downloadPDF } from './utils/exportService';
import { StatsCard } from './components/StatsCard'; // Kept for legacy or detailed view if needed
import { TransactionTable } from './components/TransactionTable';
import { MatchTable } from './components/MatchTable';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend 
} from 'recharts';

function App() {
  const [bankFile, setBankFile] = useState<UploadedFile | null>(null);
  const [ledgerFile, setLedgerFile] = useState<UploadedFile | null>(null);
  const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Dashboard vs Detailed Report
  const [mainView, setMainView] = useState<'dashboard' | 'detailed'>('dashboard');
  
  // Detailed Report State
  const [searchTerm, setSearchTerm] = useState('');
  
  // New State fields for Redesign
  const [companyName, setCompanyName] = useState('');
  const [reconDate, setReconDate] = useState(new Date().toISOString().split('T')[0]);
  const [processingMode, setProcessingMode] = useState<'speed' | 'accuracy'>('accuracy');
  
  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeSummary: true,
    includeMatches: true,
    includeUnmatchedBank: true,
    includeUnmatchedLedger: true
  });

  const apiKeyMissing = !process.env.API_KEY;

  const resetApp = useCallback(() => {
    setBankFile(null);
    setLedgerFile(null);
    setReconciliationResult(null);
    setCompanyName('');
    setMainView('dashboard');
    setSearchTerm('');
    setProgress(0);
    setShowExportModal(false);
  }, []);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>, type: 'bank' | 'ledger') => {
    const file = event.target.files?.[0];
    if (!file) return;

    setReconciliationResult(null);

    const newFile: UploadedFile = {
      file,
      type,
      status: 'parsing',
    };

    if (type === 'bank') setBankFile(newFile);
    else setLedgerFile(newFile);

    setTimeout(async () => {
        try {
            let transactions: Transaction[] = [];
            
            if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
                transactions = await parseCSV(file, type);
            } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
                if (!process.env.API_KEY) {
                   throw new Error("API Key required for PDF parsing");
                }
                transactions = await parseFileWithGemini(file, type);
            } else {
                throw new Error("Unsupported file format.");
            }

            const updatedFile = { ...newFile, status: 'ready' as const, parsedData: transactions };
            if (type === 'bank') setBankFile(updatedFile);
            else setLedgerFile(updatedFile);

        } catch (error: any) {
            const errorFile = { ...newFile, status: 'error' as const, errorMessage: error.message };
            if (type === 'bank') setBankFile(errorFile);
            else setLedgerFile(errorFile);
        }
    }, 100);
  }, []);

  const loadSampleData = () => {
    const today = new Date().toISOString().split('T')[0];
    const bankData: Transaction[] = [
        { id: 'sample-b-1', date: today, description: "Opening Balance", amount: 50000, type: 'credit', source: 'bank' },
        { id: 'sample-b-2', date: today, description: "Tech Corp Inv #1024", amount: 12500.00, type: 'credit', source: 'bank' },
        { id: 'sample-b-3', date: today, description: "Office Supply Co", amount: 850.50, type: 'debit', source: 'bank' },
        { id: 'sample-b-4', date: today, description: "REDEMPTION OF INVESTMENT IN 182DAYS T-BILL", amount: 103000.00, type: 'credit', source: 'bank' },
        { id: 'sample-b-5', date: today, description: "DIRECT DEBIT NBFI 014553 received from Clearing", amount: 51313.19, type: 'debit', source: 'bank' },
        { id: 'sample-b-6', date: today, description: "DIRECT DEBIT NBFI received from Clearing", amount: 30675.73, type: 'debit', source: 'bank' },
        { id: 'sample-b-7', date: today, description: "DIRECT DEBIT NBFI received from Clearing", amount: 24500.00, type: 'debit', source: 'bank' },
        { id: 'sample-b-8', date: today, description: "TRANSFER OF FUNDS TO EMMANUEL-GT BANK", amount: 15000.00, type: 'debit', source: 'bank' },
    ];
    
    const ledgerData: Transaction[] = [
        { id: 'sample-l-1', date: today, description: "Balance Brought Forward", amount: 50000, type: 'credit', source: 'ledger' },
        { id: 'sample-l-2', date: today, description: "Tech Corporation Payment", amount: 12500.00, type: 'credit', source: 'ledger' },
        { id: 'sample-l-3', date: today, description: "Office Supplies Ltd", amount: 850.50, type: 'debit', source: 'ledger' },
    ];

    setBankFile({ file: new File([], "Sample_Bank_Statement.csv"), type: 'bank', status: 'ready', parsedData: bankData });
    setLedgerFile({ file: new File([], "Sample_General_Ledger.csv"), type: 'ledger', status: 'ready', parsedData: ledgerData });
  };

  const runReconciliation = async () => {
    if (!bankFile?.parsedData || !ledgerFile?.parsedData) return;
    
    setIsProcessing(true);
    setProgress(0);

    // Short delay to allow UI to render the progress state before heavy work starts
    await new Promise(r => setTimeout(r, 100));

    try {
        const results = await reconcileTransactions(
            bankFile.parsedData!, 
            ledgerFile.parsedData!, 
            processingMode,
            (percent) => setProgress(percent)
        );
        setReconciliationResult(results);
    } catch (error) {
        console.error("Reconciliation failed:", error);
    } finally {
        setIsProcessing(false);
    }
  };

  const getProgressLabel = (p: number) => {
    if (p < 15) return "Initializing & Indexing...";
    if (p < 30) return "Checking Reference IDs...";
    if (p < 50) return "Matching Exact Amounts...";
    if (p < 75) return "Analyzing Fuzzy Text...";
    if (p < 90) return "Resolving Split/Merge...";
    return "Finalizing Reconciliation...";
  };

  const toggleExportOption = (key: keyof typeof exportOptions) => {
      setExportOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const applyExportPreset = (type: 'all' | 'matches' | 'unmatched') => {
      if (type === 'all') {
          setExportOptions({
            includeSummary: true,
            includeMatches: true,
            includeUnmatchedBank: true,
            includeUnmatchedLedger: true
          });
      } else if (type === 'matches') {
          setExportOptions({
            includeSummary: true,
            includeMatches: true,
            includeUnmatchedBank: false,
            includeUnmatchedLedger: false
          });
      } else if (type === 'unmatched') {
           setExportOptions({
            includeSummary: false,
            includeMatches: false,
            includeUnmatchedBank: true,
            includeUnmatchedLedger: true
          });
      }
  };

  const handleDownloadPDF = () => {
      if (!reconciliationResult) return;
      downloadPDF(reconciliationResult, companyName, exportOptions);
      setShowExportModal(false);
  };

  // --- Analytics Calculations ---
  const analytics = useMemo(() => {
      if (!reconciliationResult) return null;

      const bankTotalCredit = bankFile?.parsedData?.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0) || 0;
      const bankTotalDebit = bankFile?.parsedData?.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0) || 0;
      
      const ledgerTotalCredit = ledgerFile?.parsedData?.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0) || 0;
      const ledgerTotalDebit = ledgerFile?.parsedData?.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0) || 0;

      // New Metric Calculations for Dashboard
      const matchedTotalAmount = reconciliationResult.matches.reduce((acc, m) => {
          // Summing bank side of matches for the total
          return acc + m.bank.reduce((sum, t) => sum + t.amount, 0);
      }, 0);

      const unmatchedBankAmount = reconciliationResult.unmatchedBank.reduce((sum, t) => sum + t.amount, 0);
      const unmatchedLedgerAmount = reconciliationResult.unmatchedLedger.reduce((sum, t) => sum + t.amount, 0);

      const bankBalance = bankTotalCredit - bankTotalDebit;
      const ledgerBalance = ledgerTotalCredit - ledgerTotalDebit;
      const totalVariance = Math.abs(bankBalance - ledgerBalance);

      // Top 5 Unmatched
      const topUnmatched = [
        ...reconciliationResult.unmatchedBank.map(t => ({ ...t, origin: 'Bank' })),
        ...reconciliationResult.unmatchedLedger.map(t => ({ ...t, origin: 'Ledger' }))
      ].sort((a, b) => b.amount - a.amount).slice(0, 5);

      return {
          bankTotalCredit,
          bankTotalDebit,
          ledgerTotalCredit,
          ledgerTotalDebit,
          creditDelta: Math.abs(bankTotalCredit - ledgerTotalCredit),
          debitDelta: Math.abs(bankTotalDebit - ledgerTotalDebit),
          matchedTotalAmount,
          unmatchedBankAmount,
          unmatchedLedgerAmount,
          bankBalance,
          ledgerBalance,
          totalVariance,
          topUnmatched
      };
  }, [reconciliationResult, bankFile, ledgerFile]);

  // Filter Logic for Detailed Report
  const detailedViewData = useMemo(() => {
    if (!reconciliationResult) return { matches: [], unmatchedBank: [], unmatchedLedger: [] };

    const term = searchTerm.toLowerCase();
    
    const matches = reconciliationResult.matches.filter(m => 
      m.bank.some(t => t.description.toLowerCase().includes(term) || t.amount.toString().includes(term) || t.date.includes(term)) ||
      m.ledger.some(t => t.description.toLowerCase().includes(term) || t.amount.toString().includes(term) || t.date.includes(term))
    );

    const unmatchedBank = reconciliationResult.unmatchedBank.filter(t => 
        t.description.toLowerCase().includes(term) || t.amount.toString().includes(term) || t.date.includes(term)
    );

    const unmatchedLedger = reconciliationResult.unmatchedLedger.filter(t => 
        t.description.toLowerCase().includes(term) || t.amount.toString().includes(term) || t.date.includes(term)
    );

    return { matches, unmatchedBank, unmatchedLedger };
  }, [reconciliationResult, searchTerm]);


  // Donut Chart Data
  const donutData = reconciliationResult ? [
    { name: 'Unmatched', value: reconciliationResult.stats.unmatchedBankCount + reconciliationResult.stats.unmatchedLedgerCount, color: '#f97316' }, // Orange
    { name: 'Matched', value: reconciliationResult.matches.length, color: '#1f2937' }, // Dark Gray
  ] : [];

  const formatCurrency = (val: number) => {
      return `GH₵${val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  };

  // --------------------------------------------------------------------------------
  // VIEW: LANDING PAGE
  // --------------------------------------------------------------------------------
  if (!reconciliationResult || !analytics) {
    return (
        <div className="min-h-screen bg-[#0B1120] text-white font-inter relative overflow-hidden flex items-center justify-center py-12">
            {/* Dark Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none"></div>

            <div className="relative z-10 w-full max-w-5xl px-6 flex flex-col items-center">
                {/* Header */}
                <div className="text-center mb-10 space-y-4">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <div className="bg-indigo-600/20 p-2 rounded-xl border border-indigo-500/30">
                            <Wallet className="w-8 h-8 text-indigo-400" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                            Bank Reconciliation
                        </h1>
                    </div>
                    <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
                        Upload your bank statement and general ledger to allow our app to automatically perform the reconciliation for you.
                    </p>
                </div>

                {/* Main Card */}
                <div className="w-full bg-[#151e32]/80 border border-slate-700/50 rounded-3xl p-8 md:p-10 shadow-2xl backdrop-blur-xl">
                    
                    {/* Top Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-slate-300">Company Name <span className="text-slate-500 font-normal">(Optional)</span></label>
                            <input 
                                type="text" 
                                placeholder="e.g. Acme Corp Industries"
                                className="w-full bg-[#0f1623] border border-slate-700 rounded-xl px-5 py-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder:text-slate-600 transition-all text-sm"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-slate-300">Reconciliation 'As At' Date</label>
                            <div className="relative">
                                <input 
                                    type="date" 
                                    className="w-full bg-[#0f1623] border border-slate-700 rounded-xl px-5 py-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 appearance-none transition-all text-sm"
                                    value={reconDate}
                                    onChange={(e) => setReconDate(e.target.value)}
                                />
                                <Calendar className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* Upload Areas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                        {/* Bank Statement */}
                        <div className="space-y-4">
                            <div className="text-center">
                                <h3 className="text-white font-semibold text-lg">Bank Statement</h3>
                                <p className="text-slate-500 text-sm">Upload PDF or CSV statement.</p>
                            </div>
                            <div className="relative group cursor-pointer">
                                <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => handleFileUpload(e, 'bank')} accept=".csv,.pdf" />
                                <div className={`h-56 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all duration-300 ${bankFile?.status === 'ready' ? 'border-green-500/50 bg-green-500/5' : bankFile?.status === 'error' ? 'border-red-500/50 bg-red-500/5' : 'border-slate-700 bg-[#0f1623] hover:border-indigo-500/50 hover:bg-[#1a2333]'}`}>
                                    {bankFile?.status === 'parsing' ? (
                                        <div className="flex flex-col items-center justify-center">
                                            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
                                            <span className="text-indigo-400 font-medium text-sm">Parsing {bankFile.file.name}...</span>
                                        </div>
                                    ) : bankFile?.status === 'ready' ? (
                                        <div className="flex flex-col items-center text-green-400 animate-in fade-in zoom-in duration-300">
                                            <div className="bg-green-500/10 p-3 rounded-full mb-3">
                                                <CheckCircle className="w-8 h-8" />
                                            </div>
                                            <span className="font-medium text-sm truncate max-w-[200px] px-2">{bankFile.file.name}</span>
                                            <span className="text-xs text-green-500/70 mt-1">Ready</span>
                                        </div>
                                    ) : bankFile?.status === 'error' ? (
                                         <div className="flex flex-col items-center text-red-400 animate-in fade-in zoom-in duration-300 px-4 text-center">
                                            <AlertOctagon className="w-10 h-10 mb-3" />
                                            <span className="font-medium text-sm">Error parsing file</span>
                                            <span className="text-xs text-red-500/70 mt-1">{bankFile.errorMessage}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="bg-slate-800 p-4 rounded-full mb-4 group-hover:bg-slate-700 transition-colors shadow-lg">
                                                <CloudUpload className="w-8 h-8 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                                            </div>
                                            <span className="text-slate-300 font-medium text-sm">Choose File</span>
                                            <span className="text-slate-500 text-xs mt-1">Drag and drop or click to browse</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* General Ledger */}
                        <div className="space-y-4">
                            <div className="text-center">
                                <h3 className="text-white font-semibold text-lg">General Ledger</h3>
                                <p className="text-slate-500 text-sm">Upload Excel, CSV or PDF ledger.</p>
                            </div>
                            <div className="relative group cursor-pointer">
                                <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => handleFileUpload(e, 'ledger')} accept=".csv,.pdf" />
                                <div className={`h-56 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all duration-300 ${ledgerFile?.status === 'ready' ? 'border-green-500/50 bg-green-500/5' : ledgerFile?.status === 'error' ? 'border-red-500/50 bg-red-500/5' : 'border-slate-700 bg-[#0f1623] hover:border-indigo-500/50 hover:bg-[#1a2333]'}`}>
                                    {ledgerFile?.status === 'parsing' ? (
                                        <div className="flex flex-col items-center justify-center">
                                            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
                                            <span className="text-indigo-400 font-medium text-sm">Parsing {ledgerFile.file.name}...</span>
                                        </div>
                                    ) : ledgerFile?.status === 'ready' ? (
                                        <div className="flex flex-col items-center text-green-400 animate-in fade-in zoom-in duration-300">
                                            <div className="bg-green-500/10 p-3 rounded-full mb-3">
                                                <CheckCircle className="w-8 h-8" />
                                            </div>
                                            <span className="font-medium text-sm truncate max-w-[200px] px-2">{ledgerFile.file.name}</span>
                                            <span className="text-xs text-green-500/70 mt-1">Ready</span>
                                        </div>
                                    ) : ledgerFile?.status === 'error' ? (
                                         <div className="flex flex-col items-center text-red-400 animate-in fade-in zoom-in duration-300 px-4 text-center">
                                            <AlertOctagon className="w-10 h-10 mb-3" />
                                            <span className="font-medium text-sm">Error parsing file</span>
                                            <span className="text-xs text-red-500/70 mt-1">{ledgerFile.errorMessage}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="bg-slate-800 p-4 rounded-full mb-4 group-hover:bg-slate-700 transition-colors shadow-lg">
                                                <CloudUpload className="w-8 h-8 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                                            </div>
                                            <span className="text-slate-300 font-medium text-sm">Choose File</span>
                                            <span className="text-slate-500 text-xs mt-1">Drag and drop or click to browse</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-col items-center space-y-8">
                        {/* Sample Data Link */}
                        <div className="text-center">
                            <span className="text-slate-400 text-sm">No files? Load sample data to test</span>
                            <div className="flex gap-4 justify-center mt-2 text-xs">
                                <button onClick={loadSampleData} className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors hover:underline">
                                    <Download className="w-3 h-3" /> Sample Statement & Ledger
                                </button>
                            </div>
                        </div>

                        {/* Processing Mode */}
                        <div className="flex flex-col items-center space-y-3">
                            <div className="text-center">
                                <span className="text-slate-300 font-semibold text-sm block">Processing Mode</span>
                                <span className="text-slate-500 text-[11px] uppercase tracking-wide font-medium">'Accuracy' is better for complex files.</span>
                            </div>
                            <div className="bg-[#0f1623] p-1.5 rounded-xl border border-slate-700 flex">
                                <button 
                                    onClick={() => setProcessingMode('speed')}
                                    className={`px-8 py-2.5 rounded-lg text-sm font-medium transition-all ${processingMode === 'speed' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                                >
                                    Speed
                                </button>
                                <button 
                                     onClick={() => setProcessingMode('accuracy')}
                                    className={`px-8 py-2.5 rounded-lg text-sm font-medium transition-all ${processingMode === 'accuracy' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                                >
                                    Accuracy
                                </button>
                            </div>
                        </div>

                        {/* Reconcile Button / Progress Bar */}
                        {isProcessing ? (
                            <div className="w-full max-w-sm bg-[#151e32] border border-slate-700 rounded-xl p-6 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>
                                
                                <div className="flex justify-between items-end mb-4">
                                    <div>
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Processing</span>
                                        <span className="text-sm font-medium text-slate-200 flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                                            {getProgressLabel(progress)}
                                        </span>
                                    </div>
                                    <span className="text-2xl font-bold text-white tracking-tight">{progress}%</span>
                                </div>
                                
                                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden shadow-inner">
                                    <div 
                                        className="bg-indigo-500 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                            </div>
                        ) : (
                            <button 
                                onClick={runReconciliation}
                                disabled={!bankFile?.parsedData || !ledgerFile?.parsedData}
                                className={`
                                    w-full max-w-sm py-4 rounded-xl font-bold text-lg shadow-xl transition-all transform duration-200
                                    ${(!bankFile?.parsedData || !ledgerFile?.parsedData) 
                                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed border border-slate-600' 
                                        : 'bg-gradient-to-r from-slate-200 to-white text-slate-900 hover:scale-105 hover:shadow-2xl active:scale-95 hover:from-white hover:to-slate-100'}
                                `}
                            >
                                Reconcile Files
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
  }

  // --------------------------------------------------------------------------------
  // VIEW: DASHBOARD & REPORT (Dark Theme)
  // --------------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0f1219] text-white font-inter pb-20 relative">
      
      {/* Export Options Modal */}
      {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-[#1e293b] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
                  <button 
                      onClick={() => setShowExportModal(false)}
                      className="absolute right-4 top-4 text-slate-400 hover:text-white transition-colors"
                  >
                      <X className="w-5 h-5" />
                  </button>
                  
                  <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-400" />
                      Export PDF Report
                  </h3>
                  <p className="text-sm text-slate-400 mb-6">Customize sections to include in the downloaded file.</p>
                  
                  {/* Quick Presets */}
                  <div className="mb-6">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Layers className="w-3 h-3" /> Quick Presets
                      </div>
                      <div className="flex gap-2">
                          <button 
                             onClick={() => applyExportPreset('all')}
                             className="flex-1 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:border-indigo-500/50 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-all"
                          >
                              Full Report
                          </button>
                          <button 
                             onClick={() => applyExportPreset('matches')}
                             className="flex-1 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:border-green-500/50 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-all"
                          >
                              Matches Only
                          </button>
                          <button 
                             onClick={() => applyExportPreset('unmatched')}
                             className="flex-1 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:border-orange-500/50 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-all"
                          >
                              Unmatched Only
                          </button>
                      </div>
                  </div>

                  <div className="space-y-3 mb-8">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Manual Selection</div>
                      
                      <div 
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors border border-transparent hover:border-slate-700 bg-[#0f1219]/50"
                          onClick={() => toggleExportOption('includeSummary')}
                      >
                          <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${exportOptions.includeSummary ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600 bg-slate-800'}`}>
                              {exportOptions.includeSummary && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                          </div>
                          <span className="text-slate-200 text-sm font-medium">Executive Summary</span>
                      </div>

                      <div 
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors border border-transparent hover:border-slate-700 bg-[#0f1219]/50"
                          onClick={() => toggleExportOption('includeMatches')}
                      >
                           <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${exportOptions.includeMatches ? 'bg-green-600 border-green-600' : 'border-slate-600 bg-slate-800'}`}>
                              {exportOptions.includeMatches && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                          </div>
                          <span className="text-slate-200 text-sm font-medium">Verified Matches</span>
                      </div>

                      <div 
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors border border-transparent hover:border-slate-700 bg-[#0f1219]/50"
                          onClick={() => toggleExportOption('includeUnmatchedBank')}
                      >
                           <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${exportOptions.includeUnmatchedBank ? 'bg-orange-600 border-orange-600' : 'border-slate-600 bg-slate-800'}`}>
                              {exportOptions.includeUnmatchedBank && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                          </div>
                          <span className="text-slate-200 text-sm font-medium">Unmatched Bank Items</span>
                      </div>

                      <div 
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors border border-transparent hover:border-slate-700 bg-[#0f1219]/50"
                          onClick={() => toggleExportOption('includeUnmatchedLedger')}
                      >
                           <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${exportOptions.includeUnmatchedLedger ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 bg-slate-800'}`}>
                              {exportOptions.includeUnmatchedLedger && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                          </div>
                          <span className="text-slate-200 text-sm font-medium">Unmatched Ledger Items</span>
                      </div>
                  </div>

                  <div className="flex gap-3">
                      <button 
                          onClick={() => setShowExportModal(false)}
                          className="flex-1 py-2.5 rounded-lg border border-slate-600 text-slate-300 font-medium text-sm hover:bg-slate-800 transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={handleDownloadPDF}
                          className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2"
                      >
                          <Download className="w-4 h-4" /> Download Report
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Header & Navigation */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-white">Reconciliation Report</h1>
            <div className="flex space-x-6 text-sm">
                <button 
                    onClick={() => setMainView('dashboard')}
                    className={`pb-2 border-b-2 transition-colors ${mainView === 'dashboard' ? 'border-indigo-500 text-indigo-400 font-medium' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                >
                    Dashboard
                </button>
                <button 
                    onClick={() => setMainView('detailed')}
                    className={`pb-2 border-b-2 transition-colors ${mainView === 'detailed' ? 'border-indigo-500 text-indigo-400 font-medium' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                >
                    Detailed Report
                </button>
            </div>
        </div>
        
        {mainView === 'dashboard' && (
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-8">
                RECONCILIATION PERIOD ENDING: <span className="text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded ml-1">{reconDate}</span>
            </div>
        )}

        {mainView === 'dashboard' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Row 1: KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Count Cards */}
                <div className="bg-[#1e293b] p-4 rounded-lg border border-slate-800 border-l-4 border-l-green-500">
                    <p className="text-[10px] text-slate-400 uppercase font-medium">Matched</p>
                    <p className="text-xl font-bold text-white mt-1">{reconciliationResult.matches.length}</p>
                </div>
                <div className="bg-[#1e293b] p-4 rounded-lg border border-slate-800 border-l-4 border-l-orange-500">
                    <p className="text-[10px] text-slate-400 uppercase font-medium">Unmatched (Bank)</p>
                    <p className="text-xl font-bold text-white mt-1">{reconciliationResult.stats.unmatchedBankCount}</p>
                </div>
                <div className="bg-[#1e293b] p-4 rounded-lg border border-slate-800 border-l-4 border-l-yellow-500">
                    <p className="text-[10px] text-slate-400 uppercase font-medium">Unmatched (Ledger)</p>
                    <p className="text-xl font-bold text-white mt-1">{reconciliationResult.stats.unmatchedLedgerCount}</p>
                </div>

                {/* Amount Cards */}
                <div className="bg-[#1e293b] p-4 rounded-lg border border-slate-800 border-l-4 border-l-green-500">
                    <p className="text-[10px] text-slate-400 uppercase font-medium">Matched total</p>
                    <p className="text-lg font-bold text-white mt-1 truncate" title={formatCurrency(analytics.matchedTotalAmount)}>
                        {formatCurrency(analytics.matchedTotalAmount)}
                    </p>
                </div>
                <div className="bg-[#1e293b] p-4 rounded-lg border border-slate-800 border-l-4 border-l-orange-500">
                    <p className="text-[10px] text-slate-400 uppercase font-medium">Unmatched Bank</p>
                    <p className="text-lg font-bold text-white mt-1 truncate" title={formatCurrency(analytics.unmatchedBankAmount)}>
                        {formatCurrency(analytics.unmatchedBankAmount)}
                    </p>
                </div>
                <div className="bg-[#1e293b] p-4 rounded-lg border border-slate-800 border-l-4 border-l-yellow-500">
                    <p className="text-[10px] text-slate-400 uppercase font-medium">Unmatched Ledger</p>
                    <p className="text-lg font-bold text-white mt-1 truncate" title={formatCurrency(analytics.unmatchedLedgerAmount)}>
                        {formatCurrency(analytics.unmatchedLedgerAmount)}
                    </p>
                </div>
            </div>

            {/* Row 2: Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Transaction Count Breakdown (Donut) */}
                <div className="bg-[#1e293b] p-6 rounded-lg border border-slate-800 flex flex-col items-center">
                     <h3 className="text-slate-200 font-medium mb-4 w-full text-center">Transaction Count Breakdown</h3>
                     <div className="w-full h-[200px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={donutData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={0}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {donutData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Label */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-2xl font-bold text-white">
                                {reconciliationResult.stats.unmatchedBankCount + reconciliationResult.stats.unmatchedLedgerCount}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase">Total Items</span>
                        </div>
                     </div>
                </div>

                {/* Total Amount Comparison (Bar) */}
                <div className="bg-[#1e293b] p-6 rounded-lg border border-slate-800 flex flex-col">
                     <h3 className="text-slate-200 font-medium mb-4 w-full text-center">Total Amount Comparison</h3>
                     <div className="w-full h-[200px] flex items-end justify-center gap-12 pb-4">
                         <div className="flex flex-col items-center gap-2">
                             <span className="text-[10px] text-slate-400">Matched</span>
                             <div className="text-xs font-bold text-slate-300">{formatCurrency(analytics.matchedTotalAmount)}</div>
                             <div className="w-16 bg-[#1f2937] rounded-t-sm" style={{ height: '10px' }}></div> 
                         </div>

                         <div className="flex flex-col items-center gap-2">
                             <div className="w-24 bg-orange-500 rounded-sm shadow-lg shadow-orange-900/20" style={{ height: '120px' }}></div>
                             <span className="text-[10px] text-slate-400">Bank</span>
                             <div className="text-xs font-bold text-white">{formatCurrency(analytics.unmatchedBankAmount)}</div>
                         </div>

                         <div className="flex flex-col items-center gap-2">
                             <span className="text-[10px] text-slate-400">Ledger</span>
                             <div className="text-xs font-bold text-slate-300">{formatCurrency(analytics.unmatchedLedgerAmount)}</div>
                             <div className="w-16 bg-[#1f2937] rounded-t-sm" style={{ height: '10px' }}></div>
                         </div>
                     </div>
                </div>
            </div>

            {/* Row 3: Tables & Balances */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Top 5 Unmatched */}
                <div className="bg-[#1e293b] p-6 rounded-lg border border-slate-800">
                    <h3 className="text-slate-200 font-medium mb-6">Top 5 Largest Unmatched Transactions</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="text-[10px] uppercase text-slate-500 font-bold border-b border-slate-700/50">
                                <tr>
                                    <th className="pb-3 pl-2">Date</th>
                                    <th className="pb-3">Description</th>
                                    <th className="pb-3 text-right pr-2">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {analytics.topUnmatched.map((t) => (
                                    <tr key={t.id} className="group hover:bg-slate-800/50 transition-colors">
                                        <td className="py-3 pl-2 text-xs text-slate-400 font-mono">{t.date}</td>
                                        <td className="py-3 text-xs text-slate-300 font-medium max-w-[180px] truncate" title={t.description}>
                                            {t.description}
                                        </td>
                                        <td className="py-3 pr-2 text-right text-xs font-bold text-yellow-500 font-mono">
                                            {formatCurrency(t.amount)}
                                        </td>
                                    </tr>
                                ))}
                                {analytics.topUnmatched.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="py-8 text-center text-xs text-slate-500">No unmatched transactions.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Closing Balances */}
                <div className="bg-[#1e293b] p-6 rounded-lg border border-slate-800 flex flex-col justify-center gap-4">
                    <h3 className="text-slate-200 font-medium mb-2 text-center">Closing Balances</h3>
                    
                    <div className="bg-[#111827] border border-slate-700 p-4 rounded-lg flex justify-between items-center">
                        <span className="text-sm text-slate-400">Bank Statement Balance</span>
                        <span className="text-lg font-bold text-white">{formatCurrency(analytics.bankBalance)}</span>
                    </div>

                    <div className="bg-[#111827] border border-slate-700 p-4 rounded-lg flex justify-between items-center">
                        <span className="text-sm text-slate-400">General Ledger Balance</span>
                        <span className="text-lg font-bold text-white">{formatCurrency(analytics.ledgerBalance)}</span>
                    </div>

                    <div className="bg-[#111827] border border-red-500/50 p-4 rounded-lg flex justify-between items-center shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                        <span className="text-sm font-bold text-white">Total Variance</span>
                        <span className="text-lg font-bold text-white">{formatCurrency(analytics.totalVariance)}</span>
                    </div>
                </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 mt-8">
                <button 
                    onClick={resetApp}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-md shadow-lg shadow-indigo-900/20 transition-all active:scale-95"
                >
                    Start New Reconciliation
                </button>
                <div className="flex gap-4">
                    <button 
                        onClick={() => downloadCSV(reconciliationResult)}
                        className="px-6 py-3 bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-sm font-bold rounded-md shadow-lg shadow-sky-900/20 flex items-center gap-2 transition-all active:scale-95"
                    >
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                    <button 
                        onClick={() => setShowExportModal(true)}
                        className="px-6 py-3 bg-[#ef4444] hover:bg-[#dc2626] text-white text-sm font-bold rounded-md shadow-lg shadow-red-900/20 flex items-center gap-2 transition-all active:scale-95"
                    >
                        <Download className="w-4 h-4" /> Export PDF
                    </button>
                </div>
            </div>
        </div>
        ) : (
            // --------------------------------------------------------------------------------
            // DETAILED REPORT VIEW
            // --------------------------------------------------------------------------------
            <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-6 min-h-[800px] shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* Search Bar Row */}
                <div className="flex justify-between items-center mb-6 gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                        type="text" 
                        placeholder="Search description, date, or amount..." 
                        className="w-full bg-[#0f1219] border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <button className="flex items-center gap-2 bg-[#0f1219] border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors">
                           <span className="text-slate-500">Status:</span> All Items <ChevronDown className="w-4 h-4 text-slate-500" />
                        </button>
                    </div>
                </div>

                {/* Matched Transactions Section */}
                <div className="mb-8 border border-slate-700/50 rounded-lg overflow-hidden">
                    <div className="bg-[#0f1219]/50 px-4 py-3 border-b border-slate-700/50 flex items-center gap-2">
                        <ChevronDown className="w-4 h-4 text-green-500" />
                        <h3 className="text-green-500 font-medium text-sm">Matched Transactions ({detailedViewData.matches.length})</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                        <thead className="bg-[#111827] text-slate-500 font-bold uppercase">
                            <tr>
                                <th className="px-4 py-3">Bank Date</th>
                                <th className="px-4 py-3">Bank Description</th>
                                <th className="px-4 py-3">Ledger Date</th>
                                <th className="px-4 py-3">Ledger Description</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30 bg-[#0f1219]">
                            {detailedViewData.matches.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">No matching records found for current filters.</td>
                                </tr>
                            ) : (
                                detailedViewData.matches.map(m => (
                                    <tr key={m.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-4 py-3 text-slate-400 font-mono align-top">
                                            {m.bank.map(b => <div key={b.id}>{b.date}</div>)}
                                        </td>
                                        <td className="px-4 py-3 text-slate-300 align-top">
                                            {m.bank.map(b => <div key={b.id} className="truncate max-w-[200px]" title={b.description}>{b.description}</div>)}
                                        </td>
                                        <td className="px-4 py-3 text-slate-400 font-mono align-top">
                                            {m.ledger.map(l => <div key={l.id}>{l.date}</div>)}
                                        </td>
                                        <td className="px-4 py-3 text-slate-300 align-top">
                                            {m.ledger.map(l => <div key={l.id} className="truncate max-w-[200px]" title={l.description}>{l.description}</div>)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-300 font-mono align-top font-semibold">
                                            {formatCurrency(m.bank.reduce((s,t) => s + t.amount, 0))}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        </table>
                    </div>
                </div>

                {/* Unmatched Bank Transactions Section */}
                <div className="border border-slate-700/50 rounded-lg overflow-hidden mb-8">
                    <div className="bg-[#0f1219]/50 px-4 py-3 border-b border-slate-700/50 flex items-center gap-2">
                        <h3 className="text-orange-500 font-medium text-sm">Unmatched Bank Transactions ({detailedViewData.unmatchedBank.length})</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                        <thead className="bg-[#111827] text-slate-500 font-bold uppercase">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                   <div className="w-4 h-4 border border-slate-600 rounded bg-slate-800"></div>
                                </th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Description</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30 bg-[#0f1219]">
                             {detailedViewData.unmatchedBank.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500 italic">No unmatched bank transactions found.</td>
                                </tr>
                            ) : (
                                detailedViewData.unmatchedBank.map(t => (
                                    <tr key={t.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-4 py-3">
                                            <div className="w-4 h-4 border border-slate-600 rounded bg-slate-800 cursor-pointer hover:border-slate-500"></div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-300 font-mono">{t.date}</td>
                                        <td className="px-4 py-3 text-slate-400 font-medium">{t.description}</td>
                                        <td className="px-4 py-3 text-right text-orange-400 font-bold font-mono">
                                            {formatCurrency(t.amount)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        </table>
                    </div>
                </div>
                
                {/* Unmatched Ledger Transactions Section (Added for completeness but style matches Bank) */}
                {detailedViewData.unmatchedLedger.length > 0 && (
                    <div className="border border-slate-700/50 rounded-lg overflow-hidden">
                        <div className="bg-[#0f1219]/50 px-4 py-3 border-b border-slate-700/50 flex items-center gap-2">
                            <h3 className="text-yellow-500 font-medium text-sm">Unmatched Ledger Transactions ({detailedViewData.unmatchedLedger.length})</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                            <thead className="bg-[#111827] text-slate-500 font-bold uppercase">
                                <tr>
                                    <th className="px-4 py-3 w-10">
                                        <div className="w-4 h-4 border border-slate-600 rounded bg-slate-800"></div>
                                    </th>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Description</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/30 bg-[#0f1219]">
                                {detailedViewData.unmatchedLedger.map(t => (
                                    <tr key={t.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-4 py-3">
                                            <div className="w-4 h-4 border border-slate-600 rounded bg-slate-800 cursor-pointer hover:border-slate-500"></div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-300 font-mono">{t.date}</td>
                                        <td className="px-4 py-3 text-slate-400 font-medium">{t.description}</td>
                                        <td className="px-4 py-3 text-right text-yellow-500 font-bold font-mono">
                                            {formatCurrency(t.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
}

export default App;