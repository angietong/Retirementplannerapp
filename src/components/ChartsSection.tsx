import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Flag } from 'lucide-react';
import { PlannerConfig, YearSimulationResult, DollarDisplayMode, StressPreset } from '../types';
import { runMonteCarloSimulation } from '../engine';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatters';

interface ChartsSectionProps {
  config: PlannerConfig;
  years: YearSimulationResult[];
  showAll?: boolean;
  dollarMode?: DollarDisplayMode;
  stressPreset?: StressPreset;
}

// Curated harmonious financial palette
const SOURCE_COLORS = [
  '#059669', // Emerald
  '#0284c7', // Sky
  '#0d9488', // Teal
  '#4f46e5', // Indigo
  '#d97706', // Amber
  '#7c3aed', // Violet
  '#0891b2', // Cyan
  '#ea580c', // Orange
  '#2563eb', // Blue
  '#65a30d', // Lime
  '#dc2626', // Red
  '#64748b', // Slate
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    payload?: Record<string, any>;
  }>;
  label?: string | number;
  hasSpouse: boolean;
  primaryName: string;
  spouseName: string;
  showTotal?: boolean;
}

const FinancialTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
  hasSpouse,
  primaryName,
  spouseName,
  showTotal = false,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload[0]?.payload || {};
  const nonZeroItems = payload
    .filter(entry => typeof entry.value === 'number' && Math.abs(entry.value) > 0)
    .sort((a, b) => (b.value || 0) - (a.value || 0));

  const total = nonZeroItems.reduce((sum, item) => sum + (item.value || 0), 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 min-w-[210px] max-w-[290px] text-xs">
      <div className="pb-2 mb-2 border-b border-slate-100">
        <div className="font-bold text-slate-900 tabular-nums">Year {label}</div>
        {row.age !== undefined && (
          <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
            {primaryName}: Age {Number(row.age).toFixed(1)}
            {hasSpouse && row.spouseAge !== undefined
              ? ` · ${spouseName}: Age ${Number(row.spouseAge).toFixed(1)}`
              : ''}
          </div>
        )}
      </div>

      {nonZeroItems.length === 0 ? (
        <div className="text-slate-400">No balance / flow</div>
      ) : (
        <div className="space-y-1.5">
          {nonZeroItems.map((entry, idx) => (
            <div key={`${entry.name}-${idx}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-600 truncate">
                <span
                  className="w-2 h-2 rounded-xs shrink-0"
                  style={{ backgroundColor: entry.color || '#059669' }}
                />
                <span className="truncate">{entry.name}</span>
              </span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                {formatCurrency(entry.value || 0)}
              </span>
            </div>
          ))}
        </div>
      )}

      {showTotal && nonZeroItems.length > 1 && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between font-semibold text-slate-900">
          <span>Total</span>
          <span className="font-mono tabular-nums">{formatCurrency(total)}</span>
        </div>
      )}
    </div>
  );
};

export const ChartsSection: React.FC<ChartsSectionProps> = ({
  config,
  years,
  showAll = false,
  dollarMode = 'nominal',
  stressPreset = 'baseline',
}) => {
  const [activeChart, setActiveChart] = useState<'depletion' | 'income' | 'expenses' | 'balance' | 'montecarlo'>('depletion');
  const [showMilestones, setShowMilestones] = useState(true);
  const [sliderVolatility, setSliderVolatility] = useState(0.12);
  const [debouncedVolatility, setDebouncedVolatility] = useState(0.12);

  // Debounce Monte Carlo volatility slider so dragging stays smooth
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedVolatility(sliderVolatility), 140);
    return () => clearTimeout(timer);
  }, [sliderVolatility]);

  const shouldRunMonteCarlo = showAll || activeChart === 'montecarlo';

  const mcResult = useMemo(() => {
    if (!shouldRunMonteCarlo) return null;
    return runMonteCarloSimulation(config, debouncedVolatility, 200, stressPreset, dollarMode);
  }, [shouldRunMonteCarlo, config, debouncedVolatility, stressPreset, dollarMode]);

  const mcChartData = useMemo(() => {
    if (!mcResult) return [];
    return mcResult.calYears.map((calYr: number, i: number) => ({
      year: calYr,
      age: years[i]?.age,
      spouseAge: years[i]?.spouseAge,
      p10: Math.max(0, Math.round(mcResult.p10[i])),
      p25: Math.max(0, Math.round(mcResult.p25[i])),
      p50: Math.max(0, Math.round(mcResult.p50[i])),
      p75: Math.max(0, Math.round(mcResult.p75[i])),
      p90: Math.max(0, Math.round(mcResult.p90[i])),
    }));
  }, [mcResult, years]);

  const hasSpouse = Boolean(config.scenario?.hasSpouse);
  const primaryName = (config.scenario?.userName || 'Primary').split(' ')[0] || 'Primary';
  const spouseName = (config.scenario?.spouseName || 'Spouse').split(' ')[0] || 'Spouse';
  const valuationLabel = dollarMode === 'real' ? "Today's $" : 'Nominal $';

  // Compute staggered milestone markers to prevent label collisions
  const milestoneMarkers = useMemo(() => {
    const retYear = parseInt((config.scenario?.retDate || '2030-07-01').split('-')[0], 10) || 2030;
    const spouseRetYear =
      hasSpouse && config.scenario?.spouseRetDate
        ? parseInt(config.scenario.spouseRetDate.split('-')[0], 10)
        : null;
    const ssMinYear = years.find(y => y.age >= config.milestones.ssMinAge)?.calYear ?? null;
    const medicareYear = years.find(y => y.age >= config.milestones.medicareAge)?.calYear ?? null;
    const rmdYear = years.find(y => y.age >= config.milestones.rmdAge)?.calYear ?? null;

    const raw: { key: string; year: number; label: string; color: string }[] = [
      { key: 'ret', year: retYear, label: `${primaryName} Ret.`, color: '#059669' },
    ];
    if (spouseRetYear && spouseRetYear !== retYear) {
      raw.push({ key: 'spRet', year: spouseRetYear, label: `${spouseName} Ret.`, color: '#0d9488' });
    }
    if (ssMinYear) {
      raw.push({ key: 'ss', year: ssMinYear, label: `SS (${config.milestones.ssMinAge})`, color: '#d97706' });
    }
    if (medicareYear) {
      raw.push({ key: 'med', year: medicareYear, label: `Medicare (${config.milestones.medicareAge})`, color: '#0284c7' });
    }
    if (rmdYear) {
      raw.push({ key: 'rmd', year: rmdYear, label: `RMDs (${config.milestones.rmdAge})`, color: '#7c3aed' });
    }

    raw.sort((a, b) => a.year - b.year);
    // Assign vertical stagger row (0, 1, 2) whenever milestones are within 5 years of each other
    return raw.map((item, idx) => {
      let row = 0;
      if (idx > 0 && item.year - raw[idx - 1].year <= 5) {
        row = idx % 3;
      }
      return { ...item, dy: 8 + row * 15 };
    });
  }, [config, years, hasSpouse, primaryName, spouseName]);

  const getDeflator = (y: YearSimulationResult) => {
    if (dollarMode === 'nominal') return 1;
    const f = y.cumGeneralInflation ?? Math.pow(1 + config.rates.inflationRate, y.yr);
    return f > 0 ? f : 1;
  };

  const depletionData = useMemo(
    () =>
      years.map(y => {
        const deflator = getDeflator(y);
        const adjBal = Math.round(y.combEndBal / deflator);
        return {
          year: y.calYear,
          age: y.age,
          spouseAge: y.spouseAge,
          balance: Math.max(0, adjBal),
        };
      }),
    [years, dollarMode, config.rates.inflationRate]
  );

  const incomeData = useMemo(
    () =>
      years.map(y => {
        const deflator = getDeflator(y);
        const item: Record<string, any> = {
          year: y.calYear,
          age: y.age,
          spouseAge: y.spouseAge,
        };
        config.sources.forEach(s => {
          item[s.name] = Math.round((y.incomeBySource[s.id] || 0) / deflator);
        });
        return item;
      }),
    [years, config.sources, dollarMode, config.rates.inflationRate]
  );

  const expenseData = useMemo(
    () =>
      years.map(y => {
        const deflator = getDeflator(y);
        return {
          year: y.calYear,
          age: y.age,
          spouseAge: y.spouseAge,
          'General Living': Math.round((y.generalExpenses || 0) / deflator),
          Healthcare: Math.round((y.medicalExpenses || 0) / deflator),
          'Major Expenses': Math.round((y.majorExpenses || 0) / deflator),
          'Federal Tax': Math.round(y.fedTax / deflator),
          'State Tax': Math.round(y.stateTax / deflator),
          'Cap Gain Tax': Math.round(y.capGainTax / deflator),
        };
      }),
    [years, dollarMode, config.rates.inflationRate]
  );

  const depletingSources = useMemo(() => config.sources.filter(s => s.monthly === 'N'), [config.sources]);

  const balanceData = useMemo(
    () =>
      years.map(y => {
        const deflator = getDeflator(y);
        const item: Record<string, any> = {
          year: y.calYear,
          age: y.age,
          spouseAge: y.spouseAge,
        };
        depletingSources.forEach(s => {
          item[s.name] = Math.max(0, Math.round((y.endBalanceBySource[s.id] || 0) / deflator));
        });
        return item;
      }),
    [years, depletingSources, dollarMode, config.rates.inflationRate]
  );

  const renderMilestoneLines = () => {
    if (!showMilestones) return null;
    return (
      <>
        {milestoneMarkers.map(m => (
          <ReferenceLine
            key={m.key}
            x={m.year}
            stroke={m.color}
            strokeDasharray="3 3"
            strokeWidth={1.25}
            strokeOpacity={0.7}
            label={{
              value: m.label,
              position: 'insideTopLeft',
              fill: m.color,
              fontSize: 10,
              fontWeight: 600,
              dy: m.dy,
              dx: 3,
            }}
          />
        ))}
      </>
    );
  };

  const chartTabs: { id: typeof activeChart; label: string }[] = [
    { id: 'depletion', label: 'Portfolio Trajectory' },
    { id: 'income', label: 'Income Sources' },
    { id: 'expenses', label: 'Expenses & Taxes' },
    { id: 'balance', label: 'Account Balances' },
    { id: 'montecarlo', label: 'Monte Carlo' },
  ];

  const finalMc = mcChartData[mcChartData.length - 1];

  return (
    <div className="space-y-5">
      {/* Unified Chart Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {!showAll ? (
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg overflow-x-auto max-w-full">
            {chartTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveChart(tab.id)}
                className={`px-3 py-1.5 min-h-[36px] rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeChart === tab.id
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <div>
            <h2 className="text-base font-bold text-slate-900">All Portfolio Visualizations</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Displaying all projections in {dollarMode === 'real' ? "Real (Today's Purchasing Power)" : 'Nominal Future'} dollars.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowMilestones(!showMilestones)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto ${
            showMilestones
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Flag className="w-3.5 h-3.5" />
          Milestones: {showMilestones ? 'Visible' : 'Hidden'}
        </button>
      </div>

      {/* 1. Overall Depletion Chart */}
      {(showAll || activeChart === 'depletion') && (
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">
              Combined Portfolio Trajectory ({valuationLabel})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Total accessible portfolio assets after inflation-adjusted withdrawals, taxes, and compound growth.
            </p>
          </div>
          <div className="h-80 sm:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={depletionData} margin={{ top: 18, right: 16, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis
                  tickFormatter={formatCurrencyCompact}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 'auto']}
                  width={60}
                />
                <Tooltip
                  content={
                    <FinancialTooltip
                      hasSpouse={hasSpouse}
                      primaryName={primaryName}
                      spouseName={spouseName}
                    />
                  }
                />
                {renderMilestoneLines()}
                <Area
                  type="monotone"
                  dataKey="balance"
                  name={`Portfolio Balance (${valuationLabel})`}
                  stroke="#059669"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#balanceGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 2. Income by Source Stacked Bar */}
      {(showAll || activeChart === 'income') && (
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">
              Annual Income by Source ({valuationLabel})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Annual withdrawals from each depleting account paired with guaranteed streams (Social Security, Pensions).
            </p>
          </div>
          <div className="h-80 sm:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeData} margin={{ top: 18, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis tickFormatter={formatCurrencyCompact} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
                <Tooltip
                  content={
                    <FinancialTooltip
                      hasSpouse={hasSpouse}
                      primaryName={primaryName}
                      spouseName={spouseName}
                      showTotal
                    />
                  }
                />
                <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                {renderMilestoneLines()}
                {config.sources.map((s, idx) => (
                  <Bar
                    key={s.id}
                    dataKey={s.name}
                    stackId="incomeStack"
                    fill={SOURCE_COLORS[idx % SOURCE_COLORS.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 3. Expenses & Taxes Stacked Bar */}
      {(showAll || activeChart === 'expenses') && (
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">
              Annual Expenses &amp; Tax Burden ({valuationLabel})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              General living costs, decoupled healthcare, scheduled major events, and projected annual taxes.
            </p>
          </div>
          <div className="h-80 sm:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expenseData} margin={{ top: 18, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis tickFormatter={formatCurrencyCompact} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
                <Tooltip
                  content={
                    <FinancialTooltip
                      hasSpouse={hasSpouse}
                      primaryName={primaryName}
                      spouseName={spouseName}
                      showTotal
                    />
                  }
                />
                <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                {renderMilestoneLines()}
                <Bar dataKey="General Living" stackId="expStack" fill="#0284c7" />
                <Bar dataKey="Healthcare" stackId="expStack" fill="#7c3aed" />
                <Bar dataKey="Major Expenses" stackId="expStack" fill="#d97706" />
                <Bar dataKey="Federal Tax" stackId="expStack" fill="#dc2626" />
                <Bar dataKey="State Tax" stackId="expStack" fill="#ea580c" />
                <Bar dataKey="Cap Gain Tax" stackId="expStack" fill="#f43f5e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 4. Balances by Account (Stacked Area) */}
      {(showAll || activeChart === 'balance') && (
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">
              Year-End Balances by Account ({valuationLabel})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Composition of your remaining depleting accounts across pre-tax, taxable brokerage, cash, and Roth buckets.
            </p>
          </div>
          <div className="h-80 sm:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={balanceData} margin={{ top: 18, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis tickFormatter={formatCurrencyCompact} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
                <Tooltip
                  content={
                    <FinancialTooltip
                      hasSpouse={hasSpouse}
                      primaryName={primaryName}
                      spouseName={spouseName}
                      showTotal
                    />
                  }
                />
                <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                {renderMilestoneLines()}
                {depletingSources.map((s, idx) => (
                  <Area
                    key={s.id}
                    type="monotone"
                    dataKey={s.name}
                    stackId="balStack"
                    stroke={SOURCE_COLORS[idx % SOURCE_COLORS.length]}
                    fill={SOURCE_COLORS[idx % SOURCE_COLORS.length]}
                    fillOpacity={0.65}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 5. Monte Carlo Stochastic Fan Chart */}
      {(showAll || activeChart === 'montecarlo') && mcResult && (
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Monte Carlo Probability Fan ({valuationLabel})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                200 randomized market return sequences at {(debouncedVolatility * 100).toFixed(0)}% annual standard deviation.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-2 rounded-lg border border-slate-200 shrink-0">
              <label htmlFor="mc-vol-slider" className="text-xs font-medium text-slate-700 whitespace-nowrap">
                Return Volatility
              </label>
              <input
                id="mc-vol-slider"
                type="range"
                min="0.05"
                max="0.25"
                step="0.01"
                value={sliderVolatility}
                onChange={e => setSliderVolatility(parseFloat(e.target.value))}
                className="w-28 sm:w-36"
              />
              <span className="text-xs font-mono font-semibold text-slate-900 w-10 text-right tabular-nums">
                {(sliderVolatility * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Monte Carlo Summary Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
              <div className="text-[11px] font-medium text-slate-500">Success Probability</div>
              <div
                className={`text-xl font-bold tabular-nums mt-0.5 ${
                  mcResult.successProbability >= 85
                    ? 'text-emerald-700'
                    : mcResult.successProbability >= 65
                    ? 'text-amber-700'
                    : 'text-rose-700'
                }`}
              >
                {mcResult.successProbability}%
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
              <div className="text-[11px] font-medium text-slate-500">Bear End (10th Pct)</div>
              <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
                {formatCurrencyCompact(finalMc?.p10 ?? 0)}
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
              <div className="text-[11px] font-medium text-slate-500">Median End (50th Pct)</div>
              <div className="text-xl font-bold text-emerald-700 tabular-nums mt-0.5">
                {formatCurrencyCompact(finalMc?.p50 ?? 0)}
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
              <div className="text-[11px] font-medium text-slate-500">Bull End (90th Pct)</div>
              <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
                {formatCurrencyCompact(finalMc?.p90 ?? 0)}
              </div>
            </div>
          </div>

          <div className="h-80 sm:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mcChartData} margin={{ top: 18, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis tickFormatter={formatCurrencyCompact} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 'auto']} width={60} />
                <Tooltip
                  content={
                    <FinancialTooltip
                      hasSpouse={hasSpouse}
                      primaryName={primaryName}
                      spouseName={spouseName}
                    />
                  }
                />
                <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                {renderMilestoneLines()}
                <Area type="monotone" dataKey="p90" name="90th Percentile (Bull)" stroke="#6ee7b7" fill="#d1fae5" fillOpacity={0.35} />
                <Area type="monotone" dataKey="p75" name="75th Percentile" stroke="#34d399" fill="#a7f3d0" fillOpacity={0.35} />
                <Area type="monotone" dataKey="p50" name="Median (50th Pct)" stroke="#059669" strokeWidth={2.5} fill="#6ee7b7" fillOpacity={0.25} />
                <Area type="monotone" dataKey="p25" name="25th Percentile" stroke="#0d9488" strokeWidth={1.5} fill="transparent" />
                <Area type="monotone" dataKey="p10" name="10th Percentile (Bear)" stroke="#d97706" strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
