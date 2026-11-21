import React from 'react';
import { PlannerConfig, MonthlyExpenses } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { NumericInput } from '../NumericInput';

interface ExpensesTabProps {
  config: PlannerConfig;
  onUpdateExpenses: (key: keyof MonthlyExpenses, value: any) => void;
  onNavigateToAca?: () => void;
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({
  config,
  onUpdateExpenses,
  onNavigateToAca,
}) => {
  const preMedAnnual =
    12 * (config.expenses.expDaily + config.expenses.expMedPremium + config.expenses.expMedOop);
  const postMedAnnual =
    12 *
    (config.expenses.expDaily +
      (config.expenses.expMedPremiumPost ?? 320) +
      (config.expenses.expMedOopPost ?? 180));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Monthly Baseline Expenses (Today&apos;s Dollars)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Living costs inflate at {((config.rates.inflationRate || 0.025) * 100).toFixed(1)}% · Healthcare inflates at {(((config.rates.medicalInflationRate ?? 0.045)) * 100).toFixed(1)}%.
          </p>
        </div>

        <div className="text-xs text-slate-600 tabular-nums bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2">
          Base Annual:{' '}
          <strong className="font-mono text-slate-900">{formatCurrency(preMedAnnual)}/yr</strong>
          {(config.expenses.hasMedicarePostExp ?? true) && (
            <span className="text-slate-500">
              {' '}· Age {config.milestones.medicareAge}+: <strong className="font-mono text-emerald-700">{formatCurrency(postMedAnnual)}/yr</strong>
            </span>
          )}
        </div>
      </div>

      {/* Day-to-day living */}
      <div className="space-y-2 max-w-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-800">
              Day-to-Day Living Expenses (After-Tax)
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              Housing, food, utilities, travel, leisure, and recurring household costs.
            </p>
          </div>
          <div className="w-36 shrink-0">
            <NumericInput
              prefix="$"
              suffix="/mo"
              formatWithCommas
              min={0}
              fallbackValue={5500}
              value={config.expenses.expDaily}
              onChange={val => onUpdateExpenses('expDaily', val)}
              className="w-full min-h-[40px] text-right font-mono text-sm text-slate-900 border border-slate-300 rounded-lg py-2 bg-white focus:border-emerald-600 focus:outline-none"
              ariaLabel="Monthly day-to-day living expenses"
            />
          </div>
        </div>
        <input
          type="range"
          min={1000}
          max={20000}
          step={250}
          value={Math.min(20000, Math.max(1000, config.expenses.expDaily))}
          onChange={e => onUpdateExpenses('expDaily', parseFloat(e.target.value))}
          aria-label="Monthly living expenses slider"
          className="w-full"
        />
      </div>

      {/* Healthcare Pre & Post Medicare */}
      <div className="pt-5 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                Pre-Medicare Healthcare (Before Age {config.milestones.medicareAge})
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Private marketplace coverage, ACA plan, or COBRA.
              </p>
            </div>
            {onNavigateToAca && (
              <button
                type="button"
                onClick={onNavigateToAca}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
              >
                ACA Optimizer &rarr;
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Monthly Premium
              </label>
              <NumericInput
                prefix="$"
                suffix="/mo"
                formatWithCommas
                min={0}
                fallbackValue={750}
                value={config.expenses.expMedPremium}
                onChange={val => onUpdateExpenses('expMedPremium', val)}
                className="w-full min-h-[40px] text-right font-mono text-sm text-slate-900 border border-slate-300 rounded-lg py-2 bg-white focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Monthly Out-of-Pocket
              </label>
              <NumericInput
                prefix="$"
                suffix="/mo"
                formatWithCommas
                min={0}
                fallbackValue={350}
                value={config.expenses.expMedOop}
                onChange={val => onUpdateExpenses('expMedOop', val)}
                className="w-full min-h-[40px] text-right font-mono text-sm text-slate-900 border border-slate-300 rounded-lg py-2 bg-white focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:border-l lg:border-slate-100 lg:pl-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                Post-Medicare Healthcare (Age {config.milestones.medicareAge}+)
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Transition to Medicare Part B/D &amp; Medigap Supplement costs.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={config.expenses.hasMedicarePostExp ?? true}
                onChange={e => onUpdateExpenses('hasMedicarePostExp', e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-10 h-6 bg-slate-300 rounded-full peer peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4" />
            </label>
          </div>

          {(config.expenses.hasMedicarePostExp ?? true) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Medicare Premium
                </label>
                <NumericInput
                  prefix="$"
                  suffix="/mo"
                  formatWithCommas
                  min={0}
                  fallbackValue={320}
                  value={config.expenses.expMedPremiumPost ?? 320}
                  onChange={val => onUpdateExpenses('expMedPremiumPost', val)}
                  className="w-full min-h-[40px] text-right font-mono text-sm text-slate-900 border border-slate-300 rounded-lg py-2 bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Medicare Out-of-Pocket
                </label>
                <NumericInput
                  prefix="$"
                  suffix="/mo"
                  formatWithCommas
                  min={0}
                  fallbackValue={180}
                  value={config.expenses.expMedOopPost ?? 180}
                  onChange={val => onUpdateExpenses('expMedOopPost', val)}
                  className="w-full min-h-[40px] text-right font-mono text-sm text-slate-900 border border-slate-300 rounded-lg py-2 bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
