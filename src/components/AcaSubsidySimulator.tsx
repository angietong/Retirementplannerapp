import React, { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  PlannerConfig,
  StressPreset,
  DollarDisplayMode,
  AcaOptimizationConfig,
  AcaFplPreset,
} from '../types';
import { compareAcaOptimization, isSourceCash, isSourceRoth, resolveAcaCreditAccount } from '../engine';
import { ACA_FPL_BASE, getAcaFplLimit } from '../defaultData';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatters';
import { NumericInput } from './NumericInput';

interface AcaSubsidySimulatorProps {
  config: PlannerConfig;
  stressPreset: StressPreset;
  dollarMode?: DollarDisplayMode;
  onUpdateConfig: (updated: PlannerConfig) => void;
}

export const AcaSubsidySimulator: React.FC<AcaSubsidySimulatorProps> = ({
  config,
  stressPreset,
  dollarMode = 'nominal',
  onUpdateConfig,
}) => {
  const hasSpouse = Boolean(config.scenario?.hasSpouse);
  const primaryName = (config.scenario?.userName || 'Primary').split(' ')[0] || 'Primary';
  const spouseName = (config.scenario?.spouseName || 'Spouse').split(' ')[0] || 'Spouse';
  const valuationLabel = dollarMode === 'real' ? "Today's $" : 'Nominal $';

  const defaultHouseholdSize: 1 | 2 = hasSpouse ? 2 : 1;
  const acaConfig: AcaOptimizationConfig = useMemo(() => {
    return (
      config.acaOptimization || {
        enabled: false,
        preset: 'fpl400',
        householdSize: defaultHouseholdSize,
        customMagilimit: hasSpouse ? 84600 : 62600,
        targetMagilimit: hasSpouse ? 84600 : 62600,
        unsubsidizedAnnualPremium:
          config.expenses.expMedPremium * 12 > 0
            ? config.expenses.expMedPremium * 12
            : hasSpouse
            ? 21600
            : 13200,
        endAge: config.milestones.medicareAge || 65,
        prioritizeCashBeforeRoth: true,
        adjustMedicalExpensesWithSubsidy: true,
      }
    );
  }, [config.acaOptimization, defaultHouseholdSize, hasSpouse, config.expenses.expMedPremium, config.milestones.medicareAge]);

  const depletingAccounts = useMemo(() => {
    return config.sources
      .filter(s => s.monthly === 'N')
      .sort((a, b) => {
        const aCash = isSourceCash(a) ? 0 : a.taxType === 'Capital Gain' || a.accountType === 'brokerage' ? 1 : 2;
        const bCash = isSourceCash(b) ? 0 : b.taxType === 'Capital Gain' || b.accountType === 'brokerage' ? 1 : 2;
        if (aCash !== bCash) return aCash - bCash;
        return a.priority - b.priority;
      });
  }, [config.sources]);

  const resolvedCreditAcct = useMemo(
    () => resolveAcaCreditAccount(config.sources, acaConfig),
    [config.sources, acaConfig]
  );
  const selectedCreditValue =
    acaConfig.adjustMedicalExpensesWithSubsidy === false || acaConfig.creditAccountId === '__none__'
      ? '__none__'
      : resolvedCreditAcct?.id || '__none__';

  const comparison = useMemo(() => {
    return compareAcaOptimization(config, acaConfig, stressPreset);
  }, [config, acaConfig, stressPreset]);

  const updateAcaConfig = (partial: Partial<AcaOptimizationConfig>) => {
    const updated = { ...acaConfig, ...partial };
    if (partial.preset !== undefined || partial.householdSize !== undefined || partial.customMagilimit !== undefined) {
      const preset = partial.preset ?? updated.preset;
      const hSize = partial.householdSize ?? updated.householdSize;
      const customVal = partial.customMagilimit ?? updated.customMagilimit;
      updated.targetMagilimit = getAcaFplLimit(hSize, preset, customVal);
    }
    onUpdateConfig({
      ...config,
      acaOptimization: updated,
    });
  };

  const getRowDeflator = (cumInflation?: number, calYear?: number) => {
    if (dollarMode === 'nominal') return 1;
    if (cumInflation && cumInflation > 0) return cumInflation;
    const [retYearStr] = (config.scenario?.retDate || '2030-07-01').split('-');
    const retYear = parseInt(retYearStr, 10) || 2030;
    const yr = calYear !== undefined ? Math.max(0, calYear - retYear) : 0;
    return Math.pow(1 + config.rates.inflationRate, yr);
  };

  const displayMetrics = useMemo(() => {
    if (dollarMode === 'nominal') {
      return {
        totalSubsidiesSaved: comparison.totalSubsidiesSaved,
        preTaxDrawsDeferredToNonAgi: comparison.preTaxDrawsDeferredToNonAgi,
        finalBalanceDifference: comparison.finalBalanceDifference,
      };
    }

    const baseYears = comparison.baselineYears || [];
    const acaYears = comparison.acaYears || [];
    const defOf = (yr: number, cumInf?: number) => {
      const d = cumInf ?? Math.pow(1 + config.rates.inflationRate, yr);
      return d > 0 ? d : 1;
    };

    const totalSubsidiesSaved = comparison.schedule.reduce(
      (sum, s) => sum + s.subsidySavings / getRowDeflator(s.cumGeneralInflation, s.year),
      0
    );

    let preTaxDrawsDeferredToNonAgi = 0;
    comparison.schedule.forEach(s => {
      const baseY = baseYears.find(b => b.calYear === s.year);
      const acaY = acaYears.find(a => a.calYear === s.year);
      if (baseY && acaY) {
        const baseTd = Object.entries(baseY.withdrawalsBySource || {})
          .filter(([id]) => {
            const src = config.sources.find(x => x.id === id);
            return src && src.monthly === 'N' && (src.accountType === '401k' || src.accountType === 'ira' || (!src.accountType && src.taxType === 'Income'));
          })
          .reduce((acc, [, v]) => acc + v, 0);
        const diff = Math.max(0, baseTd - s.preTaxWd);
        preTaxDrawsDeferredToNonAgi += diff / getRowDeflator(s.cumGeneralInflation, s.year);
      }
    });

    const lastBase = baseYears[baseYears.length - 1];
    const lastAca = acaYears[acaYears.length - 1];
    const finalDef = defOf(
      lastAca?.yr ?? config.projectionYears - 1,
      lastAca?.cumGeneralInflation ?? lastBase?.cumGeneralInflation
    );
    const finalBalanceDifference =
      ((lastAca?.combEndBal ?? comparison.acaSummary.finalBalance) -
        (lastBase?.combEndBal ?? comparison.baselineSummary.finalBalance)) /
      finalDef;

    return {
      totalSubsidiesSaved,
      preTaxDrawsDeferredToNonAgi,
      finalBalanceDifference,
    };
  }, [comparison, dollarMode, config.rates.inflationRate, config.projectionYears, config.sources]);

  const baseFplAmount = ACA_FPL_BASE[acaConfig.householdSize] || 21150;

  const nonAgiTotalBalance = useMemo(() => {
    return config.sources
      .filter(s => s.monthly === 'N' && (s.taxType === 'N/a' || isSourceCash(s) || isSourceRoth(s)))
      .reduce((sum, s) => sum + (s.balance || 0), 0);
  }, [config.sources]);

  // Chart data showing MAGI composition vs ACA Cliff limit
  const acaChartData = useMemo(() => {
    return comparison.schedule.map(s => {
      const def = getRowDeflator(s.cumGeneralInflation, s.year);
      return {
        year: s.year,
        'Salary & Guaranteed': Math.round(s.salaryAndGuaranteed / def),
        'Pre-Tax Draw (AGI)': Math.round(s.preTaxWd / def),
        'Non-AGI Bridge (Cash/Roth)': Math.round(s.nonAgiWd / def),
        'ACA MAGI Cap': Math.round(s.targetLimit / def),
      };
    });
  }, [comparison.schedule, dollarMode, config.rates.inflationRate]);

  return (
    <div className="space-y-6">
      {/* Unified Light Strategy Header & Controls Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="max-w-2xl">
            <h2 className="text-base font-bold text-slate-900">
              Pre-Medicare ACA Healthcare Subsidy Bridge
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
              Before Medicare begins at age {acaConfig.endAge}, capping taxable withdrawals below the ACA subsidy threshold and bridging remaining living costs with Cash or Roth reserves unlocks substantial federal Premium Tax Credits.
            </p>
          </div>

          <label className="inline-flex items-center gap-3 cursor-pointer select-none px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 transition-colors shrink-0">
            <input
              type="checkbox"
              checked={acaConfig.enabled}
              onChange={e => updateAcaConfig({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="relative w-10 h-6 bg-slate-300 rounded-full peer peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4" />
            <span className="text-xs font-semibold text-slate-900 whitespace-nowrap">
              {acaConfig.enabled ? 'ACA Bridge Active' : 'Enable in Main Plan'}
            </span>
          </label>
        </div>

        {/* Parameters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Target MAGI Threshold
            </label>
            <select
              value={acaConfig.preset}
              onChange={e => updateAcaConfig({ preset: e.target.value as AcaFplPreset })}
              className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:border-emerald-600 focus:outline-none"
            >
              <option value="fpl400">400% FPL ({formatCurrency(baseFplAmount * 4)})</option>
              <option value="fpl300">300% FPL ({formatCurrency(baseFplAmount * 3)})</option>
              <option value="fpl250">250% FPL ({formatCurrency(baseFplAmount * 2.5)})</option>
              <option value="fpl200">200% FPL ({formatCurrency(baseFplAmount * 2)})</option>
              <option value="custom">Custom Dollar Limit...</option>
            </select>
            <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
              Base cap: <strong className="text-slate-700">{formatCurrency(acaConfig.targetMagilimit)}</strong> (inflates with CPI)
            </p>
          </div>

          {acaConfig.preset === 'custom' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Custom Annual MAGI Cap
              </label>
              <NumericInput
                prefix="$"
                formatWithCommas
                min={0}
                step={1000}
                value={acaConfig.customMagilimit ?? acaConfig.targetMagilimit}
                fallbackValue={acaConfig.targetMagilimit}
                onChange={val => updateAcaConfig({ customMagilimit: val })}
                className="w-full min-h-[40px] border border-slate-300 rounded-lg pr-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
              <p className="text-xs text-slate-500 mt-1.5">Pre-tax withdrawals stop at this limit.</p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tax Filing Household Size
              </label>
              <select
                value={acaConfig.householdSize}
                onChange={e => updateAcaConfig({ householdSize: parseInt(e.target.value, 10) as 1 | 2 })}
                className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:border-emerald-600 focus:outline-none"
              >
                <option value={2}>Married Filing Jointly (2)</option>
                <option value={1}>Single Filer (1)</option>
              </select>
              <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
                100% FPL baseline: {formatCurrency(baseFplAmount)}
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Unsubsidized Annual Premium
            </label>
            <NumericInput
              prefix="$"
              formatWithCommas
              min={0}
              step={600}
              value={acaConfig.unsubsidizedAnnualPremium}
              fallbackValue={hasSpouse ? 21600 : 13200}
              onChange={val => updateAcaConfig({ unsubsidizedAnnualPremium: val })}
              className="w-full min-h-[40px] border border-slate-300 rounded-lg pr-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
            <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
              ~{formatCurrency(acaConfig.unsubsidizedAnnualPremium / 12)}/mo before credits
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Non-AGI Bridge Order
            </label>
            <select
              value={acaConfig.prioritizeCashBeforeRoth !== false ? 'cashFirst' : 'rothFirst'}
              onChange={e => updateAcaConfig({ prioritizeCashBeforeRoth: e.target.value === 'cashFirst' })}
              className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:border-emerald-600 focus:outline-none"
            >
              <option value="cashFirst">Cash &amp; Savings &rarr; Roth</option>
              <option value="rothFirst">Roth Accounts &rarr; Cash</option>
            </select>
            <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
              Non-AGI reserves: <strong className="text-emerald-700">{formatCurrency(nonAgiTotalBalance)}</strong>
            </p>
          </div>

          {/* Credit Back Account */}
          <div className="md:col-span-2 lg:col-span-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="sm:w-1/2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Deposit Earned Subsidy Credits Into
              </label>
              <select
                value={selectedCreditValue}
                onChange={e => {
                  const val = e.target.value;
                  if (val === '__none__') {
                    updateAcaConfig({ adjustMedicalExpensesWithSubsidy: false, creditAccountId: '__none__' });
                  } else {
                    updateAcaConfig({ adjustMedicalExpensesWithSubsidy: true, creditAccountId: val });
                  }
                }}
                className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:border-emerald-600 focus:outline-none"
              >
                {depletingAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} {isSourceCash(acc) ? '(Cash / Savings — Recommended)' : `(${acc.taxType})`}
                  </option>
                ))}
                <option value="__none__">Track only — do not credit back to portfolio</option>
              </select>
            </div>
            <p className="text-xs text-slate-500 sm:w-1/2 pb-1">
              {resolvedCreditAcct
                ? `Qualified ACA credits compound inside ${resolvedCreditAcct.name} each pre-Medicare year.`
                : 'Subsidy savings are displayed below for reference without altering account balances.'}
            </p>
          </div>
        </div>
      </div>

      {/* 4 Clean KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="text-xs font-medium text-slate-500">Total Subsidies Saved ({valuationLabel})</div>
          <div className="text-2xl font-bold text-emerald-700 tabular-nums mt-2">
            {formatCurrency(displayMetrics.totalSubsidiesSaved)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Cumulative credits earned before age {acaConfig.endAge}</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="text-xs font-medium text-slate-500">Pre-Medicare Years Subsidized</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-2">
            {comparison.preMedicareYearsSubsidized} of {comparison.totalPreMedicareYears}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {comparison.totalPreMedicareYears > 0
              ? `${Math.round((comparison.preMedicareYearsSubsidized / comparison.totalPreMedicareYears) * 100)}% of pre-Medicare horizon qualified`
              : 'Already Medicare eligible'}
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="text-xs font-medium text-slate-500">Pre-Tax Draws Shielded</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-2">
            {formatCurrency(displayMetrics.preTaxDrawsDeferredToNonAgi)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Bridged with Non-AGI Cash / Roth reserves</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="text-xs font-medium text-slate-500">Net Ending Wealth Benefit</div>
          <div
            className={`text-2xl font-bold tabular-nums mt-2 ${
              displayMetrics.finalBalanceDifference >= 0 ? 'text-emerald-700' : 'text-slate-900'
            }`}
          >
            {displayMetrics.finalBalanceDifference >= 0 ? '+' : ''}
            {formatCurrency(displayMetrics.finalBalanceDifference)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Terminal balance vs. unconstrained withdrawals</p>
        </div>
      </div>

      {/* Visual ACA Bridge Chart: MAGI vs Cliff Cap */}
      {acaChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">
              Pre-Medicare Funding Mix vs. ACA MAGI Cap ({valuationLabel})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Taxable income (Salary + Pre-Tax Draws) stays below the dashed ACA limit while Non-AGI Cash/Roth bridges the remainder.
            </p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={acaChartData} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                <YAxis tickFormatter={formatCurrencyCompact} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} width={58} />
                <Tooltip
                  formatter={(val: number, name: string) => [formatCurrency(val), name]}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Salary & Guaranteed" stackId="a" fill="#64748b" />
                <Bar dataKey="Pre-Tax Draw (AGI)" stackId="a" fill="#0284c7" />
                <Bar dataKey="Non-AGI Bridge (Cash/Roth)" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="ACA MAGI Cap"
                  stroke="#dc2626"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3, fill: '#dc2626' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Pre-Medicare Schedule Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Pre-Medicare ACA Bridge Schedule</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Year-by-year MAGI qualification until Medicare starts at age {acaConfig.endAge}.
            </p>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            Base cap {formatCurrency(acaConfig.targetMagilimit)} · {valuationLabel}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                <th className="py-3 px-4">Year</th>
                <th className="py-3 px-3">{hasSpouse ? primaryName : 'Age'}</th>
                {hasSpouse && <th className="py-3 px-3">{spouseName}</th>}
                <th className="py-3 px-3 text-right">Salary / Guar.</th>
                <th className="py-3 px-3 text-right">Pre-Tax Draw</th>
                <th className="py-3 px-3 text-right">Non-AGI Bridge</th>
                <th className="py-3 px-3 text-right text-slate-800">ACA MAGI</th>
                <th className="py-3 px-3 text-right">Limit</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Subsidy Saved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparison.schedule.length === 0 ? (
                <tr>
                  <td colSpan={hasSpouse ? 10 : 9} className="py-10 text-center text-slate-500 text-sm">
                    No pre-Medicare retirement years in the current scenario (already age {acaConfig.endAge}+ at retirement).
                  </td>
                </tr>
              ) : (
                comparison.schedule.map(s => {
                  const deflator = getRowDeflator(s.cumGeneralInflation, s.year);
                  const subsidyAdj = s.subsidySavings / deflator;

                  return (
                    <tr key={s.year} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-semibold text-slate-900 tabular-nums">{s.year}</td>
                      <td className="py-2.5 px-3 text-slate-600 tabular-nums">{s.age.toFixed(1)}</td>
                      {hasSpouse && (
                        <td className="py-2.5 px-3 text-slate-600 tabular-nums">
                          {s.spouseAge !== undefined ? s.spouseAge.toFixed(1) : '—'}
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                        {s.salaryAndGuaranteed > 0 ? formatCurrency(s.salaryAndGuaranteed / deflator) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                        {s.preTaxWd > 0 ? formatCurrency(s.preTaxWd / deflator) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 font-medium">
                        {s.nonAgiWd > 0 ? formatCurrency(s.nonAgiWd / deflator) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatCurrency(s.acaMagi / deflator)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">
                        {formatCurrency(s.targetLimit / deflator)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {s.phase0IncomeOverride ? (
                          <span
                            className="inline-flex items-center gap-1 text-amber-700 font-medium"
                            title="Partial-year wages exceeded the ACA limit; preserved Cash/Roth for full retirement years."
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Phase 0 Wages
                          </span>
                        ) : s.qualified ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Qualified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Over Limit
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                        {subsidyAdj > 0 ? `+${formatCurrency(subsidyAdj)}` : '$0'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
