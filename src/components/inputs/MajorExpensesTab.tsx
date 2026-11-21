import React from 'react';
import { Plus, Trash2, Car, Home, Plane, Heart } from 'lucide-react';
import { PlannerConfig, MajorExpense } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { NumericInput } from '../NumericInput';

interface MajorExpensesTabProps {
  config: PlannerConfig;
  onAddMajorExpense: (sample?: Partial<MajorExpense>) => void;
  onRemoveMajorExpense: (id: string) => void;
  onUpdateMajorExpense: (id: string, updates: Partial<MajorExpense>) => void;
}

export const MajorExpensesTab: React.FC<MajorExpensesTabProps> = ({
  config,
  onAddMajorExpense,
  onRemoveMajorExpense,
  onUpdateMajorExpense,
}) => {
  const majorExpenses = config.majorExpenses || [];
  const totalBase = majorExpenses.reduce((sum, m) => sum + (m.amount || 0), 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-slate-900">
              Scheduled Major One-Time Expenses ({majorExpenses.length}/10)
            </h3>
            {majorExpenses.length > 0 && (
              <>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs font-semibold text-slate-700 font-mono tabular-nums">
                  {formatCurrency(totalBase)} total
                </span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Budget for vehicles, home renovations, travel, or care reserves at specific ages. Withdrawals gross up automatically.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onAddMajorExpense()}
          disabled={majorExpenses.length >= 10}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Major Expense
        </button>
      </div>

      {/* Quick Presets Bar */}
      <div className="px-4 sm:px-5 py-3 bg-slate-50/70 border-b border-slate-200 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-slate-500 mr-1">Quick add:</span>
        {[
          { icon: Home, label: 'Home Remodel ($45k @ 65)', sample: { name: 'Home Renovation / Roof', age: 65, amount: 45000, inflationAdjusted: true, notes: 'Kitchen remodel & roof replacement' } },
          { icon: Car, label: 'Vehicle ($35k @ 70)', sample: { name: 'New Vehicle Purchase', age: 70, amount: 35000, inflationAdjusted: true, notes: 'Replacement vehicle' } },
          { icon: Plane, label: 'Milestone Trip ($20k @ 68)', sample: { name: 'Milestone Anniversary Trip', age: 68, amount: 20000, inflationAdjusted: true, notes: 'Extended travel' } },
          { icon: Heart, label: 'LTC Buffer ($60k @ 80)', sample: { name: 'Long-Term Care Buffer', age: 80, amount: 60000, inflationAdjusted: true, notes: 'Care reserve' } },
        ].map(preset => {
          const Icon = preset.icon;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onAddMajorExpense(preset.sample)}
              disabled={majorExpenses.length >= 10}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors disabled:opacity-40"
            >
              <Icon className="w-3.5 h-3.5 text-slate-500" />
              {preset.label}
            </button>
          );
        })}
      </div>

      {majorExpenses.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                <th className="py-3 px-4 min-w-[200px]">Expense Name</th>
                <th className="py-3 px-3 w-28 text-center">Age</th>
                <th className="py-3 px-3 w-40 text-right">Amount</th>
                <th className="py-3 px-3 w-44">Inflation Handling</th>
                <th className="py-3 px-3 min-w-[160px]">Notes</th>
                <th className="py-3 px-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {majorExpenses.map(exp => (
                <tr key={exp.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4">
                    <input
                      type="text"
                      value={exp.name}
                      placeholder="e.g. Home Remodel"
                      onChange={e => onUpdateMajorExpense(exp.id, { name: e.target.value })}
                      className="w-full min-h-[38px] font-medium text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:outline-none rounded-lg px-2.5 py-1.5 text-[13px] bg-white"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <NumericInput
                      min={45}
                      max={110}
                      integer
                      fallbackValue={65}
                      value={exp.age}
                      onChange={val => onUpdateMajorExpense(exp.id, { age: val })}
                      className="w-full min-h-[38px] text-center font-mono text-[13px] text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:outline-none rounded-lg px-2 py-1.5 bg-white"
                      ariaLabel={`${exp.name} target age`}
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <NumericInput
                      prefix="$"
                      formatWithCommas
                      step={1000}
                      min={0}
                      fallbackValue={0}
                      value={exp.amount}
                      onChange={val => onUpdateMajorExpense(exp.id, { amount: val })}
                      className="w-full min-h-[38px] text-right font-mono text-[13px] text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:outline-none rounded-lg pr-2.5 py-1.5 bg-white"
                      ariaLabel={`${exp.name} amount`}
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <select
                      value={exp.inflationAdjusted ? 'yes' : 'no'}
                      onChange={e => onUpdateMajorExpense(exp.id, { inflationAdjusted: e.target.value === 'yes' })}
                      className="w-full min-h-[38px] border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:outline-none rounded-lg px-2.5 py-1.5 text-[13px] text-slate-800 bg-white"
                    >
                      <option value="yes">Today&apos;s $ + CPI</option>
                      <option value="no">Fixed Future $</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      value={exp.notes || ''}
                      placeholder="Optional details"
                      onChange={e => onUpdateMajorExpense(exp.id, { notes: e.target.value })}
                      className="w-full min-h-[38px] text-slate-600 border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:outline-none rounded-lg px-2.5 py-1.5 text-[13px] bg-white"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => onRemoveMajorExpense(exp.id)}
                      aria-label={`Remove ${exp.name}`}
                      className="p-2 min-w-[36px] min-h-[36px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center justify-center mx-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-10 text-center">
          <p className="text-sm font-semibold text-slate-700">No major one-time expenses scheduled</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Use the quick-add templates above or click &ldquo;Add Major Expense&rdquo; to include milestone purchases in your cash flow model.
          </p>
        </div>
      )}
    </div>
  );
};
