import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { PlannerConfig, IncomeSource, MonthlyIndicator, SourceOwner, TaxType } from '../../types';

interface SourcesTabProps {
  config: PlannerConfig;
  hasSpouse: boolean;
  primaryName: string;
  spouseName: string;
  onAddSource: () => void;
  onRemoveSource: (id: string) => void;
  onUpdateSource: (id: string, updates: Partial<IncomeSource>) => void;
  onMovePriority: (index: number, direction: 'up' | 'down') => void;
}

export const SourcesTab: React.FC<SourcesTabProps> = ({
  config,
  hasSpouse,
  primaryName,
  spouseName,
  onAddSource,
  onRemoveSource,
  onUpdateSource,
  onMovePriority,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Income & Asset Accounts Table (Up to 20 Sources)
          </h3>
          <p className="text-xs text-slate-500">
            Priority determines liquidation order (lower number tapped first). Non-monthly accounts deplete; monthly accounts provide recurring guaranteed cash flow.
          </p>
        </div>
        <button
          onClick={onAddSource}
          disabled={config.sources.length >= 20}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Income Source
        </button>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <th className="py-2.5 px-3 w-14">Order</th>
              <th className="py-2.5 px-3">Account / Source Name</th>
              <th className="py-2.5 px-3">Account Category</th>
              {hasSpouse && <th className="py-2.5 px-3">Owner</th>}
              <th className="py-2.5 px-3 text-right">Initial Balance ($)</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Tax Treatment</th>
              <th className="py-2.5 px-3 text-right">Annual Flow ($/yr)</th>
              <th className="py-2.5 px-3 text-center">Start Age</th>
              <th className="py-2.5 px-3">Notes</th>
              <th className="py-2.5 px-3 w-10 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {config.sources.map((s, idx) => (
              <tr key={s.id} className="hover:bg-slate-50/70">
                <td className="py-2 px-3">
                  <div className="flex items-center gap-1">
                    <span className="w-5 h-5 rounded bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                      {s.priority}
                    </span>
                    <div className="flex flex-col">
                      <button
                        disabled={idx === 0}
                        onClick={() => onMovePriority(idx, 'up')}
                        className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        title="Move Priority Up"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        disabled={idx === config.sources.length - 1}
                        onClick={() => onMovePriority(idx, 'down')}
                        className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        title="Move Priority Down"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </td>
                <td className="py-2 px-3">
                  <input
                    type="text"
                    value={s.name}
                    onChange={e => onUpdateSource(s.id, { name: e.target.value })}
                    className="w-full font-medium text-slate-900 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-emerald-500"
                  />
                </td>
                <td className="py-2 px-3">
                  <select
                    value={s.accountType || 'other'}
                    onChange={e => onUpdateSource(s.id, { accountType: e.target.value as any })}
                    className="border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:outline-emerald-500 bg-white"
                  >
                    <option value="401k">401(k) / 403(b)</option>
                    <option value="ira">Traditional IRA</option>
                    <option value="roth">Roth IRA / Roth</option>
                    <option value="brokerage">Taxable Brokerage</option>
                    <option value="cash">Cash / Savings</option>
                    <option value="other">Other / Pension</option>
                  </select>
                </td>
                {hasSpouse && (
                  <td className="py-2 px-3">
                    <select
                      value={s.owner || 'primary'}
                      onChange={e => onUpdateSource(s.id, { owner: e.target.value as SourceOwner })}
                      className="border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:outline-emerald-500 bg-white"
                    >
                      <option value="primary">{primaryName} (Primary)</option>
                      <option value="spouse">{spouseName} (Spouse)</option>
                      <option value="joint">Joint Household</option>
                    </select>
                  </td>
                )}
                <td className="py-2 px-3 text-right">
                  <input
                    type="number"
                    disabled={s.monthly === 'Y'}
                    value={s.monthly === 'Y' ? 0 : s.balance}
                    onChange={e => onUpdateSource(s.id, { balance: parseFloat(e.target.value) || 0 })}
                    className="w-24 text-right border border-slate-300 rounded px-2 py-1 text-xs disabled:bg-slate-100 disabled:text-slate-400 focus:outline-emerald-500"
                  />
                </td>
                <td className="py-2 px-3">
                  <select
                    value={s.monthly}
                    onChange={e => onUpdateSource(s.id, { monthly: e.target.value as MonthlyIndicator })}
                    className="border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:outline-emerald-500"
                  >
                    <option value="N">Depleting Asset</option>
                    <option value="Y">Guaranteed Flow</option>
                  </select>
                </td>
                <td className="py-2 px-3">
                  <select
                    value={s.taxType}
                    onChange={e => onUpdateSource(s.id, { taxType: e.target.value as TaxType })}
                    className="border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:outline-emerald-500"
                  >
                    <option value="Income">Ordinary Income</option>
                    <option value="Capital Gain">Capital Gain</option>
                    <option value="N/a">Tax-Free (Roth/Cash)</option>
                  </select>
                </td>
                <td className="py-2 px-3 text-right">
                  <input
                    type="number"
                    disabled={s.monthly === 'N'}
                    value={s.monthly === 'N' ? 0 : s.annualPayment}
                    onChange={e => onUpdateSource(s.id, { annualPayment: parseFloat(e.target.value) || 0 })}
                    className="w-24 text-right border border-slate-300 rounded px-2 py-1 text-xs disabled:bg-slate-100 disabled:text-slate-400 focus:outline-emerald-500"
                  />
                </td>
                <td className="py-2 px-3 text-center">
                  <input
                    type="number"
                    value={s.startAge}
                    onChange={e => onUpdateSource(s.id, { startAge: parseFloat(e.target.value) || 0 })}
                    className="w-14 text-center border border-slate-300 rounded px-1.5 py-1 text-xs focus:outline-emerald-500"
                  />
                </td>
                <td className="py-2 px-3">
                  <input
                    type="text"
                    value={s.notes}
                    placeholder="Optional notes"
                    onChange={e => onUpdateSource(s.id, { notes: e.target.value })}
                    className="w-full text-slate-600 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-emerald-500"
                  />
                </td>
                <td className="py-2 px-3 text-center">
                  <button
                    onClick={() => onRemoveSource(s.id)}
                    className="text-slate-400 hover:text-red-600 transition-colors p-1"
                    title="Remove source"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
