import React, { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, HelpCircle, Save } from 'lucide-react';
import { PlannerConfig, IncomeSource, TaxType, MonthlyIndicator } from '../types';

interface InputsSectionProps {
  config: PlannerConfig;
  onChange: (updated: PlannerConfig) => void;
}

export const InputsSection: React.FC<InputsSectionProps> = ({ config, onChange }) => {
  const [activeTab, setActiveTab] = useState<'sources' | 'scenario' | 'rates' | 'expenses'>('sources');

  const updateScenario = (key: keyof typeof config.scenario, value: any) => {
    onChange({
      ...config,
      scenario: {
        ...config.scenario,
        [key]: value,
      },
    });
  };

  const updateMilestone = (key: keyof typeof config.milestones, value: number) => {
    onChange({
      ...config,
      milestones: {
        ...config.milestones,
        [key]: value,
      },
    });
  };

  const updateRates = (key: keyof typeof config.rates, value: number) => {
    onChange({
      ...config,
      rates: {
        ...config.rates,
        [key]: value,
      },
    });
  };

  const updateExpenses = (key: keyof typeof config.expenses, value: number) => {
    onChange({
      ...config,
      expenses: {
        ...config.expenses,
        [key]: value,
      },
    });
  };

  const updateSource = (id: string, updates: Partial<IncomeSource>) => {
    const updatedSources = config.sources.map(s => {
      if (s.id === id) {
        return { ...s, ...updates };
      }
      return s;
    });
    onChange({
      ...config,
      sources: updatedSources,
    });
  };

  const addSource = () => {
    if (config.sources.length >= 20) {
      alert('Maximum 20 income sources supported.');
      return;
    }
    const newPriority = config.sources.length + 1;
    const newSource: IncomeSource = {
      id: `src-${Date.now()}`,
      name: `New Account ${newPriority}`,
      balance: 50000,
      priority: newPriority,
      monthly: 'N',
      taxType: 'Income',
      annualPayment: 0,
      startAge: 60,
      notes: '',
    };
    onChange({
      ...config,
      sources: [...config.sources, newSource],
    });
  };

  const removeSource = (id: string) => {
    onChange({
      ...config,
      sources: config.sources.filter(s => s.id !== id),
    });
  };

  const movePriority = (index: number, direction: 'up' | 'down') => {
    const newSources = [...config.sources];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSources.length) return;

    // Swap priorities
    const tempPri = newSources[index].priority;
    newSources[index].priority = newSources[targetIndex].priority;
    newSources[targetIndex].priority = tempPri;

    // Swap positions
    const temp = newSources[index];
    newSources[index] = newSources[targetIndex];
    newSources[targetIndex] = temp;

    onChange({
      ...config,
      sources: newSources,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header and Sub-tabs */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Scenario & Portfolio Configuration</h2>
          <p className="text-xs text-slate-500">
            Edit financial inputs, milestone ages, rates, and configure up to 20 income/asset accounts.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg text-xs font-medium">
          <button
            onClick={() => setActiveTab('sources')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'sources'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Income Sources ({config.sources.length})
          </button>
          <button
            onClick={() => setActiveTab('scenario')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'scenario'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Scenario & Milestones
          </button>
          <button
            onClick={() => setActiveTab('rates')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'rates'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Return & Tax Rates
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'expenses'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly Expenses
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* Tab 1: Income Sources */}
        {activeTab === 'sources' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Income & Asset Accounts</h3>
                <p className="text-xs text-slate-500">
                  Priority determines liquidation order (lower number tapped first). Non-monthly accounts deplete; monthly accounts provide recurring guaranteed cash flow.
                </p>
              </div>
              <button
                onClick={addSource}
                disabled={config.sources.length >= 20}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Income Source
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3 w-14">Order</th>
                    <th className="py-2.5 px-3">Account / Source Name</th>
                    <th className="py-2.5 px-3 text-right">Initial Balance ($)</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Tax Treatment</th>
                    <th className="py-2.5 px-3 text-right">Annual Flow ($/yr)</th>
                    <th className="py-2.5 px-3 text-center">Start Age</th>
                    <th className="py-2.5 px-3">Notes</th>
                    <th className="py-2.5 px-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {config.sources.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1">
                          <span className="w-5 h-5 rounded bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                            {s.priority}
                          </span>
                          <div className="flex flex-col">
                            <button
                              disabled={idx === 0}
                              onClick={() => movePriority(idx, 'up')}
                              className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              disabled={idx === config.sources.length - 1}
                              onClick={() => movePriority(idx, 'down')}
                              className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={s.name}
                          onChange={e => updateSource(s.id, { name: e.target.value })}
                          className="w-full font-medium text-slate-900 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-emerald-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          disabled={s.monthly === 'Y'}
                          value={s.monthly === 'Y' ? 0 : s.balance}
                          onChange={e => updateSource(s.id, { balance: parseFloat(e.target.value) || 0 })}
                          className="w-24 text-right border border-slate-300 rounded px-2 py-1 text-xs disabled:bg-slate-100 disabled:text-slate-400 focus:outline-emerald-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={s.monthly}
                          onChange={e => updateSource(s.id, { monthly: e.target.value as MonthlyIndicator })}
                          className="border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:outline-emerald-500"
                        >
                          <option value="N">Depleting Asset</option>
                          <option value="Y">Guaranteed Flow</option>
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={s.taxType}
                          onChange={e => updateSource(s.id, { taxType: e.target.value as TaxType })}
                          className="border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:outline-emerald-500"
                        >
                          <option value="Income">Ordinary Income</option>
                          <option value="Capital Gain">Capital Gain</option>
                          <option value="N/a">Tax-Free (Roth/Cash)</option>
                        </select>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          disabled={s.monthly === 'N'}
                          value={s.monthly === 'N' ? 0 : s.annualPayment}
                          onChange={e => updateSource(s.id, { annualPayment: parseFloat(e.target.value) || 0 })}
                          className="w-24 text-right border border-slate-300 rounded px-2 py-1 text-xs disabled:bg-slate-100 disabled:text-slate-400 focus:outline-emerald-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          value={s.startAge}
                          onChange={e => updateSource(s.id, { startAge: parseFloat(e.target.value) || 0 })}
                          className="w-14 text-center border border-slate-300 rounded px-1.5 py-1 text-xs focus:outline-emerald-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={s.notes}
                          placeholder="Optional notes"
                          onChange={e => updateSource(s.id, { notes: e.target.value })}
                          className="w-full text-slate-600 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-emerald-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => removeSource(s.id)}
                          className="text-slate-400 hover:text-red-600 transition-colors p-1"
                          title="Remove source"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Scenario Parameters & Milestone Ages */}
        {activeTab === 'scenario' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
                Scenario Parameters
              </h3>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">User Name</label>
                <input
                  type="text"
                  value={config.scenario.userName}
                  onChange={e => updateScenario('userName', e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Birth Date</label>
                  <input
                    type="date"
                    value={config.scenario.birthDate}
                    onChange={e => updateScenario('birthDate', e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Target Retirement Date</label>
                  <input
                    type="date"
                    value={config.scenario.retDate}
                    onChange={e => updateScenario('retDate', e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Retirement Year Salary ($)
                </label>
                <input
                  type="number"
                  value={config.scenario.retSalary}
                  onChange={e => updateScenario('retSalary', parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Prorated in Phase 0 based on the fraction of the year worked before target date.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Taxable Income % (Withdrawal Share)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={config.scenario.taxablePct}
                    onChange={e => updateScenario('taxablePct', parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Life Expectancy Age</label>
                  <input
                    type="number"
                    value={config.scenario.lifeExpAge}
                    onChange={e => updateScenario('lifeExpAge', parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
                Milestone Ages
              </h3>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  401k / IRA Penalty-Free Withdrawal Age
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={config.milestones.retireAcctAge}
                  onChange={e => updateMilestone('retireAcctAge', parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Unlocks tax-deferred account withdrawals (standard IRS rule: age 59½ or 60).
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Social Security Earliest Age
                </label>
                <input
                  type="number"
                  value={config.milestones.ssMinAge}
                  onChange={e => updateMilestone('ssMinAge', parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Medicare Start Age
                </label>
                <input
                  type="number"
                  value={config.milestones.medicareAge}
                  onChange={e => updateMilestone('medicareAge', parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Required Minimum Distribution (RMD) Age
                </label>
                <input
                  type="number"
                  value={config.milestones.rmdAge}
                  onChange={e => updateMilestone('rmdAge', parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Return & Tax Rates */}
        {activeTab === 'rates' && (
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
                  onChange={e => updateRates('investRate', parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Nominal annual compounding growth applied to remaining depleting account balances. (e.g. 0.06 = 6.0%)
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Annual Inflation Rate (%)
                </label>
                <input
                  type="number"
                  step="0.005"
                  value={config.rates.inflationRate}
                  onChange={e => updateRates('inflationRate', parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Annual rate at which monthly living and medical expenses escalate in future dollars. (e.g. 0.025 = 2.5%)
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
                Tax Toggles & Brackets
              </h3>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Target Federal Tax Bracket (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={config.rates.fedBracket}
                  onChange={e => updateRates('fedBracket', parseFloat(e.target.value) || 0)}
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
                  onChange={e => updateRates('stateRate', parseFloat(e.target.value) || 0)}
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
                    onChange={e => updateRates('capgainRate', parseFloat(e.target.value) || 0)}
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
                    onChange={e => updateRates('capgainPct', parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Monthly Expenses */}
        {activeTab === 'expenses' && (
          <div className="max-w-xl space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Monthly Expenses (Base Year, Today's Dollars)
              </h3>
              <p className="text-xs text-slate-500">
                These monthly figures are annualized (x 12) and grown each year by the inflation rate.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Day-to-day After-tax Living Expenses ($ / month)
              </label>
              <input
                type="number"
                value={config.expenses.expDaily}
                onChange={e => updateExpenses('expDaily', parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Medical Premium ($ / month)
              </label>
              <input
                type="number"
                value={config.expenses.expMedPremium}
                onChange={e => updateExpenses('expMedPremium', parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Medical Out-of-pocket Expenses ($ / month)
              </label>
              <input
                type="number"
                value={config.expenses.expMedOop}
                onChange={e => updateExpenses('expMedOop', parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <span className="font-semibold text-slate-800">Total Base Annual Expense: </span>
              <span className="font-mono font-bold text-emerald-700">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                  12 * (config.expenses.expDaily + config.expenses.expMedPremium + config.expenses.expMedOop)
                )}
                /year
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
