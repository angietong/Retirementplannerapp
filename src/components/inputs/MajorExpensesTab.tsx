import React from 'react';
import { Plus, Trash2, Sparkles, Car, Home, Plane, Heart, Info } from 'lucide-react';
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              Annual Major Expenses by Specified Age
            </h3>
            <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full border border-amber-200">
              {majorExpenses.length} of 10 Configured
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Schedule up to 10 major one-time or special annual expenses at designated ages (e.g. Home Renovation, New Vehicles, Weddings, Travel, Long-Term Care). The retirement engine will automatically increase the corresponding year&apos;s total expenses and gross up the required portfolio withdrawal.
          </p>
        </div>
        <button
          onClick={() => onAddMajorExpense()}
          disabled={majorExpenses.length >= 10}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors shadow-2xs shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Major Expense ({majorExpenses.length}/10)
        </button>
      </div>

      {/* Quick Add Presets */}
      <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
          Quick-Add Common Major Expenses:
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onAddMajorExpense({ name: 'Home Renovation / Roof', age: 65, amount: 45000, inflationAdjusted: true, notes: 'Kitchen remodel & roof replacement' })}
            disabled={majorExpenses.length >= 10}
            className="inline-flex items-center gap-1.5 text-xs bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
          >
            <Home className="w-3.5 h-3.5 text-emerald-600" />
            + Home Remodel / Roof ($45k @ 65)
          </button>
          <button
            onClick={() => onAddMajorExpense({ name: 'New Vehicle Purchase', age: 70, amount: 35000, inflationAdjusted: true, notes: 'Replacement SUV / Hybrid' })}
            disabled={majorExpenses.length >= 10}
            className="inline-flex items-center gap-1.5 text-xs bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
          >
            <Car className="w-3.5 h-3.5 text-blue-600" />
            + New Vehicle ($35k @ 70)
          </button>
          <button
            onClick={() => onAddMajorExpense({ name: 'Milestone Anniversary Trip', age: 68, amount: 20000, inflationAdjusted: true, notes: 'Extended international travel' })}
            disabled={majorExpenses.length >= 10}
            className="inline-flex items-center gap-1.5 text-xs bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
          >
            <Plane className="w-3.5 h-3.5 text-indigo-600" />
            + Anniversary Trip ($20k @ 68)
          </button>
          <button
            onClick={() => onAddMajorExpense({ name: 'Long-Term Care / Medical Buffer', age: 80, amount: 60000, inflationAdjusted: true, notes: 'Assisted living or in-home care buffer' })}
            disabled={majorExpenses.length >= 10}
            className="inline-flex items-center gap-1.5 text-xs bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
          >
            <Heart className="w-3.5 h-3.5 text-rose-600" />
            + LTC / Care Buffer ($60k @ 80)
          </button>
        </div>
      </div>

      {/* Major Expenses Table */}
      {majorExpenses.length > 0 ? (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[200px]">Expense Name / Description</th>
                <th className="py-2.5 px-3 w-28 text-center">Milestone Age</th>
                <th className="py-2.5 px-3 w-36 text-right">Amount ($)</th>
                <th className="py-2.5 px-3 w-40 text-center">Inflation Adjusted?</th>
                <th className="py-2.5 px-3">Notes & Purpose</th>
                <th className="py-2.5 px-3 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {majorExpenses.map((exp, idx) => (
                <tr key={exp.id} className="hover:bg-amber-50/30">
                  <td className="py-2.5 px-3 text-center">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-[10px] mx-auto">
                      {idx + 1}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={exp.name}
                      placeholder="e.g. Home Remodel / New Car"
                      onChange={e => onUpdateMajorExpense(exp.id, { name: e.target.value })}
                      className="w-full font-medium text-slate-900 border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-amber-500"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-slate-400 text-[11px]">Age</span>
                      <NumericInput
                        min={50}
                        max={110}
                        integer
                        fallbackValue={65}
                        value={exp.age}
                        onChange={val => onUpdateMajorExpense(exp.id, { age: val })}
                        className="w-16 text-center font-semibold text-slate-900 border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-amber-500"
                      />
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <NumericInput
                      step={1000}
                      min={0}
                      fallbackValue={0}
                      value={exp.amount}
                      onChange={val => onUpdateMajorExpense(exp.id, { amount: val })}
                      className="w-28 text-right font-mono font-semibold text-slate-900 border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-amber-500"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <select
                      value={exp.inflationAdjusted ? 'yes' : 'no'}
                      onChange={e => onUpdateMajorExpense(exp.id, { inflationAdjusted: e.target.value === 'yes' })}
                      className="border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-amber-500 bg-white"
                    >
                      <option value="yes">Yes (Today&apos;s $ + CPI)</option>
                      <option value="no">No (Fixed Future $)</option>
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={exp.notes || ''}
                      placeholder="Optional notes or details"
                      onChange={e => onUpdateMajorExpense(exp.id, { notes: e.target.value })}
                      className="w-full text-slate-600 border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-amber-500"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={() => onRemoveMajorExpense(exp.id)}
                      className="text-slate-400 hover:text-red-600 transition-colors p-1"
                      title="Remove expense"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-10 px-4 border border-dashed border-slate-300 rounded-xl bg-slate-50">
          <Sparkles className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-700">No Major Expenses Scheduled Yet</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Click &quot;Add Major Expense&quot; above or pick one of the quick presets to budget for milestone purchases, home repairs, or family events at specific ages.
          </p>
        </div>
      )}

      {/* Summary Box */}
      {majorExpenses.length > 0 && (
        <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Total Scheduled Major Expenses: <strong className="font-mono">{formatCurrency(majorExpenses.reduce((sum, m) => sum + (m.amount || 0), 0))}</strong> (in base dollars) across <strong>{majorExpenses.length}</strong> life events.
            </span>
          </div>
          <span className="text-[11px] text-amber-800">
            Automatically factored into the liquidation cascade and tax gross-up formulas.
          </span>
        </div>
      )}
    </div>
  );
};
