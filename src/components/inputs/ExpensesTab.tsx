import React, { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { PlannerConfig, MonthlyExpenses, PhaseKey, YearSimulationResult } from '../../types';
import { getPhaseDefinitions, buildDefaultPhaseExpenses } from '../../engine';
import { formatCurrency } from '../../utils/formatters';
import { NumericInput } from '../NumericInput';

interface ExpensesTabProps {
  config: PlannerConfig;
  years?: YearSimulationResult[];
  onUpdateExpenses: (key: keyof MonthlyExpenses, value: any) => void;
  onUpdateExpensesPatch?: (patch: Partial<MonthlyExpenses>) => void;
  onNavigateToAca?: () => void;
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({
  config,
  years,
  onUpdateExpenses,
  onUpdateExpensesPatch,
  onNavigateToAca,
}) => {
  const usePhaseExpenses = Boolean(config.expenses.usePhaseExpenses);
  const phaseDefinitions = useMemo(() => getPhaseDefinitions(config), [config]);
  const phaseExpenses = useMemo(
    () => buildDefaultPhaseExpenses(config.expenses.expDaily, config.expenses.phaseExpDaily),
    [config.expenses.expDaily, config.expenses.phaseExpDaily]
  );

  // Map each phase number (0-6) to its active year/age span in the simulated timeline
  const phaseSpanByNum = useMemo(() => {
    const map = new Map<
      number,
      { startYear: number; endYear: number; startAge: number; endAge: number; count: number }
    >();
    if (!years || years.length === 0) return map;
    for (const y of years) {
      const existing = map.get(y.phase);
      if (!existing) {
        map.set(y.phase, {
          startYear: y.calYear,
          endYear: y.calYear,
          startAge: y.age,
          endAge: y.age,
          count: 1,
        });
      } else {
        existing.endYear = y.calYear;
        existing.endAge = y.age;
        existing.count += 1;
      }
    }
    return map;
  }, [years]);

  const applyExpensesPatch = (patch: Partial<MonthlyExpenses>) => {
    if (onUpdateExpensesPatch) {
      onUpdateExpensesPatch(patch);
      return;
    }
    (Object.keys(patch) as (keyof MonthlyExpenses)[]).forEach(k => {
      onUpdateExpenses(k, patch[k]);
    });
  };

  const handleTogglePhaseExpenses = (enabled: boolean) => {
    if (enabled) {
      applyExpensesPatch({
        usePhaseExpenses: true,
        phaseExpDaily: buildDefaultPhaseExpenses(
          config.expenses.expDaily,
          config.expenses.phaseExpDaily
        ),
      });
    } else {
      applyExpensesPatch({ usePhaseExpenses: false });
    }
  };

  const handleUpdatePhaseAmount = (phaseKey: PhaseKey, val: number) => {
    const nextMap = {
      ...phaseExpenses,
      [phaseKey]: val,
    };
    applyExpensesPatch({ phaseExpDaily: nextMap });
  };

  const handleResetAllToBaseline = () => {
    applyExpensesPatch({
      phaseExpDaily: buildDefaultPhaseExpenses(config.expenses.expDaily),
    });
  };

  const preMedAnnual =
    12 * (config.expenses.expDaily + config.expenses.expMedPremium + config.expenses.expMedOop);
  const postMedAnnual =
    12 *
    (config.expenses.expDaily +
      (config.expenses.expMedPremiumPost ?? 320) +
      (config.expenses.expMedOopPost ?? 180));

  // Active phase living expense range for header summary when per-phase mode is enabled
  const activePhaseMonthlyValues = useMemo(() => {
    if (!usePhaseExpenses) return [];
    const activeDefs =
      years && years.length > 0
        ? phaseDefinitions.filter(def => phaseSpanByNum.has(def.phase))
        : phaseDefinitions;
    const defsToUse = activeDefs.length > 0 ? activeDefs : phaseDefinitions;
    return defsToUse.map(def => phaseExpenses[def.key]);
  }, [usePhaseExpenses, years, phaseDefinitions, phaseSpanByNum, phaseExpenses]);

  const minPhaseMonthly =
    activePhaseMonthlyValues.length > 0 ? Math.min(...activePhaseMonthlyValues) : config.expenses.expDaily;
  const maxPhaseMonthly =
    activePhaseMonthlyValues.length > 0 ? Math.max(...activePhaseMonthlyValues) : config.expenses.expDaily;

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
          {usePhaseExpenses ? (
            <>
              Living by Phase:{' '}
              <strong className="font-mono text-slate-900">
                {minPhaseMonthly === maxPhaseMonthly
                  ? `${formatCurrency(minPhaseMonthly)}/mo`
                  : `${formatCurrency(minPhaseMonthly)}–${formatCurrency(maxPhaseMonthly)}/mo`}
              </strong>
              <span className="text-slate-500">
                {' '}· {minPhaseMonthly === maxPhaseMonthly
                  ? `${formatCurrency(minPhaseMonthly * 12)}/yr`
                  : `${formatCurrency(minPhaseMonthly * 12)}–${formatCurrency(maxPhaseMonthly * 12)}/yr`}
              </span>
            </>
          ) : (
            <>
              Base Annual:{' '}
              <strong className="font-mono text-slate-900">{formatCurrency(preMedAnnual)}/yr</strong>
              {(config.expenses.hasMedicarePostExp ?? true) && (
                <span className="text-slate-500">
                  {' '}· Age {config.milestones.medicareAge}+: <strong className="font-mono text-emerald-700">{formatCurrency(postMedAnnual)}/yr</strong>
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Day-to-day living baseline */}
      <div className="space-y-4">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-800">
                {usePhaseExpenses
                  ? 'Default Baseline Living Expense (Reference / Fallback)'
                  : 'Day-to-Day Living Expenses (After-Tax)'}
              </label>
              <p className="text-xs text-slate-500 mt-0.5">
                {usePhaseExpenses
                  ? 'Reference monthly amount used to seed or reset your phase schedule.'
                  : 'Housing, food, utilities, travel, leisure, and recurring household costs.'}
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
          {!usePhaseExpenses && (
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
          )}
        </div>

        {/* Optional Phase-Specific Monthly Living Expenses */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                Vary Day-to-Day Living Expenses by Retirement Phase
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Set an explicit monthly amount (today&apos;s dollars, inflation-adjusted) for each milestone stage. Custom amounts stay bound to their stage if Social Security and Medicare swap order.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {usePhaseExpenses && (
                <button
                  type="button"
                  onClick={handleResetAllToBaseline}
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  Apply Baseline to All
                </button>
              )}

              <label className="inline-flex items-center gap-2.5 cursor-pointer select-none min-h-[38px]">
                <input
                  type="checkbox"
                  checked={usePhaseExpenses}
                  onChange={e => handleTogglePhaseExpenses(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="relative w-10 h-6 bg-slate-300 rounded-full peer peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4" />
                <span className="text-xs font-semibold text-slate-800 whitespace-nowrap">
                  {usePhaseExpenses ? 'By Phase' : 'Flat Rate'}
                </span>
              </label>
            </div>
          </div>

          {usePhaseExpenses && (
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="text-slate-500 font-semibold text-[11px] border-b border-slate-200">
                    <th className="py-2.5 pr-4">Retirement Phase &amp; Stage</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Monthly (Today&apos;s $)</th>
                    <th className="py-2.5 pl-4 text-right whitespace-nowrap">Annual &amp; vs. Baseline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {phaseDefinitions.map(def => {
                    const monthlyVal = phaseExpenses[def.key];
                    const annualVal = monthlyVal * 12;
                    const span = phaseSpanByNum.get(def.phase);
                    const isActiveInTimeline = !years || years.length === 0 || Boolean(span);
                    const diffPct =
                      config.expenses.expDaily > 0
                        ? Math.round(((monthlyVal - config.expenses.expDaily) / config.expenses.expDaily) * 100)
                        : 0;

                    const spanText = !years || years.length === 0
                      ? null
                      : span
                        ? span.count === 1
                          ? `${span.startYear} · Age ${Math.round(span.startAge)} (1 yr)`
                          : `${span.startYear}–${span.endYear} · Ages ${Math.round(span.startAge)}–${Math.round(span.endAge)} (${span.count} yrs)`
                        : 'Not reached in current timeline';

                    return (
                      <tr
                        key={def.key}
                        className={`transition-colors hover:bg-slate-50/70 ${
                          isActiveInTimeline ? '' : 'opacity-65'
                        }`}
                      >
                        <td className="py-2.5 pr-4 align-middle">
                          <div className="font-semibold text-slate-900">
                            P{def.phase} · {def.label}
                          </div>
                          {spanText && (
                            <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                              {spanText}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 align-middle text-right">
                          <div className="w-36 ml-auto">
                            <NumericInput
                              prefix="$"
                              suffix="/mo"
                              formatWithCommas
                              min={0}
                              fallbackValue={config.expenses.expDaily}
                              value={monthlyVal}
                              onChange={val => handleUpdatePhaseAmount(def.key, val)}
                              className="w-full min-h-[40px] text-right font-mono text-sm text-slate-900 border border-slate-300 rounded-lg py-1.5 bg-white focus:border-emerald-600 focus:outline-none"
                              ariaLabel={`Monthly living expense for Phase ${def.phase} ${def.shortLabel}`}
                            />
                          </div>
                        </td>
                        <td className="py-2.5 pl-4 align-middle text-right whitespace-nowrap tabular-nums">
                          <div className="font-mono font-semibold text-slate-800">
                            {formatCurrency(annualVal)}/yr
                          </div>
                          <div
                            className={`text-[11px] font-mono ${
                              diffPct > 0
                                ? 'text-amber-700'
                                : diffPct < 0
                                  ? 'text-emerald-700'
                                  : 'text-slate-400'
                            }`}
                          >
                            {diffPct === 0
                              ? 'Matches baseline'
                              : `${diffPct > 0 ? '+' : ''}${diffPct}% vs. baseline`}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
