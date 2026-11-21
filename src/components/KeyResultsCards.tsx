import React from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { PlanSummary, PlannerConfig, DollarDisplayMode, YearSimulationResult } from '../types';
import { formatCurrency } from '../utils/formatters';

interface KeyResultsCardsProps {
  summary: PlanSummary;
  config: PlannerConfig;
  years?: YearSimulationResult[];
  dollarMode?: DollarDisplayMode;
  stressPresetName?: string;
  isCustomStress?: boolean;
  compact?: boolean;
}

export const KeyResultsCards: React.FC<KeyResultsCardsProps> = ({
  summary,
  config,
  years,
  dollarMode = 'nominal',
  stressPresetName = 'Baseline Plan',
  isCustomStress = false,
  compact = false,
}) => {
  const isSustained = summary.fundsRunOutYear === null;
  const hasSpouse = Boolean(config.scenario.hasSpouse);

  const realMetrics = React.useMemo(() => {
    if (!years || years.length === 0) {
      return {
        totalTaxes: summary.totalTaxesPaid,
        finalBalance: summary.finalBalance,
      };
    }
    const totalTaxes = years.reduce((sum, y) => {
      const deflator =
        y.cumGeneralInflation && y.cumGeneralInflation > 0
          ? y.cumGeneralInflation
          : Math.pow(1 + config.rates.inflationRate, y.yr);
      return sum + y.totalTax / (deflator > 0 ? deflator : 1);
    }, 0);

    const lastYr = years[years.length - 1];
    const finalDeflator =
      lastYr && lastYr.cumGeneralInflation && lastYr.cumGeneralInflation > 0
        ? lastYr.cumGeneralInflation
        : Math.pow(1 + config.rates.inflationRate, Math.max(0, years.length - 1));

    return {
      totalTaxes,
      finalBalance: summary.finalBalance / (finalDeflator > 0 ? finalDeflator : 1),
    };
  }, [years, summary.totalTaxesPaid, summary.finalBalance, config.rates.inflationRate]);

  const displayedTaxes = dollarMode === 'real' ? realMetrics.totalTaxes : summary.totalTaxesPaid;
  const displayedFinal = dollarMode === 'real' ? realMetrics.finalBalance : summary.finalBalance;
  const valuationLabel = dollarMode === 'real' ? "Today's $" : 'Nominal $';

  // Compact Live Impact Strip for Configuration screens
  if (compact) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          {isSustained ? (
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <div>
            <div className="text-[11px] font-medium text-slate-500">Plan Sustainability</div>
            <div className={`text-sm font-bold tabular-nums ${isSustained ? 'text-emerald-700' : 'text-amber-700'}`}>
              {isSustained ? `Funded ${summary.yearsFundingLasts} yrs` : `Depletes ${summary.fundsRunOutYear}`}
            </div>
          </div>
        </div>

        <div className="h-7 w-px bg-slate-200 hidden sm:block" />

        <div>
          <div className="text-[11px] font-medium text-slate-500">Starting Portfolio</div>
          <div className="text-sm font-bold text-slate-900 tabular-nums">
            {formatCurrency(summary.startingCombinedBalance)}
          </div>
        </div>

        <div className="h-7 w-px bg-slate-200 hidden sm:block" />

        <div>
          <div className="text-[11px] font-medium text-slate-500">Ending Balance ({valuationLabel})</div>
          <div className="text-sm font-bold text-slate-900 tabular-nums">
            {formatCurrency(Math.max(0, displayedFinal))}
          </div>
        </div>

        <div className="h-7 w-px bg-slate-200 hidden sm:block" />

        <div>
          <div className="text-[11px] font-medium text-slate-500">Est. Lifetime Taxes ({valuationLabel})</div>
          <div className="text-sm font-bold text-slate-900 tabular-nums">
            {formatCurrency(displayedTaxes)}
          </div>
        </div>
      </div>
    );
  }

  const horizonText = hasSpouse
    ? `Through age ${config.scenario.lifeExpAge} & spouse age ${config.scenario.spouseLifeExpAge || 92}`
    : `Through age ${config.scenario.lifeExpAge}+`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      {/* 1. Plan Sustainability */}
      <div
        className={`bg-white rounded-xl p-5 border flex flex-col justify-between ${
          !isSustained
            ? 'border-amber-300'
            : isCustomStress
            ? 'border-amber-200'
            : 'border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-3">
          <span className="font-medium">Plan Sustainability</span>
          <span className={`inline-flex items-center gap-1 font-semibold ${isSustained ? 'text-emerald-700' : 'text-amber-700'}`}>
            {isSustained ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            {isSustained ? 'On Track' : 'Shortfall'}
          </span>
        </div>
        <div>
          <div className={`text-2xl font-bold tracking-tight tabular-nums ${isSustained ? 'text-emerald-700' : 'text-amber-700'}`}>
            {isSustained ? 'Fully Funded' : `Depletes ${summary.fundsRunOutYear}`}
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            {isSustained
              ? `${horizonText} · ${summary.yearsFundingLasts} yrs`
              : `Lasts ${summary.yearsFundingLasts} of ${config.projectionYears} simulated years`}
            {isCustomStress ? ` · ${stressPresetName}` : ''}
          </p>
        </div>
      </div>

      {/* 2. Projected Ending Portfolio */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-3">
          <span className="font-medium">Ending Estate Balance</span>
          <span className="text-slate-400">{valuationLabel}</span>
        </div>
        <div>
          <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {formatCurrency(Math.max(0, displayedFinal))}
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            Projected balance after {config.projectionYears}-year horizon
          </p>
        </div>
      </div>

      {/* 3. Starting Portfolio */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-3">
          <span className="font-medium">Starting Portfolio</span>
          <span className="text-slate-400">{hasSpouse ? 'Joint Household' : 'Individual'}</span>
        </div>
        <div>
          <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {formatCurrency(summary.startingCombinedBalance)}
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            {config.sources.filter(s => s.monthly === 'N').length} depleting accounts · {config.sources.filter(s => s.monthly === 'Y').length} guaranteed streams
          </p>
        </div>
      </div>

      {/* 4. Lifetime Tax Liability */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-3">
          <span className="font-medium">Est. Lifetime Taxes</span>
          <span className="text-slate-400">{valuationLabel}</span>
        </div>
        <div>
          <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {formatCurrency(displayedTaxes)}
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            Federal, state, and capital gains combined
          </p>
        </div>
      </div>
    </div>
  );
};
