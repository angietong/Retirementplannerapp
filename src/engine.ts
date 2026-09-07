import {
  PlannerConfig,
  YearSimulationResult,
  PlanSummary,
  StressPreset,
  DollarDisplayMode,
  RothConversionConfig,
  RothComparisonResult,
  MonteCarloPercentileResult,
} from './types';

// Official IRS Uniform Lifetime Table (Publication 590-B, SECURE 2.0 for RMD starting age 73)
export const IRS_UNIFORM_LIFETIME_DIVISORS: Record<number, number> = {
  72: 27.4,
  73: 26.5,
  74: 25.5,
  75: 24.6,
  76: 23.7,
  77: 22.9,
  78: 22.0,
  79: 21.1,
  80: 20.2,
  81: 19.4,
  82: 18.5,
  83: 17.7,
  84: 16.8,
  85: 16.0,
  86: 15.2,
  87: 14.4,
  88: 13.7,
  89: 12.9,
  90: 12.2,
  91: 11.5,
  92: 10.8,
  93: 10.1,
  94: 9.5,
  95: 8.9,
  96: 8.4,
  97: 7.8,
  98: 7.3,
  99: 6.8,
  100: 6.4,
  101: 6.0,
  102: 5.6,
  103: 5.2,
  104: 4.9,
  105: 4.6,
  106: 4.3,
  107: 4.1,
  108: 3.9,
  109: 3.7,
  110: 3.5,
  111: 3.4,
  112: 3.3,
  113: 3.1,
  114: 3.0,
  115: 2.9,
  116: 2.8,
  117: 2.7,
  118: 2.5,
  119: 2.3,
  120: 2.0,
};

export function getIrsRmdDivisor(age: number): number {
  const roundedAge = Math.floor(age);
  if (roundedAge < 72) return 0;
  if (roundedAge > 120) return 2.0;
  return IRS_UNIFORM_LIFETIME_DIVISORS[roundedAge] || 2.0;
}

export function getAdjustedAmount(
  amount: number,
  yr: number,
  mode: DollarDisplayMode,
  inflationRate: number,
  cumInflationFactor?: number
): number {
  if (mode === 'nominal') return amount;
  const deflator = cumInflationFactor ?? Math.pow(1 + inflationRate, yr);
  return deflator > 0 ? amount / deflator : amount;
}

export function runSimulation(
  config: PlannerConfig,
  stressPreset: StressPreset = 'baseline',
  overrideRothConfig?: RothConversionConfig,
  overrideInvestRates?: number[]
): {
  years: YearSimulationResult[];
  summary: PlanSummary;
} {
  const { scenario, milestones, rates, expenses, sources, projectionYears } = config;
  const rothConfig = overrideRothConfig ?? config.rothConversion;

  const [retYearStr] = scenario.retDate.split('-');
  const retYear = parseInt(retYearStr, 10) || 2030;
  const retDateObj = new Date(scenario.retDate);
  const birthDateObj = new Date(scenario.birthDate);

  // Primary age at retirement (years)
  const diffDays = (retDateObj.getTime() - birthDateObj.getTime()) / (1000 * 60 * 60 * 24);
  const retAge = diffDays > 0 ? diffDays / 365.25 : 60;

  // Spouse age at primary retirement
  const hasSpouse = Boolean(scenario.hasSpouse);
  let retSpouseAge = 58;
  let spouseRetDateObj: Date | null = null;
  let spouseRetYear = retYear;

  if (hasSpouse && scenario.spouseBirthDate) {
    const spouseBirthObj = new Date(scenario.spouseBirthDate);
    const diffSpouse = (retDateObj.getTime() - spouseBirthObj.getTime()) / (1000 * 60 * 60 * 24);
    retSpouseAge = diffSpouse > 0 ? diffSpouse / 365.25 : 58;

    if (scenario.spouseRetDate) {
      spouseRetDateObj = new Date(scenario.spouseRetDate);
      const [spYr] = scenario.spouseRetDate.split('-');
      spouseRetYear = parseInt(spYr, 10) || retYear;
    }
  }

  // Primary fraction of retirement year worked
  const startOfYear = new Date(retYear, 0, 1);
  const daysWorked = (retDateObj.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24);
  const primaryWorkFrac = Math.max(0, Math.min(1, daysWorked / 365));

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
  let cumGeneralInflation = 1;
  let cumMedicalInflation = 1;

  for (let yr = 0; yr < projectionYears; yr++) {
    const calYear = retYear + yr;
    const age = retAge + yr;
    const spouseAge = hasSpouse ? retSpouseAge + yr : undefined;

    // Determine return rate and general inflation rate under active stress preset
    let effInvestRate = overrideInvestRates && overrideInvestRates[yr] !== undefined
      ? overrideInvestRates[yr]
      : rates.investRate;
    let effInflationRate = rates.inflationRate;
    let effMedicalInflationRate = rates.medicalInflationRate ?? 0.045; // Decoupled medical rate (default 4.5%)

    if (!overrideInvestRates) {
      if (stressPreset === 'crash2008') {
        if (yr === 0) effInvestRate = -0.37;
        else if (yr === 1) effInvestRate = -0.10;
        else if (yr === 2) effInvestRate = 0.26;
        else if (yr === 3) effInvestRate = 0.15;
        else if (yr === 4) effInvestRate = 0.12;
        else effInvestRate = rates.investRate;
      } else if (stressPreset === 'stagflation') {
        if (yr < 5) {
          effInflationRate = 0.075;
          effMedicalInflationRate = 0.095; // Healthcare inflation elevated during stagflation
          effInvestRate = 0.020;
        } else {
          effInflationRate = 0.040;
          effMedicalInflationRate = 0.060;
          effInvestRate = 0.040;
        }
      } else if (stressPreset === 'earlyBear') {
        if (yr === 0) effInvestRate = -0.12;
        else if (yr === 1) effInvestRate = -0.15;
        else if (yr === 2) effInvestRate = -0.08;
        else effInvestRate = rates.investRate;
      } else if (stressPreset === 'bull') {
        effInvestRate = 0.085;
        effInflationRate = 0.020;
        effMedicalInflationRate = 0.038;
      }
    }

    if (yr > 0) {
      cumGeneralInflation *= (1 + effInflationRate);
      cumMedicalInflation *= (1 + effMedicalInflationRate);
    }

    // Check Medicare milestone status (age 65+)
    const isMedicareActive = age >= milestones.medicareAge;

    // Base medical expenses (switching to post-Medicare amounts if configured)
    let baseMedPremium = expenses.expMedPremium;
    let baseMedOop = expenses.expMedOop;

    if (isMedicareActive && expenses.hasMedicarePostExp) {
      baseMedPremium = expenses.expMedPremiumPost ?? expenses.expMedPremium;
      baseMedOop = expenses.expMedOopPost ?? expenses.expMedOop;
    }

    // Decoupled expenses calculation
    const yrGeneralExpenses = 12 * expenses.expDaily * cumGeneralInflation;
    const yrMedicalExpenses = 12 * (baseMedPremium + baseMedOop) * cumMedicalInflation;
    const yrExpenses = yrGeneralExpenses + yrMedicalExpenses;

    // Primary salary calculation
    let primarySalary = 0;
    let currWorkFrac = 0;
    let remFrac = 1;

    if (calYear < retYear) {
      primarySalary = scenario.retSalary;
      currWorkFrac = 1;
      remFrac = 0;
    } else if (calYear === retYear) {
      currWorkFrac = primaryWorkFrac;
      remFrac = 1 - primaryWorkFrac;
      primarySalary = scenario.retSalary * primaryWorkFrac;
    }

    // Spouse salary calculation
    let spouseSalary = 0;
    if (hasSpouse && scenario.spouseRetSalary && scenario.spouseRetSalary > 0) {
      if (calYear < spouseRetYear) {
        spouseSalary = scenario.spouseRetSalary;
      } else if (calYear === spouseRetYear && spouseRetDateObj) {
        const spStartOfYear = new Date(spouseRetYear, 0, 1);
        const spDaysWorked = (spouseRetDateObj.getTime() - spStartOfYear.getTime()) / (1000 * 60 * 60 * 24);
        const spWorkFrac = Math.max(0, Math.min(1, spDaysWorked / 365));
        spouseSalary = scenario.spouseRetSalary * spWorkFrac;
      }
    }

    const totalSalary = primarySalary + spouseSalary;

    // Phase calculation:
    let phase = 0;
    if (yr > 0) {
      phase = 1 +
        (age >= milestones.retireAcctAge ? 1 : 0) +
        (age >= milestones.ssMinAge ? 1 : 0) +
        (age >= milestones.medicareAge ? 1 : 0) +
        (age >= milestones.rmdAge ? 1 : 0);
    }

    // Guaranteed income by source with owner verification
    const guaranteedBySource: Record<string, number> = {};
    let guarTotal = 0;
    let guarTaxable = 0;

    sources.forEach(s => {
      if (s.monthly === 'Y') {
        const owner = s.owner || 'primary';
        let isAccessible = false;
        const requiredStartAge = s.startAge || 0;

        if (owner === 'spouse' && hasSpouse && spouseAge !== undefined) {
          isAccessible = spouseAge >= requiredStartAge;
        } else if (owner === 'joint' && hasSpouse && spouseAge !== undefined) {
          isAccessible = Math.max(age, spouseAge) >= requiredStartAge;
        } else {
          isAccessible = age >= requiredStartAge;
        }

        if (isAccessible) {
          const payment = s.annualPayment || 0;
          guaranteedBySource[s.id] = payment;
          guarTotal += payment;
          if (s.taxType === 'Income') {
            guarTaxable += payment;
          }
        } else {
          guaranteedBySource[s.id] = 0;
        }
      } else {
        guaranteedBySource[s.id] = 0;
      }
    });

    const taxOther = guarTaxable + totalSalary;

    // Begin balance per source
    const beginBalanceBySource: Record<string, number> = {};
    sources.forEach(s => {
      beginBalanceBySource[s.id] = s.monthly === 'N' ? (prevEndBalances[s.id] || 0) : 0;
    });

    // -------------------------------------------------------------
    // RMD Calculation (SECURE 2.0 at age 73 using official IRS divisors)
    // -------------------------------------------------------------
    const rmdBySource: Record<string, number> = {};
    let rmdTotal = 0;
    let rmdDivisor = 0;

    sources.forEach(s => {
      rmdBySource[s.id] = 0;
      if (s.monthly === 'N' && s.taxType === 'Income') {
        const owner = s.owner || 'primary';
        let ownerAge = age;
        if (owner === 'spouse' && hasSpouse && spouseAge !== undefined) {
          ownerAge = spouseAge;
        } else if (owner === 'joint' && hasSpouse && spouseAge !== undefined) {
          ownerAge = Math.max(age, spouseAge);
        }

        if (ownerAge >= milestones.rmdAge) {
          const divisor = getIrsRmdDivisor(ownerAge);
          if (divisor > 0) {
            const acctBegBal = Math.max(0, beginBalanceBySource[s.id] || 0);
            const reqRmd = acctBegBal / divisor;
            rmdBySource[s.id] = reqRmd;
            rmdTotal += reqRmd;
            if (rmdDivisor === 0) rmdDivisor = divisor;
          }
        }
      }
    });

    // Gross-up base withdrawal formula needed to meet living expenses
    const denominator = Math.max(0.0001, 1 - rTax);
    const rawWd = (yrExpenses - (guarTotal + totalSalary) + incRate * taxOther) / denominator;
    const baseWdTotal = Math.max(0, rawWd);

    // Prepare accessible depleting sources by priority
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
        const owner = s.owner || 'primary';
        const requiredStartAge = s.startAge || 0;

        let isAccessible = false;
        if (owner === 'spouse' && hasSpouse && spouseAge !== undefined) {
          isAccessible = spouseAge >= requiredStartAge;
        } else if (owner === 'joint' && hasSpouse && spouseAge !== undefined) {
          isAccessible = Math.max(age, spouseAge) >= requiredStartAge;
        } else {
          isAccessible = age >= requiredStartAge;
        }

        if (isAccessible) {
          depletingAccessible.push({ source: s, orderKey, beginBal });
        }
      }
    });

    depletingAccessible.sort((a, b) => a.orderKey - b.orderKey);

    // Initial normal priority distribution to cover base living needs
    const withdrawalsBySource: Record<string, number> = {};
    sources.forEach(s => {
      withdrawalsBySource[s.id] = 0;
    });

    let cumulativePrev = 0;
    depletingAccessible.forEach(item => {
      const cumulativeCurr = cumulativePrev + Math.max(0, item.beginBal);
      const fillCurr = Math.min(baseWdTotal, cumulativeCurr);
      const fillPrev = Math.min(baseWdTotal, cumulativePrev);
      const normalWd = Math.max(0, fillCurr - fillPrev);
      withdrawalsBySource[item.source.id] = normalWd;
      cumulativePrev = cumulativeCurr;
    });

    // Check RMD mandate: Each pre-tax account MUST distribute AT LEAST its RMD amount
    let rmdSurplusGross = 0;
    let rmdSurplusReinvested = 0;

    depletingAccessible.forEach(item => {
      const sId = item.source.id;
      const acctRmd = rmdBySource[sId] || 0;
      const normalWd = withdrawalsBySource[sId] || 0;

      if (acctRmd > normalWd) {
        // Enforce RMD minimum distribution
        const excess = Math.min(item.beginBal, acctRmd) - normalWd;
        if (excess > 0) {
          withdrawalsBySource[sId] += excess;
          rmdSurplusGross += excess;
        }
      }
    });

    // Reinvest RMD surplus (net of taxes) into Taxable Brokerage Account
    if (rmdSurplusGross > 0) {
      const surplusTax = rmdSurplusGross * (rates.fedBracket + rates.stateRate);
      rmdSurplusReinvested = Math.max(0, rmdSurplusGross - surplusTax);
    }

    // Actual total withdrawals across all accounts
    let wdTotal = 0;
    sources.forEach(s => {
      wdTotal += withdrawalsBySource[s.id] || 0;
    });

    // Systematic Roth Conversion logic (if enabled)
    let rothConvertedAmount = 0;
    let rothConversionTax = 0;

    if (rothConfig?.enabled && age >= rothConfig.startAge && age <= rothConfig.endAge) {
      // Calculate taxable income before conversion
      const baseTaxableIncome = totalSalary + guarTaxable + (scenario.taxablePct * wdTotal);
      const bracketRoom = Math.max(0, rothConfig.bracketRoomMaxIncome - baseTaxableIncome);
      const annualCap = rothConfig.annualCap > 0 ? rothConfig.annualCap : Infinity;

      // Available pre-tax balances remaining after withdrawals
      let availablePreTax = 0;
      depletingAccessible.forEach(item => {
        if (item.source.taxType === 'Income') {
          const rem = Math.max(0, item.beginBal - (withdrawalsBySource[item.source.id] || 0));
          availablePreTax += rem;
        }
      });

      const maxConversion = Math.min(bracketRoom, annualCap, availablePreTax);
      if (maxConversion > 100) {
        rothConvertedAmount = maxConversion;
        rothConversionTax = maxConversion * (rothConfig.targetBracketRate || rates.fedBracket);

        // Deduct conversion amount from pre-tax accounts
        let convRemaining = maxConversion;
        depletingAccessible.forEach(item => {
          if (item.source.taxType === 'Income' && convRemaining > 0) {
            const currentWd = withdrawalsBySource[item.source.id] || 0;
            const availableInAcct = Math.max(0, item.beginBal - currentWd);
            const deduct = Math.min(availableInAcct, convRemaining);
            withdrawalsBySource[item.source.id] = currentWd + deduct;
            convRemaining -= deduct;
          }
        });

        // Add converted amount to Roth account
        const netToRoth = rothConfig.taxPaymentMethod === 'withhold'
          ? Math.max(0, rothConvertedAmount - rothConversionTax)
          : rothConvertedAmount;

        // Find existing Roth account
        const rothAcct = sources.find(s => s.monthly === 'N' && s.taxType === 'N/a');
        if (rothAcct) {
          // Will be deposited into rothAcct balance below
        }
      }
    }

    // Taxes
    const taxTarget = scenario.taxablePct * wdTotal;
    const nonTaxTarget = (1 - scenario.taxablePct) * wdTotal;

    const fedTax = rates.fedBracket * taxOther +
      rates.fedBracket * scenario.taxablePct * (1 - rates.capgainPct) * wdTotal +
      rothConversionTax;
    const stateTax = rates.stateRate * taxOther +
      rates.stateRate * scenario.taxablePct * (1 - rates.capgainPct) * wdTotal;
    const capGainTax = rates.capgainRate * scenario.taxablePct * rates.capgainPct * wdTotal;
    const totalTax = fedTax + stateTax + capGainTax;

    totalTaxesPaid += totalTax;
    totalWithdrawals += wdTotal;

    // Find destination accounts for redirected RMD surplus and Roth conversion
    const brokerageAcct = sources.find(s => s.monthly === 'N' && s.taxType === 'Capital Gain') ||
      sources.find(s => s.monthly === 'N' && s.taxType !== 'Income');
    const rothAcct = sources.find(s => s.monthly === 'N' && s.taxType === 'N/a');

    // End balances and Total Income per source
    const endBalanceBySource: Record<string, number> = {};
    const incomeBySource: Record<string, number> = {};
    let combEndBal = 0;

    sources.forEach(s => {
      const beg = beginBalanceBySource[s.id] || 0;
      const wd = withdrawalsBySource[s.id] || 0;
      const guar = guaranteedBySource[s.id] || 0;

      if (s.monthly === 'N') {
        let remaining = Math.max(0, beg - wd);

        // Redirect RMD surplus into taxable brokerage account
        if (brokerageAcct && s.id === brokerageAcct.id && rmdSurplusReinvested > 0) {
          remaining += rmdSurplusReinvested;
        }

        // Deposit systematic Roth conversion into Roth account
        if (rothAcct && s.id === rothAcct.id && rothConvertedAmount > 0) {
          const netToRoth = rothConfig?.taxPaymentMethod === 'withhold'
            ? Math.max(0, rothConvertedAmount - rothConversionTax)
            : rothConvertedAmount;
          remaining += netToRoth;
        }

        const endBal = remaining * (1 + effInvestRate);
        endBalanceBySource[s.id] = endBal;
        combEndBal += endBal;
      } else {
        endBalanceBySource[s.id] = 0;
      }

      incomeBySource[s.id] = wd + guar;
    });

    // Check depleted status
    const inLifeHorizon = age <= scenario.lifeExpAge || (hasSpouse && spouseAge !== undefined && spouseAge <= (scenario.spouseLifeExpAge || 92));
    const depleted = combEndBal <= 0 && inLifeHorizon;
    if (combEndBal <= 0 && fundsRunOutYear === null) {
      fundsRunOutYear = calYear;
      yearsFundingLasts = yr;
    }

    years.push({
      yr,
      calYear,
      age: Math.round(age * 10) / 10,
      spouseAge: spouseAge !== undefined ? Math.round(spouseAge * 10) / 10 : undefined,
      phase,
      workFrac: Math.round(currWorkFrac * 100) / 100,
      remFrac: Math.round(remFrac * 100) / 100,
      salary: totalSalary,
      primarySalary,
      spouseSalary,
      expenses: yrExpenses,
      generalExpenses: yrGeneralExpenses,
      medicalExpenses: yrMedicalExpenses,
      isMedicareActive,
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
      effectiveReturnRate: effInvestRate,
      effectiveInflationRate: effInflationRate,
      effectiveMedicalInflationRate: effMedicalInflationRate,
      rmdTotal,
      rmdDivisor,
      rmdSurplusGross,
      rmdSurplusReinvested,
      rmdBySource,
      rothConvertedAmount,
      rothConversionTax,
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

export function compareRothConversion(
  config: PlannerConfig,
  rothConfig: RothConversionConfig,
  stressPreset: StressPreset = 'baseline'
): RothComparisonResult {
  const baseline = runSimulation(config, stressPreset, { ...rothConfig, enabled: false });
  const withRoth = runSimulation(config, stressPreset, { ...rothConfig, enabled: true });

  const lifetimeTaxSavings = baseline.summary.totalTaxesPaid - withRoth.summary.totalTaxesPaid;
  const finalBalanceDifference = withRoth.summary.finalBalance - baseline.summary.finalBalance;

  let totalConverted = 0;
  let totalConversionTaxesPaid = 0;
  let rmdLifetimeSavings = 0;
  let peakRmdReduction = 0;

  const conversionSchedule = withRoth.years
    .filter(y => (y.rothConvertedAmount ?? 0) > 0 || (y.age >= rothConfig.startAge && y.age <= rothConfig.endAge))
    .map(y => {
      const convAmt = y.rothConvertedAmount ?? 0;
      const convTax = y.rothConversionTax ?? 0;
      totalConverted += convAmt;
      totalConversionTaxesPaid += convTax;

      // Pre-tax balance sum
      const preTaxBal = config.sources
        .filter(s => s.monthly === 'N' && s.taxType === 'Income')
        .reduce((sum, s) => sum + (y.endBalanceBySource[s.id] || 0), 0);

      // Roth balance sum
      const rothBal = config.sources
        .filter(s => s.monthly === 'N' && s.taxType === 'N/a')
        .reduce((sum, s) => sum + (y.endBalanceBySource[s.id] || 0), 0);

      const baseTaxable = y.salary + y.guarTaxable + (y.taxTarget || 0);
      const bracketRoom = Math.max(0, rothConfig.bracketRoomMaxIncome - baseTaxable);

      return {
        year: y.calYear,
        age: y.age,
        spouseAge: y.spouseAge,
        bracketRoom,
        convertedAmount: convAmt,
        conversionTax: convTax,
        preTaxBalanceBefore: preTaxBal + convAmt,
        preTaxBalanceAfter: preTaxBal,
        rothBalanceAfter: rothBal,
      };
    });

  // Calculate RMD savings at age 73+
  withRoth.years.forEach((y, idx) => {
    if (y.age >= config.milestones.rmdAge) {
      const baseY = baseline.years[idx];
      const baseRmd = baseY?.rmdTotal ?? 0;
      const rothRmd = y.rmdTotal ?? 0;
      const rmdDiff = Math.max(0, baseRmd - rothRmd);
      const taxDiff = rmdDiff * (config.rates.fedBracket + config.rates.stateRate);
      rmdLifetimeSavings += taxDiff;
      if (rmdDiff > peakRmdReduction) {
        peakRmdReduction = rmdDiff;
      }
    }
  });

  return {
    baselineSummary: baseline.summary,
    rothSummary: withRoth.summary,
    lifetimeTaxSavings,
    finalBalanceDifference,
    totalConverted,
    totalConversionTaxesPaid,
    rmdLifetimeSavings,
    peakRmdReduction,
    conversionSchedule,
  };
}

function randNormal(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + stdDev * num;
}

export function runMonteCarloSimulation(
  config: PlannerConfig,
  volatility: number = 0.12,
  runsCount: number = 250,
  stressPreset: StressPreset = 'baseline',
  dollarMode: DollarDisplayMode = 'real'
): MonteCarloPercentileResult {
  const [retYearStr] = config.scenario.retDate.split('-');
  const retYear = parseInt(retYearStr, 10) || 2030;
  const projYears = config.projectionYears;

  const allRunBalances: number[][] = Array.from({ length: projYears }, () => []);
  let successfulRuns = 0;

  for (let r = 0; r < runsCount; r++) {
    const customRates: number[] = [];
    for (let yr = 0; yr < projYears; yr++) {
      const sampled = randNormal(config.rates.investRate, volatility);
      customRates.push(sampled);
    }

    const res = runSimulation(config, stressPreset, undefined, customRates);
    let runSuccess = true;

    res.years.forEach((y, yr) => {
      const deflator = dollarMode === 'real' ? Math.pow(1 + config.rates.inflationRate, yr) : 1;
      const val = y.combEndBal / deflator;
      allRunBalances[yr].push(val);
      if (y.depleted) {
        runSuccess = false;
      }
    });

    if (runSuccess) {
      successfulRuns++;
    }
  }

  const years: number[] = [];
  const calYears: number[] = [];
  const p10: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p90: number[] = [];

  for (let yr = 0; yr < projYears; yr++) {
    years.push(yr);
    calYears.push(retYear + yr);
    const sorted = [...allRunBalances[yr]].sort((a, b) => a - b);
    const n = sorted.length;
    if (n === 0) {
      p10.push(0);
      p25.push(0);
      p50.push(0);
      p75.push(0);
      p90.push(0);
      continue;
    }

    const getPct = (p: number) => {
      const idx = Math.floor((p / 100) * n);
      return sorted[Math.min(Math.max(0, idx), n - 1)];
    };

    p10.push(getPct(10));
    p25.push(getPct(25));
    p50.push(getPct(50));
    p75.push(getPct(75));
    p90.push(getPct(90));
  }

  const successProbability = Math.round((successfulRuns / runsCount) * 100);

  return {
    years,
    calYears,
    p10,
    p25,
    p50,
    p75,
    p90,
    successProbability,
    runsCount,
    volatility,
  };
}
