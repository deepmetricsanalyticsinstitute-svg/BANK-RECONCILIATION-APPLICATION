import React from 'react';
import { MatchGroup } from '../types';
import { CheckCircle2, Split, Merge, Zap } from 'lucide-react';

interface MatchTableProps {
  matches: MatchGroup[];
}

export const MatchTable: React.FC<MatchTableProps> = ({ matches }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-100 bg-green-50 flex justify-between items-center">
        <h3 className="font-semibold text-green-800 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Reconciled Matches 
            <span className="text-green-600 font-normal text-sm bg-green-100 px-2 py-0.5 rounded-full">
                {matches.length} groups
            </span>
        </h3>
      </div>
      <div className="overflow-y-auto flex-1 max-h-[400px]">
        {matches.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No matches found yet.
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 font-medium w-1/2">Bank Statement</th>
                <th className="px-6 py-3 font-medium w-1/2 border-l border-gray-200">General Ledger</th>
                <th className="px-4 py-3 font-medium text-right min-w-[120px]">Analysis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {matches.map((m) => {
                 const bankTotal = m.bank.reduce((sum, t) => sum + t.amount, 0);
                 const ledgerTotal = m.ledger.reduce((sum, t) => sum + t.amount, 0);
                 const isExact = Math.abs(bankTotal - ledgerTotal) < 0.01;

                 // Determine color based on confidence
                 const scoreColor = m.confidence >= 0.9 ? 'bg-green-500' : 
                                  m.confidence >= 0.7 ? 'bg-amber-500' : 'bg-red-500';
                 const scoreTextColor = m.confidence >= 0.9 ? 'text-green-600' : 
                                      m.confidence >= 0.7 ? 'text-amber-600' : 'text-red-500';

                 return (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors group">
                    {/* Bank Column */}
                    <td className="px-6 py-3 relative align-top">
                       <div className="space-y-2">
                           {m.bank.map(t => (
                               <div key={t.id} className="flex flex-col pb-1 border-b border-gray-100 last:border-0 last:pb-0">
                                   <div className="flex justify-between items-center">
                                       <span className="font-mono text-xs text-gray-500">{t.date}</span>
                                       <span className="font-mono font-semibold">{t.amount.toFixed(2)}</span>
                                   </div>
                                   <div className="text-xs text-gray-600 truncate mt-0.5" title={t.description}>{t.description}</div>
                               </div>
                           ))}
                           {m.bank.length > 1 && (
                               <div className="pt-1 border-t border-dashed border-gray-300 flex justify-between text-xs font-bold text-gray-700">
                                   <span>Total</span>
                                   <span>{bankTotal.toFixed(2)}</span>
                               </div>
                           )}
                       </div>
                    </td>

                    {/* Ledger Column */}
                    <td className="px-6 py-3 border-l border-gray-200 relative align-top bg-gray-50/30">
                       <div className="space-y-2">
                           {m.ledger.map(t => (
                               <div key={t.id} className="flex flex-col pb-1 border-b border-gray-100 last:border-0 last:pb-0">
                                   <div className="flex justify-between items-center">
                                       <span className="font-mono text-xs text-gray-500">{t.date}</span>
                                       <span className="font-mono font-semibold">{t.amount.toFixed(2)}</span>
                                   </div>
                                   <div className="text-xs text-gray-600 truncate mt-0.5" title={t.description}>{t.description}</div>
                               </div>
                           ))}
                           {m.ledger.length > 1 && (
                               <div className="pt-1 border-t border-dashed border-gray-300 flex justify-between text-xs font-bold text-gray-700">
                                   <span>Total</span>
                                   <span>{ledgerTotal.toFixed(2)}</span>
                               </div>
                           )}
                       </div>
                    </td>

                    {/* Analysis/Status Column */}
                    <td className="px-4 py-3 text-right align-top">
                        <div className="flex flex-col items-end gap-3">
                            {/* Match Type Badge */}
                            <div>
                                {m.type === '1-to-N' && (
                                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700" title="One Bank Item = Multiple Ledger Items">
                                        <Split className="w-3 h-3 mr-1" /> Split
                                    </span>
                                )}
                                {m.type === 'N-to-1' && (
                                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-700" title="Multiple Bank Items = One Ledger Item">
                                        <Merge className="w-3 h-3 mr-1" /> Merge
                                    </span>
                                )}
                                {m.type === 'fuzzy' && (
                                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700" title="Fuzzy Description Match">
                                        <Zap className="w-3 h-3 mr-1" /> Fuzzy
                                    </span>
                                )}
                                {m.type === 'exact' && (
                                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                                        <CheckCircle2 className="w-3 h-3 mr-1" /> Exact
                                    </span>
                                )}
                            </div>
                            
                            {/* Confidence Visual Indicator */}
                            <div className="w-24">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] text-gray-400 uppercase tracking-wide">Confidence</span>
                                    <span className={`text-[10px] font-bold ${scoreTextColor}`}>
                                        {(m.confidence * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-500 ${scoreColor}`}
                                        style={{ width: `${m.confidence * 100}%` }}
                                    />
                                </div>
                            </div>

                            {/* Difference warning */}
                            {!isExact && (
                                <span className="text-red-600 text-[10px] font-mono bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                                    Diff: {(bankTotal - ledgerTotal).toFixed(2)}
                                </span>
                            )}
                        </div>
                    </td>
                  </tr>
              )})}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};