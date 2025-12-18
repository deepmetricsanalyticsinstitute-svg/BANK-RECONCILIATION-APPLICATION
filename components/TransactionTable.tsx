import React, { useMemo } from 'react';
import { Transaction } from '../types';
import { ArrowUpRight, ArrowDownLeft, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface TransactionTableProps {
  transactions: Transaction[];
  compareAgainst?: Transaction[];
  title: string;
  emptyMessage?: string;
  status?: 'matched' | 'unmatched' | 'neutral';
}

export const TransactionTable: React.FC<TransactionTableProps> = ({ 
  transactions, 
  compareAgainst,
  title, 
  emptyMessage = "No transactions found",
  status = 'neutral'
}) => {
  
  // Logic to find potential matches that failed due to one specific field
  const hints = useMemo(() => {
    const map = new Map<string, { field: 'date' | 'amount', message: string, value?: string }>();
    if (!compareAgainst || status !== 'unmatched') return map;

    for (const t of transactions) {
        // 1. Check for Exact Amount Match (implies Date was likely too far)
        // We look for same type and same amount
        const amountMatch = compareAgainst.find(c => 
            c.type === t.type && 
            Math.abs(c.amount - t.amount) < 0.01
        );
        
        if (amountMatch) {
            map.set(t.id, { 
                field: 'date', 
                message: `Similar amount (${amountMatch.amount.toFixed(2)}) found on ${amountMatch.date}`,
                value: amountMatch.date 
            });
            continue; 
        }

        // 2. Check for Exact Date Match (implies Amount was likely different)
        // We look for same type and same date
        const dateMatch = compareAgainst.find(c => 
            c.type === t.type && 
            c.date === t.date
        );

        if (dateMatch) {
             map.set(t.id, { 
                field: 'amount', 
                message: `Transaction on same date found with amount ${dateMatch.amount.toFixed(2)}`,
                value: dateMatch.amount.toFixed(2)
            });
            continue;
        }
    }
    return map;
  }, [transactions, compareAgainst, status]);

  // Style config based on status
  const styles = {
    matched: {
      headerBg: 'bg-green-50',
      headerText: 'text-green-800',
      icon: <CheckCircle className="w-5 h-5 text-green-600" />,
      rowBorder: 'border-l-4 border-green-500',
      badgeBg: 'bg-green-100',
      badgeText: 'text-green-700',
      badgeLabel: 'Matched'
    },
    unmatched: {
      headerBg: 'bg-red-50',
      headerText: 'text-red-800',
      icon: <AlertCircle className="w-5 h-5 text-red-600" />,
      rowBorder: 'border-l-4 border-red-500',
      badgeBg: 'bg-red-100',
      badgeText: 'text-red-700',
      badgeLabel: 'Unmatched'
    },
    neutral: {
      headerBg: 'bg-gray-50',
      headerText: 'text-gray-800',
      icon: null,
      rowBorder: 'border-l-4 border-transparent pl-4',
      badgeBg: '',
      badgeText: '',
      badgeLabel: ''
    }
  };

  const currentStyle = styles[status];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
      <div className={`px-6 py-4 border-b border-gray-100 flex items-center justify-between ${currentStyle.headerBg}`}>
        <div className="flex items-center gap-2">
            {currentStyle.icon}
            <h3 className={`font-semibold ${currentStyle.headerText}`}>
                {title} <span className="text-gray-500 font-normal text-sm opacity-80">({transactions.length})</span>
            </h3>
        </div>
      </div>
      <div className="overflow-y-auto flex-1 max-h-[400px]">
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            {emptyMessage}
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 font-medium pl-6">Date</th>
                <th className="px-6 py-3 font-medium">Description</th>
                <th className="px-6 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((t) => {
                const hint = hints.get(t.id);
                return (
                    <tr key={t.id} className={`hover:bg-gray-50 transition-colors ${currentStyle.rowBorder}`}>
                    <td className="px-6 py-3 text-gray-600 whitespace-nowrap font-mono text-xs pl-5 relative group/date">
                        <div className="flex items-center gap-1">
                            {t.date}
                            {hint?.field === 'date' && (
                                <div className="relative">
                                    <Info className="w-3.5 h-3.5 text-amber-500 cursor-help" />
                                    <div className="absolute left-0 top-full mt-1 w-48 bg-gray-800 text-white text-[10px] p-2 rounded shadow-lg opacity-0 group-hover/date:opacity-100 transition-opacity z-50 pointer-events-none whitespace-normal z-20">
                                        {hint.message}
                                    </div>
                                </div>
                            )}
                        </div>
                    </td>
                    <td className="px-6 py-3 text-gray-800 font-medium">
                        <div className="flex items-center justify-between gap-2">
                            <span className="truncate max-w-[180px]" title={t.description}>{t.description}</span>
                            {status !== 'neutral' && (
                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${currentStyle.badgeBg} ${currentStyle.badgeText}`}>
                                    {currentStyle.badgeLabel}
                                </span>
                            )}
                        </div>
                    </td>
                    <td className={`px-6 py-3 text-right font-mono font-semibold flex items-center justify-end gap-1 ${t.type === 'credit' ? 'text-green-600' : 'text-gray-900'} relative group/amount`}>
                         {hint?.field === 'amount' && (
                            <div className="relative mr-1">
                                <Info className="w-3.5 h-3.5 text-amber-500 cursor-help" />
                                <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 text-white text-[10px] p-2 rounded shadow-lg opacity-0 group-hover/amount:opacity-100 transition-opacity z-50 pointer-events-none text-left whitespace-normal z-20">
                                    {hint.message}
                                </div>
                            </div>
                        )}
                        {t.type === 'credit' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3 text-gray-400" />}
                        {t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};