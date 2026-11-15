import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
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
import { Flag, Sparkles, Activity } from 'lucide-react';
import { PlannerConfig, YearSimulationResult, DollarDisplayMode, MonteCarloPercentileResult } from '../types';
import { runMonteCarloSimulation } from '../engine';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatters';

interface ChartsSectionProps {
  config: PlannerConfig;
  years: YearSimulationResult[];
  showAll?: boolean;
  dollarMode?: DollarDisplayMode;
  onDollarModeChange?: (mode: DollarDisplayMode) => void;
}

// Distinct colors for sources
const SOURCE_COLORS = [
  '#0284c7', // Sky blue
  '#0d9488', // Teal
  '#16a34a', // Green
  '#ca8a04', // Yellow/Gold
  '#ea580c', // Orange
  '#dc2626', // Red
  '#9333ea', // Purple
  '#4f46e5', // Indigo
  '#0891b2', // Cyan
  '#db2777', // Pink
  '#65a30d', // Lime
  '#d97706', // Amber
];

export const ChartsSection: React.FC<ChartsSectionProps> = ({
  config,
  years,
  showAll = false,
  dollarMode = 'nominal',
  onDollarModeChange,
}) => {
  const [activeChart, setActiveChart] = useState<'depletion' | 'income' | 'expenses' | 'balance'>('depletion');
  const [showMilestones, setShowMilestones] = useState(true);
  const [isMonteCarlo, setIsMonteCarlo] = useState(false);
  const [mcVolatility, setMcVolatility] = useState(0.12);

  const mcResult = useMemo(() => {
    return runMonteCarloSimulation(config, mcVolatility, 200, 'baseline', dollarMode);
  }, [config, mcVolatility, dollarMode]);

  const mcChartData = mcResult.calYears.map((calYr: number, i: number) => {
    const p10 = Math.max(0, mcResult.p10[i]);
    const p25 = Math.max(0, mcResult.p25[i]);
    const p50 = Math.max(0, mcResult.p50[i]);
    const p75 = Math.max(0, mcResult.p75[i]);
    const p90 = Math.max(0, mcResult.p90[i]);
    return {
      year: calYr,
      p10,
      p25,
      p50,
      p75,
      p90,
    };
  });

  const hasSpouse = Boolean(config.scenario?.hasSpouse);
  const primaryName = (config.scenario?.userName || 'Primary').split(' ')[0] || 'Primary';
  const spouseName = (config.scenario?.spouseName || 'Spouse').split(' ')[0] || 'Spouse';

  // Find milestone calendar years
  const retYear = parseInt((config.scenario?.retDate || '2030-07-01').split('-')[0], 10) || 2030;
  const spouseRetYear = hasSpouse && config.scenario?.spouseRetDate
    ? parseInt(config.scenario.spouseRetDate.split('-')[0], 10)
    : null;

  const medicareYearObj = years.find(y => y.age >= config.milestones.medicareAge);
  const medicareYear = medicareYearObj ? medicareYearObj.calYear : null;

  const rmdYearObj = years.find(y => y.age >= config.milestones.rmdAge);
  const rmdYear = rmdYearObj ? rmdYearObj.calYear : null;

  const ssMinYearObj = years.find(y => y.age >= config.milestones.ssMinAge);
  const ssMinYear = ssMinYearObj ? ssMinYearObj.calYear : null;

  // Deflator helper
  const getDeflator = (yrIndex: number) => {
    if (dollarMode === 'nominal') return 1;
    return Math.pow(1 + config.rates.inflationRate, yrIndex);
  };

  // Prepare data for Depletion Chart
  const depletionData = years.map(y => {
    const deflator = getDeflator(y.yr);
    const adjBal = Math.round(y.combEndBal / deflator);
    return {
      year: y.calYear,
      age: y.age,
      spouseAge: y.spouseAge,
      balance: Math.max(0, adjBal),
      rawBalance: adjBal,
      depleted: y.depleted,
    };
  });

  // Prepare data for Income by Source (Stacked Bar)
  const incomeData = years.map(y => {
    const deflator = getDeflator(y.yr);
    const item: Record<string, any> = {
      year: y.calYear,
      age: y.age,
      spouseAge: y.spouseAge,
    };
    config.sources.forEach(s => {
      item[s.name] = Math.round((y.incomeBySource[s.id] || 0) / deflator);
    });
    return item;
  });

  // Prepare data for Expenses & Taxes (Stacked Bar)
  const expenseData = years.map(y => {
    const deflator = getDeflator(y.yr);
    return {
      year: y.calYear,
      age: y.age,
      spouseAge: y.spouseAge,
      'General Living': Math.round((y.generalExpenses || 0) / deflator),
      'Healthcare': Math.round((y.medicalExpenses || 0) / deflator),
      'Major Expenses': Math.round((y.majorExpenses || 0) / deflator),
      'Federal Tax': Math.round(y.fedTax / deflator),
      'State Tax': Math.round(y.stateTax / deflator),
      'Capital Gain Tax': Math.round(y.capGainTax / deflator),
    };
  });

  // Prepare data for Balance by Source (Stacked Area/Bar)
  const depletingSources = config.sources.filter(s => s.monthly === 'N');
  const balanceData = years.map(y => {
    const deflator = getDeflator(y.yr);
    const item: Record<string, any> = {
      year: y.calYear,
      age: y.age,
      spouseAge: y.spouseAge,
    };
    depletingSources.forEach(s => {
      item[s.name] = Math.max(0, Math.round((y.endBalanceBySource[s.id] || 0) / deflator));
    });
    return item;
  });

  const renderMilestoneLines = () => {
    if (!showMilestones) return null;
    return (
      <>
        <ReferenceLine
          x={retYear}
          stroke="#059669"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          label={{
            value: `🎯 ${primaryName} Ret. (${retYear})`,
            position: 'insideTopLeft',
            fill: '#059669',
            fontSize: 10,
            fontWeight: 600,
          }}
        />
        {spouseRetYear && spouseRetYear !== retYear && (
          <ReferenceLine
            x={spouseRetYear}
            stroke="#0d9488"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{
              value: `🎯 ${spouseName} Ret. (${spouseRetYear})`,
              position: 'insideTopLeft',
              fill: '#0d9488',
              fontSize: 10,
              fontWeight: 600,
            }}
          />
        )}
        {ssMinYear && (
          <ReferenceLine
            x={ssMinYear}
            stroke="#ea580c"
            strokeDasharray="3 3"
            strokeWidth={1}
            label={{
              value: `💰 SS (Age ${config.milestones.ssMinAge})`,
              position: 'insideTopLeft',
              fill: '#ea580c',
              fontSize: 10,
              fontWeight: 500,
            }}
          />
        )}
        {medicareYear && (
          <ReferenceLine
            x={medicareYear}
            stroke="#0284c7"
            strokeDasharray="3 3"
            strokeWidth={1}
            label={{
              value: `🛡️ Medicare (${config.milestones.medicareAge})`,
              position: 'insideTopLeft',
              fill: '#0284c7',
              fontSize: 10,
              fontWeight: 500,
            }}
          />
        )}
        {rmdYear && (
          <ReferenceLine
            x={rmdYear}
            stroke="#9333ea"
            strokeDasharray="3 3"
            strokeWidth={1}
            label={{
              value: `📋 RMDs (${config.milestones.rmdAge})`,
              position: 'insideTopLeft',
              fill: '#9333ea',
              fontSize: 10,
              fontWeight: 500,
            }}
          />
        )}
      </>
    );
  };

  const renderTooltipLabel = (label: any, payload: any) => {
    const item = payload?.[0]?.payload;
    if (!item) return `Year ${label}`;
    if (hasSpouse && item.spouseAge !== undefined) {
      return `Year ${label} (${primaryName}: Age ${item.age} • ${spouseName}: Age ${item.spouseAge})`;
    }
    return `Year ${label} (Age ${item.age})`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-bold text-slate-900">Portfolio Projections</h2>
          {/* Dollar Mode Toggle */}
          <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => onDollarModeChange && onDollarModeChange('nominal')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                dollarMode === 'nominal'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Nominal (Future $)
            </button>
            <button
              onClick={() => onDollarModeChange && onDollarModeChange('real')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                dollarMode === 'real'
                  ? 'bg-white text-emerald-800 font-semibold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Real (Today's Purchasing Power)
            </button>
          </div>

          {/* Milestone markers toggle */}
          <button
            onClick={() => setShowMilestones(!showMilestones)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              showMilestones
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Flag className="w-3 h-3 text-emerald-600" />
            Milestone Lines: {showMilestones ? 'ON' : 'OFF'}
          </button>

          {/* Monte Carlo Mode Toggle */}
          <button
            onClick={() => setIsMonteCarlo(!isMonteCarlo)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              isMonteCarlo
                ? 'bg-purple-600 text-white border-purple-600 font-semibold shadow-xs'
                : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Monte Carlo Fan Chart: {isMonteCarlo ? 'ON' : 'OFF'}
          </button>
        </div>

        {!showAll && !isMonteCarlo && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
            <button
              onClick={() => setActiveChart('depletion')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeChart === 'depletion' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Overall Depletion
            </button>
            <button
              onClick={() => setActiveChart('income')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeChart === 'income' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Income by Source
            </button>
            <button
              onClick={() => setActiveChart('expenses')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeChart === 'expenses' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Expenses & Taxes
            </button>
            <button
              onClick={() => setActiveChart('balance')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeChart === 'balance' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Balances by Account
            </button>
          </div>
        )}
      </div>

      {/* Monte Carlo Fan Chart View */}
      {isMonteCarlo && (
        <div className="bg-white p-5 rounded-xl border border-purple-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                  Monte Carlo Stochastic Fan Chart
                </span>
                <span className="text-sm font-bold text-slate-900">
                  Success Probability: <span className={`text-base font-extrabold ${mcResult.successProbability >= 85 ? 'text-emerald-700' : mcResult.successProbability >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{mcResult.successProbability}%</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Simulated 200 market return paths randomized with standard deviation (Volatility: {(mcVolatility * 100).toFixed(0)}%). Visualizing 10th (bear), 25th, 50th (median), 75th, and 90th (bull) percentile outcome trajectories.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <label className="text-xs font-semibold text-slate-700">Annual Return Volatility:</label>
              <input
                type="range"
                min="0.05"
                max="0.25"
                step="0.01"
                value={mcVolatility}
                onChange={e => setMcVolatility(parseFloat(e.target.value))}
                className="w-32 accent-purple-600"
              />
              <span className="text-xs font-mono font-bold text-purple-700 w-10 text-right">
                {(mcVolatility * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mcChartData} margin={{ top: 20, right: 20, left: 15, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tickFormatter={formatCurrencyCompact} tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 'auto']} />
                <Tooltip
                  formatter={(val: number, name: string) => [formatCurrency(val), name]}
                  labelFormatter={renderTooltipLabel}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                {renderMilestoneLines()}
                <Area type="monotone" dataKey="p90" name="90th Percentile (Bull Path)" stroke="#c084fc" fill="#f3e8ff" fillOpacity={0.3} />
                <Area type="monotone" dataKey="p75" name="75th Percentile" stroke="#a855f7" fill="#e9d5ff" fillOpacity={0.4} />
                <Area type="monotone" dataKey="p50" name="Median Outcome (50th Pct)" stroke="#7c3aed" strokeWidth={2.5} fill="#ddd6fe" fillOpacity={0.3} />
                <Area type="monotone" dataKey="p25" name="25th Percentile" stroke="#9333ea" fill="transparent" />
                <Area type="monotone" dataKey="p10" name="10th Percentile (Bear Path)" stroke="#6b21a8" strokeDasharray="3 3" fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 1. Overall Depletion Chart */}
      {(showAll || activeChart === 'depletion') && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Overall Depletion — Combined Portfolio Balance ({dollarMode === 'real' ? "Today's Purchasing Power" : 'Future Nominal $'})
              </h3>
              <p className="text-xs text-slate-500">
                Trajectory of total accessible assets after inflation-adjusted withdrawals and compound growth. Vertical lines indicate milestone transition years.
              </p>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={depletionData} margin={{ top: 20, right: 20, left: 15, bottom: 20 }}>
                <defs>
                  <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis
                  tickFormatter={formatCurrencyCompact}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  domain={[0, 'auto']}
                />
                <Tooltip
                  formatter={(val: number) => [formatCurrency(val), `Combined Balance (${dollarMode === 'real' ? "Today's $" : 'Nominal $'})`]}
                  labelFormatter={renderTooltipLabel}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Legend verticalAlign="top" height={36} />
                {renderMilestoneLines()}
                <Area
                  type="monotone"
                  dataKey="balance"
                  name={`Combined Portfolio Balance (${dollarMode === 'real' ? "Today's $" : 'Nominal $'})`}
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
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Income by Source ({dollarMode === 'real' ? "Today's Purchasing Power" : 'Future Nominal $'})
              </h3>
              <p className="text-xs text-slate-500">
                Annual withdrawals from each depleting account + guaranteed payments (Pensions, Social Security, Annuities).
              </p>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeData} margin={{ top: 20, right: 20, left: 15, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tickFormatter={formatCurrencyCompact} tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  formatter={(val: number, name: string) => [formatCurrency(val), name]}
                  labelFormatter={renderTooltipLabel}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Legend verticalAlign="top" height={40} wrapperStyle={{ fontSize: '11px' }} />
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
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Expenses & Taxes ({dollarMode === 'real' ? "Today's Purchasing Power" : 'Future Nominal $'})
              </h3>
              <p className="text-xs text-slate-500">
                Day-to-day & medical expenses combined with projected annual federal, state, and capital gains taxes.
              </p>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expenseData} margin={{ top: 20, right: 20, left: 15, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tickFormatter={formatCurrencyCompact} tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  formatter={(val: number, name: string) => [formatCurrency(val), name]}
                  labelFormatter={renderTooltipLabel}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                {renderMilestoneLines()}
                <Bar dataKey="General Living" stackId="expStack" fill="#3b82f6" />
                <Bar dataKey="Healthcare" stackId="expStack" fill="#8b5cf6" />
                <Bar dataKey="Major Expenses" stackId="expStack" fill="#f59e0b" />
                <Bar dataKey="Federal Tax" stackId="expStack" fill="#ef4444" />
                <Bar dataKey="State Tax" stackId="expStack" fill="#f97316" />
                <Bar dataKey="Capital Gain Tax" stackId="expStack" fill="#ec4899" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 4. Balances by Account (Stacked Area) */}
      {(showAll || activeChart === 'balance') && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Balance Snapshot by Account ({dollarMode === 'real' ? "Today's Purchasing Power" : 'Future Nominal $'})
              </h3>
              <p className="text-xs text-slate-500">
                Year-end balances across your depleting asset accounts (401k, IRAs, Investments, Savings).
              </p>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={balanceData} margin={{ top: 20, right: 20, left: 15, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tickFormatter={formatCurrencyCompact} tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  formatter={(val: number, name: string) => [formatCurrency(val), name]}
                  labelFormatter={renderTooltipLabel}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Legend verticalAlign="top" height={40} wrapperStyle={{ fontSize: '11px' }} />
                {renderMilestoneLines()}
                {depletingSources.map((s, idx) => (
                  <Area
                    key={s.id}
                    type="monotone"
                    dataKey={s.name}
                    stackId="balStack"
                    stroke={SOURCE_COLORS[idx % SOURCE_COLORS.length]}
                    fill={SOURCE_COLORS[idx % SOURCE_COLORS.length]}
                    fillOpacity={0.7}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

