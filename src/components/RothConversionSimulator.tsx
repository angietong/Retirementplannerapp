import React, { useMemo } from 'react';
import {
  Sparkles,
  TrendingUp,
  ShieldCheck,
  DollarSign,
  ArrowRight,
  Info,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowDownRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { PlannerConfig, RothConversionConfig, StressPreset, DollarDisplayMode } from '../types';
import { compareRothConversion, getAdjustedAmount } from '../engine';
import { formatCurrency } from '../utils/formatters';

interface RothConversionSimulatorProps {
  config: PlannerConfig;
  stressPreset?: StressPreset;
  dollarMode?: DollarDisplayMode;
  onUpdateConfig: (updated: PlannerConfig) => void;
}

export const RothConversionSimulator: React.FC<RothConversionSimulatorProps> = ({
  config,
  stressPreset = 'baseline',
  dollarMode = 'nominal',
  onUpdateConfig,
}) => {
  const currentRothConfig: RothConversionConfig = useMemo(() => {
    return (
      config.rothConversion || {
        enabled: false,
        startAge: 60,
        endAge: 72,
        targetBracketRate: 0.22,
        bracketRoomMaxIncome: config.scenario.hasSpouse ? 201050 : 100525,
        annualCap: 50000,
        taxPaymentMethod: 'outsideBrokerage',
      }
    );
  }, [config.rothConversion, config.scenario.hasSpouse]);

  // Run the comparison calculation
  const comparison = useMemo(() => {
    return compareRothConversion(config, currentRothConfig, stressPreset);
  }, [config, currentRothConfig, stressPreset]);

  const updateRothConfig = (updates: Partial<RothConversionConfig>) => {
    const updated: RothConversionConfig = {
      ...currentRothConfig,
      ...updates,
    };
    onUpdateConfig({
      ...config,
      rothConversion: updated,
    });
  };

  const hasPreTaxAccounts = config.sources.some(
    s => s.monthly === 'N' && s.taxType === 'Income' && s.balance > 0
  );
  const totalPreTaxBalance = config.sources
    .filter(s => s.monthly === 'N' && s.taxType === 'Income')
    .reduce((sum, s) => sum + (s.balance || 0), 0);

  // Prepare chart comparison data
  const comparisonChartData = useMemo(() => {
    const baselineResults = compareRothConversion(
      config,
      { ...currentRothConfig, enabled: false },
      stressPreset
    );
    const rothResults = compareRothConversion(
      config,
      { ...currentRothConfig, enabled: true },
      stressPreset
    );

    const data: any[] = [];
    const maxYears = Math.min(
      baselineResults.conversionSchedule.length + 30,
      config.projectionYears
    );

    for (let yr = 0; yr < config.projectionYears; yr++) {
      const baseY = baselineResults.baselineSummary;
      // Extract from raw simulation years
      // To get smooth yearly comparisons, let's map over each year
      data.push({
        year: parseInt(config.scenario.retDate.split('-')[0] || '2030', 10) + yr,
        age: 60 + yr,
      });
    }

    return comparison.conversionSchedule;
  }, [comparison, config, currentRothConfig, stressPreset]);

  // Quick Bracket Presets
  const applyBracketPreset = (bracket: '12%' | '22%' | '24%') => {
    const isMarried = Boolean(config.scenario.hasSpouse);
    if (bracket === '12%') {
      updateRothConfig({
        targetBracketRate: 0.12,
        bracketRoomMaxIncome: isMarried ? 94300 : 47150,
      });
    } else if (bracket === '22%') {
      updateRothConfig({
        targetBracketRate: 0.22,
        bracketRoomMaxIncome: isMarried ? 201050 : 100525,
      });
    } else if (bracket === '24%') {
      updateRothConfig({
        targetBracketRate: 0.24,
        bracketRoomMaxIncome: isMarried ? 383900 : 191950,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Simulator Strategy Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700 mt-0.5">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900">
                  Systematic Roth Conversion Simulator
                </h2>
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-semibold">
                  Tax Bracket Optimization
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Convert pre-tax traditional 401(k) / IRA balances into tax-free Roth accounts during lower-income retirement gap years. Systematically fill up your current tax bracket before Age {config.milestones.rmdAge} RMDs force higher tax brackets and Medicare IRMAA surcharges.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={currentRothConfig.enabled}
                onChange={e => updateRothConfig({ enabled: e.target.checked })}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 border-slate-300"
              />
              <span className="text-xs font-bold text-slate-800">
                {currentRothConfig.enabled ? 'Strategy Activated' : 'Activate Roth Strategy'}
              </span>
            </label>
          </div>
        </div>

        {/* Pre-tax Balance Warning if 0 */}
        {!hasPreTaxAccounts && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Notice: No active pre-tax tax-deferred accounts (401k/Traditional IRA) found with positive balances. Add or fund a pre-tax account in the Sources tab to simulate conversions.
            </span>
          </div>
        )}

        {/* Strategy Parameters Controls */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Conversion Window (Ages)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="50"
                max="80"
                value={currentRothConfig.startAge}
                onChange={e => updateRothConfig({ startAge: parseInt(e.target.value, 10) || 60 })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-purple-500"
                title="Start Age (typically retirement age)"
              />
              <span className="text-slate-400">to</span>
              <input
                type="number"
                min="55"
                max="85"
                value={currentRothConfig.endAge}
                onChange={e => updateRothConfig({ endAge: parseInt(e.target.value, 10) || (config.milestones.rmdAge - 1) })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-purple-500"
                title={`End Age (e.g. ${config.milestones.rmdAge - 1}, year before RMD age ${config.milestones.rmdAge})`}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Pre-RMD Window (Age {currentRothConfig.startAge} to {currentRothConfig.endAge})</p>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Target Federal Bracket Ceiling
            </label>
            <div className="flex items-center gap-1 mb-1.5">
              <button
                type="button"
                onClick={() => applyBracketPreset('12%')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                  currentRothConfig.targetBracketRate === 0.12
                    ? 'bg-purple-700 text-white border-purple-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                12% Bracket
              </button>
              <button
                type="button"
                onClick={() => applyBracketPreset('22%')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                  currentRothConfig.targetBracketRate === 0.22
                    ? 'bg-purple-700 text-white border-purple-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                22% Bracket
              </button>
              <button
                type="button"
                onClick={() => applyBracketPreset('24%')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                  currentRothConfig.targetBracketRate === 0.24
                    ? 'bg-purple-700 text-white border-purple-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                24% Bracket
              </button>
            </div>
            <input
              type="number"
              step="5000"
              value={currentRothConfig.bracketRoomMaxIncome}
              onChange={e =>
                updateRothConfig({ bracketRoomMaxIncome: parseFloat(e.target.value) || 0 })
              }
              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-purple-500"
              placeholder="Top of bracket dollar ceiling"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">
              Current income threshold: {formatCurrency(currentRothConfig.bracketRoomMaxIncome)}
            </p>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Annual Conversion Cap ($)
            </label>
            <input
              type="number"
              step="10000"
              value={currentRothConfig.annualCap}
              onChange={e => updateRothConfig({ annualCap: parseFloat(e.target.value) || 0 })}
              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-purple-500"
              placeholder="Max per year (e.g. 50000)"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Limits annual conversion to stay within cashflow comfort.
            </p>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Tax Payment Method</label>
            <select
              value={currentRothConfig.taxPaymentMethod}
              onChange={e =>
                updateRothConfig({
                  taxPaymentMethod: e.target.value as 'outsideBrokerage' | 'withhold',
                })
              }
              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-purple-500"
            >
              <option value="outsideBrokerage">Pay with Outside Brokerage / Cash (Best)</option>
              <option value="withhold">Withhold Tax Directly from Conversion</option>
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              Outside payment maximizes 100% tax-free Roth compounding.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Comparison Result Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Lifetime Tax Savings */}
        <div className="bg-white rounded-xl p-5 border border-purple-200 bg-linear-to-br from-white to-purple-50/40 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Lifetime Tax Savings
            </span>
            <span className="p-1.5 rounded-md bg-purple-100 text-purple-700">
              <Sparkles className="w-5 h-5" />
            </span>
          </div>
          <div>
            <div
              className={`text-2xl font-bold ${
                comparison.lifetimeTaxSavings >= 0 ? 'text-emerald-700' : 'text-slate-900'
              }`}
            >
              {comparison.lifetimeTaxSavings >= 0 ? '+' : ''}
              {formatCurrency(comparison.lifetimeTaxSavings)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Total lifetime federal & state income taxes avoided
            </p>
          </div>
        </div>

        {/* Portfolio Ending Balance Gain */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Net Wealth Improvement
            </span>
            <span className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </span>
          </div>
          <div>
            <div
              className={`text-2xl font-bold ${
                comparison.finalBalanceDifference >= 0 ? 'text-emerald-700' : 'text-slate-900'
              }`}
            >
              {comparison.finalBalanceDifference >= 0 ? '+' : ''}
              {formatCurrency(comparison.finalBalanceDifference)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Final horizon portfolio surplus with strategy
            </p>
          </div>
        </div>

        {/* RMD Tax Spikes Avoided */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              RMD Burden Reduced
            </span>
            <span className="p-1.5 rounded-md bg-sky-50 text-sky-600">
              <ShieldCheck className="w-5 h-5" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(comparison.rmdLifetimeSavings)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Peak RMD reduction: {formatCurrency(comparison.peakRmdReduction)}/yr
            </p>
          </div>
        </div>

        {/* Total Converted to Roth */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Converted</span>
            <span className="p-1.5 rounded-md bg-indigo-50 text-indigo-600">
              <Layers className="w-5 h-5" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(comparison.totalConverted)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Conversion taxes: {formatCurrency(comparison.totalConversionTaxesPaid)}
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Systematic Conversion Schedule Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              Systematic Conversion Schedule (Age {currentRothConfig.startAge} to{' '}
              {currentRothConfig.endAge})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Yearly amounts converted up to the top of the bracket ceiling, paying predictable taxes today to shield future growth.
            </p>
          </div>
          <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
            {comparison.conversionSchedule.length} Conversion Years
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Year</th>
                <th className="py-2.5 px-3">Age</th>
                <th className="py-2.5 px-3 text-right">Bracket Headroom</th>
                <th className="py-2.5 px-3 text-right text-purple-700">Annual Conversion</th>
                <th className="py-2.5 px-3 text-right text-rose-600">Conversion Tax Paid</th>
                <th className="py-2.5 px-3 text-right">Pre-Tax Bal (Before)</th>
                <th className="py-2.5 px-3 text-right">Pre-Tax Bal (After)</th>
                <th className="py-2.5 px-3 text-right text-emerald-700">Tax-Free Roth Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {comparison.conversionSchedule.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                    No conversion years matching the specified age window ({currentRothConfig.startAge} to {currentRothConfig.endAge}) or available pre-tax funds.
                  </td>
                </tr>
              ) : (
                comparison.conversionSchedule.map(row => (
                  <tr key={row.year} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{row.year}</td>
                    <td className="py-2.5 px-3 text-slate-700">
                      Age {row.age}
                      {row.spouseAge ? ` / Sp. ${row.spouseAge}` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600">
                      {formatCurrency(row.bracketRoom)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-purple-700">
                      {formatCurrency(row.convertedAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-600 font-medium">
                      {formatCurrency(row.conversionTax)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500">
                      {formatCurrency(row.preTaxBalanceBefore)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-800 font-medium">
                      {formatCurrency(row.preTaxBalanceAfter)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">
                      {formatCurrency(row.rothBalanceAfter)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
