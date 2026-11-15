import {
  PlannerConfig,
  YearSimulationResult,
  PlanSummary,
  StressPreset,
  DollarDisplayMode,
  RothConversionConfig,
  RothComparisonResult,
  AcaOptimizationConfig,
  AcaComparisonResult,
  MonteCarloPercentileResult,
} from './types';
import { ACA_FPL_BASE } from './defaultData';

// Official IRS Uniform Lifetime Table (Publication 590-B, Table III for RMD calculation)
export const IRS_UNIFORM_LIFETIME_DIVISORS: Record<number, number> = {
  70: 29.1,
  71: 28.2,
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
  if (roundedAge < 70) {
    return Math.max(2.0, 29.1 + (70 - roundedAge) * 0.9);
  }
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

export function isTaxDeferredSource(s: { monthly: string; taxType: string; accountType?: string; name: string }): boolean {
  if (s.monthly === 'Y') return false;
  if (s.taxType === 'N/a' || s.taxType === 'Capital Gain') return false;
  if (s.taxType === 'Income') return true;
  const type = s.accountType;
  if (type === '401k' || type === 'ira') return true;
  const lower = s.name.toLowerCase();
  if (lower.includes('401k') || lower.includes('403b') || lower.includes('ira') || lower.includes('traditional')) {
    if (!lower.includes('roth')) return true;
  }
  return false;
}

export function isSourceNonAgi(s: { taxType: string; accountType?: string; name: string }): boolean {
  if (s.taxType === 'Income' || s.taxType === 'Capital Gain') return false;
  if (s.taxType === 'N/a') return true;
  const type = s.accountType;
  if (type === 'cash' || type === 'roth') return true;
  const lower = s.name.toLowerCase();
  return lower.includes('cash') || lower.includes('savings') || lower.includes('checking') || lower.includes('roth') || lower.includes('hsa');
}

export function isSourceCash(s: { taxType: string; accountType?: string; name: string }): boolean {
  const type = s.accountType;
  if (type === 'cash') return true;
  const lower = s.name.toLowerCase();
  return lower.includes('cash') || lower.includes('savings') || lower.includes('checking') || lower.includes('money market');
}

export function isSourceRoth(s: { taxType: string; accountType?: string; name: string }): boolean {
  const type = s.accountType;
  if (type === 'roth') return true;
  const lower = s.name.toLowerCase();
  return lower.includes('roth');
}

export function calculateAcaSubsidy({
  magi,
  householdSize,
  unsubsidizedPremium,
  targetLimit,
  cumInflation = 1,
}: {
  magi: number;
  householdSize: 1 | 2;
  unsubsidizedPremium: number;
  targetLimit: number;
  cumInflation?: number;
}): { qualified: boolean; subsidyAmount: number; expectedContribution: number; fplRatio: number } {
  const baseFpl = (ACA_FPL_BASE[householdSize] || 21150) * (cumInflation && cumInflation > 0 ? cumInflation : 1);
  const fplRatio = baseFpl > 0 ? magi / baseFpl : 4.0;

  if (magi > targetLimit + 1.0) {
    return {
      qualified: false,
      subsidyAmount: 0,
      expectedContribution: unsubsidizedPremium,
      fplRatio,
    };
  }

  // Sliding scale ACA benchmark expected contribution rate (% of MAGI)
  let rate = 0.085;
  if (fplRatio <= 1.50) {
    rate = 0.0;
  } else if (fplRatio <= 2.00) {
    rate = 0.0 + ((fplRatio - 1.50) / 0.50) * 0.02; // 0% to 2%
  } else if (fplRatio <= 2.50) {
    rate = 0.02 + ((fplRatio - 2.00) / 0.50) * 0.02; // 2% to 4%
  } else if (fplRatio <= 3.00) {
    rate = 0.04 + ((fplRatio - 2.50) / 0.50) * 0.02; // 4% to 6%
  } else if (fplRatio <= 4.00) {
    rate = 0.06 + ((fplRatio - 3.00) / 1.00) * 0.025; // 6% to 8.5%
  } else {
    rate = 0.085;
  }

  const expectedContribution = Math.min(unsubsidizedPremium, Math.max(0, magi * rate));
  const subsidyAmount = Math.max(0, unsubsidizedPremium - expectedContribution);
  const qualified = magi <= targetLimit + 1.0 && subsidyAmount > 0;

  return {
    qualified,
    subsidyAmount,
    expectedContribution,
    fplRatio,
  };
}

export function getSourcePenaltyFreeAge(
  s: { startAge?: number; accountType?: string; name: string },
  milestones: PlannerConfig['milestones'],
  isSpouseOwner: boolean
): number {
  const four01kAge = isSpouseOwner
    ? (milestones.spouseFour01kAge ?? milestones.four01kAge ?? 55)
    : (milestones.four01kAge ?? 55);
  const iraAge = isSpouseOwner
    ? (milestones.spouseIraAge ?? milestones.iraAge ?? 60)
    : (milestones.iraAge ?? 60);

  const lowerName = s.name.toLowerCase();
  const type = s.accountType;

  // 401(k) / 403(b)
  if (type === '401k' || (!type && (lowerName.includes('401k') || lowerName.includes('403b') || lowerName.includes('employer')))) {
    if (s.startAge !== undefined && s.startAge !== null && s.startAge > 0) {
      return s.startAge;
    }
    return four01kAge;
  }

  // IRA / Roth
  if (type === 'ira' || type === 'roth' || (!type && (lowerName.includes('ira') || lowerName.includes('roth')))) {
    if (s.startAge !== undefined && s.startAge !== null && s.startAge > 0) {
      return s.startAge;
    }
    return iraAge;
  }

  return s.startAge || 0;
}

export function isSourceAccessible(
  s: { startAge?: number; accountType?: string; name: string; owner?: string },
  age: number,
  spouseAge: number | undefined,
  milestones: PlannerConfig['milestones'],
  hasSpouse: boolean
): boolean {
  const owner = s.owner || 'primary';
  const isSpouse = owner === 'spouse';
  const reqAge = getSourcePenaltyFreeAge(s, milestones, isSpouse);

  if (owner === 'spouse') {
    return Boolean(hasSpouse && spouseAge !== undefined && spouseAge >= reqAge);
  }
  if (owner === 'joint') {
    const primEligible = age >= reqAge;
    const spouseEligible = Boolean(hasSpouse && spouseAge !== undefined && spouseAge >= reqAge);
    return primEligible || spouseEligible;
  }
  // primary
  return age >= reqAge;
}

export function runSimulation(
  config: PlannerConfig,
  stressPreset: StressPreset = 'baseline',
  overrideRothConfig?: RothConversionConfig,
  overrideInvestRates?: number[],
  overrideAcaConfig?: AcaOptimizationConfig
): {
  years: YearSimulationResult[];
  summary: PlanSummary;
} {
  const { scenario, milestones, rates, expenses, sources, projectionYears } = config;
  const rothConfig = overrideRothConfig ?? config.rothConversion;
  const acaConfig = overrideAcaConfig ?? config.acaOptimization;
  const acaEnabled = Boolean(acaConfig?.enabled);
  const acaEndAge = acaConfig?.endAge ?? milestones.medicareAge ?? 65;

  const four01kAge = milestones.four01kAge ?? milestones.retireAcctAge ?? 55;
  const iraAge = milestones.iraAge ?? milestones.retireAcctAge ?? 60;
  const ssMinAge = milestones.ssMinAge ?? 62;

  const spouseFour01kAge = milestones.spouseFour01kAge ?? four01kAge;
  const spouseIraAge = milestones.spouseIraAge ?? iraAge;
  const spouseSsMinAge = milestones.spouseSsMinAge ?? ssMinAge;

  const getSourceRequiredAge = (s: typeof sources[0]) => {
    const owner = s.owner || 'primary';
    return getSourcePenaltyFreeAge(s, milestones, owner === 'spouse');
  };

  const parseLocalDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length < 3) return null;
    const [y, m, d] = parts.map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  };

  const [retYearStr] = (scenario.retDate || '2030-07-01').split('-');
  const retYear = parseInt(retYearStr, 10) || 2030;
  const retDateObj = parseLocalDate(scenario.retDate) || new Date(retYear, 6, 1);
  const birthDateObj = parseLocalDate(scenario.birthDate) || new Date(1970, 5, 15);

  // Primary age at retirement (years)
  const diffDays = (retDateObj.getTime() - birthDateObj.getTime()) / (1000 * 60 * 60 * 24);
  const retAge = diffDays > 0 ? diffDays / 365.25 : 60;

  // Spouse age at primary retirement
  const hasSpouse = Boolean(scenario.hasSpouse);
  let retSpouseAge = 58;
  let spouseRetDateObj: Date | null = null;
  let spouseRetYear = retYear;

  if (hasSpouse && scenario.spouseBirthDate) {
    const spouseBirthObj = parseLocalDate(scenario.spouseBirthDate) || new Date(1972, 8, 20);
    const diffSpouse = (retDateObj.getTime() - spouseBirthObj.getTime()) / (1000 * 60 * 60 * 24);
    retSpouseAge = diffSpouse > 0 ? diffSpouse / 365.25 : 58;

    if (scenario.spouseRetDate) {
      spouseRetDateObj = parseLocalDate(scenario.spouseRetDate);
      const [spYr] = (scenario.spouseRetDate || '2032-07-01').split('-');
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

  // Pre-process and index source attributes once outside the simulation loops
  interface ProcessedSourceMeta {
    source: typeof sources[0];
    id: string;
    name: string;
    isMonthly: boolean;
    isTaxDef: boolean;
    owner: 'primary' | 'spouse' | 'joint';
    reqAge: number;
    orderKey: number;
    taxType: string;
    annualPayment: number;
    balance: number;
  }

  const processedSources: ProcessedSourceMeta[] = sources.map((s, idx) => {
    const isMonthly = s.monthly === 'Y';
    const isTaxDef = isTaxDeferredSource(s);
    const owner = (s.owner || 'primary') as 'primary' | 'spouse' | 'joint';
    const reqAge = getSourcePenaltyFreeAge(s, milestones, owner === 'spouse');
    const orderKey = (s.priority ?? 9999) + idx * 0.0001;
    return {
      source: s,
      id: s.id,
      name: s.name,
      isMonthly,
      isTaxDef,
      owner,
      reqAge,
      orderKey,
      taxType: s.taxType,
      annualPayment: s.annualPayment || 0,
      balance: s.balance || 0,
    };
  });

  const startingCombinedBalance = processedSources
    .filter(s => !s.isMonthly)
    .reduce((sum, s) => sum + s.balance, 0);

  const years: YearSimulationResult[] = [];
  let prevEndBalances: Record<string, number> = {};

  // Initialize begin balances for yr = 0
  processedSources.forEach(s => {
    prevEndBalances[s.id] = !s.isMonthly ? s.balance : 0;
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

    // Major expenses calculation for specified age (up to 10 entries)
    let yrMajorExpenses = 0;
    const yrMajorExpensesList: { name: string; amount: number }[] = [];

    if (config.majorExpenses && config.majorExpenses.length > 0) {
      config.majorExpenses.forEach(m => {
        if (m.amount > 0 && (Math.floor(m.age) === Math.floor(age) || Math.round(m.age) === Math.round(age))) {
          const nominalAmount = m.inflationAdjusted !== false ? m.amount * cumGeneralInflation : m.amount;
          yrMajorExpenses += nominalAmount;
          yrMajorExpensesList.push({
            name: m.name || 'Major Expense',
            amount: nominalAmount,
          });
        }
      });
    }

    // Decoupled expenses calculation (General Living + Medical + Major Specified Expenses)
    const yrGeneralExpenses = 12 * expenses.expDaily * cumGeneralInflation;
    const yrMedicalExpenses = 12 * (baseMedPremium + baseMedOop) * cumMedicalInflation;
    const yrExpenses = yrGeneralExpenses + yrMedicalExpenses + yrMajorExpenses;

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

    // Phase calculation (Phases 0 through 5 matching UI milestone architecture):
    let phase = 0;
    if (yr > 0) {
      const primaryReachedSS = age >= ssMinAge;
      const spouseReachedSS = hasSpouse && spouseAge !== undefined ? spouseAge >= spouseSsMinAge : primaryReachedSS;
      const ssReached = hasSpouse ? (primaryReachedSS || spouseReachedSS) : primaryReachedSS;

      if (age < four01kAge) {
        phase = 1;
      } else if (age < iraAge) {
        phase = 2;
      } else if (!ssReached && age < milestones.medicareAge) {
        phase = 3;
      } else if (age < milestones.rmdAge) {
        phase = 4;
      } else {
        phase = 5;
      }
    }

    // Guaranteed income by source with owner verification
    const guaranteedBySource: Record<string, number> = {};
    let guarTotal = 0;
    let guarTaxable = 0;

    processedSources.forEach(s => {
      if (s.isMonthly) {
        let isAccessible = false;
        if (s.owner === 'spouse' && hasSpouse && spouseAge !== undefined) {
          isAccessible = spouseAge >= s.reqAge;
        } else if (s.owner === 'joint' && hasSpouse && spouseAge !== undefined) {
          isAccessible = Math.max(age, spouseAge) >= s.reqAge;
        } else {
          isAccessible = age >= s.reqAge;
        }

        if (isAccessible) {
          const payment = s.annualPayment;
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
    processedSources.forEach(s => {
      beginBalanceBySource[s.id] = !s.isMonthly ? (prevEndBalances[s.id] || 0) : 0;
    });

    // -------------------------------------------------------------
    // RMD Calculation (SECURE 2.0 at age 73 using official IRS divisors)
    // -------------------------------------------------------------
    const rmdBySource: Record<string, number> = {};
    let rmdTotal = 0;
    let rmdDivisor = 0;

    processedSources.forEach(s => {
      rmdBySource[s.id] = 0;
      if (!s.isMonthly && s.taxType === 'Income') {
        let ownerAge = age;
        if (s.owner === 'spouse' && hasSpouse && spouseAge !== undefined) {
          ownerAge = spouseAge;
        } else if (s.owner === 'joint' && hasSpouse && spouseAge !== undefined) {
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
      isTaxDeferred: boolean;
      owner: 'primary' | 'spouse' | 'joint';
    }

    const depletingAccessible: AccessibleSource[] = [];
    processedSources.forEach(s => {
      if (!s.isMonthly) {
        let isAccessible = false;
        if (s.owner === 'spouse') {
          isAccessible = Boolean(hasSpouse && spouseAge !== undefined && spouseAge >= s.reqAge);
        } else if (s.owner === 'joint') {
          isAccessible = age >= s.reqAge || Boolean(hasSpouse && spouseAge !== undefined && spouseAge >= s.reqAge);
        } else {
          isAccessible = age >= s.reqAge;
        }

        if (isAccessible) {
          depletingAccessible.push({
            source: s.source,
            orderKey: s.orderKey,
            beginBal: beginBalanceBySource[s.id] || 0,
            isTaxDeferred: s.isTaxDef,
            owner: s.owner,
          });
        }
      }
    });

    depletingAccessible.sort((a, b) => a.orderKey - b.orderKey);

    // Initial normal priority distribution to cover base living needs
    const withdrawalsBySource: Record<string, number> = {};
    processedSources.forEach(s => {
      withdrawalsBySource[s.id] = 0;
    });

    let isSynchronizedTdActive = false;
    const tdWithdrawalByOwner = { primary: 0, spouse: 0 };

    // Synchronized multi-member tax-deferred strategy check
    const tdStrategyEnabled = config.taxDeferredStrategy?.enabled ?? true;
    const tdStrategyMethod = config.taxDeferredStrategy?.method ?? 'proportional';

    const primaryTdItems = depletingAccessible.filter(
      item => item.isTaxDeferred && item.owner !== 'spouse' && item.beginBal > 0
    );
    const spouseTdItems = depletingAccessible.filter(
      item => item.isTaxDeferred && item.owner === 'spouse' && item.beginBal > 0
    );

    const primaryTdBal = primaryTdItems.reduce((acc, item) => acc + Math.max(0, item.beginBal), 0);
    const spouseTdBal = spouseTdItems.reduce((acc, item) => acc + Math.max(0, item.beginBal), 0);
    const canBalanceTd = tdStrategyEnabled && hasSpouse && primaryTdBal > 0 && spouseTdBal > 0;

    // ACA Healthcare Subsidy Optimization Pre-Medicare Check
    const isPrimaryPreMedicare = age < acaEndAge;
    const isSpousePreMedicare = hasSpouse && spouseAge !== undefined && spouseAge < acaEndAge;
    const isAcaApplicable = isPrimaryPreMedicare || isSpousePreMedicare;
    const baseAcaTargetLimit = acaConfig?.targetMagilimit || (hasSpouse ? 84600 : 62600);
    // Project annual inflated ACA income cap matching HHS poverty guideline adjustments
    const acaTargetLimitForYear = baseAcaTargetLimit * cumGeneralInflation;

    let acaAgiConstrainedWd = 0;
    let acaNonAgiWdUsed = 0;
    let isPhase0AcaIncomeOverride = false;

    if (acaEnabled && isAcaApplicable) {
      // -------------------------------------------------------------
      // ACA OPTIMIZED DRAWDOWN STRATEGY:
      // Cap AGI-generating draws to maintain ACA subsidy qualification,
      // bridging remaining cash flow needs using Non-AGI accounts (Cash & Roth).
      // -------------------------------------------------------------
      const unavoidableAgi = totalSalary + guarTaxable;
      const totalIncomeWithWd = unavoidableAgi + baseWdTotal;
      const remainingAgiHeadroom = Math.max(0, acaTargetLimitForYear - unavoidableAgi);

      // Available liquid Non-AGI accounts (Cash & Roth)
      const availableNonAgiBal = depletingAccessible
        .filter(item => isSourceNonAgi(item.source) && item.beginBal > 0)
        .reduce((sum, item) => sum + Math.max(0, item.beginBal), 0);

      const neededNonAgiBridge = Math.max(0, baseWdTotal - remainingAgiHeadroom);

      // SPECIAL LOGIC FOR PHASE 0:
      // When the ACA cap is increased (e.g. to >$100,000), partial-year salary alone may be below the cap,
      // but the living expense withdrawn amount (totalIncomeWithWd = salary + baseWdTotal) exceeds the cap.
      // Additionally, if the required Non-AGI cash/Roth bridge needed to stay under the limit exceeds total
      // available Cash/Roth assets, attempting to cap pre-tax draws would inevitably fail in step 4 anyway.
      // In these situations, draw from high-priority tax-deferred sources as income to fully fund living needs,
      // shielding precious tax-free Cash/Roth reserves for subsequent pre-Medicare retirement years.
      const isPhase0ExceededAca = phase === 0 && (
        unavoidableAgi >= (acaTargetLimitForYear - 1.0) ||
        totalIncomeWithWd >= (acaTargetLimitForYear - 1.0) ||
        (neededNonAgiBridge > 0 && neededNonAgiBridge > availableNonAgiBal)
      );

      // 1. Draw from pre-tax AGI sources:
      let allowablePreTaxDraw = 0;
      if (isPhase0ExceededAca) {
        allowablePreTaxDraw = baseWdTotal;
        isPhase0AcaIncomeOverride = true;
      } else {
        allowablePreTaxDraw = Math.min(baseWdTotal, remainingAgiHeadroom);
      }
      let filledSoFar = 0;

      const totalTdBal = primaryTdBal + spouseTdBal;
      const tdToDraw = Math.min(allowablePreTaxDraw, totalTdBal);

      if (tdToDraw > 0) {
        if (canBalanceTd && primaryTdBal > 0 && spouseTdBal > 0) {
          isSynchronizedTdActive = true;
          let primTarget = 0;
          let spTarget = 0;

          if (tdStrategyMethod === 'equal') {
            const half = tdToDraw / 2;
            primTarget = Math.min(primaryTdBal, half);
            spTarget = Math.min(spouseTdBal, half);
            let rem = tdToDraw - (primTarget + spTarget);
            if (rem > 0) {
              if (primaryTdBal > primTarget) {
                const add = Math.min(primaryTdBal - primTarget, rem);
                primTarget += add;
                rem -= add;
              }
              if (rem > 0 && spouseTdBal > spTarget) {
                spTarget += Math.min(spouseTdBal - spTarget, rem);
              }
            }
          } else {
            primTarget = tdToDraw * (primaryTdBal / totalTdBal);
            spTarget = tdToDraw * (spouseTdBal / totalTdBal);
          }

          let primRem = primTarget;
          primaryTdItems.forEach(item => {
            const avail = Math.max(0, item.beginBal);
            const wd = Math.min(avail, primRem);
            withdrawalsBySource[item.source.id] = wd;
            primRem -= wd;
            tdWithdrawalByOwner.primary += wd;
          });

          let spRem = spTarget;
          spouseTdItems.forEach(item => {
            const avail = Math.max(0, item.beginBal);
            const wd = Math.min(avail, spRem);
            withdrawalsBySource[item.source.id] = wd;
            spRem -= wd;
            tdWithdrawalByOwner.spouse += wd;
          });
        } else {
          let remTd = tdToDraw;
          const allTd = depletingAccessible.filter(i => i.isTaxDeferred && i.beginBal > 0);
          allTd.forEach(item => {
            const avail = Math.max(0, item.beginBal);
            const wd = Math.min(avail, remTd);
            withdrawalsBySource[item.source.id] = wd;
            remTd -= wd;
            if (item.owner === 'spouse') {
              tdWithdrawalByOwner.spouse += wd;
            } else {
              tdWithdrawalByOwner.primary += wd;
            }
          });
        }
        filledSoFar += tdToDraw;
        acaAgiConstrainedWd += tdToDraw;
      }

      // 2. Fill remaining cash need using Non-AGI sources (Cash and Roth generate 0 AGI)
      const needNonAgi = Math.max(0, baseWdTotal - filledSoFar);
      if (needNonAgi > 0) {
        const nonAgiSources = depletingAccessible
          .filter(item => isSourceNonAgi(item.source) && item.beginBal > 0)
          .sort((a, b) => {
            const aIsCash = isSourceCash(a.source);
            const bIsCash = isSourceCash(b.source);
            if (acaConfig?.prioritizeCashBeforeRoth !== false) {
              if (aIsCash && !bIsCash) return -1;
              if (!aIsCash && bIsCash) return 1;
            } else {
              const aIsRoth = isSourceRoth(a.source);
              const bIsRoth = isSourceRoth(b.source);
              if (aIsRoth && !bIsRoth) return -1;
              if (!aIsRoth && bIsRoth) return 1;
            }
            return a.orderKey - b.orderKey;
          });

        let remNonAgi = needNonAgi;
        nonAgiSources.forEach(item => {
          const currentWd = withdrawalsBySource[item.source.id] || 0;
          const avail = Math.max(0, item.beginBal - currentWd);
          const wd = Math.min(avail, remNonAgi);
          if (wd > 0) {
            withdrawalsBySource[item.source.id] = currentWd + wd;
            remNonAgi -= wd;
            filledSoFar += wd;
            acaNonAgiWdUsed += wd;
          }
        });
      }

      // 3. Fill from Brokerage / Capital gains accounts if still needed
      const needBrokerage = Math.max(0, baseWdTotal - filledSoFar);
      if (needBrokerage > 0) {
        const brokerageSources = depletingAccessible.filter(
          item => !item.isTaxDeferred && !isSourceNonAgi(item.source) && item.beginBal > 0
        );
        let remBrokerage = needBrokerage;
        brokerageSources.forEach(item => {
          const currentWd = withdrawalsBySource[item.source.id] || 0;
          const avail = Math.max(0, item.beginBal - currentWd);
          const wd = Math.min(avail, remBrokerage);
          if (wd > 0) {
            withdrawalsBySource[item.source.id] = currentWd + wd;
            remBrokerage -= wd;
            filledSoFar += wd;
          }
        });
      }

      // 4. Safety net: If living expenses are still unfunded, draw remainder from any available balances
      const stillUnfunded = Math.max(0, baseWdTotal - filledSoFar);
      if (stillUnfunded > 0) {
        let remStill = stillUnfunded;
        depletingAccessible.forEach(item => {
          const currentWd = withdrawalsBySource[item.source.id] || 0;
          const avail = Math.max(0, item.beginBal - currentWd);
          if (avail > 0 && remStill > 0) {
            const wd = Math.min(avail, remStill);
            withdrawalsBySource[item.source.id] = currentWd + wd;
            remStill -= wd;
            filledSoFar += wd;
            if (item.isTaxDeferred) {
              if (item.owner === 'spouse') tdWithdrawalByOwner.spouse += wd;
              else tdWithdrawalByOwner.primary += wd;
            }
          }
        });
      }
    } else if (canBalanceTd) {
      // Find the priority order bounds for the tax-deferred tier
      const tdOrderKeys = [...primaryTdItems, ...spouseTdItems].map(i => i.orderKey);
      const minTdOrderKey = Math.min(...tdOrderKeys);

      let filledSoFar = 0;

      // 1. Fill any accessible non-tax-deferred sources with priority ahead of the tax-deferred tier (e.g. Cash if priority 1)
      depletingAccessible
        .filter(item => !item.isTaxDeferred && item.orderKey < minTdOrderKey)
        .forEach(item => {
          const needed = Math.max(0, baseWdTotal - filledSoFar);
          const wd = Math.min(Math.max(0, item.beginBal), needed);
          withdrawalsBySource[item.source.id] = wd;
          filledSoFar += wd;
        });

      // 2. Tax-deferred tier: Draw from both Primary and Spouse pre-tax accounts in tandem to reduce RMD exposure
      const remainingForTd = Math.max(0, baseWdTotal - filledSoFar);
      const totalTdBal = primaryTdBal + spouseTdBal;
      const tdWithdrawalNeeded = Math.min(remainingForTd, totalTdBal);

      if (tdWithdrawalNeeded > 0) {
        isSynchronizedTdActive = true;
        let primaryTarget = 0;
        let spouseTarget = 0;

        if (tdStrategyMethod === 'equal') {
          const half = tdWithdrawalNeeded / 2;
          primaryTarget = Math.min(primaryTdBal, half);
          spouseTarget = Math.min(spouseTdBal, half);
          let rem = tdWithdrawalNeeded - (primaryTarget + spouseTarget);
          if (rem > 0) {
            if (primaryTdBal > primaryTarget) {
              const add = Math.min(primaryTdBal - primaryTarget, rem);
              primaryTarget += add;
              rem -= add;
            }
            if (rem > 0 && spouseTdBal > spouseTarget) {
              spouseTarget += Math.min(spouseTdBal - spouseTarget, rem);
            }
          }
        } else {
          // 'proportional' (default: depletes accounts proportional to balance to reduce future RMDs)
          primaryTarget = totalTdBal > 0 ? tdWithdrawalNeeded * (primaryTdBal / totalTdBal) : 0;
          spouseTarget = totalTdBal > 0 ? tdWithdrawalNeeded * (spouseTdBal / totalTdBal) : 0;
        }

        // Allocate primaryTarget across Primary's tax-deferred accounts in priority order
        let primRem = primaryTarget;
        primaryTdItems.forEach(item => {
          const avail = Math.max(0, item.beginBal);
          const wd = Math.min(avail, primRem);
          withdrawalsBySource[item.source.id] = wd;
          primRem -= wd;
          tdWithdrawalByOwner.primary += wd;
        });

        // Allocate spouseTarget across Spouse's tax-deferred accounts in priority order
        let spRem = spouseTarget;
        spouseTdItems.forEach(item => {
          const avail = Math.max(0, item.beginBal);
          const wd = Math.min(avail, spRem);
          withdrawalsBySource[item.source.id] = wd;
          spRem -= wd;
          tdWithdrawalByOwner.spouse += wd;
        });

        filledSoFar += tdWithdrawalNeeded;
      }

      // 3. Fill any non-tax-deferred sources with priority after the tax-deferred tier (e.g. Brokerage, Roth)
      depletingAccessible
        .filter(item => !item.isTaxDeferred && item.orderKey >= minTdOrderKey)
        .forEach(item => {
          const needed = Math.max(0, baseWdTotal - filledSoFar);
          const wd = Math.min(Math.max(0, item.beginBal), needed);
          withdrawalsBySource[item.source.id] = wd;
          filledSoFar += wd;
        });
    } else {
      // Standard sequential priority waterfall
      let cumulativePrev = 0;
      depletingAccessible.forEach(item => {
        const cumulativeCurr = cumulativePrev + Math.max(0, item.beginBal);
        const fillCurr = Math.min(baseWdTotal, cumulativeCurr);
        const fillPrev = Math.min(baseWdTotal, cumulativePrev);
        const normalWd = Math.max(0, fillCurr - fillPrev);
        withdrawalsBySource[item.source.id] = normalWd;
        cumulativePrev = cumulativeCurr;

        if (item.isTaxDeferred && normalWd > 0) {
          if (item.owner === 'spouse') {
            tdWithdrawalByOwner.spouse += normalWd;
          } else {
            tdWithdrawalByOwner.primary += normalWd;
          }
        }
      });
    }

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

    // Systematic Roth Conversion logic (if enabled)
    let rothConvertedAmount = 0;
    let rothConversionTax = 0;
    const conversionDeductionsBySource: Record<string, number> = {};

    if (rothConfig?.enabled && age >= rothConfig.startAge && age <= rothConfig.endAge) {
      // Calculate taxable income before conversion
      let currentTaxableLivingWd = 0;
      depletingAccessible.forEach(item => {
        const wd = withdrawalsBySource[item.source.id] || 0;
        if (item.source.taxType === 'Income') {
          currentTaxableLivingWd += wd;
        } else if (item.source.taxType === 'Capital Gain') {
          currentTaxableLivingWd += wd * rates.capgainPct;
        }
      });

      const baseTaxableIncome = totalSalary + guarTaxable + currentTaxableLivingWd;
      const bracketRoom = Math.max(0, rothConfig.bracketRoomMaxIncome - baseTaxableIncome);
      const annualCap = rothConfig.annualCap > 0 ? rothConfig.annualCap : Infinity;

      // Available pre-tax balances remaining after living & RMD withdrawals
      let availablePreTax = 0;
      depletingAccessible.forEach(item => {
        if (item.source.taxType === 'Income') {
          const rem = Math.max(0, item.beginBal - (withdrawalsBySource[item.source.id] || 0));
          availablePreTax += rem;
        }
      });

      let maxAllowedByAca = Infinity;
      if (acaEnabled && isAcaApplicable) {
        const currentTaxableBeforeConv = totalSalary + guarTaxable + currentTaxableLivingWd;
        maxAllowedByAca = Math.max(0, acaTargetLimitForYear - currentTaxableBeforeConv);
      }

      const maxConversion = Math.min(bracketRoom, annualCap, availablePreTax, maxAllowedByAca);
      if (maxConversion > 100) {
        rothConvertedAmount = maxConversion;
        const fedConvRate = rothConfig.targetBracketRate || rates.fedBracket;
        const totalConvRate = fedConvRate + rates.stateRate;
        rothConversionTax = maxConversion * totalConvRate;

        // Deduct conversion amount from pre-tax accounts
        let convRemaining = maxConversion;
        depletingAccessible.forEach(item => {
          if (item.source.taxType === 'Income' && convRemaining > 0) {
            const currentWd = withdrawalsBySource[item.source.id] || 0;
            const availableInAcct = Math.max(0, item.beginBal - currentWd);
            const deduct = Math.min(availableInAcct, convRemaining);
            withdrawalsBySource[item.source.id] = currentWd + deduct;
            conversionDeductionsBySource[item.source.id] = deduct;
            convRemaining -= deduct;
          }
        });
      }
    }

    // Find destination accounts for redirected RMD surplus and Roth conversion
    const brokerageAcct = sources.find(s => s.monthly === 'N' && s.taxType === 'Capital Gain') ||
      sources.find(s => s.monthly === 'N' && s.taxType !== 'Income') ||
      sources.find(s => s.monthly === 'N');
    const rothAcct = (rothConfig?.targetRothAccountId ? sources.find(s => s.id === rothConfig.targetRothAccountId) : null) ||
      sources.find(s => s.monthly === 'N' && (s.accountType === 'roth' || s.name.toLowerCase().includes('roth'))) ||
      sources.find(s => s.monthly === 'N' && s.taxType === 'N/a' && !isSourceCash(s)) ||
      sources.find(s => s.monthly === 'N' && s.taxType === 'N/a');

    // Deduct conversion taxes from brokerage / cash when paid from outside accounts
    let rothTaxPaidOutside = 0;
    const taxPaidOutsideBySource: Record<string, number> = {};
    if (rothConvertedAmount > 0 && rothConfig?.taxPaymentMethod === 'outsideBrokerage') {
      let taxRemaining = rothConversionTax;
      if (brokerageAcct) {
        const curWd = withdrawalsBySource[brokerageAcct.id] || 0;
        const avail = Math.max(0, (beginBalanceBySource[brokerageAcct.id] || 0) - curWd);
        const drawTax = Math.min(avail, taxRemaining);
        if (drawTax > 0) {
          withdrawalsBySource[brokerageAcct.id] = curWd + drawTax;
          taxPaidOutsideBySource[brokerageAcct.id] = drawTax;
          taxRemaining -= drawTax;
          rothTaxPaidOutside += drawTax;
        }
      }
      if (taxRemaining > 0) {
        const cashSources = depletingAccessible.filter(i => isSourceCash(i.source));
        for (const c of cashSources) {
          const curWd = withdrawalsBySource[c.source.id] || 0;
          const avail = Math.max(0, c.beginBal - curWd);
          const drawTax = Math.min(avail, taxRemaining);
          if (drawTax > 0) {
            withdrawalsBySource[c.source.id] = curWd + drawTax;
            taxPaidOutsideBySource[c.source.id] = (taxPaidOutsideBySource[c.source.id] || 0) + drawTax;
            taxRemaining -= drawTax;
            rothTaxPaidOutside += drawTax;
            if (taxRemaining <= 0) break;
          }
        }
      }
    }

    // Actual total withdrawals across all accounts
    let wdTotal = 0;
    let livingWdTotal = 0;
    let ordinaryLivingWd = 0;
    let capGainLivingWd = 0;
    let taxFreeLivingWd = 0;

    sources.forEach(s => {
      const totWd = withdrawalsBySource[s.id] || 0;
      const convDeduct = conversionDeductionsBySource[s.id] || 0;
      const outsideTaxDeduct = taxPaidOutsideBySource[s.id] || 0;
      const livingWd = Math.max(0, totWd - convDeduct - outsideTaxDeduct);

      wdTotal += totWd;
      livingWdTotal += livingWd;

      if (s.taxType === 'Income' || isTaxDeferredSource(s)) {
        ordinaryLivingWd += livingWd;
      } else if (s.taxType === 'Capital Gain' || s.accountType === 'brokerage') {
        capGainLivingWd += livingWd;
      } else {
        taxFreeLivingWd += livingWd;
      }
    });

    // Account-specific precise tax calculation
    const taxableOrdinaryIncome = taxOther + ordinaryLivingWd;
    const taxableCapGains = capGainLivingWd * rates.capgainPct;
    const taxTarget = ordinaryLivingWd + taxableCapGains;
    const nonTaxTarget = taxFreeLivingWd + (capGainLivingWd * (1 - rates.capgainPct));

    const fedConvRate = rothConfig?.targetBracketRate || rates.fedBracket;
    const fedTax = (rates.fedBracket * taxableOrdinaryIncome) + (rothConvertedAmount * fedConvRate);
    const stateTax = (rates.stateRate * taxableOrdinaryIncome) + (rothConvertedAmount * rates.stateRate);
    const capGainTax = rates.capgainRate * taxableCapGains;
    const totalTax = fedTax + stateTax + capGainTax;

    totalTaxesPaid += totalTax;
    totalWithdrawals += wdTotal;

    // ACA Healthcare Subsidy evaluation for this year
    const acaMagi = taxableOrdinaryIncome + taxableCapGains;
    let acaQualified = false;
    let acaSubsidySavings = 0;

    if (isAcaApplicable) {
      const baseUnsubsidized = acaConfig?.unsubsidizedAnnualPremium ?? (expenses.expMedPremium * 12 > 0 ? expenses.expMedPremium * 12 : 21600);
      const unsubsidizedAnnualPrem = baseUnsubsidized * cumMedicalInflation;
      const hSize = (acaConfig?.householdSize ?? (hasSpouse ? 2 : 1)) as 1 | 2;
      const acaMetrics = calculateAcaSubsidy({
        magi: acaMagi,
        householdSize: hSize,
        unsubsidizedPremium: unsubsidizedAnnualPrem,
        targetLimit: acaTargetLimitForYear,
        cumInflation: cumGeneralInflation,
      });

      acaQualified = acaMetrics.qualified;
      acaSubsidySavings = acaMetrics.subsidyAmount;
    }

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
          const unpaidTax = Math.max(0, rothConversionTax - rothTaxPaidOutside);
          const netToRoth = rothConfig?.taxPaymentMethod === 'withhold'
            ? Math.max(0, rothConvertedAmount - rothConversionTax)
            : Math.max(0, rothConvertedAmount - unpaidTax);
          remaining += netToRoth;
        }

        // Reinvest/credit ACA subsidy savings into cash or brokerage account if configured
        if (acaConfig?.adjustMedicalExpensesWithSubsidy && acaSubsidySavings > 0) {
          const acaDestAcct = sources.find(src => src.monthly === 'N' && (isSourceCash(src) || src.taxType === 'Capital Gain')) ||
            sources.find(src => src.monthly === 'N');
          if (acaDestAcct && s.id === acaDestAcct.id) {
            remaining += acaSubsidySavings;
          }
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
      majorExpenses: yrMajorExpenses,
      majorExpensesList: yrMajorExpensesList,
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
      isSynchronizedTdActive,
      tdWithdrawalByOwner,
      acaMagi,
      acaTargetLimit: isAcaApplicable ? acaTargetLimitForYear : undefined,
      acaBaseTargetLimit: isAcaApplicable ? baseAcaTargetLimit : undefined,
      isAcaApplicable,
      acaQualified,
      acaSubsidySavings,
      acaAgiConstrainedWd,
      acaNonAgiWdUsed,
      isPhase0AcaIncomeOverride,
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

  let totalAcaSubsidiesSaved = 0;
  let acaYearsQualified = 0;
  years.forEach(y => {
    if (y.isAcaApplicable) {
      if (y.acaQualified) acaYearsQualified++;
      if (y.acaSubsidySavings) totalAcaSubsidiesSaved += y.acaSubsidySavings;
    }
  });

  return {
    years,
    summary: {
      fundsRunOutYear,
      yearsFundingLasts,
      startingCombinedBalance,
      totalTaxesPaid,
      totalWithdrawals,
      finalBalance,
      totalAcaSubsidiesSaved,
      acaYearsQualified,
    },
  };
}

export function compareAcaOptimization(
  config: PlannerConfig,
  acaConfig: AcaOptimizationConfig,
  stressPreset: StressPreset = 'baseline'
): AcaComparisonResult {
  const baseline = runSimulation(config, stressPreset, undefined, undefined, { ...acaConfig, enabled: false });
  const withAca = runSimulation(config, stressPreset, undefined, undefined, { ...acaConfig, enabled: true });

  let totalSubsidiesSaved = 0;
  let preMedicareYearsSubsidized = 0;
  let totalPreMedicareYears = 0;
  let preTaxDrawsDeferredToNonAgi = 0;

  const schedule = withAca.years
    .filter(y => y.isAcaApplicable)
    .map(y => {
      totalPreMedicareYears++;
      const baseY = baseline.years.find(b => b.calYear === y.calYear) || y;
      const subsidy = y.acaSubsidySavings ?? 0;
      totalSubsidiesSaved += subsidy;
      if (y.acaQualified) {
        preMedicareYearsSubsidized++;
      }

      const baselinePreTaxWd = baseY.withdrawalsBySource
        ? Object.entries(baseY.withdrawalsBySource)
            .filter(([sId]) => {
              const s = config.sources.find(src => src.id === sId);
              return s && isTaxDeferredSource(s);
            })
            .reduce((sum, [, val]) => sum + val, 0)
        : 0;

      const acaPreTaxWd = y.withdrawalsBySource
        ? Object.entries(y.withdrawalsBySource)
            .filter(([sId]) => {
              const s = config.sources.find(src => src.id === sId);
              return s && isTaxDeferredSource(s);
            })
            .reduce((sum, [, val]) => sum + val, 0)
        : 0;

      const diffPreTax = Math.max(0, baselinePreTaxWd - acaPreTaxWd);
      preTaxDrawsDeferredToNonAgi += diffPreTax;

      return {
        year: y.calYear,
        age: y.age,
        spouseAge: y.spouseAge,
        salaryAndGuaranteed: y.salary + y.guarTotal,
        baselineMagi: baseY.acaMagi ?? (baseY.salary + baseY.guarTaxable + baseY.taxTarget),
        acaMagi: y.acaMagi ?? (y.salary + y.guarTaxable + y.taxTarget),
        targetLimit: y.acaTargetLimit ?? acaConfig.targetMagilimit,
        baseTargetLimit: y.acaBaseTargetLimit ?? acaConfig.targetMagilimit,
        qualified: Boolean(y.acaQualified),
        subsidySavings: subsidy,
        preTaxWd: acaPreTaxWd,
        nonAgiWd: y.acaNonAgiWdUsed ?? 0,
        phase0IncomeOverride: Boolean(y.isPhase0AcaIncomeOverride),
      };
    });

  return {
    baselineSummary: baseline.summary,
    acaSummary: withAca.summary,
    totalSubsidiesSaved,
    preMedicareYearsSubsidized,
    totalPreMedicareYears,
    preTaxDrawsDeferredToNonAgi,
    finalBalanceDifference: withAca.summary.finalBalance - baseline.summary.finalBalance,
    schedule,
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
        .filter(s => s.monthly === 'N' && (s.accountType === 'roth' || s.name.toLowerCase().includes('roth') || (s.taxType === 'N/a' && !isSourceCash(s))))
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
  const [retYearStr] = (config.scenario?.retDate || '2030-07-01').split('-');
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
