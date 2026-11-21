import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
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

export type InputSubSection = 'sources' | 'scenario' | 'expenses' | 'rates';

interface InputsSectionProps {
  config: PlannerConfig;
  section: InputSubSection;
  onChange: (updated: PlannerConfig) => void;
  onNavigateToAcaSimulator?: () => void;
}

export const InputsSection: React.FC<InputsSectionProps> = ({
  config,
  section,
  onChange,
  onNavigateToAcaSimulator,
}) => {
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const primaryName = (config.scenario?.userName || 'Primary').split(' ')[0] || 'Primary';
  const spouseName = (config.scenario?.spouseName || 'Spouse').split(' ')[0] || 'Spouse';
  const hasSpouse = Boolean(config.scenario?.hasSpouse);

  const [birthYearStr] = (config.scenario?.birthDate || '1970-06-15').split('-');
  const birthYear = parseInt(birthYearStr, 10) || 1970;
  const [retYearStr] = (config.scenario?.retDate || '2030-07-01').split('-');
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
    const updated = (config.majorExpenses || []).map(m =>
      m.id === id ? { ...m, ...updates } : m
    );
    onChange({
      ...config,
      majorExpenses: updated,
    });
  };

  const addMajorExpense = (sample?: Partial<MajorExpense>) => {
    const current = config.majorExpenses || [];
    if (current.length >= 10) {
      showBanner('Maximum 10 major expenses supported.');
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
    const updatedSources = config.sources.map(s =>
      s.id === id ? { ...s, ...updates } : s
    );
    onChange({
      ...config,
      sources: updatedSources,
    });
  };

  const addSource = (monthly: 'N' | 'Y') => {
    if (config.sources.length >= 20) {
      showBanner('Maximum 20 income & asset sources supported.');
      return;
    }
    const newPriority = Math.max(0, ...config.sources.map(s => s.priority || 0)) + 1;
    const newSource: IncomeSource =
      monthly === 'N'
        ? {
            id: `src-${Date.now()}`,
            name: `New Account ${newPriority}`,
            balance: 50000,
            priority: newPriority,
            monthly: 'N',
            taxType: 'Income',
            accountType: '401k',
            annualPayment: 0,
            startAge: 60,
            owner: 'primary',
            notes: '',
          }
        : {
            id: `src-${Date.now()}`,
            name: `New Guaranteed Stream`,
            balance: 0,
            priority: newPriority,
            monthly: 'Y',
            taxType: 'Income',
            accountType: 'other',
            annualPayment: 18000,
            startAge: 67,
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

  const moveDepletingPriority = (sourceId: string, direction: 'up' | 'down') => {
    const depleting = config.sources
      .filter(s => s.monthly === 'N')
      .sort((a, b) => a.priority - b.priority);
    const idx = depleting.findIndex(s => s.id === sourceId);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || targetIdx < 0 || targetIdx >= depleting.length) return;

    // Reorder and assign clean sequential priorities (1..N)
    const reordered = [...depleting];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, moved);

    const priorityMap = new Map<string, number>();
    reordered.forEach((s, i) => priorityMap.set(s.id, i + 1));

    const guaranteed = config.sources.filter(s => s.monthly === 'Y');
    const updatedSources = [
      ...reordered.map((s, i) => ({ ...s, priority: i + 1 })),
      ...guaranteed.map((s, i) => ({ ...s, priority: reordered.length + i + 1 })),
    ];

    onChange({
      ...config,
      sources: updatedSources,
    });
  };

  return (
    <div className="space-y-6">
      {bannerMessage && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-medium text-amber-900 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{bannerMessage}</span>
        </div>
      )}

      {section === 'sources' && (
        <SourcesTab
          config={config}
          hasSpouse={hasSpouse}
          primaryName={primaryName}
          spouseName={spouseName}
          onAddSource={addSource}
          onRemoveSource={removeSource}
          onUpdateSource={updateSource}
          onMoveDepletingPriority={moveDepletingPriority}
        />
      )}

      {section === 'scenario' && (
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

      {section === 'expenses' && (
        <div className="space-y-6">
          <ExpensesTab
            config={config}
            onUpdateExpenses={updateExpenses}
            onNavigateToAca={onNavigateToAcaSimulator}
          />
          <MajorExpensesTab
            config={config}
            onAddMajorExpense={addMajorExpense}
            onRemoveMajorExpense={removeMajorExpense}
            onUpdateMajorExpense={updateMajorExpense}
          />
        </div>
      )}

      {section === 'rates' && (
        <RatesTab config={config} onUpdateRates={updateRates} />
      )}
    </div>
  );
};
