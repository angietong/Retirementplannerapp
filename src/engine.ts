import { PlannerConfig, YearSimulationResult, PlanSummary } from './types';

export function runSimulation(config: PlannerConfig): {
  years: YearSimulationResult[];
  summary: PlanSummary;
} {
  const { scenario, milestones, rates, expenses, sources, projectionYears } = config;

  const [retYearStr, retMonthStr, retDayStr] = scenario.retDate.split('-');
  const retYear = parseInt(retYearStr, 10) || 2030;
  const retDateObj = new Date(scenario.retDate);
  const birthDateObj = new Date(scenario.birthDate);

  // Age at retirement (years)
  const diffDays = (retDateObj.getTime() - birthDateObj.getTime()) / (1000 * 60 * 60 * 24);
  const retAge = diffDays > 0 ? diffDays / 365.25 : 60;

  // Fraction of retirement year worked
  const startOfYear = new Date(retYear, 0, 1);
  const daysWorked = (retDateObj.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24);
  const workFrac = Math.max(0, Math.min(1, daysWorked / 365));

  const annualExpense = 12 * (expenses.expDaily + expenses.expMedPremium + expenses.expMedOop);
  const incRate = rates.fedBracket + rates.stateRate;
  const rTax = scenario.taxablePct * (
    (1 - rates.capgainPct) * incRate + rates.capgainPct * rates.capgainRate
  );

  const startingCombinedBalance = sources
    .filter(s => s.monthly === 'N')
    .reduce((sum, s) => sum + (s.balance || 0), 0);

  const years: YearSimulationResult[] = [];
  let prevEndBalances: Record<string, number> = {};

  // Initialize begin balances for yr = 0
  sources.forEach(s => {
    prevEndBalances[s.id] = s.monthly === 'N' ? (s.balance || 0) : 0;
  });

  let fundsRunOutYear: number | null = null;
  let yearsFundingLasts = projectionYears;
  let totalTaxesPaid = 0;
  let totalWithdrawals = 0;

  for (let yr = 0; yr < projectionYears; yr++) {
    const calYear = retYear + yr;
    const age = retAge + yr;
    const currWorkFrac = yr === 0 ? workFrac : 0;
    const remFrac = yr === 0 ? 1 - workFrac : 1;
    const salary = yr === 0 ? scenario.retSalary * workFrac : 0;
    const yrExpenses = annualExpense * Math.pow(1 + rates.inflationRate, yr);

    // Phase calculation:
    // Phase 0: retirement year
    // Phase 1+: milestone triggers
    let phase = 0;
    if (yr > 0) {
      phase = 1 +
        (age >= milestones.retireAcctAge ? 1 : 0) +
        (age >= milestones.ssMinAge ? 1 : 0) +
        (age >= milestones.medicareAge ? 1 : 0) +
        (age >= milestones.rmdAge ? 1 : 0);
    }

    // Guaranteed income
    const guaranteedBySource: Record<string, number> = {};
    let guarTotal = 0;
    let guarTaxable = 0;

    sources.forEach(s => {
      if (s.monthly === 'Y' && age >= (s.startAge || 0)) {
        const payment = s.annualPayment || 0;
        guaranteedBySource[s.id] = payment;
        guarTotal += payment;
        if (s.taxType === 'Income') {
          guarTaxable += payment;
        }
      } else {
        guaranteedBySource[s.id] = 0;
      }
    });

    const taxOther = guarTaxable + salary;

    // Gross-up withdrawal formula
    const denominator = Math.max(0.0001, 1 - rTax);
    const rawWd = (yrExpenses - (guarTotal + salary) + incRate * taxOther) / denominator;
    const wdTotal = Math.max(0, rawWd);

    const taxTarget = scenario.taxablePct * wdTotal;
    const nonTaxTarget = (1 - scenario.taxablePct) * wdTotal;

    const fedTax = rates.fedBracket * taxOther +
      rates.fedBracket * scenario.taxablePct * (1 - rates.capgainPct) * wdTotal;
    const stateTax = rates.stateRate * taxOther +
      rates.stateRate * scenario.taxablePct * (1 - rates.capgainPct) * wdTotal;
    const capGainTax = rates.capgainRate * scenario.taxablePct * rates.capgainPct * wdTotal;
    const totalTax = fedTax + stateTax + capGainTax;

    totalTaxesPaid += totalTax;
    totalWithdrawals += wdTotal;

    // Begin balance per source
    const beginBalanceBySource: Record<string, number> = {};
    sources.forEach(s => {
      beginBalanceBySource[s.id] = s.monthly === 'N' ? (prevEndBalances[s.id] || 0) : 0;
    });

    // Single Priority Cascade across depleting sources
    // Each depleting source has an orderKey: priority + index * 0.0001
    interface AccessibleSource {
      source: typeof sources[0];
      orderKey: number;
      beginBal: number;
    }

    const depletingAccessible: AccessibleSource[] = [];
    sources.forEach((s, idx) => {
      if (s.monthly === 'N') {
        const orderKey = (s.priority ?? 9999) + idx * 0.0001;
        const beginBal = beginBalanceBySource[s.id];
        const isAccessible = age >= (s.startAge || 0);
        if (isAccessible) {
          depletingAccessible.push({ source: s, orderKey, beginBal });
        }
      }
    });

    // Sort by orderKey ascending
    depletingAccessible.sort((a, b) => a.orderKey - b.orderKey);

    const withdrawalsBySource: Record<string, number> = {};
    sources.forEach(s => {
      withdrawalsBySource[s.id] = 0;
    });

    let cumulativePrev = 0;
    depletingAccessible.forEach(item => {
      const cumulativeCurr = cumulativePrev + Math.max(0, item.beginBal);
      const fillCurr = Math.min(wdTotal, cumulativeCurr);
      const fillPrev = Math.min(wdTotal, cumulativePrev);
      const wd = Math.max(0, fillCurr - fillPrev);
      withdrawalsBySource[item.source.id] = wd;
      cumulativePrev = cumulativeCurr;
    });

    // End balances and Total Income per source
    const endBalanceBySource: Record<string, number> = {};
    const incomeBySource: Record<string, number> = {};
    let combEndBal = 0;

    sources.forEach(s => {
      const beg = beginBalanceBySource[s.id] || 0;
      const wd = withdrawalsBySource[s.id] || 0;
      const guar = guaranteedBySource[s.id] || 0;

      if (s.monthly === 'N') {
        const remaining = Math.max(0, beg - wd);
        const endBal = remaining * (1 + rates.investRate);
        endBalanceBySource[s.id] = endBal;
        combEndBal += endBal;
      } else {
        endBalanceBySource[s.id] = 0;
      }

      incomeBySource[s.id] = wd + guar;
    });

    // Check depleted status
    const depleted = combEndBal <= 0 && age <= scenario.lifeExpAge;
    if (combEndBal <= 0 && fundsRunOutYear === null) {
      fundsRunOutYear = calYear;
      yearsFundingLasts = yr;
    }

    years.push({
      yr,
      calYear,
      age: Math.round(age * 10) / 10,
      phase,
      workFrac: Math.round(currWorkFrac * 100) / 100,
      remFrac: Math.round(remFrac * 100) / 100,
      salary,
      expenses: yrExpenses,
      guarTotal,
      guarTaxable,
      taxOther,
      wdTotal,
      taxTarget,
      nonTaxTarget,
      fedTax,
      stateTax,
      capGainTax,
      totalTax,
      combEndBal,
      depleted,
      withdrawalsBySource,
      guaranteedBySource,
      incomeBySource,
      endBalanceBySource,
      beginBalanceBySource,
    });

    // Carry forward end balances
    prevEndBalances = { ...endBalanceBySource };
  }

  const finalBalance = years.length > 0 ? years[years.length - 1].combEndBal : 0;

  return {
    years,
    summary: {
      fundsRunOutYear,
      yearsFundingLasts,
      startingCombinedBalance,
      totalTaxesPaid,
      totalWithdrawals,
      finalBalance,
    },
  };
}
