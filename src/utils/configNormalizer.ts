import { DEFAULT_CONFIG } from '../defaultData';
import { PlannerConfig, SavedScenario, PhaseKey } from '../types';
import { buildDefaultPhaseExpenses } from '../engine';

function stripUnsafeKeys<T extends Record<string, unknown>>(obj: unknown): Partial<T> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    result[key] = value;
  }
  return result as Partial<T>;
}

export function normalizeConfig(parsed: unknown): PlannerConfig {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return DEFAULT_CONFIG;
  }

  const safeRoot = stripUnsafeKeys<Record<string, any>>(parsed);
  const safeScenario = stripUnsafeKeys<Record<string, any>>(safeRoot.scenario);
  const safeMilestones = stripUnsafeKeys<Record<string, any>>(safeRoot.milestones);
  const safeRates = stripUnsafeKeys<Record<string, any>>(safeRoot.rates);
  const safeExpenses = stripUnsafeKeys<Record<string, any>>(safeRoot.expenses);
  const safeRoth = stripUnsafeKeys<Record<string, any>>(safeRoot.rothConversion);
  const safeTaxDeferred = stripUnsafeKeys<Record<string, any>>(safeRoot.taxDeferredStrategy);
  const safeAca = stripUnsafeKeys<Record<string, any>>(safeRoot.acaOptimization);

  return {
    ...DEFAULT_CONFIG,
    projectionYears:
      typeof safeRoot.projectionYears === 'number' && Number.isFinite(safeRoot.projectionYears)
        ? Math.min(80, Math.max(5, Math.round(safeRoot.projectionYears)))
        : DEFAULT_CONFIG.projectionYears,
    scenario: {
      ...DEFAULT_CONFIG.scenario,
      ...safeScenario,
    },
    milestones: {
      ...DEFAULT_CONFIG.milestones,
      ...safeMilestones,
      rmdAge: Number(safeMilestones.rmdAge) || DEFAULT_CONFIG.milestones.rmdAge,
      medicareAge: Number(safeMilestones.medicareAge) || DEFAULT_CONFIG.milestones.medicareAge,
    },
    rates: {
      ...DEFAULT_CONFIG.rates,
      ...safeRates,
    },
    expenses: (() => {
      const baseExpDaily =
        typeof safeExpenses.expDaily === 'number' && Number.isFinite(safeExpenses.expDaily) && safeExpenses.expDaily >= 0
          ? safeExpenses.expDaily
          : DEFAULT_CONFIG.expenses.expDaily;
      const usePhaseExpenses = Boolean(safeExpenses.usePhaseExpenses);
      const rawPhaseMap = stripUnsafeKeys<Record<string, unknown>>(safeExpenses.phaseExpDaily);
      const hasRawPhaseEntries = Object.keys(rawPhaseMap).length > 0;
      const sanitizedPhasePartial: Partial<Record<PhaseKey, number>> = {};
      for (const [k, v] of Object.entries(rawPhaseMap)) {
        const num = Number(v);
        if (Number.isFinite(num) && num >= 0) {
          sanitizedPhasePartial[k as PhaseKey] = num;
        }
      }
      return {
        ...DEFAULT_CONFIG.expenses,
        ...safeExpenses,
        expDaily: baseExpDaily,
        usePhaseExpenses,
        ...(usePhaseExpenses || hasRawPhaseEntries
          ? { phaseExpDaily: buildDefaultPhaseExpenses(baseExpDaily, sanitizedPhasePartial) }
          : { phaseExpDaily: undefined }),
      };
    })(),
    majorExpenses: Array.isArray(safeRoot.majorExpenses)
      ? safeRoot.majorExpenses.map((item: unknown, idx: number) => {
          const safeItem = stripUnsafeKeys<Record<string, any>>(item);
          return {
            id: typeof safeItem.id === 'string' && safeItem.id ? safeItem.id : `major-${idx + 1}`,
            name: typeof safeItem.name === 'string' ? safeItem.name : 'Major Expense',
            age: Number.isFinite(Number(safeItem.age)) ? Number(safeItem.age) : 65,
            amount: Number.isFinite(Number(safeItem.amount)) ? Number(safeItem.amount) : 0,
            inflationAdjusted: Boolean(safeItem.inflationAdjusted),
            notes: typeof safeItem.notes === 'string' ? safeItem.notes : '',
          };
        })
      : DEFAULT_CONFIG.majorExpenses,
    rothConversion: {
      ...DEFAULT_CONFIG.rothConversion!,
      ...safeRoth,
    },
    taxDeferredStrategy: {
      ...DEFAULT_CONFIG.taxDeferredStrategy!,
      ...safeTaxDeferred,
    },
    acaOptimization: {
      ...DEFAULT_CONFIG.acaOptimization!,
      ...safeAca,
      adjustMedicalExpensesWithSubsidy:
        safeAca.creditAccountId !== undefined
          ? Boolean(safeAca.adjustMedicalExpensesWithSubsidy)
          : true,
      creditAccountId:
        typeof safeAca.creditAccountId === 'string'
          ? safeAca.creditAccountId
          : DEFAULT_CONFIG.acaOptimization?.creditAccountId,
    },
    sources:
      Array.isArray(safeRoot.sources) && safeRoot.sources.length > 0
        ? safeRoot.sources.map((s: unknown, idx: number) => {
            const safeSource = stripUnsafeKeys<Record<string, any>>(s);
            const defaultSource = DEFAULT_CONFIG.sources[idx] || DEFAULT_CONFIG.sources[0];
            return {
              ...defaultSource,
              ...safeSource,
              id: typeof safeSource.id === 'string' && safeSource.id ? safeSource.id : `src-${idx + 1}`,
              balance:
                typeof safeSource.balance === 'number' && Number.isFinite(safeSource.balance)
                  ? safeSource.balance
                  : defaultSource.balance,
              priority:
                typeof safeSource.priority === 'number' && Number.isFinite(safeSource.priority)
                  ? safeSource.priority
                  : defaultSource.priority,
              taxType: safeSource.taxType || defaultSource.taxType,
              monthly: safeSource.monthly === 'Y' || safeSource.monthly === 'N' ? safeSource.monthly : defaultSource.monthly,
            };
          })
        : DEFAULT_CONFIG.sources,
  };
}

export function normalizeSavedScenarios(raw: unknown): SavedScenario[] {
  if (!Array.isArray(raw)) return [];
  const valid: SavedScenario[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = stripUnsafeKeys<Record<string, any>>(raw[i]);
    if (!item.config || typeof item.config !== 'object') continue;
    valid.push({
      id: typeof item.id === 'string' && item.id ? item.id : `scen-${Date.now()}-${i}`,
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : `Saved Plan ${i + 1}`,
      savedAt: typeof item.savedAt === 'string' ? item.savedAt : new Date().toISOString(),
      config: normalizeConfig(item.config),
    });
  }
  return valid;
}
