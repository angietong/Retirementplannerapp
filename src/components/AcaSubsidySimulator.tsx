import React, { useMemo } from 'react';
import {
  ShieldCheck,
  HeartPulse,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Calendar,
  Layers,
  HelpCircle,
  ArrowRight,
  Info,
  Sparkles,
} from 'lucide-react';
import {
  PlannerConfig,
  StressPreset,
  DollarDisplayMode,
  AcaOptimizationConfig,
  AcaFplPreset,
} from '../types';
import { compareAcaOptimization, isSourceCash, isSourceRoth } from '../engine';
import { ACA_FPL_BASE, getAcaFplLimit } from '../defaultData';
import { formatCurrency } from '../utils/formatters';

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

  const defaultHouseholdSize: 1 | 2 = hasSpouse ? 2 : 1;
  const acaConfig: AcaOptimizationConfig = useMemo(() => {
    return (
      config.acaOptimization || {
        enabled: false,
        preset: 'fpl400',
        householdSize: defaultHouseholdSize,
        customMagilimit: hasSpouse ? 84600 : 62600,
        targetMagilimit: hasSpouse ? 84600 : 62600,
        unsubsidizedAnnualPremium: config.expenses.expMedPremium * 12 > 0 ? config.expenses.expMedPremium * 12 : (hasSpouse ? 21600 : 13200),
        endAge: config.milestones.medicareAge || 65,
        prioritizeCashBeforeRoth: true,
        adjustMedicalExpensesWithSubsidy: false,
      }
    );
  }, [config.acaOptimization, defaultHouseholdSize, hasSpouse, config.expenses.expMedPremium, config.milestones.medicareAge]);

  const comparison = useMemo(() => {
    return compareAcaOptimization(config, acaConfig, stressPreset);
  }, [config, acaConfig, stressPreset]);

  const updateAcaConfig = (partial: Partial<AcaOptimizationConfig>) => {
    const updated = { ...acaConfig, ...partial };
    // Recalculate targetMagilimit if preset or householdSize changed
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

  const getDeflator = (calYear: number) => {
    if (dollarMode === 'nominal') return 1;
    const [retYearStr] = (config.scenario?.retDate || '2030-07-01').split('-');
    const retYear = parseInt(retYearStr, 10) || 2030;
    const yr = Math.max(0, calYear - retYear);
    return Math.pow(1 + config.rates.inflationRate, yr);
  };

  const baseFplAmount = ACA_FPL_BASE[acaConfig.householdSize] || 21150;

  // Find non-AGI liquid balance available in portfolio today
  const nonAgiTotalBalance = useMemo(() => {
    return config.sources
      .filter(s => s.monthly === 'N' && (s.taxType === 'N/a' || isSourceCash(s) || isSourceRoth(s)))
      .reduce((sum, s) => sum + (s.balance || 0), 0);
  }, [config.sources]);

  const preTaxTotalBalance = useMemo(() => {
    return config.sources
      .filter(s => s.monthly === 'N' && s.taxType === 'Income')
      .reduce((sum, s) => sum + (s.balance || 0), 0);
  }, [config.sources]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Header Card */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <HeartPulse className="w-3.5 h-3.5 text-emerald-400" />
              ACA Medical Insurance Subsidy Bridge
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              Pre-Medicare Healthcare Subsidy Optimization
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Before Medicare begins at age 65, early retirees purchasing Affordable Care Act (ACA) health insurance
              qualify for substantial Premium Tax Credits if Adjusted Gross Income (AGI/MAGI) remains below the subsidy cliff.
              This strategy limits withdrawals from taxable accounts and uses non-AGI sources (Cash and Roth) to preserve thousands of dollars in annual health premium subsidies.
            </p>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
            <button
              onClick={() => updateAcaConfig({ enabled: !acaConfig.enabled })}
              className={`inline-flex items-center gap-2.5 px-5 py-3 rounded-xl font-bold text-sm shadow-md transition-all ${
                acaConfig.enabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40 ring-2 ring-emerald-400'
                  : 'bg-white/10 hover:bg-white/20 text-slate-200 border border-white/20'
              }`}
            >
              <ShieldCheck className={`w-5 h-5 ${acaConfig.enabled ? 'text-white' : 'text-slate-400'}`} />
              <span>
                {acaConfig.enabled ? 'ACA Subsidy Optimization: ACTIVE' : 'Enable ACA Subsidy Drawdown'}
              </span>
            </button>
            <div className="text-xs text-slate-400">
              {acaConfig.enabled ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  AGI-capped drawdown active for ages &lt; {acaConfig.endAge}
                </span>
              ) : (
                <span>Standard priority sequence active (unconstrained AGI)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Control Panel & Inputs */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">ACA Subsidy Parameters & Target Threshold</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            2025/2026 Federal Poverty Level (FPL): {formatCurrency(baseFplAmount)} ({acaConfig.householdSize}-Person Household)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Target AGI / FPL Preset */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Subsidy Qualifying Threshold (Target AGI)
            </label>
            <select
              value={acaConfig.preset}
              onChange={e => updateAcaConfig({ preset: e.target.value as AcaFplPreset })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            >
              <option value="fpl400">
                400% FPL Cliff ({formatCurrency(baseFplAmount * 4)}) &bull; Standard Subsidy Cap
              </option>
              <option value="fpl300">
                300% FPL Benchmark ({formatCurrency(baseFplAmount * 3)}) &bull; Higher PTC Credit
              </option>
              <option value="fpl250">
                250% FPL Sweet Spot ({formatCurrency(baseFplAmount * 2.5)}) &bull; Cost-Sharing Silver
              </option>
              <option value="fpl200">
                200% FPL Low Premium ({formatCurrency(baseFplAmount * 2)}) &bull; Ultra-Low Premium
              </option>
              <option value="custom">Custom Dollar AGI Limit...</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Active Target AGI Limit: <strong className="text-slate-800">{formatCurrency(acaConfig.targetMagilimit)}</strong>
            </p>
          </div>

          {/* Custom Dollar Limit (if selected) or Household Size */}
          {acaConfig.preset === 'custom' ? (
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Custom Target Annual MAGI ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 font-bold">$</span>
                <input
                  type="number"
                  step="1000"
                  value={acaConfig.customMagilimit ?? acaConfig.targetMagilimit}
                  onChange={e => updateAcaConfig({ customMagilimit: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Withdrawals from pre-tax accounts will be capped to keep AGI under this dollar amount.
              </p>
            </div>
          ) : (
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Household Tax Filing Status
              </label>
              <select
                value={acaConfig.householdSize}
                onChange={e => updateAcaConfig({ householdSize: parseInt(e.target.value, 10) as 1 | 2 })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              >
                <option value={2}>Married Filing Jointly (2 Persons)</option>
                <option value={1}>Single Tax Return (1 Person)</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                FPL is {formatCurrency(baseFplAmount)}. 400% cliff is {formatCurrency(baseFplAmount * 4)}.
              </p>
            </div>
          )}

          {/* Unsubsidized Health Premium Estimate */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Unsubsidized Pre-65 Annual Premium ($/yr)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 font-bold">$</span>
              <input
                type="number"
                step="600"
                value={acaConfig.unsubsidizedAnnualPremium}
                onChange={e => updateAcaConfig({ unsubsidizedAnnualPremium: parseFloat(e.target.value) || 0 })}
                className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Private coverage cost without subsidy (~{formatCurrency(acaConfig.unsubsidizedAnnualPremium / 12)}/mo).
            </p>
          </div>

          {/* Non-AGI Drawdown Preference & End Age */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Non-AGI Bridge Account Preference
            </label>
            <select
              value={acaConfig.prioritizeCashBeforeRoth !== false ? 'cashFirst' : 'rothFirst'}
              onChange={e => updateAcaConfig({ prioritizeCashBeforeRoth: e.target.value === 'cashFirst' })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            >
              <option value="cashFirst">Cash & Savings First &rarr; then Roth</option>
              <option value="rothFirst">Roth Accounts First &rarr; then Cash</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Available Non-AGI reserves: <strong className="text-emerald-700">{formatCurrency(nonAgiTotalBalance)}</strong>
            </p>
          </div>

          {/* Reinvest Subsidy Savings */}
          <div className="md:col-span-3 pt-3 border-t border-slate-100">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(acaConfig.adjustMedicalExpensesWithSubsidy)}
                onChange={e => updateAcaConfig({ adjustMedicalExpensesWithSubsidy: e.target.checked })}
                className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
              <div>
                <span className="text-xs font-semibold text-slate-800">
                  Credit Subsidy Savings to Portfolio (Reinvest Healthcare Credits)
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  When enabled, annual ACA premium tax credits are directly credited to your portfolio cash reserve, so subsidy savings compound and preserve portfolio longevity.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Key Results KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Subsidies Saved */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Subsidies Saved
            </span>
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-600">
              {formatCurrency(comparison.totalSubsidiesSaved)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Cumulative health insurance premium credits earned before age {acaConfig.endAge}.
          </p>
        </div>

        {/* Years Subsidized */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pre-Medicare Years Subsidized
            </span>
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {comparison.preMedicareYearsSubsidized} of {comparison.totalPreMedicareYears}
            </span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {comparison.totalPreMedicareYears > 0
                ? `${Math.round((comparison.preMedicareYearsSubsidized / comparison.totalPreMedicareYears) * 100)}%`
                : 'N/A'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Years where household MAGI stayed under the {formatCurrency(acaConfig.targetMagilimit)} cap (inflated annually with CPI-U).
          </p>
        </div>

        {/* Pre-Tax Withdrawals Shielded */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pre-Tax Draws Shielded
            </span>
            <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-purple-700">
              {formatCurrency(comparison.preTaxDrawsDeferredToNonAgi)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Tax-deferred distributions deferred and funded with Cash/Roth to protect the subsidy.
          </p>
        </div>

        {/* Final Net Portfolio Impact */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Net Portfolio Benefit
            </span>
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-extrabold ${
                comparison.finalBalanceDifference >= 0 ? 'text-emerald-600' : 'text-slate-800'
              }`}
            >
              {comparison.finalBalanceDifference >= 0 ? '+' : ''}
              {formatCurrency(comparison.finalBalanceDifference)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Difference in terminal net worth vs. drawing pre-tax without ACA constraints.
          </p>
        </div>
      </div>

      {/* Comparative Analysis: Baseline vs ACA Optimization */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          Comparative Strategy Breakdown: Baseline Priority vs. ACA-Optimized Drawdown
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Baseline Card */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Unconstrained Baseline Drawdown
              </span>
              <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-medium">
                Standard Priority
              </span>
            </div>

            <p className="text-slate-600 leading-relaxed">
              In the standard plan, living expenses are drawn primarily from tax-deferred 401(k) and IRA accounts
              because they occupy the top liquidation priorities. This produces high annual AGI ({formatCurrency(90000)} - {formatCurrency(130000)}/yr),
              exceeding the ACA 400% FPL subsidy cliff.
            </p>

            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Average Pre-Medicare AGI:</span>
                {(() => {
                  const avgBase =
                    comparison.schedule.length > 0
                      ? comparison.schedule.reduce((acc, s) => acc + s.baselineMagi, 0) / comparison.schedule.length
                      : 0;
                  const avgLimit =
                    comparison.schedule.length > 0
                      ? comparison.schedule.reduce((acc, s) => acc + s.targetLimit, 0) / comparison.schedule.length
                      : acaConfig.targetMagilimit;
                  const exceeds = avgBase > avgLimit;
                  return (
                    <span className={`font-semibold ${exceeds ? 'text-red-600' : 'text-slate-800'}`}>
                      {formatCurrency(avgBase)}/yr ({exceeds ? 'Exceeds Cap' : 'Under Cap'})
                    </span>
                  );
                })()}
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pre-Medicare Health Subsidies Received:</span>
                <span className="font-bold text-slate-800">
                  {comparison.baselineSummary.totalAcaSubsidiesSaved && comparison.baselineSummary.totalAcaSubsidiesSaved > 0
                    ? formatCurrency(comparison.baselineSummary.totalAcaSubsidiesSaved)
                    : '$0 (100% Out-of-Pocket)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Lifetime Taxes Paid:</span>
                <span className="font-semibold text-slate-800">
                  {formatCurrency(comparison.baselineSummary.totalTaxesPaid)}
                </span>
              </div>
            </div>
          </div>

          {/* ACA-Optimized Card */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
              <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                ACA-Optimized Drawdown Plan
              </span>
              <span className="text-[11px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold">
                Subsidy Preserved
              </span>
            </div>

            <p className="text-emerald-900 leading-relaxed">
              Tax-deferred withdrawals are deliberately capped each year up to the target AGI limit ({formatCurrency(acaConfig.targetMagilimit)}).
              The remaining budget is bridged by tapping liquid Non-AGI accounts (Cash and Roth), keeping MAGI under the cliff and qualifying for maximum premium tax credits.
            </p>

            <div className="bg-white p-3 rounded-lg border border-emerald-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Average Pre-Medicare AGI:</span>
                {(() => {
                  const avgAca =
                    comparison.schedule.length > 0
                      ? comparison.schedule.reduce((acc, s) => acc + s.acaMagi, 0) / comparison.schedule.length
                      : 0;
                  const avgLimit =
                    comparison.schedule.length > 0
                      ? comparison.schedule.reduce((acc, s) => acc + s.targetLimit, 0) / comparison.schedule.length
                      : acaConfig.targetMagilimit;
                  const isUnder = avgAca <= avgLimit;
                  return (
                    <span className={`font-semibold ${isUnder ? 'text-emerald-700' : 'text-amber-800'}`}>
                      {formatCurrency(avgAca)}/yr ({isUnder ? 'Under Cap' : 'Over Cap'})
                    </span>
                  );
                })()}
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Pre-Medicare Subsidies Saved:</span>
                <span className="font-extrabold text-emerald-600">
                  +{formatCurrency(comparison.totalSubsidiesSaved)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Terminal Portfolio Difference:</span>
                <span className="font-bold text-emerald-700">
                  {comparison.finalBalanceDifference >= 0 ? '+' : ''}
                  {formatCurrency(comparison.finalBalanceDifference)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Year-by-Year Pre-Medicare ACA Bridge Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-emerald-600" />
              Pre-Medicare Year-by-Year ACA Bridge Schedule
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing income breakdown, MAGI comparison, and subsidy tax credit qualifications until Medicare starts at age {acaConfig.endAge}.
            </p>
          </div>
          <div className="text-xs text-slate-600 bg-white px-3 py-1 rounded-md border border-slate-200">
            Base Cap: <strong className="text-slate-900">{formatCurrency(acaConfig.targetMagilimit)}</strong> (inflates annually)
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">Year</th>
                <th className="py-3 px-3">{hasSpouse ? `${primaryName} Age` : 'Age'}</th>
                {hasSpouse && <th className="py-3 px-3">{spouseName} Age</th>}
                <th className="py-3 px-3 text-right">Guaranteed/Salary</th>
                <th className="py-3 px-3 text-right">Pre-Tax (401k/IRA)</th>
                <th className="py-3 px-3 text-right">Non-AGI (Cash/Roth)</th>
                <th className="py-3 px-3 text-right font-bold text-slate-900">Total ACA MAGI</th>
                <th className="py-3 px-3 text-right" title="Target MAGI cap projected with annual general inflation (CPI-U)">Target Limit (Inflated)</th>
                <th className="py-3 px-3 text-center">Subsidy Status</th>
                <th className="py-3 px-3 text-right font-bold text-emerald-700">Subsidy Saved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {comparison.schedule.length === 0 ? (
                <tr>
                  <td colSpan={hasSpouse ? 10 : 9} className="py-6 text-center text-slate-500 font-sans text-xs">
                    No pre-Medicare retirement years detected in current scenario horizon (Primary/Spouse are already age {acaConfig.endAge}+ at retirement).
                  </td>
                </tr>
              ) : (
                comparison.schedule.map(s => {
                  const deflator = getDeflator(s.year);
                  const guarAdj = s.salaryAndGuaranteed / deflator;
                  const preTaxAdj = s.preTaxWd / deflator;
                  const nonAgiAdj = s.nonAgiWd / deflator;
                  const magiAdj = s.acaMagi / deflator;
                  const limitAdj = s.targetLimit / deflator;
                  const subsidyAdj = s.subsidySavings / deflator;

                  return (
                    <tr
                      key={s.year}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        s.qualified ? 'bg-emerald-50/20' : 'bg-amber-50/30'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-semibold text-slate-900 font-sans">{s.year}</td>
                      <td className="py-2.5 px-3 text-slate-600 font-sans">{s.age.toFixed(1)}</td>
                      {hasSpouse && (
                        <td className="py-2.5 px-3 text-slate-600 font-sans">
                          {s.spouseAge !== undefined ? s.spouseAge.toFixed(1) : '—'}
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {guarAdj > 0 ? formatCurrency(guarAdj) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-purple-700 font-medium">
                        {preTaxAdj > 0 ? formatCurrency(preTaxAdj) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-700 font-medium">
                        {nonAgiAdj > 0 ? formatCurrency(nonAgiAdj) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {formatCurrency(magiAdj)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">
                        {formatCurrency(limitAdj)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        {s.phase0IncomeOverride ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-full"
                            title="Partial worked year wages and living withdrawals exceeded the ACA limit. High-priority tax-deferred accounts were tapped for living income, preserving Cash & Roth reserves for future subsidy years."
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-700" />
                            PHASE 0: PRE-TAX INCOME
                          </span>
                        ) : s.qualified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            QUALIFIED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3 text-slate-500" />
                            OVER LIMIT
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
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

      {/* Strategic Rules & Pro Tips */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 text-xs text-slate-700 space-y-3">
        <h4 className="font-bold text-slate-900 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-emerald-600" />
          Strategic Best Practices for ACA Subsidy Planning
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-slate-600">
          <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900 block">1. The "ACA Bridge" Concept</span>
            <p className="leading-relaxed text-[11px]">
              Between retirement and Medicare at 65, private health insurance is costly.
              Using Cash reserves and Roth accounts as a bridge allows you to live comfortably while reporting low taxable AGI.
            </p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900 block">2. Why Draw Pre-Tax Income?</span>
            <p className="leading-relaxed text-[11px]">
              You do not need $0 of AGI! Drawing pre-tax money up to the ACA threshold (e.g. $84,600 for a couple) allows you to pay low
              income tax (standard deduction + 10%–12% brackets) without losing health subsidies.
            </p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900 block">3. Coordinating Roth Conversions</span>
            <p className="leading-relaxed text-[11px]">
              When ACA optimization is enabled, the simulator automatically holds systematic Roth conversions below your target AGI ceiling
              to prevent accidental subsidy disqualification until Medicare kicks in at age 65.
            </p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-amber-200 bg-amber-50/50 space-y-1">
            <span className="font-bold text-amber-950 block">4. Phase 0 Transition Year</span>
            <p className="leading-relaxed text-[11px] text-amber-900">
              When partial-year earned wages and living expense withdrawals exceed the ACA limit, the planner taps high-priority tax-deferred accounts for living income
              instead of burning cash/Roth, preserving non-AGI assets for full retirement years.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
