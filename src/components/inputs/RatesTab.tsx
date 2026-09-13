import React from 'react';
import { PlannerConfig, RateAssumptions } from '../../types';

interface RatesTabProps {
  config: PlannerConfig;
  onUpdateRates: (key: keyof RateAssumptions, value: number) => void;
}

export const RatesTab: React.FC<RatesTabProps> = ({ config, onUpdateRates }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
          Investment & Inflation Assumptions
        </h3>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Annual Investment Rate of Return (%)
          </label>
          <input
            type="number"
            step="0.005"
            value={config.rates.investRate}
            onChange={e => onUpdateRates('investRate', parseFloat(e.target.value) || 0)}
            className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Annual General Inflation Rate (%)
          </label>
          <input
            type="number"
            step="0.005"
            value={config.rates.inflationRate}
            onChange={e => onUpdateRates('inflationRate', parseFloat(e.target.value) || 0)}
            className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
          />
          <p className="text-[10px] text-slate-500 mt-0.5">Applies to day-to-day living expenses (standard 2.5%)</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center justify-between">
            <span>Medical / Healthcare Inflation Rate (%)</span>
            <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded font-semibold">Decoupled</span>
          </label>
          <input
            type="number"
            step="0.005"
            value={config.rates.medicalInflationRate ?? 0.045}
            onChange={e => onUpdateRates('medicalInflationRate', parseFloat(e.target.value) || 0)}
            className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
          />
          <p className="text-[10px] text-slate-500 mt-0.5">
            Decoupled escalation: healthcare historically runs at 4.5% vs 2.5% CPI.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
          Tax Brackets & Rates
        </h3>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Federal Tax Bracket (%)
          </label>
          <input
            type="number"
            step="0.01"
            value={config.rates.fedBracket}
            onChange={e => onUpdateRates('fedBracket', parseFloat(e.target.value) || 0)}
            className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            State Tax Rate (%)
          </label>
          <input
            type="number"
            step="0.01"
            value={config.rates.stateRate}
            onChange={e => onUpdateRates('stateRate', parseFloat(e.target.value) || 0)}
            className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Capital Gain Tax Rate (%)
            </label>
            <input
              type="number"
              step="0.01"
              value={config.rates.capgainRate}
              onChange={e => onUpdateRates('capgainRate', parseFloat(e.target.value) || 0)}
              className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Capital Gain Share of Taxable %
            </label>
            <input
              type="number"
              step="0.05"
              value={config.rates.capgainPct}
              onChange={e => onUpdateRates('capgainPct', parseFloat(e.target.value) || 0)}
              className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
