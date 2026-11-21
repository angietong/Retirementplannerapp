import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { CheckCircle2, ArrowRight, RotateCcw } from 'lucide-react';
import { PlannerConfig, StressPreset, DollarDisplayMode, YearSimulationResult } from '../types';
import { runWhatIfComparisons, WhatIfScenarioResult } from '../whatifEngine';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatters';

interface WhatIfComparisonViewProps {
  config: PlannerConfig;
  stressPreset: StressPreset;
  dollarMode: DollarDisplayMode;
  getDeflator: (yr: number, cumInflation?: number) => number;
  onApplyStrategy: (newConfig: PlannerConfig, strategyName: string) => void;
  previousConfig?: PlannerConfig | null;
  lastAppliedName?: string | null;
  onUndoApply?: () => void;
}

export const WhatIfComparisonView: React.FC<WhatIfComparisonViewProps> = ({
  config,
  stressPreset,
  dollarMode,
  getDeflator,
  onApplyStrategy,
  previousConfig,
  lastAppliedName,
  onUndoApply,
}) => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<WhatIfScenarioResult['id']>('minTax');

  const scenarios = useMemo(() => {
    return runWhatIfComparisons(config, stressPreset);
  }, [config, stressPreset]);

  const baselineScenario = scenarios[0];
  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId) || scenarios[1];
  const valuationLabel = dollarMode === 'real' ? "Today's $" : 'Nominal $';

  const getYearDeflator = (y: YearSimulationResult) =>
    dollarMode === 'nominal' ? 1 : getDeflator(y.yr, y.cumGeneralInflation);

  const getRealTaxes = (scen: WhatIfScenarioResult) => {
    if (dollarMode === 'nominal') return scen.totalTaxesPaid;
    return scen.years.reduce((sum, y) => sum + y.totalTax / getYearDeflator(y), 0);
  };

  const getRealPeakRmd = (scen: WhatIfScenarioResult) => {
    if (dollarMode === 'nominal') return scen.peakRmd;
    return Math.max(0, ...scen.years.map(y => (y.rmdTotal || 0) / getYearDeflator(y)));
  };

  const getRealFinalBalance = (scen: WhatIfScenarioResult) => {
    if (dollarMode === 'nominal') return scen.finalBalance;
    const lastYear = scen.years[scen.years.length - 1];
    const deflator = lastYear ? getYearDeflator(lastYear) : getDeflator(config.projectionYears - 1);
    return scen.finalBalance / deflator;
  };

  const overlayChartData = useMemo(() => {
    return baselineScenario.years.map((by, idx) => {
      const sy = selectedScenario.years[idx];
      const def = getYearDeflator(by);
      return {
        year: by.calYear,
        'Your Baseline': Math.max(0, Math.round(by.combEndBal / def)),
        [selectedScenario.shortName]: Math.max(0, Math.round((sy?.combEndBal ?? by.combEndBal) / def)),
      };
    });
  }, [baselineScenario, selectedScenario, dollarMode]);

  const selectedTax = getRealTaxes(selectedScenario);
  const baseTax = getRealTaxes(baselineScenario);
  const taxDiff = selectedTax - baseTax;

  const selectedEstate = getRealFinalBalance(selectedScenario);
  const baseEstate = getRealFinalBalance(baselineScenario);
  const estateDiff = selectedEstate - baseEstate;

  const selectedPeakRmd = getRealPeakRmd(selectedScenario);
  const basePeakRmd = getRealPeakRmd(baselineScenario);

  return (
    <div className="space-y-6">
      {/* Applied Confirmation & Undo Banner */}
      {lastAppliedName && previousConfig && onUndoApply && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-emerald-950 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Applied <strong>{lastAppliedName}</strong> to your active retirement plan.
            </span>
          </div>
          <button
            type="button"
            onClick={onUndoApply}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg bg-white border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100/50 transition-colors self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Undo Change
          </button>
        </div>
      )}

      {/* Header Intro */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6">
        <h2 className="text-base font-bold text-slate-900">What-If Optimization Lab</h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
          Automatically tests withdrawal sequencing, Roth conversions, ACA MAGI caps, and sustainable spending ceilings against your current baseline. Select any strategy below to compare trajectories or apply it directly to your plan.
        </p>

        {/* Accessible Strategy Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mt-5">
          {scenarios.slice(1).map(scen => {
            const isSelected = selectedScenarioId === scen.id;
            const scenTax = getRealTaxes(scen);
            const scenEstate = getRealFinalBalance(scen);
            const deltaTax = scenTax - baseTax;

            return (
              <button
                key={scen.id}
                type="button"
                onClick={() => setSelectedScenarioId(scen.id)}
                aria-pressed={isSelected}
                className={`text-left rounded-xl p-4 border transition-all flex flex-col justify-between min-h-[144px] ${
                  isSelected
                    ? 'bg-emerald-50/70 border-emerald-500 ring-1 ring-emerald-500'
                    : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-slate-900">{scen.name}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3">
                    {scen.description}
                  </p>
                </div>

                <div className="space-y-1 pt-3 mt-3 border-t border-slate-200/70 text-[11px] tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tax</span>
                    <span className={`font-mono font-semibold ${deltaTax <= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {formatCurrencyCompact(scenTax)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Estate</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatCurrencyCompact(Math.max(0, scenEstate))}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Strategy Detail & Trajectory Overlay */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">{selectedScenario.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
              {selectedScenario.description}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onApplyStrategy(selectedScenario.appliedConfig, selectedScenario.name)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <span>Apply to My Plan</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* 4 Delta Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-xs font-medium text-slate-500 block">Lifetime Taxes ({valuationLabel})</span>
            <div className="text-xl font-bold text-slate-900 tabular-nums mt-1">
              {formatCurrency(selectedTax)}
            </div>
            <div className={`text-xs font-medium tabular-nums mt-1 ${taxDiff <= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {taxDiff <= 0 ? 'Saves ' : '+'}
              {formatCurrency(Math.abs(taxDiff))} vs. baseline
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-xs font-medium text-slate-500 block">Peak Annual RMD</span>
            <div className="text-xl font-bold text-slate-900 tabular-nums mt-1">
              {formatCurrency(selectedPeakRmd)}
            </div>
            <div className={`text-xs font-medium tabular-nums mt-1 ${selectedPeakRmd <= basePeakRmd ? 'text-emerald-700' : 'text-slate-600'}`}>
              {selectedPeakRmd < basePeakRmd
                ? `-${formatCurrency(basePeakRmd - selectedPeakRmd)}/yr vs. baseline`
                : 'Same or higher than baseline'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-xs font-medium text-slate-500 block">Ending Estate ({valuationLabel})</span>
            <div className="text-xl font-bold text-slate-900 tabular-nums mt-1">
              {formatCurrency(Math.max(0, selectedEstate))}
            </div>
            <div className={`text-xs font-medium tabular-nums mt-1 ${estateDiff >= 0 ? 'text-emerald-700' : 'text-slate-600'}`}>
              {estateDiff >= 0 ? '+' : '-'}
              {formatCurrency(Math.abs(estateDiff))} vs. baseline
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-xs font-medium text-slate-500 block">Portfolio Longevity</span>
            <div className="text-xl font-bold text-slate-900 tabular-nums mt-1">
              {selectedScenario.summary.fundsRunOutYear === null
                ? 'Fully Funded'
                : `Depletes ${selectedScenario.summary.fundsRunOutYear}`}
            </div>
            <div className="text-xs font-medium text-emerald-700 tabular-nums mt-1">
              {selectedScenario.id === 'maxSpending'
                ? `Sustainable spend: ${formatCurrency(selectedScenario.maxSustainableAnnualExpense)}/yr`
                : `${selectedScenario.summary.yearsFundingLasts} funded years`}
            </div>
          </div>
        </div>

        {/* Trajectory Overlay Chart */}
        <div>
          <h4 className="text-xs font-semibold text-slate-700 mb-3">
            Portfolio Trajectory Comparison ({valuationLabel})
          </h4>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overlayChartData} margin={{ top: 10, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                <YAxis tickFormatter={formatCurrencyCompact} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} width={58} />
                <Tooltip
                  formatter={(val: number, name: string) => [formatCurrency(val), name]}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area
                  type="monotone"
                  dataKey="Your Baseline"
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  fill="transparent"
                />
                <Area
                  type="monotone"
                  dataKey={selectedScenario.shortName}
                  stroke="#059669"
                  strokeWidth={2.5}
                  fill="#d1fae5"
                  fillOpacity={0.35}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Compare All Side-by-Side Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">All Strategies Side-by-Side ({valuationLabel})</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any row to inspect its trajectory above.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                <th className="py-3 px-4">Strategy</th>
                <th className="py-3 px-3 text-right">Lifetime Taxes</th>
                <th className="py-3 px-3 text-right">Peak RMD</th>
                <th className="py-3 px-3 text-right">Ending Estate</th>
                <th className="py-3 px-4 text-right">Longevity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scenarios.map(scen => {
                const isSelected = scen.id === selectedScenarioId;
                const isBase = scen.id === 'baseline';
                return (
                  <tr
                    key={scen.id}
                    onClick={() => !isBase && setSelectedScenarioId(scen.id)}
                    className={`${
                      isBase
                        ? 'bg-slate-50/70'
                        : isSelected
                        ? 'bg-emerald-50/60 cursor-pointer'
                        : 'hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {scen.name}
                      {isBase && <span className="text-slate-400 font-normal ml-1.5">(Current)</span>}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-800">
                      {formatCurrency(getRealTaxes(scen))}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                      {formatCurrency(getRealPeakRmd(scen))}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatCurrency(Math.max(0, getRealFinalBalance(scen)))}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      <span className={scen.summary.fundsRunOutYear === null ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                        {scen.summary.fundsRunOutYear === null ? 'Fully Funded' : `Year ${scen.summary.fundsRunOutYear}`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
