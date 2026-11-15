import React, { useState, useMemo } from 'react';
import { Sliders, Sparkles, TrendingUp, ShieldCheck, DollarSign, Award, CheckCircle2 } from 'lucide-react';
import { PlannerConfig, StressPreset, DollarDisplayMode } from '../types';
import { runWhatIfComparisons, WhatIfScenarioResult } from '../whatifEngine';

interface WhatIfComparisonViewProps {
  config: PlannerConfig;
  stressPreset: StressPreset;
  dollarMode: DollarDisplayMode;
  getDeflator: (yr: number) => number;
}

export const WhatIfComparisonView: React.FC<WhatIfComparisonViewProps> = ({
  config,
  stressPreset,
  dollarMode,
  getDeflator
}) => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<WhatIfScenarioResult['id']>('minTax');

  const scenarios = useMemo(() => {
    return runWhatIfComparisons(config, stressPreset);
  }, [config, stressPreset]);

  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId) || scenarios[1];
  const baselineScenario = scenarios[0];

  const getRealTaxes = (scen: WhatIfScenarioResult) => {
    if (dollarMode === 'nominal') return scen.totalTaxesPaid;
    return scen.years.reduce((sum, y) => sum + y.totalTax / getDeflator(y.yr), 0);
  };

  const getRealFinalBalance = (bal: number) => {
    if (dollarMode === 'nominal') return bal;
    return bal / getDeflator(config.projectionYears - 1);
  };

  const formatCurrency = (val: number, yrIndex?: number) => {
    const deflator = yrIndex !== undefined ? getDeflator(yrIndex) : 1;
    const adjusted = val / deflator;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(adjusted);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-900 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold">What-If Scenario Optimization Engine</h2>
        </div>
        <p className="text-emerald-100 text-xs sm:text-sm max-w-3xl leading-relaxed">
          Compare how intelligent withdrawal sequencing and automated tax conversion strategies impact your retirement outcomes across four distinct financial goals. Select a strategy to inspect optimized cash flows, lifetime tax savings, and estate net worth.
        </p>
      </div>

      {/* Scenario Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {scenarios.slice(1).map(scen => {
          const isSelected = selectedScenarioId === scen.id;
          const scenTax = getRealTaxes(scen);
          const baseTax = getRealTaxes(baselineScenario);
          const taxDiff = scenTax - baseTax;
          const scenEstate = getRealFinalBalance(scen.finalBalance);
          const baseEstate = getRealFinalBalance(baselineScenario.finalBalance);
          const estateDiff = scenEstate - baseEstate;

          return (
            <div
              key={scen.id}
              onClick={() => setSelectedScenarioId(scen.id)}
              className={`rounded-xl p-4 border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-400/30 shadow-md'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900">{scen.name}</span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed mb-3 line-clamp-3">
                  {scen.description}
                </p>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-slate-100 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Lifetime Tax:</span>
                  <span className={`font-semibold ${taxDiff <= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {formatCurrency(scenTax)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Estate Net Worth:</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(scenEstate)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Comparison & Optimization breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600" />
              Detailed Analysis: {selectedScenario.name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparison against your baseline configuration under active market stress preset.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700">
            <span>Valuation:</span>
            <span className="text-emerald-700 font-bold uppercase">{dollarMode}</span>
          </div>
        </div>

        {/* Comparison Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-xs font-semibold text-slate-500 block mb-1">Total Lifetime Taxes Paid</span>
            <div className="text-lg font-extrabold text-slate-900 mb-1">
              {formatCurrency(getRealTaxes(selectedScenario))}
            </div>
            <div className={`text-[11px] font-medium ${getRealTaxes(selectedScenario) <= getRealTaxes(baselineScenario) ? 'text-emerald-700' : 'text-rose-600'}`}>
              {getRealTaxes(selectedScenario) <= getRealTaxes(baselineScenario) ? '▼ ' : '▲ '}
              {formatCurrency(Math.abs(getRealTaxes(selectedScenario) - getRealTaxes(baselineScenario)))} vs Baseline
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-xs font-semibold text-slate-500 block mb-1">Peak Annual RMD</span>
            <div className="text-lg font-extrabold text-slate-900 mb-1">
              {formatCurrency(selectedScenario.peakRmd)}
            </div>
            <div className={`text-[11px] font-medium ${selectedScenario.peakRmd <= baselineScenario.peakRmd ? 'text-emerald-700' : 'text-slate-600'}`}>
              {selectedScenario.peakRmd <= baselineScenario.peakRmd ? '▼ Lower RMD burden' : 'Standard RMD profile'}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-xs font-semibold text-slate-500 block mb-1">Final Estate Net Worth</span>
            <div className="text-lg font-extrabold text-slate-900 mb-1">
              {formatCurrency(getRealFinalBalance(selectedScenario.finalBalance))}
            </div>
            <div className={`text-[11px] font-medium ${selectedScenario.finalBalance >= baselineScenario.finalBalance ? 'text-emerald-700' : 'text-slate-600'}`}>
              {selectedScenario.finalBalance >= baselineScenario.finalBalance ? '▲ ' : '▼ '}
              {formatCurrency(Math.abs(getRealFinalBalance(selectedScenario.finalBalance) - getRealFinalBalance(baselineScenario.finalBalance)))} vs Baseline
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-xs font-semibold text-slate-500 block mb-1">Portfolio Longevity</span>
            <div className="text-lg font-extrabold text-slate-900 mb-1">
              {selectedScenario.summary.fundsRunOutYear === null ? 'Full Life Expectancy' : `Depletes in ${selectedScenario.summary.fundsRunOutYear}`}
            </div>
            <div className="text-[11px] font-medium text-emerald-700">
              {selectedScenario.id === 'maxSpending' ? `Max Sustainable Spend: ${formatCurrency(selectedScenario.maxSustainableAnnualExpense)}/yr` : 'Sustains lifestyle goals'}
            </div>
          </div>
        </div>

        {/* Optimization Action Summary */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-xs text-emerald-900 leading-relaxed space-y-2">
          <div className="font-bold flex items-center gap-1.5 text-emerald-950">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            Automated System Optimization Rules Applied for "{selectedScenario.name}":
          </div>
          <p>
            {selectedScenario.id === 'minTax' && 'The simulation automatically sequenced accounts to exhaust taxable cash and brokerage before tax-deferred accounts, while executing pre-RMD Roth conversions to equalize tax brackets and avoid higher future marginal tax rates.'}
            {selectedScenario.id === 'minRmd' && `The simulation prioritized traditional pre-tax 401(k) / IRA withdrawals prior to mandatory RMD age (${config.milestones.rmdAge}) and executed targeted pre-RMD Roth conversions to aggressively shrink pre-tax balances, minimizing future RMD spikes.`}
            {selectedScenario.id === 'maxSpending' && 'The system iteratively evaluated lifestyle expense ceilings, identifying that your portfolio can safely sustain a higher annual expenditure without compromising long-term solvency.'}
            {selectedScenario.id === 'maxEstate' && 'The simulation prioritized drawing down taxable assets and deferred pre-tax withdrawals, while keeping Roth accounts untouched to compound tax-free for legacy heirs.'}
          </p>
        </div>
      </div>
    </div>
  );
};
