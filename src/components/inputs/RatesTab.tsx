import React from 'react';
import { PlannerConfig, RateAssumptions } from '../../types';
import { NumericInput } from '../NumericInput';

interface RatesTabProps {
  config: PlannerConfig;
  onUpdateRates: (key: keyof RateAssumptions, value: number) => void;
}

interface RateSliderRowProps {
  label: string;
  helper: string;
  value: number;
  min: number;
  max: number;
  step: number;
  fallbackValue: number;
  onChange: (val: number) => void;
}

const RateSliderRow: React.FC<RateSliderRowProps> = ({
  label,
  helper,
  value,
  min,
  max,
  step,
  fallbackValue,
  onChange,
}) => {
  const pct = Number((value * 100).toFixed(2));
  return (
    <div className="space-y-2 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-800">{label}</label>
          <p className="text-xs text-slate-500 mt-0.5">{helper}</p>
        </div>
        <div className="w-28 shrink-0">
          <NumericInput
            suffix="%"
            step={step}
            min={min}
            max={max}
            displayScale={100}
            fallbackValue={fallbackValue}
            value={value}
            onChange={onChange}
            className="w-full min-h-[38px] text-right font-mono text-sm text-slate-900 border border-slate-300 rounded-lg pl-2.5 py-1.5 bg-white focus:border-emerald-600 focus:outline-none"
            ariaLabel={label}
          />
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, pct))}
        onChange={e => onChange(parseFloat(e.target.value) / 100)}
        aria-label={`${label} slider`}
        className="w-full"
      />
    </div>
  );
};

export const RatesTab: React.FC<RatesTabProps> = ({ config, onUpdateRates }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Investment & Inflation */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Growth &amp; Inflation Assumptions</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Drag sliders to watch sustainability and ending portfolio respond live above.
          </p>
        </div>

        <RateSliderRow
          label="Annual Investment Return"
          helper="Expected annual portfolio growth rate (nominal)"
          value={config.rates.investRate}
          min={0}
          max={14}
          step={0.25}
          fallbackValue={0.06}
          onChange={val => onUpdateRates('investRate', val)}
        />

        <RateSliderRow
          label="General Living Inflation (CPI)"
          helper="Applies to day-to-day living costs and inflation-adjusted major expenses"
          value={config.rates.inflationRate}
          min={0}
          max={10}
          step={0.25}
          fallbackValue={0.025}
          onChange={val => onUpdateRates('inflationRate', val)}
        />

        <RateSliderRow
          label="Healthcare / Medical Inflation"
          helper="Decoupled escalation rate for pre-Medicare and Medicare health costs"
          value={config.rates.medicalInflationRate ?? 0.045}
          min={0}
          max={12}
          step={0.25}
          fallbackValue={0.045}
          onChange={val => onUpdateRates('medicalInflationRate', val)}
        />
      </div>

      {/* Tax Brackets */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Effective Tax Rates</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Applied to ordinary income withdrawals, guaranteed streams, and brokerage capital gains.
          </p>
        </div>

        <RateSliderRow
          label="Federal Ordinary Tax Bracket"
          helper="Effective / marginal federal rate applied to taxable income"
          value={config.rates.fedBracket}
          min={0}
          max={40}
          step={1}
          fallbackValue={0.22}
          onChange={val => onUpdateRates('fedBracket', val)}
        />

        <RateSliderRow
          label="State Income Tax Rate"
          helper="Set to 0% if retiring in a no-income-tax state"
          value={config.rates.stateRate}
          min={0}
          max={15}
          step={0.5}
          fallbackValue={0.05}
          onChange={val => onUpdateRates('stateRate', val)}
        />

        <RateSliderRow
          label="Long-Term Capital Gains Tax Rate"
          helper="Tax rate applied to realized investment gains from brokerage sales"
          value={config.rates.capgainRate}
          min={0}
          max={30}
          step={1}
          fallbackValue={0.15}
          onChange={val => onUpdateRates('capgainRate', val)}
        />

        <RateSliderRow
          label="Capital Gain Share of Brokerage Sales"
          helper="Percentage of brokerage withdrawal treated as taxable gain vs. cost basis"
          value={config.rates.capgainPct}
          min={0}
          max={100}
          step={5}
          fallbackValue={0.6}
          onChange={val => onUpdateRates('capgainPct', val)}
        />
      </div>
    </div>
  );
};
