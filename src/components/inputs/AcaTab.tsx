import React from 'react';
import { ShieldCheck, HeartPulse, Sliders, Info, CheckCircle2 } from 'lucide-react';
import { PlannerConfig, AcaOptimizationConfig, AcaFplPreset } from '../../types';
import { ACA_FPL_BASE, getAcaFplLimit } from '../../defaultData';
import { formatCurrency } from '../../utils/formatters';

interface AcaTabProps {
  config: PlannerConfig;
  onChange: (updated: PlannerConfig) => void;
  onNavigateToSimulator?: () => void;
}

export const AcaTab: React.FC<AcaTabProps> = ({ config, onChange, onNavigateToSimulator }) => {
  const hasSpouse = Boolean(config.scenario.hasSpouse);
  const defaultHouseholdSize: 1 | 2 = hasSpouse ? 2 : 1;

  const acaConfig: AcaOptimizationConfig = config.acaOptimization || {
    enabled: false,
    preset: 'fpl400',
    householdSize: defaultHouseholdSize,
    customMagilimit: hasSpouse ? 84600 : 62600,
    targetMagilimit: hasSpouse ? 84600 : 62600,
    unsubsidizedAnnualPremium: config.expenses.expMedPremium * 12 > 0 ? config.expenses.expMedPremium * 12 : (hasSpouse ? 21600 : 13200),
    endAge: config.milestones.medicareAge || 65,
    prioritizeCashBeforeRoth: true,
    adjustMedicalExpensesWithSubsidy: false,
  };

  const updateAcaConfig = (partial: Partial<AcaOptimizationConfig>) => {
    const updated = { ...acaConfig, ...partial };
    if (partial.preset !== undefined || partial.householdSize !== undefined || partial.customMagilimit !== undefined) {
      const preset = partial.preset ?? updated.preset;
      const hSize = partial.householdSize ?? updated.householdSize;
      const customVal = partial.customMagilimit ?? updated.customMagilimit;
      updated.targetMagilimit = getAcaFplLimit(hSize, preset, customVal);
    }
    onChange({
      ...config,
      acaOptimization: updated,
    });
  };

  const baseFpl = ACA_FPL_BASE[acaConfig.householdSize] || 21150;

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-emerald-600" />
            ACA Medical Insurance Subsidy Drawdown Strategy
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Plan your drawdown sequence between retirement and Medicare age 65 to keep Adjusted Gross Income (AGI/MAGI) under ACA subsidy qualification limits.
          </p>
        </div>
        {onNavigateToSimulator && (
          <button
            onClick={onNavigateToSimulator}
            className="text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-semibold px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors"
          >
            Open Full ACA Simulator &rarr;
          </button>
        )}
      </div>

      {/* Enable Toggle Card */}
      <div
        className={`p-4 rounded-xl border transition-all ${
          acaConfig.enabled
            ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                acaConfig.enabled ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">
                Enable ACA Subsidy Drawdown Optimization
              </span>
              <span className="text-[11px] text-slate-500">
                {acaConfig.enabled
                  ? 'Active: Pre-tax withdrawals capped to preserve healthcare subsidy until Medicare age 65.'
                  : 'Disabled: Standard priority sequence draws pre-tax first without AGI constraints.'}
              </span>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={acaConfig.enabled}
              onChange={e => updateAcaConfig({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>
      </div>

      {/* Config Form Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Preset Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Target AGI / FPL Subsidy Threshold
          </label>
          <select
            value={acaConfig.preset}
            onChange={e => updateAcaConfig({ preset: e.target.value as AcaFplPreset })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 bg-white focus:outline-emerald-500 font-medium"
          >
            <option value="fpl400">400% FPL Cliff ({formatCurrency(baseFpl * 4)}) &bull; Avoid Hard Cliff</option>
            <option value="fpl300">300% FPL Benchmark ({formatCurrency(baseFpl * 3)}) &bull; Enhanced PTC</option>
            <option value="fpl250">250% FPL Sweet Spot ({formatCurrency(baseFpl * 2.5)}) &bull; Max Silver CSR</option>
            <option value="fpl200">200% FPL Low Premium ({formatCurrency(baseFpl * 2)}) &bull; Ultra-Low Premium</option>
            <option value="custom">Custom Dollar Limit...</option>
          </select>
          <p className="text-[10px] text-slate-500 mt-1">
            Target Base MAGI: <strong className="text-slate-800">{formatCurrency(acaConfig.targetMagilimit)}</strong> (automatically inflates annually with projected CPI-U).
          </p>
        </div>

        {/* Custom Limit or Household size */}
        {acaConfig.preset === 'custom' ? (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Custom Maximum Annual MAGI ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">$</span>
              <input
                type="number"
                step="1000"
                value={acaConfig.customMagilimit ?? acaConfig.targetMagilimit}
                onChange={e => updateAcaConfig({ customMagilimit: parseFloat(e.target.value) || 0 })}
                className="w-full pl-7 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 font-bold focus:outline-emerald-500"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Cap on withdrawals from pre-tax 401(k) / IRA to qualify for subsidies.
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Household Size
            </label>
            <select
              value={acaConfig.householdSize}
              onChange={e => updateAcaConfig({ householdSize: parseInt(e.target.value, 10) as 1 | 2 })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 bg-white focus:outline-emerald-500 font-medium"
            >
              <option value={2}>2 Persons (Married Filing Jointly)</option>
              <option value={1}>1 Person (Single)</option>
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              100% FPL: {formatCurrency(baseFpl)}. 400% Cliff: {formatCurrency(baseFpl * 4)}.
            </p>
          </div>
        )}

        {/* Unsubsidized Health Insurance Premium */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Estimated Unsubsidized Annual Premium ($/yr)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">$</span>
            <input
              type="number"
              step="600"
              value={acaConfig.unsubsidizedAnnualPremium}
              onChange={e => updateAcaConfig({ unsubsidizedAnnualPremium: parseFloat(e.target.value) || 0 })}
              className="w-full pl-7 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 font-medium focus:outline-emerald-500"
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Cost of pre-Medicare private silver health plan (~{formatCurrency(acaConfig.unsubsidizedAnnualPremium / 12)}/mo).
          </p>
        </div>

        {/* Non-AGI Priority */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Non-AGI Drawdown Preference
          </label>
          <select
            value={acaConfig.prioritizeCashBeforeRoth !== false ? 'cashFirst' : 'rothFirst'}
            onChange={e => updateAcaConfig({ prioritizeCashBeforeRoth: e.target.value === 'cashFirst' })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 bg-white focus:outline-emerald-500 font-medium"
          >
            <option value="cashFirst">Cash & Savings First &rarr; then Roth</option>
            <option value="rothFirst">Roth Accounts First &rarr; then Cash</option>
          </select>
          <p className="text-[10px] text-slate-500 mt-1">
            Which non-taxable account to draw from first when bridging the living expense gap.
          </p>
        </div>

        {/* Reinvest Subsidy Savings */}
        <div className="md:col-span-2 pt-2 border-t border-slate-100">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(acaConfig.adjustMedicalExpensesWithSubsidy)}
              onChange={e => updateAcaConfig({ adjustMedicalExpensesWithSubsidy: e.target.checked })}
              className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
            />
            <div>
              <span className="text-xs font-semibold text-slate-800">
                Credit Subsidy Savings to Portfolio (Reinvest Premium Credits)
              </span>
              <p className="text-[10px] text-slate-500 mt-0.5">
                When enabled, qualified annual ACA premium tax credits directly preserve portfolio capital by crediting savings to your cash/brokerage reserve.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Info Callout */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1.5 leading-relaxed">
          <p>
            <strong>How the algorithm executes:</strong> When living expenses exceed your target AGI cap, the simulation
            draws pre-tax 401(k)/IRA balances only up to the limit. The remaining living expenses are funded from Cash and Roth accounts
            (which produce 0 AGI). Once Medicare starts at age {acaConfig.endAge}, normal liquidation priority resumes.
          </p>
          <p className="text-[11px] text-blue-800">
            <strong>Phase 0 Transition Logic:</strong> If partial-year earned wages in your retirement year already exceed your ACA limit,
            the planner draws from high-priority tax-deferred accounts as income instead of draining Cash/Roth reserves, preserving your
            non-AGI assets for full retirement years where subsidies can actually be captured.
          </p>
        </div>
      </div>
    </div>
  );
};
