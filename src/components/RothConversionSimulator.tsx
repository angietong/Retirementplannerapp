import React, { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Info } from 'lucide-react';
import { PlannerConfig, RothConversionConfig, StressPreset, DollarDisplayMode } from '../types';
import { compareRothConversion, isTaxDeferredSource } from '../engine';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatters';
import { NumericInput } from './NumericInput';

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
  const [chartView, setChartView] = useState<'rmd' | 'balance'>('rmd');

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

  const comparison = useMemo(() => {
    return compareRothConversion(config, currentRothConfig, stressPreset);
  }, [config, currentRothConfig, stressPreset]);

  const updateRothConfig = (updates: Partial<RothConversionConfig>) => {
    onUpdateConfig({
      ...config,
      rothConversion: {
        ...currentRothConfig,
        ...updates,
      },
    });
  };

  const hasSpouse = Boolean(config.scenario?.hasSpouse);
  const primaryName = (config.scenario?.userName || 'Primary').split(' ')[0] || 'Primary';
  const spouseName = (config.scenario?.spouseName || 'Spouse').split(' ')[0] || 'Spouse';
  const valuationLabel = dollarMode === 'real' ? "Today's $" : 'Nominal $';

  const hasPreTaxAccounts = config.sources.some(
    s => s.monthly === 'N' && isTaxDeferredSource(s) && s.balance > 0
  );

  const getYearDeflator = (yrIdx: number, cumInf?: number) => {
    if (dollarMode === 'nominal') return 1;
    const f = cumInf ?? Math.pow(1 + config.rates.inflationRate, yrIdx);
    return f > 0 ? f : 1;
  };

  const displayMetrics = useMemo(() => {
    if (dollarMode === 'nominal') {
      return {
        lifetimeTaxSavings: comparison.lifetimeTaxSavings,
        finalBalanceDifference: comparison.finalBalanceDifference,
        rmdLifetimeSavings: comparison.rmdLifetimeSavings,
        peakRmdReduction: comparison.peakRmdReduction,
        totalConverted: comparison.totalConverted,
        totalConversionTaxesPaid: comparison.totalConversionTaxesPaid,
      };
    }

    const baseYears = comparison.baselineYears || [];
    const rothYears = comparison.rothYears || [];

    const baseRealTax = baseYears.reduce(
      (sum, y) => sum + y.totalTax / getYearDeflator(y.yr, y.cumGeneralInflation),
      0
    );
    const rothRealTax = rothYears.reduce(
      (sum, y) => sum + y.totalTax / getYearDeflator(y.yr, y.cumGeneralInflation),
      0
    );

    const lastBase = baseYears[baseYears.length - 1];
    const lastRoth = rothYears[rothYears.length - 1];
    const finalDeflator = getYearDeflator(
      lastRoth?.yr ?? config.projectionYears - 1,
      lastRoth?.cumGeneralInflation ?? lastBase?.cumGeneralInflation
    );
    const finalBalanceDifference =
      ((lastRoth?.combEndBal ?? comparison.rothSummary.finalBalance) -
        (lastBase?.combEndBal ?? comparison.baselineSummary.finalBalance)) /
      finalDeflator;

    let rmdLifetimeSavings = 0;
    let peakRmdReduction = 0;
    const taxRate = config.rates.fedBracket + config.rates.stateRate;
    rothYears.forEach((y, idx) => {
      const baseY = baseYears[idx];
      const baseRmd = baseY?.rmdTotal ?? 0;
      const rothRmd = y.rmdTotal ?? 0;
      if (baseRmd > 0 || rothRmd > 0) {
        const def = getYearDeflator(y.yr, y.cumGeneralInflation);
        const rmdDiffReal = Math.max(0, baseRmd - rothRmd) / def;
        rmdLifetimeSavings += rmdDiffReal * taxRate;
        if (rmdDiffReal > peakRmdReduction) {
          peakRmdReduction = rmdDiffReal;
        }
      }
    });

    const totalConverted = comparison.conversionSchedule.reduce(
      (sum, r) => sum + r.convertedAmount / (r.cumGeneralInflation && r.cumGeneralInflation > 0 ? r.cumGeneralInflation : 1),
      0
    );
    const totalConversionTaxesPaid = comparison.conversionSchedule.reduce(
      (sum, r) => sum + r.conversionTax / (r.cumGeneralInflation && r.cumGeneralInflation > 0 ? r.cumGeneralInflation : 1),
      0
    );

    return {
      lifetimeTaxSavings: baseRealTax - rothRealTax,
      finalBalanceDifference,
      rmdLifetimeSavings,
      peakRmdReduction,
      totalConverted,
      totalConversionTaxesPaid,
    };
  }, [comparison, dollarMode, config.rates.inflationRate, config.rates.fedBracket, config.rates.stateRate, config.projectionYears]);

  // Chart data comparing Baseline vs Roth Conversion strategy
  const comparisonChartData = useMemo(() => {
    const baseYears = comparison.baselineYears || [];
    const rothYears = comparison.rothYears || [];
    return baseYears.map((by, i) => {
      const ry = rothYears[i];
      const def = getYearDeflator(by.yr, by.cumGeneralInflation);
      return {
        year: by.calYear,
        age: by.age,
        'Baseline Balance': Math.max(0, Math.round(by.combEndBal / def)),
        'With Roth Strategy': Math.max(0, Math.round((ry?.combEndBal ?? by.combEndBal) / def)),
        'Baseline RMD': Math.round((by.rmdTotal || 0) / def),
        'Roth Strategy RMD': Math.round((ry?.rmdTotal || 0) / def),
      };
    });
  }, [comparison, dollarMode, config.rates.inflationRate]);

  const rmdChartData = useMemo(() => {
    const rmdAge = config.milestones.rmdAge || 73;
    const filtered = comparisonChartData.filter(d => d.age >= rmdAge - 1 || d['Baseline RMD'] > 0 || d['Roth Strategy RMD'] > 0);
    return filtered.length > 0 ? filtered : comparisonChartData;
  }, [comparisonChartData, config.milestones.rmdAge]);

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
    } else {
      updateRothConfig({
        targetBracketRate: 0.24,
        bracketRoomMaxIncome: isMarried ? 383900 : 191950,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Strategy Header & Parameters Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="max-w-2xl">
            <h2 className="text-base font-bold text-slate-900">
              Systematic Roth Conversion Strategy
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
              Convert pre-tax 401(k) and IRA balances into tax-free Roth accounts during lower-income gap years before Age {config.milestones.rmdAge} RMDs trigger higher marginal tax brackets.
            </p>
          </div>

          <label className="inline-flex items-center gap-3 cursor-pointer select-none px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 transition-colors shrink-0">
            <input
              type="checkbox"
              checked={currentRothConfig.enabled}
              onChange={e => updateRothConfig({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="relative w-10 h-6 bg-slate-300 rounded-full peer peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4" />
            <span className="text-xs font-semibold text-slate-900 whitespace-nowrap">
              {currentRothConfig.enabled ? 'Strategy Active' : 'Enable in Main Plan'}
            </span>
          </label>
        </div>

        {!hasPreTaxAccounts && (
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              No pre-tax 401(k) or Traditional IRA accounts with positive balances were found. Fund a pre-tax account under Accounts &amp; Income to model conversions.
            </span>
          </div>
        )}

        {/* Strategy Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Conversion Window (Ages)
            </label>
            <div className="flex items-center gap-2">
              <NumericInput
                integer
                min={30}
                max={85}
                value={currentRothConfig.startAge}
                fallbackValue={60}
                onChange={val => updateRothConfig({ startAge: val })}
                className="w-full min-h-[40px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                ariaLabel="Conversion start age"
              />
              <span className="text-xs text-slate-400">to</span>
              <NumericInput
                integer
                min={35}
                max={95}
                value={currentRothConfig.endAge}
                fallbackValue={config.milestones.rmdAge - 1}
                onChange={val => updateRothConfig({ endAge: val })}
                className="w-full min-h-[40px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                ariaLabel="Conversion end age"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Typically ends at age {config.milestones.rmdAge - 1} (prior to RMDs).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Target Bracket Ceiling
            </label>
            <div className="flex items-center gap-1.5 mb-2">
              {(['12%', '22%', '24%'] as const).map(b => {
                const rate = b === '12%' ? 0.12 : b === '22%' ? 0.22 : 0.24;
                const active = currentRothConfig.targetBracketRate === rate;
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => applyBracketPreset(b)}
                    className={`flex-1 py-1.5 min-h-[32px] rounded-md text-xs font-semibold border transition-colors ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
            <NumericInput
              prefix="$"
              formatWithCommas
              min={0}
              step={5000}
              value={currentRothConfig.bracketRoomMaxIncome}
              fallbackValue={hasSpouse ? 201050 : 100525}
              onChange={val => updateRothConfig({ bracketRoomMaxIncome: val })}
              className="w-full min-h-[40px] bg-white border border-slate-300 rounded-lg pr-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              ariaLabel="Target bracket dollar ceiling"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">Annual Conversion Cap</label>
              <span className="text-xs font-mono font-semibold text-emerald-700 tabular-nums">
                {formatCurrency(currentRothConfig.annualCap)}
              </span>
            </div>
            <NumericInput
              prefix="$"
              formatWithCommas
              min={0}
              step={5000}
              value={currentRothConfig.annualCap}
              fallbackValue={50000}
              onChange={val => updateRothConfig({ annualCap: val })}
              className="w-full min-h-[40px] bg-white border border-slate-300 rounded-lg pr-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              ariaLabel="Annual conversion cap"
            />
            <input
              type="range"
              min={0}
              max={200000}
              step={5000}
              value={Math.min(200000, currentRothConfig.annualCap)}
              onChange={e => updateRothConfig({ annualCap: parseFloat(e.target.value) })}
              aria-label="Annual conversion cap slider"
              className="w-full mt-2"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tax Payment Source
            </label>
            <select
              value={currentRothConfig.taxPaymentMethod}
              onChange={e =>
                updateRothConfig({
                  taxPaymentMethod: e.target.value as 'outsideBrokerage' | 'withhold',
                })
              }
              className="w-full min-h-[40px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
            >
              <option value="outsideBrokerage">Pay from Brokerage / Cash</option>
              <option value="withhold">Withhold from Conversion</option>
            </select>
            <p className="text-xs text-slate-500 mt-1.5">
              {hasSpouse
                ? `Dual-spouse mode splits conversions 50/50 across ${primaryName} & ${spouseName}.`
                : 'Paying tax from outside funds maximizes tax-free Roth compounding.'}
            </p>
          </div>
        </div>
      </div>

      {/* 4 Clean KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="text-xs font-medium text-slate-500">Lifetime Tax Impact ({valuationLabel})</div>
          <div
            className={`text-2xl font-bold tabular-nums mt-2 ${
              displayMetrics.lifetimeTaxSavings >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {displayMetrics.lifetimeTaxSavings >= 0 ? '+' : ''}
            {formatCurrency(displayMetrics.lifetimeTaxSavings)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {displayMetrics.lifetimeTaxSavings >= 0 ? 'Net taxes avoided vs. no conversions' : 'Additional lifetime tax cost'}
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="text-xs font-medium text-slate-500">Ending Wealth Impact ({valuationLabel})</div>
          <div
            className={`text-2xl font-bold tabular-nums mt-2 ${
              displayMetrics.finalBalanceDifference >= 0 ? 'text-emerald-700' : 'text-slate-900'
            }`}
          >
            {displayMetrics.finalBalanceDifference >= 0 ? '+' : ''}
            {formatCurrency(displayMetrics.finalBalanceDifference)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Terminal estate difference vs. baseline</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="text-xs font-medium text-slate-500">Peak Annual RMD Cut</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-2">
            {formatCurrency(displayMetrics.peakRmdReduction)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Est. RMD tax saved: {formatCurrency(displayMetrics.rmdLifetimeSavings)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="text-xs font-medium text-slate-500">Total Converted to Roth</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-2">
            {formatCurrency(displayMetrics.totalConverted)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Upfront conversion tax: {formatCurrency(displayMetrics.totalConversionTaxesPaid)}
          </p>
        </div>
      </div>

      {/* Visual Impact Chart: RMD Cliff & Portfolio Trajectory */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {chartView === 'rmd'
                ? `Required Minimum Distribution (RMD) Reduction (${valuationLabel})`
                : `Portfolio Balance: Baseline vs. Roth Strategy (${valuationLabel})`}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {chartView === 'rmd'
                ? 'Comparing forced pre-tax RMD withdrawals with and without systematic conversions.'
                : 'Long-term portfolio net worth trajectory across your retirement horizon.'}
            </p>
          </div>
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setChartView('rmd')}
              className={`px-3 py-1.5 min-h-[34px] rounded-md text-xs font-medium transition-colors ${
                chartView === 'rmd' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              RMD Cliff Impact
            </button>
            <button
              type="button"
              onClick={() => setChartView('balance')}
              className={`px-3 py-1.5 min-h-[34px] rounded-md text-xs font-medium transition-colors ${
                chartView === 'balance' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Portfolio Trajectory
            </button>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartView === 'rmd' ? (
              <BarChart data={rmdChartData} margin={{ top: 10, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                <YAxis tickFormatter={formatCurrencyCompact} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} width={58} />
                <Tooltip
                  formatter={(val: number, name: string) => [formatCurrency(val), name]}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Baseline RMD" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Roth Strategy RMD" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={comparisonChartData} margin={{ top: 10, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                <YAxis tickFormatter={formatCurrencyCompact} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} width={58} />
                <Tooltip
                  formatter={(val: number, name: string) => [formatCurrency(val), name]}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="Baseline Balance" stroke="#94a3b8" strokeDasharray="4 4" fill="transparent" strokeWidth={2} />
                <Area type="monotone" dataKey="With Roth Strategy" stroke="#059669" fill="#d1fae5" fillOpacity={0.35} strokeWidth={2.5} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Conversion Schedule Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Conversion Schedule (Age {currentRothConfig.startAge}–{currentRothConfig.endAge})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {comparison.conversionSchedule.length} active conversion years · {valuationLabel}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                <th className="py-3 px-4">Year</th>
                <th className="py-3 px-3">Age</th>
                <th className="py-3 px-3 text-right">Bracket Room</th>
                <th className="py-3 px-3 text-right">Converted</th>
                {hasSpouse && (
                  <>
                    <th className="py-3 px-3 text-right">{primaryName}</th>
                    <th className="py-3 px-3 text-right">{spouseName}</th>
                  </>
                )}
                <th className="py-3 px-3 text-right">Conversion Tax</th>
                <th className="py-3 px-3 text-right">Pre-Tax After</th>
                <th className="py-3 px-4 text-right">Roth Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparison.conversionSchedule.length === 0 ? (
                <tr>
                  <td colSpan={hasSpouse ? 9 : 7} className="py-10 text-center text-slate-500 text-sm">
                    No conversion years match age {currentRothConfig.startAge}–{currentRothConfig.endAge} with available pre-tax funds.
                  </td>
                </tr>
              ) : (
                comparison.conversionSchedule.map(row => {
                  const deflator =
                    dollarMode === 'real' && row.cumGeneralInflation && row.cumGeneralInflation > 0
                      ? row.cumGeneralInflation
                      : 1;
                  return (
                    <tr key={row.year} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-semibold text-slate-900 tabular-nums">{row.year}</td>
                      <td className="py-2.5 px-3 text-slate-600 tabular-nums">
                        {row.age}
                        {row.spouseAge ? ` / ${row.spouseAge}` : ''}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                        {formatCurrency(row.bracketRoom / deflator)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatCurrency(row.convertedAmount / deflator)}
                      </td>
                      {hasSpouse && (
                        <>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                            {formatCurrency((row.primaryConverted ?? 0) / deflator)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                            {formatCurrency((row.spouseConverted ?? 0) / deflator)}
                          </td>
                        </>
                      )}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-600">
                        {formatCurrency(row.conversionTax / deflator)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {formatCurrency(row.preTaxBalanceAfter / deflator)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                        {formatCurrency(row.rothBalanceAfter / deflator)}
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
