import { PlannerConfig, YearSimulationResult, PlanSummary, StressPreset } from './types';
import { runSimulation } from './engine';
import { DEFAULT_CONFIG } from './defaultData';

export interface WhatIfScenarioResult {
  id: 'baseline' | 'minTax' | 'minRmd' | 'maxSpending' | 'maxEstate';
  name: string;
  description: string;
  summary: PlanSummary;
  years: YearSimulationResult[];
  totalTaxesPaid: number;
  finalBalance: number;
  peakRmd: number;
  maxSustainableAnnualExpense: number;
}

export function runWhatIfComparisons(
  config: PlannerConfig,
  stressPreset: StressPreset = 'baseline'
): WhatIfScenarioResult[] {
  // 1. Baseline
  const baselineSim = runSimulation(config, stressPreset);
  const baselinePeakRmd = Math.max(0, ...baselineSim.years.map(y => y.rmdTotal || 0));

  // 2. Minimize Lifetime Tax
  // Modify source priorities: cash -> brokerage -> pre-tax -> roth
  const taxOptimizedSources = config.sources.map(s => {
    let newPriority = s.priority;
    const type = s.accountType;
    const name = s.name.toLowerCase();
    if (type === 'cash' || name.includes('cash') || name.includes('savings')) newPriority = 1;
    else if (type === 'brokerage' || name.includes('brokerage')) newPriority = 2;
    else if (type === '401k' || type === 'ira' || name.includes('401k') || name.includes('ira')) newPriority = 3;
    else if (type === 'roth' || name.includes('roth')) newPriority = 4;
    return { ...s, priority: newPriority };
  });

  const taxConfig: PlannerConfig = {
    ...config,
    sources: taxOptimizedSources,
    rothConversion: {
      ...(config.rothConversion || {
        enabled: true,
        startAge: 60,
        endAge: 72,
        targetBracketRate: 0.22,
        bracketRoomMaxIncome: 201050,
        annualCap: 50000,
        taxPaymentMethod: 'outsideBrokerage'
      }),
      enabled: true,
    }
  };
  const taxSim = runSimulation(taxConfig, stressPreset);
  const taxPeakRmd = Math.max(0, ...taxSim.years.map(y => y.rmdTotal || 0));

  // 3. Minimize RMD
  // Pre-tax accounts prioritized first before age 73
  const rmdOptimizedSources = config.sources.map(s => {
    let newPriority = s.priority;
    const type = s.accountType;
    const name = s.name.toLowerCase();
    if (type === '401k' || type === 'ira' || name.includes('401k') || name.includes('ira')) newPriority = 1;
    else if (type === 'cash' || type === 'brokerage') newPriority = 2;
    else newPriority = 3;
    return { ...s, priority: newPriority };
  });

  const rmdConfig: PlannerConfig = {
    ...config,
    sources: rmdOptimizedSources,
    rothConversion: {
      enabled: true,
      startAge: 60,
      endAge: 72,
      targetBracketRate: 0.24,
      bracketRoomMaxIncome: 250000,
      annualCap: 80000,
      taxPaymentMethod: 'outsideBrokerage'
    }
  };
  const rmdSim = runSimulation(rmdConfig, stressPreset);
  const rmdPeakRmd = Math.max(0, ...rmdSim.years.map(y => y.rmdTotal || 0));

  // 4. Maximize Spending During Lifetime
  let bestExpenseMultiplier = 1.0;
  let maxSpendSim = baselineSim;
  for (let mult = 1.05; mult <= 1.50; mult += 0.05) {
    const testConfig: PlannerConfig = {
      ...config,
      expenses: {
        ...config.expenses,
        expDaily: config.expenses.expDaily * mult
      }
    };
    const testSim = runSimulation(testConfig, stressPreset);
    if (testSim.summary.fundsRunOutYear === null) {
      bestExpenseMultiplier = mult;
      maxSpendSim = testSim;
    } else {
      break;
    }
  }
  const maxSpendPeakRmd = Math.max(0, ...maxSpendSim.years.map(y => y.rmdTotal || 0));

  // 5. Maximize Estate Net Worth
  // Prioritize cash & brokerage first, keep roth untouched (priority 99)
  const estateOptimizedSources = config.sources.map(s => {
    let newPriority = s.priority;
    const type = s.accountType;
    const name = s.name.toLowerCase();
    if (type === 'cash' || name.includes('cash')) newPriority = 1;
    else if (type === 'brokerage' || name.includes('brokerage')) newPriority = 2;
    else if (type === '401k' || type === 'ira') newPriority = 3;
    else if (type === 'roth' || name.includes('roth')) newPriority = 99;
    return { ...s, priority: newPriority };
  });

  const estateConfig: PlannerConfig = {
    ...config,
    sources: estateOptimizedSources,
    rothConversion: {
      ...(config.rothConversion || DEFAULT_CONFIG.rothConversion!),
      enabled: false
    }
  };
  const estateSim = runSimulation(estateConfig, stressPreset);
  const estatePeakRmd = Math.max(0, ...estateSim.years.map(y => y.rmdTotal || 0));

  return [
    {
      id: 'baseline',
      name: 'Baseline Strategy',
      description: 'Your currently configured source priorities, tax brackets, and withdrawal rules.',
      summary: baselineSim.summary,
      years: baselineSim.years,
      totalTaxesPaid: baselineSim.summary.totalTaxesPaid,
      finalBalance: baselineSim.summary.finalBalance,
      peakRmd: baselinePeakRmd,
      maxSustainableAnnualExpense: config.expenses.expDaily * 12
    },
    {
      id: 'minTax',
      name: '1) Minimize Lifetime Tax',
      description: 'Prioritizes tax-efficient withdrawals (Cash/Brokerage first, Pre-tax second, Roth last) with bracket-filling Roth conversions.',
      summary: taxSim.summary,
      years: taxSim.years,
      totalTaxesPaid: taxSim.summary.totalTaxesPaid,
      finalBalance: taxSim.summary.finalBalance,
      peakRmd: taxPeakRmd,
      maxSustainableAnnualExpense: config.expenses.expDaily * 12
    },
    {
      id: 'minRmd',
      name: '2) Minimize Future RMD',
      description: 'Aggressively draws down Pre-Tax accounts prior to age 73 and executes higher pre-73 Roth conversions to slash future RMD tax spikes.',
      summary: rmdSim.summary,
      years: rmdSim.years,
      totalTaxesPaid: rmdSim.summary.totalTaxesPaid,
      finalBalance: rmdSim.summary.finalBalance,
      peakRmd: rmdPeakRmd,
      maxSustainableAnnualExpense: config.expenses.expDaily * 12
    },
    {
      id: 'maxSpending',
      name: '3) Maximize Lifetime Spending',
      description: `Optimizes cash flow sustainability, safely increasing annual lifestyle spending by up to ${Math.round((bestExpenseMultiplier - 1) * 100)}% without premature depletion.`,
      summary: maxSpendSim.summary,
      years: maxSpendSim.years,
      totalTaxesPaid: maxSpendSim.summary.totalTaxesPaid,
      finalBalance: maxSpendSim.summary.finalBalance,
      peakRmd: maxSpendPeakRmd,
      maxSustainableAnnualExpense: config.expenses.expDaily * 12 * bestExpenseMultiplier
    },
    {
      id: 'maxEstate',
      name: '4) Maximize Estate Net Worth',
      description: 'Draws taxable cash/brokerage first, defers pre-tax accounts, and preserves Roth accounts untouched to maximize tax-free legacy compounding.',
      summary: estateSim.summary,
      years: estateSim.years,
      totalTaxesPaid: estateSim.summary.totalTaxesPaid,
      finalBalance: estateSim.summary.finalBalance,
      peakRmd: estatePeakRmd,
      maxSustainableAnnualExpense: config.expenses.expDaily * 12
    }
  ];
}
