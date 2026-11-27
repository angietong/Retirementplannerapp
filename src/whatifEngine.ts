import { PlannerConfig, YearSimulationResult, PlanSummary, StressPreset, AcaOptimizationConfig, PhaseExpenseMap } from './types';
import { runSimulation, buildDefaultPhaseExpenses, ALL_PHASE_KEYS } from './engine';

export interface WhatIfScenarioResult {
  id: 'baseline' | 'minTax' | 'minRmd' | 'acaSubsidy' | 'maxSpending' | 'maxEstate';
  name: string;
  shortName: string;
  description: string;
  summary: PlanSummary;
  years: YearSimulationResult[];
  totalTaxesPaid: number;
  finalBalance: number;
  peakRmd: number;
  maxSustainableAnnualExpense: number;
  appliedConfig: PlannerConfig;
}

export function runWhatIfComparisons(
  config: PlannerConfig,
  stressPreset: StressPreset = 'baseline'
): WhatIfScenarioResult[] {
  // 1. Baseline Simulation
  const baselineSim = runSimulation(config, stressPreset);
  const baselinePeakRmd = Math.max(0, ...baselineSim.years.map(y => y.rmdTotal || 0));

  // Determine key planning milestone ages
  const [retYearStr] = (config.scenario?.retDate || '2030-07-01').split('-');
  const [birthYearStr] = (config.scenario?.birthDate || '1970-06-15').split('-');
  const retYear = parseInt(retYearStr, 10) || 2030;
  const birthYear = parseInt(birthYearStr, 10) || 1970;
  const approxRetAge = Math.max(50, Math.min(75, retYear - birthYear));
  const rmdAge = config.milestones.rmdAge || 73;
  const convStartAge = Math.max(50, Math.min(rmdAge - 1, approxRetAge));
  const convEndAge = Math.max(convStartAge, rmdAge - 1);
  const isMfj = Boolean(config.scenario.hasSpouse);

  // Helper: Create tax-efficient withdrawal sequence (Cash -> Brokerage -> Pre-tax -> Roth)
  const createTaxEfficientSources = () =>
    config.sources.map(s => {
      let newPriority = s.priority;
      const type = s.accountType;
      const name = s.name.toLowerCase();
      if (type === 'cash' || name.includes('cash') || name.includes('savings') || name.includes('checking')) newPriority = 1;
      else if (type === 'brokerage' || name.includes('brokerage') || name.includes('taxable')) newPriority = 2;
      else if (type === '401k' || type === 'ira' || name.includes('401k') || name.includes('ira') || name.includes('traditional')) newPriority = 3;
      else if (type === 'roth' || name.includes('roth')) newPriority = 4;
      return { ...s, priority: newPriority };
    });

  // Helper: Create pre-tax prioritized sequence (Pre-tax first to drain RMD balances -> Cash -> Brokerage -> Roth)
  const createPreTaxFirstSources = () =>
    config.sources.map(s => {
      let newPriority = s.priority;
      const type = s.accountType;
      const name = s.name.toLowerCase();
      if (type === '401k' || type === 'ira' || name.includes('401k') || name.includes('ira') || name.includes('traditional')) newPriority = 1;
      else if (type === 'cash' || name.includes('cash') || name.includes('savings')) newPriority = 2;
      else if (type === 'brokerage' || name.includes('brokerage')) newPriority = 3;
      else if (type === 'roth' || name.includes('roth')) newPriority = 4;
      return { ...s, priority: newPriority };
    });

  // Helper: Create legacy-maximizing sequence (Cash -> Brokerage -> Pre-tax -> Roth untouched at priority 99)
  const createEstateSources = () =>
    config.sources.map(s => {
      let newPriority = s.priority;
      const type = s.accountType;
      const name = s.name.toLowerCase();
      if (type === 'cash' || name.includes('cash') || name.includes('savings')) newPriority = 1;
      else if (type === 'brokerage' || name.includes('brokerage')) newPriority = 2;
      else if (type === '401k' || type === 'ira' || name.includes('401k') || name.includes('ira')) newPriority = 3;
      else if (type === 'roth' || name.includes('roth')) newPriority = 99;
      return { ...s, priority: newPriority };
    });

  // -------------------------------------------------------------
  // 2. Scenario 1: Minimize Lifetime Tax
  // -------------------------------------------------------------
  const taxSources = createTaxEfficientSources();
  const testBracketRooms = isMfj
    ? [0, 94300, 201050, 383900]
    : [0, 47150, 100525, 191950];
  const testCaps = [0, 25000, 50000, 75000, 100000];

  let bestTaxSim = baselineSim;
  let bestTaxConfig: PlannerConfig = config;
  let bestTaxDescription = 'Prioritizes tax-efficient withdrawal sequencing (Cash → Brokerage → Pre-Tax → Roth).';

  const noConvConfig: PlannerConfig = {
    ...config,
    sources: taxSources,
    rothConversion: {
      enabled: false,
      startAge: convStartAge,
      endAge: convEndAge,
      targetBracketRate: 0.12,
      bracketRoomMaxIncome: testBracketRooms[1] || 94300,
      annualCap: 0,
      taxPaymentMethod: 'outsideBrokerage',
    },
  };
  const noConvSim = runSimulation(noConvConfig, stressPreset);
  if (noConvSim.summary.totalTaxesPaid <= bestTaxSim.summary.totalTaxesPaid) {
    bestTaxSim = noConvSim;
    bestTaxConfig = noConvConfig;
    bestTaxDescription = 'Sequences withdrawals tax-efficiently (Cash first, Brokerage second, Pre-Tax third, Roth preserved) to minimize taxable distributions.';
  }

  for (const bracketMax of testBracketRooms) {
    if (bracketMax === 0) continue;
    for (const cap of testCaps) {
      if (cap === 0) continue;
      const targetRate = bracketMax <= (isMfj ? 94300 : 47150) ? 0.12 : (bracketMax <= (isMfj ? 201050 : 100525) ? 0.22 : 0.24);
      const testConfig: PlannerConfig = {
        ...config,
        sources: taxSources,
        rothConversion: {
          enabled: true,
          startAge: convStartAge,
          endAge: convEndAge,
          targetBracketRate: targetRate,
          bracketRoomMaxIncome: bracketMax,
          annualCap: cap,
          taxPaymentMethod: 'outsideBrokerage',
        },
      };

      const testSim = runSimulation(testConfig, stressPreset);
      const isSolvent =
        testSim.summary.fundsRunOutYear === null ||
        (baselineSim.summary.fundsRunOutYear !== null && testSim.summary.fundsRunOutYear >= baselineSim.summary.fundsRunOutYear);

      if (isSolvent && testSim.summary.totalTaxesPaid < bestTaxSim.summary.totalTaxesPaid) {
        bestTaxSim = testSim;
        bestTaxConfig = testConfig;
        const taxSavings = baselineSim.summary.totalTaxesPaid - testSim.summary.totalTaxesPaid;
        bestTaxDescription = `Sequences withdrawals tax-efficiently and executes targeted Roth conversions capped at $${(cap / 1000).toFixed(0)}k/yr (up to the ${(targetRate * 100).toFixed(0)}% bracket), reducing lifetime taxes by $${Math.round(taxSavings).toLocaleString()}.`;
      }
    }
  }

  const taxSim = bestTaxSim;
  const taxPeakRmd = Math.max(0, ...taxSim.years.map(y => y.rmdTotal || 0));

  // -------------------------------------------------------------
  // 3. Scenario 2: Minimize Future RMD
  // -------------------------------------------------------------
  const rmdSources = createPreTaxFirstSources();
  let bestRmdSim = baselineSim;
  let bestRmdConfig: PlannerConfig = { ...config, sources: rmdSources };
  let bestRmdPeak = baselinePeakRmd;
  let bestRmdDescription = `Prioritizes drawing down traditional pre-tax accounts prior to age ${rmdAge} to deflate pre-tax balances before mandatory RMDs begin.`;

  const rmdTestCaps = [30000, 60000, 90000, 150000];
  const rmdTargetRooms = isMfj ? [201050, 383900] : [100525, 191950];

  for (const maxRoom of rmdTargetRooms) {
    for (const cap of rmdTestCaps) {
      const testConfig: PlannerConfig = {
        ...config,
        sources: rmdSources,
        rothConversion: {
          enabled: true,
          startAge: convStartAge,
          endAge: convEndAge,
          targetBracketRate: maxRoom <= (isMfj ? 201050 : 100525) ? 0.22 : 0.24,
          bracketRoomMaxIncome: maxRoom,
          annualCap: cap,
          taxPaymentMethod: 'outsideBrokerage',
        },
      };

      const testSim = runSimulation(testConfig, stressPreset);
      const testPeak = Math.max(0, ...testSim.years.map(y => y.rmdTotal || 0));

      const isSolvent =
        testSim.summary.fundsRunOutYear === null ||
        (baselineSim.summary.fundsRunOutYear !== null && testSim.summary.fundsRunOutYear >= baselineSim.summary.fundsRunOutYear);

      const isBetterPeak = testPeak < bestRmdPeak - 1;
      const isTiedPeakWithBetterBalance =
        Math.abs(testPeak - bestRmdPeak) <= 1 &&
        testSim.summary.finalBalance > bestRmdSim.summary.finalBalance;

      if (isSolvent && (isBetterPeak || isTiedPeakWithBetterBalance)) {
        bestRmdPeak = testPeak;
        bestRmdSim = testSim;
        bestRmdConfig = testConfig;
        const rmdCut = baselinePeakRmd - testPeak;
        bestRmdDescription = `Draws down pre-tax accounts first and executes pre-RMD Roth conversions ($${(cap / 1000).toFixed(0)}k/yr), slashing peak mandatory RMD by $${Math.round(rmdCut).toLocaleString()}/yr.`;
      }
    }
  }

  const rmdSim = bestRmdSim;
  const rmdPeakRmd = bestRmdPeak;

  // -------------------------------------------------------------
  // 4. Scenario 3: Maximize Lifetime Spending
  // -------------------------------------------------------------
  const spendSources = createTaxEfficientSources();
  let lo = 0.20;
  let hi = 4.00;
  let bestSpendMult = 1.0;
  let maxSpendSim = baselineSim;
  let maxSpendConfig: PlannerConfig = config;

  const getAverageAnnualBaseLiving = (years: YearSimulationResult[], fallbackMonthly: number): number => {
    if (!years.length) return fallbackMonthly * 12;
    const total = years.reduce((sum, y) => sum + (y.baseMonthlyLivingExpense ?? fallbackMonthly) * 12, 0);
    return total / years.length;
  };

  const baselineAnnualLiving = getAverageAnnualBaseLiving(baselineSim.years, config.expenses.expDaily);

  const scaleExpensesByMultiplier = (mult: number): PlannerConfig['expenses'] => {
    const scaledBase = Math.round(config.expenses.expDaily * mult);
    if (!config.expenses.usePhaseExpenses) {
      return {
        ...config.expenses,
        expDaily: scaledBase,
      };
    }
    const baseMap = buildDefaultPhaseExpenses(config.expenses.expDaily, config.expenses.phaseExpDaily);
    const scaledPhaseMap = {} as PhaseExpenseMap;
    for (const key of ALL_PHASE_KEYS) {
      scaledPhaseMap[key] = Math.round(baseMap[key] * mult);
    }
    return {
      ...config.expenses,
      expDaily: scaledBase,
      phaseExpDaily: scaledPhaseMap,
    };
  };

  for (let iter = 0; iter < 18; iter++) {
    const mid = (lo + hi) / 2;
    const testConfig: PlannerConfig = {
      ...config,
      sources: spendSources,
      expenses: scaleExpensesByMultiplier(mid),
    };

    const testSim = runSimulation(testConfig, stressPreset);
    if (testSim.summary.fundsRunOutYear === null) {
      bestSpendMult = mid;
      maxSpendSim = testSim;
      maxSpendConfig = testConfig;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const maxSpendPeakRmd = Math.max(0, ...maxSpendSim.years.map(y => y.rmdTotal || 0));
  const maxSpendAnnualLiving = getAverageAnnualBaseLiving(
    maxSpendSim.years,
    config.expenses.expDaily * bestSpendMult
  );
  const spendDeltaPct = Math.round((bestSpendMult - 1) * 100);
  const spendScopeLabel = config.expenses.usePhaseExpenses
    ? 'average phased lifestyle spending (all phases scaled proportionally)'
    : 'annual lifestyle spending';
  const spendDescription =
    spendDeltaPct >= 0
      ? `Optimizes tax-efficient withdrawal sequencing, safely supporting up to +${spendDeltaPct}% higher ${spendScopeLabel} ($${Math.round(maxSpendAnnualLiving).toLocaleString()}/yr) without premature depletion.`
      : `Calculates that sustainable ${spendScopeLabel} under this market scenario is $${Math.round(maxSpendAnnualLiving).toLocaleString()}/yr (${spendDeltaPct}% adjustment to sustain lifetime funding).`;

  // -------------------------------------------------------------
  // 5. Scenario 4: Maximize Estate Net Worth (Legacy)
  // -------------------------------------------------------------
  const estateSources = createEstateSources();
  let bestEstateSim = baselineSim;
  let bestEstateConfig: PlannerConfig = config;
  let bestEstateFinal = baselineSim.summary.finalBalance;
  let bestEstateDescription =
    'Draws down taxable cash and brokerage accounts first while keeping Roth accounts untouched at priority 99 to compound tax-free for beneficiaries.';

  const estateCandidates: PlannerConfig[] = [
    {
      ...config,
      sources: estateSources,
      rothConversion: {
        enabled: false,
        startAge: convStartAge,
        endAge: convEndAge,
        targetBracketRate: 0.22,
        bracketRoomMaxIncome: 201050,
        annualCap: 0,
        taxPaymentMethod: 'outsideBrokerage',
      },
    },
    {
      ...config,
      sources: estateSources,
      rothConversion: {
        enabled: true,
        startAge: convStartAge,
        endAge: convEndAge,
        targetBracketRate: 0.12,
        bracketRoomMaxIncome: isMfj ? 94300 : 47150,
        annualCap: 40000,
        taxPaymentMethod: 'outsideBrokerage',
      },
    },
    {
      ...config,
      sources: estateSources,
      rothConversion: {
        enabled: true,
        startAge: convStartAge,
        endAge: convEndAge,
        targetBracketRate: 0.22,
        bracketRoomMaxIncome: isMfj ? 201050 : 100525,
        annualCap: 50000,
        taxPaymentMethod: 'outsideBrokerage',
      },
    },
  ];

  estateCandidates.forEach(cand => {
    const testSim = runSimulation(cand, stressPreset);
    const isSolvent =
      testSim.summary.fundsRunOutYear === null ||
      (baselineSim.summary.fundsRunOutYear !== null && testSim.summary.fundsRunOutYear >= baselineSim.summary.fundsRunOutYear);
    if (isSolvent && testSim.summary.finalBalance >= bestEstateFinal) {
      bestEstateFinal = testSim.summary.finalBalance;
      bestEstateSim = testSim;
      bestEstateConfig = cand;
      const growthDiff = bestEstateFinal - baselineSim.summary.finalBalance;
      if (growthDiff > 1000) {
        bestEstateDescription = `Maximizes legacy wealth by sequencing taxable assets first and letting Roth compound 100% tax-free, boosting final estate net worth by $${Math.round(growthDiff).toLocaleString()}.`;
      }
    }
  });

  const estateSim = bestEstateSim;
  const estatePeakRmd = Math.max(0, ...estateSim.years.map(y => y.rmdTotal || 0));

  // -------------------------------------------------------------
  // Scenario 5: ACA Medical Insurance Subsidy Optimization
  // -------------------------------------------------------------
  const acaTestConfig: AcaOptimizationConfig = {
    enabled: true,
    preset: config.acaOptimization?.preset ?? 'fpl400',
    householdSize: config.acaOptimization?.householdSize ?? (isMfj ? 2 : 1),
    targetMagilimit: config.acaOptimization?.targetMagilimit ?? (isMfj ? 84600 : 62600),
    customMagilimit: config.acaOptimization?.customMagilimit ?? (isMfj ? 84600 : 62600),
    unsubsidizedAnnualPremium:
      config.acaOptimization?.unsubsidizedAnnualPremium ??
      (config.expenses.expMedPremium * 12 > 0 ? config.expenses.expMedPremium * 12 : isMfj ? 21600 : 13200),
    endAge: config.milestones.medicareAge || 65,
    prioritizeCashBeforeRoth: config.acaOptimization?.prioritizeCashBeforeRoth ?? true,
    adjustMedicalExpensesWithSubsidy: config.acaOptimization?.adjustMedicalExpensesWithSubsidy ?? true,
    creditAccountId: config.acaOptimization?.creditAccountId,
  };

  const acaAppliedConfig: PlannerConfig = {
    ...config,
    acaOptimization: acaTestConfig,
  };

  const acaSim = runSimulation(config, stressPreset, undefined, undefined, acaTestConfig);
  const acaPeakRmd = Math.max(0, ...acaSim.years.map(y => y.rmdTotal || 0));
  const totalSubsidiesSaved = acaSim.summary.totalAcaSubsidiesSaved ?? 0;
  const acaYearsCount = acaSim.summary.acaYearsQualified ?? 0;
  const acaDescription =
    totalSubsidiesSaved > 0
      ? `Caps pre-65 taxable AGI to qualify for $${Math.round(totalSubsidiesSaved).toLocaleString()} in health insurance subsidies across ${acaYearsCount} pre-Medicare year(s) using Cash/Roth bridges.`
      : `Caps pre-65 taxable AGI below 400% FPL to qualify for maximum healthcare premium credits before Medicare at age 65.`;

  return [
    {
      id: 'baseline',
      name: 'Baseline Strategy',
      shortName: 'Baseline',
      description: 'Your currently configured source priorities, tax brackets, and withdrawal rules.',
      summary: baselineSim.summary,
      years: baselineSim.years,
      totalTaxesPaid: baselineSim.summary.totalTaxesPaid,
      finalBalance: baselineSim.summary.finalBalance,
      peakRmd: baselinePeakRmd,
      maxSustainableAnnualExpense: baselineAnnualLiving,
      appliedConfig: config,
    },
    {
      id: 'acaSubsidy',
      name: 'ACA Health Subsidy',
      shortName: 'ACA Subsidy',
      description: acaDescription,
      summary: acaSim.summary,
      years: acaSim.years,
      totalTaxesPaid: acaSim.summary.totalTaxesPaid,
      finalBalance: acaSim.summary.finalBalance,
      peakRmd: acaPeakRmd,
      maxSustainableAnnualExpense: baselineAnnualLiving,
      appliedConfig: acaAppliedConfig,
    },
    {
      id: 'minTax',
      name: 'Minimize Lifetime Tax',
      shortName: 'Min Tax',
      description: bestTaxDescription,
      summary: taxSim.summary,
      years: taxSim.years,
      totalTaxesPaid: taxSim.summary.totalTaxesPaid,
      finalBalance: taxSim.summary.finalBalance,
      peakRmd: taxPeakRmd,
      maxSustainableAnnualExpense: baselineAnnualLiving,
      appliedConfig: bestTaxConfig,
    },
    {
      id: 'minRmd',
      name: 'Minimize Future RMD',
      shortName: 'Min RMD',
      description: bestRmdDescription,
      summary: rmdSim.summary,
      years: rmdSim.years,
      totalTaxesPaid: rmdSim.summary.totalTaxesPaid,
      finalBalance: rmdSim.summary.finalBalance,
      peakRmd: rmdPeakRmd,
      maxSustainableAnnualExpense: baselineAnnualLiving,
      appliedConfig: bestRmdConfig,
    },
    {
      id: 'maxSpending',
      name: 'Maximize Lifetime Spending',
      shortName: 'Max Spend',
      description: spendDescription,
      summary: maxSpendSim.summary,
      years: maxSpendSim.years,
      totalTaxesPaid: maxSpendSim.summary.totalTaxesPaid,
      finalBalance: maxSpendSim.summary.finalBalance,
      peakRmd: maxSpendPeakRmd,
      maxSustainableAnnualExpense: maxSpendAnnualLiving,
      appliedConfig: maxSpendConfig,
    },
    {
      id: 'maxEstate',
      name: 'Maximize Estate Net Worth',
      shortName: 'Max Estate',
      description: bestEstateDescription,
      summary: estateSim.summary,
      years: estateSim.years,
      totalTaxesPaid: estateSim.summary.totalTaxesPaid,
      finalBalance: estateSim.summary.finalBalance,
      peakRmd: estatePeakRmd,
      maxSustainableAnnualExpense: baselineAnnualLiving,
      appliedConfig: bestEstateConfig,
    },
  ];
}
