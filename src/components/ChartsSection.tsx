import React, { useState } from 'react';
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
} from 'recharts';
import { PlannerConfig, YearSimulationResult } from '../types';

interface ChartsSectionProps {
  config: PlannerConfig;
  years: YearSimulationResult[];
  showAll?: boolean;
}

const formatCurrencyCompact = (val: number) => {
  if (Math.abs(val) >= 1_000_000) {
    return `$${(val / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(val) >= 1_000) {
    return `$${(val / 1_000).toFixed(0)}k`;
  }
  return `$${val}`;
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val);
};

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

export const ChartsSection: React.FC<ChartsSectionProps> = ({ config, years, showAll = false }) => {
  const [activeChart, setActiveChart] = useState<'depletion' | 'income' | 'expenses' | 'balance'>('depletion');

  // Prepare data for Depletion Chart
  const depletionData = years.map(y => ({
    year: y.calYear,
    age: y.age,
    balance: Math.max(0, Math.round(y.combEndBal)),
    rawBalance: Math.round(y.combEndBal),
    depleted: y.depleted,
  }));

  // Prepare data for Income by Source (Stacked Bar)
  const incomeData = years.map(y => {
    const item: Record<string, any> = {
      year: y.calYear,
      age: y.age,
    };
    config.sources.forEach(s => {
      item[s.name] = Math.round(y.incomeBySource[s.id] || 0);
    });
    return item;
  });

  // Prepare data for Expenses & Taxes (Stacked Bar)
  const expenseData = years.map(y => ({
    year: y.calYear,
    age: y.age,
    Expenses: Math.round(y.expenses),
    'Federal Tax': Math.round(y.fedTax),
    'State Tax': Math.round(y.stateTax),
    'Capital Gain Tax': Math.round(y.capGainTax),
  }));

  // Prepare data for Balance by Source (Stacked Area/Bar)
  const depletingSources = config.sources.filter(s => s.monthly === 'N');
  const balanceData = years.map(y => {
    const item: Record<string, any> = {
      year: y.calYear,
      age: y.age,
    };
    depletingSources.forEach(s => {
      item[s.name] = Math.max(0, Math.round(y.endBalanceBySource[s.id] || 0));
    });
    return item;
  });

  return (
    <div className="space-y-6">
      {!showAll && (
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Portfolio Projections</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
              Nominal ($) Future Dollars
            </span>
          </div>
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
        </div>
      )}

      {/* 1. Overall Depletion Chart */}
      {(showAll || activeChart === 'depletion') && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Overall Depletion — Combined Portfolio Balance
              </h3>
              <p className="text-xs text-slate-500">
                Trajectory of total accessible assets after inflation-adjusted withdrawals and {config.rates.investRate * 100}% annual growth.
              </p>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={depletionData} margin={{ top: 10, right: 20, left: 15, bottom: 20 }}>
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
                  formatter={(val: number) => [formatCurrency(val), 'Combined Balance']}
                  labelFormatter={(label, payload) => {
                    const age = payload?.[0]?.payload?.age;
                    return `Year ${label} (Age ${age})`;
                  }}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Legend verticalAlign="top" height={36} />
                <Area
                  type="monotone"
                  dataKey="balance"
                  name="Combined Portfolio Balance"
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
                Income by Source (Stacked)
              </h3>
              <p className="text-xs text-slate-500">
                Annual withdrawals from each depleting account + guaranteed payments (Pensions, Social Security, Annuities).
              </p>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeData} margin={{ top: 10, right: 20, left: 15, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tickFormatter={formatCurrencyCompact} tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  formatter={(val: number, name: string) => [formatCurrency(val), name]}
                  labelFormatter={(label, payload) => {
                    const age = payload?.[0]?.payload?.age;
                    return `Year ${label} (Age ${age})`;
                  }}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Legend verticalAlign="top" height={40} wrapperStyle={{ fontSize: '11px' }} />
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
                Expenses & Taxes (Stacked)
              </h3>
              <p className="text-xs text-slate-500">
                Inflation-adjusted day-to-day & medical expenses combined with projected annual federal, state, and capital gains taxes.
              </p>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expenseData} margin={{ top: 10, right: 20, left: 15, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tickFormatter={formatCurrencyCompact} tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  formatter={(val: number, name: string) => [formatCurrency(val), name]}
                  labelFormatter={(label, payload) => {
                    const age = payload?.[0]?.payload?.age;
                    return `Year ${label} (Age ${age})`;
                  }}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Expenses" stackId="expStack" fill="#3b82f6" />
                <Bar dataKey="Federal Tax" stackId="expStack" fill="#ef4444" />
                <Bar dataKey="State Tax" stackId="expStack" fill="#f97316" />
                <Bar dataKey="Capital Gain Tax" stackId="expStack" fill="#a855f7" />
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
                Balance Snapshot by Account
              </h3>
              <p className="text-xs text-slate-500">
                Year-end balances across your depleting asset accounts (401k, IRAs, Investments, Savings).
              </p>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={balanceData} margin={{ top: 10, right: 20, left: 15, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tickFormatter={formatCurrencyCompact} tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  formatter={(val: number, name: string) => [formatCurrency(val), name]}
                  labelFormatter={(label, payload) => {
                    const age = payload?.[0]?.payload?.age;
                    return `Year ${label} (Age ${age})`;
                  }}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Legend verticalAlign="top" height={40} wrapperStyle={{ fontSize: '11px' }} />
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
