import { PlannerConfig, YearSimulationResult, PlanSummary, StressPreset } from './types';
import { runSimulation } from './engine';

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
  // 1. Baseline Simulation
  const baselineSim = runSimulation(config, stressPreset);
  const baselinePeakRmd = Math.max(0, ...baselineSim.years.map(y => y.rmdTotal || 0));

  // Determine key planning milestone ages
  const [retYearStr] = config.scenario.retDate.split('-');
  const [birthYearStr] = config.scenario.birthDate.split('-');
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

  // Candidate Roth conversion bracket ceilings
  const testBracketRooms = isMfj
    ? [0, 94300, 201050, 383900]
    : [0, 47150, 100525, 191950];

  const testCaps = [0, 25000, 50000, 75000, 100000];

  let bestTaxSim = baselineSim;
  let bestTaxDescription = 'Prioritizes tax-efficient withdrawal sequencing (Cash → Brokerage → Pre-Tax → Roth).';

  // Test pure tax-efficient sequencing without conversion
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
    bestTaxDescription = 'Sequences withdrawals tax-efficiently (Cash first, Brokerage second, Pre-Tax third, Roth preserved) to minimize taxable distributions.';
  }

  // Grid search to find optimal bracket-filling conversion parameters
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
  let bestRmdPeak = baselinePeakRmd;
  let bestRmdDescription = `Prioritizes drawing down traditional pre-tax accounts prior to age ${rmdAge} to deflate pre-tax balances before mandatory RMDs begin.`;

  // Test pre-tax drawdown + pre-RMD conversion combinations to minimize peak RMD
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

      if (isSolvent && testPeak <= bestRmdPeak) {
        bestRmdPeak = testPeak;
        bestRmdSim = testSim;
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

  // High-precision binary search on expense multiplier (0.5% resolution)
  for (let iter = 0; iter < 18; iter++) {
    const mid = (lo + hi) / 2;
    const testConfig: PlannerConfig = {
      ...config,
      sources: spendSources,
      expenses: {
        ...config.expenses,
        expDaily: config.expenses.expDaily * mid,
      },
    };

    const testSim = runSimulation(testConfig, stressPreset);
    if (testSim.summary.fundsRunOutYear === null) {
      bestSpendMult = mid;
      maxSpendSim = testSim;
      lo = mid; // Explore higher spending capability
    } else {
      hi = mid; // Exceeds portfolio capacity
    }
  }

  const maxSpendPeakRmd = Math.max(0, ...maxSpendSim.years.map(y => y.rmdTotal || 0));
  const spendDeltaPct = Math.round((bestSpendMult - 1) * 100);
  const spendDescription =
    spendDeltaPct >= 0
      ? `Optimizes tax-efficient withdrawal sequencing, safely supporting up to +${spendDeltaPct}% higher annual lifestyle spending ($${Math.round(config.expenses.expDaily * 12 * bestSpendMult).toLocaleString()}/yr) without premature depletion.`
      : `Calculates that sustainable spending under this market scenario is $${Math.round(config.expenses.expDaily * 12 * bestSpendMult).toLocaleString()}/yr (${spendDeltaPct}% adjustment to sustain lifetime funding).`;

  // -------------------------------------------------------------
  // 5. Scenario 4: Maximize Estate Net Worth (Legacy)
  // -------------------------------------------------------------
  const estateSources = createEstateSources();
  let bestEstateSim = baselineSim;
  let bestEstateFinal = baselineSim.summary.finalBalance;
  let bestEstateDescription =
    'Draws down taxable cash and brokerage accounts first while keeping Roth accounts untouched at priority 99 to compound tax-free for beneficiaries.';

  // Test baseline vs estate sequencing vs low-bracket Roth conversions
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
      const growthDiff = bestEstateFinal - baselineSim.summary.finalBalance;
      if (growthDiff > 1000) {
        bestEstateDescription = `Maximizes legacy wealth by sequencing taxable assets first and letting Roth compound 100% tax-free, boosting final estate net worth by $${Math.round(growthDiff).toLocaleString()}.`;
      }
    }
  });

  const estateSim = bestEstateSim;
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
      maxSustainableAnnualExpense: config.expenses.expDaily * 12,
    },
    {
      id: 'minTax',
      name: '1) Minimize Lifetime Tax',
      description: bestTaxDescription,
      summary: taxSim.summary,
      years: taxSim.years,
      totalTaxesPaid: taxSim.summary.totalTaxesPaid,
      finalBalance: taxSim.summary.finalBalance,
      peakRmd: taxPeakRmd,
      maxSustainableAnnualExpense: config.expenses.expDaily * 12,
    },
    {
      id: 'minRmd',
      name: '2) Minimize Future RMD',
      description: bestRmdDescription,
      summary: rmdSim.summary,
      years: rmdSim.years,
      totalTaxesPaid: rmdSim.summary.totalTaxesPaid,
      finalBalance: rmdSim.summary.finalBalance,
      peakRmd: rmdPeakRmd,
      maxSustainableAnnualExpense: config.expenses.expDaily * 12,
    },
    {
      id: 'maxSpending',
      name: '3) Maximize Lifetime Spending',
      description: spendDescription,
      summary: maxSpendSim.summary,
      years: maxSpendSim.years,
      totalTaxesPaid: maxSpendSim.summary.totalTaxesPaid,
      finalBalance: maxSpendSim.summary.finalBalance,
      peakRmd: maxSpendPeakRmd,
      maxSustainableAnnualExpense: config.expenses.expDaily * 12 * bestSpendMult,
    },
    {
      id: 'maxEstate',
      name: '4) Maximize Estate Net Worth',
      description: bestEstateDescription,
      summary: estateSim.summary,
      years: estateSim.years,
      totalTaxesPaid: estateSim.summary.totalTaxesPaid,
      finalBalance: estateSim.summary.finalBalance,
      peakRmd: estatePeakRmd,
      maxSustainableAnnualExpense: config.expenses.expDaily * 12,
    },
  ];
}

