import React from 'react';
import { Sparkles } from 'lucide-react';
import { PlannerConfig, MonthlyExpenses } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface ExpensesTabProps {
  config: PlannerConfig;
  onUpdateExpenses: (key: keyof MonthlyExpenses, value: any) => void;
  onNavigateToMajorExpenses: () => void;
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({
  config,
  onUpdateExpenses,
  onNavigateToMajorExpenses,
}) => {
  const majorExpensesCount = (config.majorExpenses || []).length;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          Monthly Expenses (Base Year, Today&apos;s Dollars)
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Living expenses grow at the general inflation rate ({((config.rates.inflationRate || 0.025) * 100).toFixed(1)}%), while healthcare expenses grow at the decoupled medical inflation rate ({(((config.rates.medicalInflationRate ?? 0.045)) * 100).toFixed(1)}%).
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Day-to-day After-tax Living Expenses ($ / month)
        </label>
        <input
          type="number"
          value={config.expenses.expDaily}
          onChange={e => onUpdateExpenses('expDaily', parseFloat(e.target.value) || 0)}
          className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
        />
        <p className="text-[10px] text-slate-500 mt-0.5">
          Housing, food, utilities, leisure, travel, and non-medical living costs.
        </p>
      </div>

      {/* Medical Expenses Section */}
      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-4">
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Pre-Medicare Medical Expenses (Before Age 65)
          </h4>
          <p className="text-[11px] text-slate-500">
            Private insurance, ACA marketplace coverage, or COBRA.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Medical Premium ($ / month)
            </label>
            <input
              type="number"
              value={config.expenses.expMedPremium}
              onChange={e => onUpdateExpenses('expMedPremium', parseFloat(e.target.value) || 0)}
              className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Medical Out-of-pocket ($ / month)
            </label>
            <input
              type="number"
              value={config.expenses.expMedOop}
              onChange={e => onUpdateExpenses('expMedOop', parseFloat(e.target.value) || 0)}
              className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
            />
          </div>
        </div>

        <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-2.5 text-[11px] text-emerald-900 flex items-center justify-between">
          <span>
            💡 <strong>ACA Subsidy Bridge:</strong> You can optimize your drawdown sequence in the <strong>ACA Subsidy Drawdown</strong> tab to cap taxable AGI and qualify for federal health insurance subsidies before age 65.
          </span>
        </div>

        {/* Post-Medicare Milestone Toggle */}
        <div className="pt-3 border-t border-slate-200">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.expenses.hasMedicarePostExp ?? true}
              onChange={e => onUpdateExpenses('hasMedicarePostExp', e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300 mt-0.5"
            />
            <div>
              <span className="text-xs font-bold text-slate-800">
                Specify Different Medical Expenses After Medicare Milestone (Age 65+)
              </span>
              <p className="text-[11px] text-slate-500">
                When reaching Age 65, medical expenses transition from private coverage to Medicare Part B/D + Medigap Supplement.
              </p>
            </div>
          </label>

          {(config.expenses.hasMedicarePostExp ?? true) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 bg-white p-3 rounded-lg border border-slate-200">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Post-Medicare Premium ($ / mo)
                </label>
                <input
                  type="number"
                  value={config.expenses.expMedPremiumPost ?? 320}
                  onChange={e => onUpdateExpenses('expMedPremiumPost', parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                  placeholder="e.g. 320"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Medicare Part B standard premium + Part D / Medigap</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Post-Medicare Out-of-pocket ($ / mo)
                </label>
                <input
                  type="number"
                  value={config.expenses.expMedOopPost ?? 180}
                  onChange={e => onUpdateExpenses('expMedOopPost', parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                  placeholder="e.g. 180"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Copays, dental, vision, hearing out-of-pocket</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
        <span className="font-semibold text-slate-800">Initial Base Annual Expense: </span>
        <span className="font-mono font-bold text-emerald-700">
          {formatCurrency(12 * (config.expenses.expDaily + config.expenses.expMedPremium + config.expenses.expMedOop))}
          /year
        </span>
        {(config.expenses.hasMedicarePostExp ?? true) && (
          <span className="text-slate-500 ml-2">
            (shifts to {formatCurrency(12 * (config.expenses.expDaily + (config.expenses.expMedPremiumPost ?? 320) + (config.expenses.expMedOopPost ?? 180)))}/yr in today&apos;s dollars at Medicare Age 65)
          </span>
        )}
      </div>

      {/* Link to Major Expenses */}
      <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-amber-900 font-semibold text-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            Have one-time major expenses planned? (Vehicles, Home Remodel, College, Travel)
          </div>
          <p className="text-[11px] text-amber-800/80 mt-0.5">
            You can specify up to 10 major one-time annual expenses by age. The planner will automatically increase withdrawals for those specific years.
          </p>
        </div>
        <button
          onClick={onNavigateToMajorExpenses}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-semibold shrink-0 transition-colors shadow-2xs"
        >
          Configure Major Expenses ({majorExpensesCount})
        </button>
      </div>
    </div>
  );
};
