import React, { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Users, User, Heart, Calendar, DollarSign, Sparkles, Car, Home, Plane, Layers, Info } from 'lucide-react';
import { PlannerConfig, IncomeSource, TaxType, MonthlyIndicator, SourceOwner, MajorExpense } from '../types';

interface InputsSectionProps {
  config: PlannerConfig;
  onChange: (updated: PlannerConfig) => void;
}

export const InputsSection: React.FC<InputsSectionProps> = ({ config, onChange }) => {
  const [activeTab, setActiveTab] = useState<'sources' | 'scenario' | 'rates' | 'expenses' | 'majorExpenses'>('sources');

  const primaryName = config.scenario.userName.split(' ')[0] || 'Primary';
  const spouseName = (config.scenario.spouseName || 'Spouse').split(' ')[0] || 'Spouse';
  const hasSpouse = Boolean(config.scenario.hasSpouse);
  const majorExpenses = config.majorExpenses || [];

  const [birthYearStr] = config.scenario.birthDate.split('-');
  const birthYear = parseInt(birthYearStr, 10) || 1970;
  const [retYearStr] = config.scenario.retDate.split('-');
  const retYear = parseInt(retYearStr, 10) || 2030;
  const currentRetAge = Math.round(retYear - birthYear);

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

  const updateExpenses = (key: keyof typeof config.expenses, value: any) => {
    onChange({
      ...config,
      expenses: {
        ...config.expenses,
        [key]: value,
      },
    });
  };

  const updateMajorExpense = (id: string, updates: Partial<MajorExpense>) => {
    const updated = (config.majorExpenses || []).map(m => {
      if (m.id === id) {
        return { ...m, ...updates };
      }
      return m;
    });
    onChange({
      ...config,
      majorExpenses: updated,
    });
  };

  const addMajorExpense = (sample?: Partial<MajorExpense>) => {
    const current = config.majorExpenses || [];
    if (current.length >= 10) {
      alert('Maximum 10 major expenses allowed.');
      return;
    }

    const defaultAge = sample?.age ?? Math.max(currentRetAge, 65 + current.length * 2);
    const newExpense: MajorExpense = {
      id: `maj-exp-${Date.now()}`,
      name: sample?.name ?? `Major Expense ${current.length + 1}`,
      age: defaultAge,
      amount: sample?.amount ?? 30000,
      inflationAdjusted: sample?.inflationAdjusted ?? true,
      notes: sample?.notes ?? '',
    };

    onChange({
      ...config,
      majorExpenses: [...current, newExpense],
    });
  };

  const removeMajorExpense = (id: string) => {
    onChange({
      ...config,
      majorExpenses: (config.majorExpenses || []).filter(m => m.id !== id),
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
      owner: 'primary',
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
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Scenario & Portfolio Configuration</h2>
            {hasSpouse ? (
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 border border-indigo-200">
                <Users className="w-3 h-3" /> 2-Person Household ({primaryName} & {spouseName})
              </span>
            ) : (
              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <User className="w-3 h-3" /> Individual ({primaryName})
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Edit financial inputs, household members, milestone ages, rates, and configure up to 20 income/asset accounts.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg text-xs font-medium flex-wrap">
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
            Household & Milestones
          </button>
          <button
            onClick={() => setActiveTab('rates')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'rates'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Rates & Taxes
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
          <button
            onClick={() => setActiveTab('majorExpenses')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'majorExpenses'
                ? 'bg-amber-500 text-white shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            Major Expenses ({majorExpenses.length}/10)
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* Tab 1: Income & Asset Sources */}
        {activeTab === 'sources' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Income & Asset Accounts Table (Up to 20 Sources)
                </h3>
                <p className="text-xs text-slate-500">
                  Priority determines liquidation order (lower number tapped first). Non-monthly accounts deplete; monthly accounts provide recurring guaranteed cash flow.
                </p>
              </div>
              <button
                onClick={addSource}
                disabled={config.sources.length >= 20}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md transition-colors shrink-0"
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
                    <th className="py-2.5 px-3">Account Category</th>
                    {hasSpouse && <th className="py-2.5 px-3">Owner</th>}
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
                      <td className="py-2 px-3">
                        <select
                          value={s.accountType || 'other'}
                          onChange={e => updateSource(s.id, { accountType: e.target.value as any })}
                          className="border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:outline-emerald-500 bg-white"
                        >
                          <option value="401k">401(k) / 403(b)</option>
                          <option value="ira">Traditional IRA</option>
                          <option value="roth">Roth IRA / Roth</option>
                          <option value="brokerage">Taxable Brokerage</option>
                          <option value="cash">Cash / Savings</option>
                          <option value="other">Other / Pension</option>
                        </select>
                      </td>
                      {hasSpouse && (
                        <td className="py-2 px-3">
                          <select
                            value={s.owner || 'primary'}
                            onChange={e => updateSource(s.id, { owner: e.target.value as SourceOwner })}
                            className="border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:outline-emerald-500 bg-white"
                          >
                            <option value="primary">{primaryName} (Primary)</option>
                            <option value="spouse">{spouseName} (Spouse)</option>
                            <option value="joint">Joint Household</option>
                          </select>
                        </td>
                      )}
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
          <div className="space-y-6">
            {/* 2-Person Household Toggle Banner */}
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-indigo-950">2-Person Household Projection (With Spouse)</h4>
                  <p className="text-xs text-indigo-700">
                    Model both spouses with individual birth dates, retirement ages, salaries, and account ownership.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasSpouse}
                  onChange={e => updateScenario('hasSpouse', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                <span className="ml-2 text-xs font-semibold text-slate-800">
                  {hasSpouse ? 'Enabled' : 'Single Person'}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Primary User Section */}
              <div className="space-y-4 p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <User className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Primary Household Member ({primaryName})
                  </h3>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Retirement Salary ($)
                    </label>
                    <input
                      type="number"
                      value={config.scenario.retSalary}
                      onChange={e => updateScenario('retSalary', parseFloat(e.target.value) || 0)}
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
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Portion of asset withdrawals subject to ordinary income vs capital gains / tax-free.
                  </p>
                </div>
              </div>

              {/* Spouse Section */}
              {hasSpouse ? (
                <div className="space-y-4 p-4 rounded-xl border border-indigo-200 bg-indigo-50/20">
                  <div className="flex items-center gap-2 border-b border-indigo-200 pb-2">
                    <Heart className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-bold text-indigo-950">
                      Spouse Details ({spouseName})
                    </h3>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Spouse Name</label>
                    <input
                      type="text"
                      value={config.scenario.spouseName || ''}
                      onChange={e => updateScenario('spouseName', e.target.value)}
                      placeholder="e.g. Jane Doe"
                      className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500 bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Spouse Birth Date</label>
                      <input
                        type="date"
                        value={config.scenario.spouseBirthDate || ''}
                        onChange={e => updateScenario('spouseBirthDate', e.target.value)}
                        className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Spouse Retirement Date</label>
                      <input
                        type="date"
                        value={config.scenario.spouseRetDate || ''}
                        onChange={e => updateScenario('spouseRetDate', e.target.value)}
                        className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Spouse Salary ($)
                      </label>
                      <input
                        type="number"
                        value={config.scenario.spouseRetSalary || 0}
                        onChange={e => updateScenario('spouseRetSalary', parseFloat(e.target.value) || 0)}
                        className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Spouse Life Expectancy</label>
                      <input
                        type="number"
                        value={config.scenario.spouseLifeExpAge || 92}
                        onChange={e => updateScenario('spouseLifeExpAge', parseFloat(e.target.value) || 0)}
                        className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500 bg-white"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-indigo-700 mt-2 bg-indigo-50 p-2.5 rounded-lg">
                    💡 When enabled, spouse accounts unlock at their specific start ages, and household sustainability protects both spouses through their life expectancies.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center">
                  <Users className="w-10 h-10 text-slate-400 mb-2" />
                  <h4 className="text-sm font-semibold text-slate-700">Single Person Plan</h4>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    Toggle "2-Person Household" above to add a spouse with separate retirement dates, incomes, and account accessibility.
                  </p>
                  <button
                    onClick={() => updateScenario('hasSpouse', true)}
                    className="mt-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium transition-colors"
                  >
                    Enable Spouse Planning
                  </button>
                </div>
              )}
            </div>

            {/* Milestone Ages */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
                Milestone Ages & Distribution Rules
              </h3>

              {/* Primary Milestones */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  {primaryName}'s Milestones
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      401(k) / 403(b) Access Age (Rule of 55)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={config.milestones.four01kAge ?? config.milestones.retireAcctAge ?? 55}
                      onChange={e => updateMilestone('four01kAge', parseFloat(e.target.value) || 55)}
                      className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">Employer plan early withdrawal</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      IRA / Roth Access Age
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={config.milestones.iraAge ?? config.milestones.retireAcctAge ?? 60}
                      onChange={e => updateMilestone('iraAge', parseFloat(e.target.value) || 60)}
                      className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">IRS penalty-free age (e.g. 59.5)</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Social Security Earliest Age
                    </label>
                    <input
                      type="number"
                      value={config.milestones.ssMinAge}
                      onChange={e => updateMilestone('ssMinAge', parseFloat(e.target.value) || 62)}
                      className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">Earliest claim age (e.g. 62)</p>
                  </div>
                </div>
              </div>

              {/* Spouse Milestones */}
              {hasSpouse && (
                <div className="pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    {spouseName}'s Milestones
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Spouse 401(k) / 403(b) Access Age
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={config.milestones.spouseFour01kAge ?? config.milestones.four01kAge ?? 55}
                        onChange={e => updateMilestone('spouseFour01kAge', parseFloat(e.target.value) || 55)}
                        className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                      />
                      <p className="text-[10px] text-slate-500 mt-0.5">Employer plan early withdrawal</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Spouse IRA / Roth Access Age
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={config.milestones.spouseIraAge ?? config.milestones.iraAge ?? 60}
                        onChange={e => updateMilestone('spouseIraAge', parseFloat(e.target.value) || 60)}
                        className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                      />
                      <p className="text-[10px] text-slate-500 mt-0.5">IRS penalty-free age (e.g. 59.5)</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Spouse Social Security Earliest Age
                      </label>
                      <input
                        type="number"
                        value={config.milestones.spouseSsMinAge ?? config.milestones.ssMinAge ?? 62}
                        onChange={e => updateMilestone('spouseSsMinAge', parseFloat(e.target.value) || 62)}
                        className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                      />
                      <p className="text-[10px] text-slate-500 mt-0.5">Earliest claim age (e.g. 62)</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Shared / Statutory Milestones */}
              <div className="pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Shared Statutory Milestones
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Medicare Start Age
                    </label>
                    <input
                      type="number"
                      value={config.milestones.medicareAge}
                      onChange={e => updateMilestone('medicareAge', parseFloat(e.target.value) || 65)}
                      className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">Standard: Age 65</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Required Minimum Dist. (RMD) Age
                    </label>
                    <input
                      type="number"
                      value={config.milestones.rmdAge}
                      onChange={e => updateMilestone('rmdAge', parseFloat(e.target.value) || 73)}
                      className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">SECURE 2.0: Age 73</p>
                  </div>
                </div>
              </div>

              {/* Tax-Deferred Drawdown & RMD Mitigation Strategy */}
              <div className="pt-4 border-t border-slate-200">
                <div className="bg-gradient-to-r from-emerald-50/70 to-teal-50/70 border border-emerald-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">
                          ⚡
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Tax-Deferred 401(k) / IRA Early Depletion Strategy
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Starts withdrawing from tax-deferred accounts as soon as each member becomes penalty-free eligible (Rule of 55 for 401(k), 59½/60 for IRA).
                        When the second member becomes eligible, withdrawals balance across both members&apos; pre-tax accounts to accelerate early depletion and slash future RMD tax spikes.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={config.taxDeferredStrategy?.enabled ?? true}
                        onChange={e => {
                          onChange({
                            ...config,
                            taxDeferredStrategy: {
                              enabled: e.target.checked,
                              method: config.taxDeferredStrategy?.method ?? 'proportional',
                            },
                          });
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {(config.taxDeferredStrategy?.enabled ?? true) && (
                    <div className="mt-3 pt-3 border-t border-emerald-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Drawdown Allocation Method
                        </label>
                        <select
                          value={config.taxDeferredStrategy?.method ?? 'proportional'}
                          onChange={e => {
                            onChange({
                              ...config,
                              taxDeferredStrategy: {
                                enabled: config.taxDeferredStrategy?.enabled ?? true,
                                method: e.target.value as 'proportional' | 'equal',
                              },
                            });
                          }}
                          className="w-full border border-emerald-200 rounded-md px-2.5 py-1.5 text-xs text-slate-900 bg-white focus:outline-emerald-500"
                        >
                          <option value="proportional">Proportional to Balances (Optimal for RMD Mitigation)</option>
                          <option value="equal">Equal 50 / 50 Split Between Spouses</option>
                        </select>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Proportional drawdown smoothly drains both accounts in tandem relative to asset size.
                        </p>
                      </div>

                      <div className="bg-white/80 p-2.5 rounded border border-emerald-100 text-[11px] text-slate-700 space-y-1">
                        <span className="font-semibold text-emerald-900 block">Dynamic Transition Workflow:</span>
                        <div>1. Prior to second member eligibility: First member supplies 100% of required pre-tax living withdrawals.</div>
                        <div>2. Upon second member turning eligible (e.g. age 60): Second member begins withdrawals, automatically lowering first member&apos;s withdrawals.</div>
                      </div>
                    </div>
                  )}
                </div>
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
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Annual General Inflation Rate (%)
                </label>
                <input
                  type="number"
                  step="0.005"
                  value={config.rates.inflationRate}
                  onChange={e => updateRates('inflationRate', parseFloat(e.target.value) || 0)}
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
                  onChange={e => updateRates('medicalInflationRate', parseFloat(e.target.value) || 0)}
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
          <div className="max-w-2xl space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Monthly Expenses (Base Year, Today's Dollars)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Living expenses grow at the general inflation rate ({((config.rates.inflationRate || 0.025) * 100).toFixed(1)}%), while healthcare expenses grow at the decoupled medical inflation rate ({(((config.rates.medicalInflationRate ?? 0.045)) * 100).toFixed(1)}%).
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
              <p className="text-[10px] text-slate-500 mt-0.5">
                Housing, food, utilities, leisure, travel, and non-medical living costs.
              </p>
            </div>

            {/* Medical Expenses Section */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Pre-Medicare Medical Expenses (Before Age 65)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Private insurance, ACA marketplace coverage, or COBRA.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Medical Premium ($ / month)
                  </label>
                  <input
                    type="number"
                    value={config.expenses.expMedPremium}
                    onChange={e => updateExpenses('expMedPremium', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Medical Out-of-pocket ($ / month)
                  </label>
                  <input
                    type="number"
                    value={config.expenses.expMedOop}
                    onChange={e => updateExpenses('expMedOop', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                  />
                </div>
              </div>

              {/* Post-Medicare Milestone Toggle */}
              <div className="pt-3 border-t border-slate-200">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.expenses.hasMedicarePostExp ?? true}
                    onChange={e => updateExpenses('hasMedicarePostExp', e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      Specify Different Medical Expenses After Medicare Milestone (Age 65+)
                    </span>
                    <p className="text-[11px] text-slate-500">
                      When reaching Age 65, medical expenses transition from private coverage to Medicare Part B/D + Medigap Supplement.
                    </p>
                  </div>
                </label>

                {(config.expenses.hasMedicarePostExp ?? true) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 bg-white p-3 rounded-lg border border-slate-200">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Post-Medicare Premium ($ / mo)
                      </label>
                      <input
                        type="number"
                        value={config.expenses.expMedPremiumPost ?? 320}
                        onChange={e => updateExpenses('expMedPremiumPost', parseFloat(e.target.value) || 0)}
                        className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                        placeholder="e.g. 320"
                      />
                      <p className="text-[10px] text-slate-500 mt-0.5">Medicare Part B standard premium + Part D / Medigap</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Post-Medicare Out-of-pocket ($ / mo)
                      </label>
                      <input
                        type="number"
                        value={config.expenses.expMedOopPost ?? 180}
                        onChange={e => updateExpenses('expMedOopPost', parseFloat(e.target.value) || 0)}
                        className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                        placeholder="e.g. 180"
                      />
                      <p className="text-[10px] text-slate-500 mt-0.5">Copays, dental, vision, hearing out-of-pocket</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <span className="font-semibold text-slate-800">Initial Base Annual Expense: </span>
              <span className="font-mono font-bold text-emerald-700">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                  12 * (config.expenses.expDaily + config.expenses.expMedPremium + config.expenses.expMedOop)
                )}
                /year
              </span>
              {(config.expenses.hasMedicarePostExp ?? true) && (
                <span className="text-slate-500 ml-2">
                  (shifts to {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                    12 * (config.expenses.expDaily + (config.expenses.expMedPremiumPost ?? 320) + (config.expenses.expMedOopPost ?? 180))
                  )}/yr in today's dollars at Medicare Age 65)
                </span>
              )}
            </div>

            {/* Link to Major Expenses */}
            <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-amber-900 font-semibold text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Have one-time major expenses planned? (Vehicles, Home Remodel, College, Travel)
                </div>
                <p className="text-[11px] text-amber-800/80 mt-0.5">
                  You can specify up to 10 major one-time annual expenses by age. The planner will automatically increase withdrawals for those specific years.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('majorExpenses')}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-semibold shrink-0 transition-colors shadow-2xs"
              >
                Configure Major Expenses ({majorExpenses.length})
              </button>
            </div>
          </div>
        )}

        {/* Tab 5: Major Specified Expenses */}
        {activeTab === 'majorExpenses' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Annual Major Expenses by Specified Age
                  </h3>
                  <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                    {majorExpenses.length} of 10 Configured
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                  Schedule up to 10 major one-time or special annual expenses at designated ages (e.g. Home Renovation, New Vehicles, Weddings, Travel, Long-Term Care). The retirement engine will automatically increase the corresponding year's total expenses and gross up the required portfolio withdrawal.
                </p>
              </div>
              <button
                onClick={() => addMajorExpense()}
                disabled={majorExpenses.length >= 10}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors shadow-2xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Major Expense ({majorExpenses.length}/10)
              </button>
            </div>

            {/* Quick Add Presets */}
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
                Quick-Add Common Major Expenses:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => addMajorExpense({ name: 'Home Renovation / Roof', age: 65, amount: 45000, inflationAdjusted: true, notes: 'Kitchen remodel & roof replacement' })}
                  disabled={majorExpenses.length >= 10}
                  className="inline-flex items-center gap-1.5 text-xs bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
                >
                  <Home className="w-3.5 h-3.5 text-emerald-600" />
                  + Home Remodel / Roof ($45k @ 65)
                </button>
                <button
                  onClick={() => addMajorExpense({ name: 'New Vehicle Purchase', age: 70, amount: 35000, inflationAdjusted: true, notes: 'Replacement SUV / Hybrid' })}
                  disabled={majorExpenses.length >= 10}
                  className="inline-flex items-center gap-1.5 text-xs bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
                >
                  <Car className="w-3.5 h-3.5 text-sky-600" />
                  + New Vehicle ($35k @ 70)
                </button>
                <button
                  onClick={() => addMajorExpense({ name: 'Dream World Cruise / Travel', age: 67, amount: 25000, inflationAdjusted: true, notes: 'Bucket-list international retirement travel' })}
                  disabled={majorExpenses.length >= 10}
                  className="inline-flex items-center gap-1.5 text-xs bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
                >
                  <Plane className="w-3.5 h-3.5 text-indigo-600" />
                  + Dream Travel ($25k @ 67)
                </button>
                <button
                  onClick={() => addMajorExpense({ name: 'Family Wedding / Gift', age: 72, amount: 30000, inflationAdjusted: true, notes: 'Family milestone gift' })}
                  disabled={majorExpenses.length >= 10}
                  className="inline-flex items-center gap-1.5 text-xs bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  + Family Gift / Wedding ($30k @ 72)
                </button>
                <button
                  onClick={() => addMajorExpense({ name: 'Assisted Living / LTC Buffer', age: 80, amount: 60000, inflationAdjusted: true, notes: 'Specialized healthcare & assistance buffer' })}
                  disabled={majorExpenses.length >= 10}
                  className="inline-flex items-center gap-1.5 text-xs bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
                >
                  <Heart className="w-3.5 h-3.5 text-rose-600" />
                  + Long-Term Care Buffer ($60k @ 80)
                </button>
              </div>
            </div>

            {/* Major Expenses List */}
            {majorExpenses.length === 0 ? (
              <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Sparkles className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-700">No Major Expenses Scheduled</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                  Schedule one-off purchases (new cars, kitchen renovations, dream vacations) so the simulation can factor increased withdrawal targets in those years.
                </p>
                <button
                  onClick={() => addMajorExpense()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-md shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  Add First Major Expense
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {majorExpenses.map((exp, index) => {
                  const estCalendarYear = birthYear + Math.round(exp.age);
                  return (
                    <div
                      key={exp.id}
                      className="bg-white p-4 rounded-xl border border-slate-200 hover:border-amber-300 transition-all shadow-2xs space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <input
                            type="text"
                            value={exp.name}
                            onChange={e => updateMajorExpense(exp.id, { name: e.target.value })}
                            placeholder="Expense Description (e.g. Roof Replacement)"
                            className="font-semibold text-xs text-slate-900 border border-slate-300 rounded-md px-2.5 py-1.5 flex-1 focus:outline-amber-500"
                          />
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => removeMajorExpense(exp.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete Expense"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                        {/* Target Age */}
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Target Age (Year: ~{estCalendarYear})
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="40"
                              max="105"
                              value={exp.age}
                              onChange={e => updateMajorExpense(exp.id, { age: parseFloat(e.target.value) || 65 })}
                              className="w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:outline-amber-500 font-semibold"
                            />
                            <span className="absolute right-2.5 top-1.5 text-[11px] text-slate-400 font-sans pointer-events-none">
                              yrs old
                            </span>
                          </div>
                        </div>

                        {/* Amount */}
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Expense Amount ($)
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs pointer-events-none">$</span>
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={exp.amount}
                              onChange={e => updateMajorExpense(exp.id, { amount: parseFloat(e.target.value) || 0 })}
                              className="w-full border border-slate-300 rounded-md pl-6 pr-2.5 py-1.5 text-xs text-slate-900 focus:outline-amber-500 font-mono font-semibold"
                            />
                          </div>
                        </div>

                        {/* Inflation Adjustment */}
                        <div className="sm:col-span-1 md:col-span-2 flex flex-col justify-center">
                          <label className="flex items-center gap-2 cursor-pointer mt-2 sm:mt-0">
                            <input
                              type="checkbox"
                              checked={exp.inflationAdjusted ?? true}
                              onChange={e => updateMajorExpense(exp.id, { inflationAdjusted: e.target.checked })}
                              className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 border-slate-300"
                            />
                            <div>
                              <span className="text-xs font-semibold text-slate-800">
                                In Today's Dollars (Adjust for Inflation)
                              </span>
                              <p className="text-[10px] text-slate-500">
                                {exp.inflationAdjusted ?? true
                                  ? `Grows with general inflation (${((config.rates.inflationRate || 0.025) * 100).toFixed(1)}%/yr) until Age ${exp.age}`
                                  : 'Fixed nominal dollar amount'}
                              </p>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Notes / Details */}
                      <div>
                        <input
                          type="text"
                          value={exp.notes || ''}
                          onChange={e => updateMajorExpense(exp.id, { notes: e.target.value })}
                          placeholder="Optional notes or category details (e.g. financed out of brokerage or cash reserves)..."
                          className="w-full border border-slate-200 bg-slate-50/50 rounded-md px-2.5 py-1 text-xs text-slate-600 focus:outline-amber-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Major Expenses Summary Banner */}
            {majorExpenses.length > 0 && (
              <div className="bg-amber-50/80 rounded-xl p-4 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-200/80 text-amber-900 rounded-lg">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-amber-950 uppercase tracking-wider block">
                      Total Major Expenses Scheduled
                    </span>
                    <div className="text-base font-extrabold text-amber-900">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
                        majorExpenses.reduce((sum, m) => sum + (m.amount || 0), 0)
                      )}
                      <span className="text-xs font-normal text-amber-800 ml-1.5">
                        across {majorExpenses.length} milestone event{majorExpenses.length > 1 ? 's' : ''} (Ages: {majorExpenses.map(m => m.age).sort((a,b)=>a-b).join(', ')})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-amber-800 font-medium block">
                    Automatically grossed up in annual liquidation waterfall
                  </span>
                  <span className="text-[10px] text-amber-700">
                    Accounts for federal, state, and capital gains tax liabilities
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
