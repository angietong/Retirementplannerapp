import React, { useState } from 'react';
import { Users, User, Sparkles, AlertCircle } from 'lucide-react';
import {
  PlannerConfig,
  IncomeSource,
  MajorExpense,
  ScenarioParams,
  MilestoneAges,
  RateAssumptions,
  MonthlyExpenses,
} from '../types';
import { SourcesTab } from './inputs/SourcesTab';
import { ScenarioTab } from './inputs/ScenarioTab';
import { RatesTab } from './inputs/RatesTab';
import { ExpensesTab } from './inputs/ExpensesTab';
import { MajorExpensesTab } from './inputs/MajorExpensesTab';

interface InputsSectionProps {
  config: PlannerConfig;
  onChange: (updated: PlannerConfig) => void;
}

export const InputsSection: React.FC<InputsSectionProps> = ({ config, onChange }) => {
  const [activeTab, setActiveTab] = useState<'sources' | 'scenario' | 'rates' | 'expenses' | 'majorExpenses'>('sources');
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const primaryName = config.scenario.userName.split(' ')[0] || 'Primary';
  const spouseName = (config.scenario.spouseName || 'Spouse').split(' ')[0] || 'Spouse';
  const hasSpouse = Boolean(config.scenario.hasSpouse);
  const majorExpenses = config.majorExpenses || [];

  const [birthYearStr] = config.scenario.birthDate.split('-');
  const birthYear = parseInt(birthYearStr, 10) || 1970;
  const [retYearStr] = config.scenario.retDate.split('-');
  const retYear = parseInt(retYearStr, 10) || 2030;
  const currentRetAge = Math.round(retYear - birthYear);

  const showBanner = (msg: string) => {
    setBannerMessage(msg);
    setTimeout(() => setBannerMessage(null), 4000);
  };

  const updateScenario = (key: keyof ScenarioParams, value: any) => {
    onChange({
      ...config,
      scenario: {
        ...config.scenario,
        [key]: value,
      },
    });
  };

  const updateMilestone = (key: keyof MilestoneAges, value: number) => {
    onChange({
      ...config,
      milestones: {
        ...config.milestones,
        [key]: value,
      },
    });
  };

  const updateRates = (key: keyof RateAssumptions, value: number) => {
    onChange({
      ...config,
      rates: {
        ...config.rates,
        [key]: value,
      },
    });
  };

  const updateExpenses = (key: keyof MonthlyExpenses, value: any) => {
    onChange({
      ...config,
      expenses: {
        ...config.expenses,
        [key]: value,
      },
    });
  };

  const updateTaxDeferredStrategy = (strategy: { enabled: boolean; method: 'proportional' | 'equal' }) => {
    onChange({
      ...config,
      taxDeferredStrategy: strategy,
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
      showBanner('Maximum 10 major expenses allowed.');
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
      showBanner('Maximum 20 income sources supported.');
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

      {bannerMessage && (
        <div className="mx-5 mt-4 p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs font-medium text-amber-900 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{bannerMessage}</span>
        </div>
      )}

      <div className="p-5">
        {activeTab === 'sources' && (
          <SourcesTab
            config={config}
            hasSpouse={hasSpouse}
            primaryName={primaryName}
            spouseName={spouseName}
            onAddSource={addSource}
            onRemoveSource={removeSource}
            onUpdateSource={updateSource}
            onMovePriority={movePriority}
          />
        )}

        {activeTab === 'scenario' && (
          <ScenarioTab
            config={config}
            hasSpouse={hasSpouse}
            primaryName={primaryName}
            spouseName={spouseName}
            onUpdateScenario={updateScenario}
            onUpdateMilestone={updateMilestone}
            onUpdateTaxDeferredStrategy={updateTaxDeferredStrategy}
          />
        )}

        {activeTab === 'rates' && (
          <RatesTab
            config={config}
            onUpdateRates={updateRates}
          />
        )}

        {activeTab === 'expenses' && (
          <ExpensesTab
            config={config}
            onUpdateExpenses={updateExpenses}
            onNavigateToMajorExpenses={() => setActiveTab('majorExpenses')}
          />
        )}

        {activeTab === 'majorExpenses' && (
          <MajorExpensesTab
            config={config}
            onAddMajorExpense={addMajorExpense}
            onRemoveMajorExpense={removeMajorExpense}
            onUpdateMajorExpense={updateMajorExpense}
          />
        )}
      </div>
    </div>
  );
};
