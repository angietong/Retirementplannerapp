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
  IncomeSource,
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
  const type = s.accountType;
  if (type === '401k' || type === 'ira') return true;
  if (type === 'cash' || type === 'brokerage' || type === 'roth' || type === 'other') return false;
  if (s.taxType === 'Income') return true;
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

export function resolveAcaCreditAccount(
  sources: IncomeSource[],
  acaConfig?: AcaOptimizationConfig
): IncomeSource | null {
  if (!acaConfig) return null;
  if (acaConfig.adjustMedicalExpensesWithSubsidy === false || acaConfig.creditAccountId === '__none__') {
    return null;
  }
  const nonMonthly = sources.filter(src => src.monthly === 'N');
  if (nonMonthly.length === 0) return null;

  if (acaConfig.creditAccountId) {
    const explicit = nonMonthly.find(src => src.id === acaConfig.creditAccountId);
    if (explicit) return explicit;
  }

  // Default preference: Cash/Savings account first, then Brokerage, then first depleting account
  return (
    nonMonthly.find(src => isSourceCash(src)) ||
    nonMonthly.find(src => src.taxType === 'Capital Gain' || src.accountType === 'brokerage') ||
    nonMonthly[0]
  );
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
  const medicareAge = milestones.medicareAge ?? 65;
  const rmdAge = milestones.rmdAge ?? 73;

  const spouseSsMinAge = milestones.spouseSsMinAge ?? ssMinAge;

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

  const incRate = Math.min(0.95, Math.max(0, rates.fedBracket + rates.stateRate));
  const cgEffRate = Math.min(0.95, Math.max(0, rates.capgainPct * rates.capgainRate));
  const getSourceMarginalTaxRate = (s: { taxType: string; accountType?: string; name: string; monthly: string }): number => {
    if (isTaxDeferredSource(s) || s.taxType === 'Income') return incRate;
    if (s.taxType === 'Capital Gain' || s.accountType === 'brokerage') return cgEffRate;
    return 0;
  };

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
  let firstZeroYearIdx: number | null = null;
  let yearsFundingLasts = projectionYears;
  let totalTaxesPaid = 0;
  let totalWithdrawals = 0;
  let cumGeneralInflation = 1;
  let cumMedicalInflation = 1;
  const triggeredMajorExpenseIndices = new Set<number>();

  for (let yr = 0; yr < projectionYears; yr++) {
    const calYear = retYear + yr;
    const age = Math.round((retAge + yr) * 10) / 10;
    const spouseAge = hasSpouse ? Math.round((retSpouseAge + yr) * 10) / 10 : undefined;

    // Determine return rate and inflation rates under active stress preset
    let effInvestRate = rates.investRate;
    let effInflationRate = rates.inflationRate;
    let effMedicalInflationRate = rates.medicalInflationRate ?? 0.045; // Decoupled medical rate (default 4.5%)

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

    if (overrideInvestRates && overrideInvestRates[yr] !== undefined) {
      effInvestRate = overrideInvestRates[yr];
    }

    if (yr > 0) {
      cumGeneralInflation *= (1 + effInflationRate);
      cumMedicalInflation *= (1 + effMedicalInflationRate);
    }

    // Check Medicare milestone status per person (prorate bridge years for different-age spouses)
    const isPrimaryOnMedicare = age >= medicareAge;
    const isSpouseOnMedicare = hasSpouse && spouseAge !== undefined ? spouseAge >= medicareAge : false;
    const isMedicareActive = hasSpouse && spouseAge !== undefined
      ? (isPrimaryOnMedicare || isSpouseOnMedicare)
      : isPrimaryOnMedicare;
    const medicareFrac = hasSpouse && spouseAge !== undefined
      ? ((isPrimaryOnMedicare ? 1 : 0) + (isSpouseOnMedicare ? 1 : 0)) / 2
      : (isPrimaryOnMedicare ? 1 : 0);

    // Base medical expenses (blending pre-Medicare and post-Medicare amounts per covered spouse)
    let baseMedPremium = expenses.expMedPremium;
    let baseMedOop = expenses.expMedOop;

    if (medicareFrac > 0 && expenses.hasMedicarePostExp) {
      const postPrem = expenses.expMedPremiumPost ?? expenses.expMedPremium;
      const postOop = expenses.expMedOopPost ?? expenses.expMedOop;
      baseMedPremium = (1 - medicareFrac) * expenses.expMedPremium + medicareFrac * postPrem;
      baseMedOop = (1 - medicareFrac) * expenses.expMedOop + medicareFrac * postOop;
    }

    // Major expenses calculation for specified age (triggers strictly once per expense)
    let yrMajorExpenses = 0;
    const yrMajorExpensesList: { name: string; amount: number }[] = [];

    if (config.majorExpenses && config.majorExpenses.length > 0) {
      config.majorExpenses.forEach((m, idx) => {
        if (
          m.amount > 0 &&
          !triggeredMajorExpenseIndices.has(idx) &&
          Math.floor(age) === Math.floor(m.age)
        ) {
          triggeredMajorExpenseIndices.add(idx);
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
      } else if (!ssReached && age < medicareAge) {
        phase = 3;
      } else if (age < rmdAge) {
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
    // RMD Calculation & Mandate (SECURE 2.0 at age 73 using official IRS divisors)
    // Enforced FIRST across ALL tax-deferred accounts (regardless of startAge)
    // so mandated RMDs fund living expenses before liquidating Cash/Brokerage.
    // -------------------------------------------------------------
    const rmdBySource: Record<string, number> = {};
    let rmdTotal = 0;
    let rmdDivisor = 0;

    const withdrawalsBySource: Record<string, number> = {};
    processedSources.forEach(s => {
      withdrawalsBySource[s.id] = 0;
      rmdBySource[s.id] = 0;
    });

    const tdWithdrawalByOwner = { primary: 0, spouse: 0 };

    processedSources.forEach(s => {
      if (!s.isMonthly && s.isTaxDef) {
        let ownerAge = age;
        if (s.owner === 'spouse' && hasSpouse && spouseAge !== undefined) {
          ownerAge = spouseAge;
        } else if (s.owner === 'joint' && hasSpouse && spouseAge !== undefined) {
          ownerAge = Math.max(age, spouseAge);
        }

        if (ownerAge >= rmdAge) {
          const divisor = getIrsRmdDivisor(ownerAge);
          if (divisor > 0) {
            const acctBegBal = Math.max(0, beginBalanceBySource[s.id] || 0);
            const reqRmd = Math.min(acctBegBal, acctBegBal / divisor);
            rmdBySource[s.id] = reqRmd;
            rmdTotal += reqRmd;
            if (rmdDivisor === 0) rmdDivisor = divisor;

            if (reqRmd > 0) {
              withdrawalsBySource[s.id] = reqRmd;
              if (s.owner === 'spouse') {
                tdWithdrawalByOwner.spouse += reqRmd;
              } else {
                tdWithdrawalByOwner.primary += reqRmd;
              }
            }
          }
        }
      }
    });

    if (rmdDivisor === 0 && (age >= rmdAge || (hasSpouse && spouseAge !== undefined && spouseAge >= rmdAge))) {
      rmdDivisor = getIrsRmdDivisor(age >= rmdAge ? age : spouseAge!);
    }

    // Exact after-tax net cash needed from depleting portfolio to cover living expenses
    // (after accounting for salary, guaranteed income, and ordinary tax on those inflows)
    const netCashNeeded = Math.max(0, yrExpenses + incRate * taxOther - (guarTotal + totalSalary));
    const rmdNetCash = rmdTotal * (1 - incRate);

    let remNetNeeded = Math.max(0, netCashNeeded - rmdNetCash);
    let rmdSurplusReinvested = Math.max(0, rmdNetCash - netCashNeeded);
    let rmdSurplusGross = rmdSurplusReinvested > 0 && incRate < 0.9999
      ? rmdSurplusReinvested / (1 - incRate)
      : 0;

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

    const getAvailBal = (sourceId: string, beginBal: number): number =>
      Math.max(0, beginBal - (withdrawalsBySource[sourceId] || 0));

    let isSynchronizedTdActive = false;

    // Synchronized multi-member tax-deferred strategy check (using remaining balances after RMDs)
    const tdStrategyEnabled = config.taxDeferredStrategy?.enabled ?? true;
    const tdStrategyMethod = config.taxDeferredStrategy?.method ?? 'proportional';

    const primaryTdItems = depletingAccessible.filter(
      item => item.isTaxDeferred && item.owner !== 'spouse' && getAvailBal(item.source.id, item.beginBal) > 0
    );
    const spouseTdItems = depletingAccessible.filter(
      item => item.isTaxDeferred && item.owner === 'spouse' && getAvailBal(item.source.id, item.beginBal) > 0
    );

    const primaryTdBal = primaryTdItems.reduce((acc, item) => acc + getAvailBal(item.source.id, item.beginBal), 0);
    const spouseTdBal = spouseTdItems.reduce((acc, item) => acc + getAvailBal(item.source.id, item.beginBal), 0);
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

    if (remNetNeeded > 0.01) {
      if (acaEnabled && isAcaApplicable) {
        // -------------------------------------------------------------
        // ACA OPTIMIZED DRAWDOWN STRATEGY:
        // Cap AGI-generating draws to maintain ACA subsidy qualification,
        // bridging remaining net cash needs using Non-AGI accounts (Cash & Roth).
        // -------------------------------------------------------------
        const unavoidableAgi = totalSalary + guarTaxable + rmdTotal;
        const preTaxGrossForRemNet = remNetNeeded / (1 - incRate);
        const totalIncomeWithWd = unavoidableAgi + preTaxGrossForRemNet;
        const remainingAgiHeadroom = Math.max(0, acaTargetLimitForYear - unavoidableAgi);

        // Available liquid Non-AGI accounts (Cash & Roth, 0% tax -> $1 gross = $1 net)
        const availableNonAgiBal = depletingAccessible
          .filter(item => isSourceNonAgi(item.source))
          .reduce((sum, item) => sum + getAvailBal(item.source.id, item.beginBal), 0);

        const maxPreTaxNetInHeadroom = remainingAgiHeadroom * (1 - incRate);
        const neededNonAgiBridge = Math.max(0, remNetNeeded - maxPreTaxNetInHeadroom);

        // SPECIAL LOGIC FOR PHASE 0:
        // When partial-year salary + living draw exceeds the ACA cap or the required Non-AGI bridge
        // exceeds available Cash/Roth reserves, draw pre-tax income to preserve tax-free reserves
        // for full pre-Medicare retirement years.
        const isPhase0ExceededAca = phase === 0 && (
          unavoidableAgi >= (acaTargetLimitForYear - 1.0) ||
          totalIncomeWithWd >= (acaTargetLimitForYear - 1.0) ||
          (neededNonAgiBridge > 0 && neededNonAgiBridge > availableNonAgiBal)
        );

        // 1. Draw from pre-tax AGI sources up to allowable headroom
        let allowablePreTaxGross = 0;
        if (isPhase0ExceededAca) {
          allowablePreTaxGross = preTaxGrossForRemNet;
          isPhase0AcaIncomeOverride = true;
        } else {
          allowablePreTaxGross = Math.min(preTaxGrossForRemNet, remainingAgiHeadroom);
        }

        const totalTdBal = primaryTdBal + spouseTdBal;
        const tdToDraw = Math.min(allowablePreTaxGross, totalTdBal);

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
              const avail = getAvailBal(item.source.id, item.beginBal);
              const wd = Math.min(avail, primRem);
              if (wd > 0) {
                withdrawalsBySource[item.source.id] = (withdrawalsBySource[item.source.id] || 0) + wd;
                primRem -= wd;
                tdWithdrawalByOwner.primary += wd;
              }
            });

            let spRem = spTarget;
            spouseTdItems.forEach(item => {
              const avail = getAvailBal(item.source.id, item.beginBal);
              const wd = Math.min(avail, spRem);
              if (wd > 0) {
                withdrawalsBySource[item.source.id] = (withdrawalsBySource[item.source.id] || 0) + wd;
                spRem -= wd;
                tdWithdrawalByOwner.spouse += wd;
              }
            });
          } else {
            let remTd = tdToDraw;
            const allTd = depletingAccessible.filter(i => i.isTaxDeferred && getAvailBal(i.source.id, i.beginBal) > 0);
            allTd.forEach(item => {
              const avail = getAvailBal(item.source.id, item.beginBal);
              const wd = Math.min(avail, remTd);
              if (wd > 0) {
                withdrawalsBySource[item.source.id] = (withdrawalsBySource[item.source.id] || 0) + wd;
                remTd -= wd;
                if (item.owner === 'spouse') {
                  tdWithdrawalByOwner.spouse += wd;
                } else {
                  tdWithdrawalByOwner.primary += wd;
                }
              }
            });
          }
          remNetNeeded = Math.max(0, remNetNeeded - tdToDraw * (1 - incRate));
          acaAgiConstrainedWd += tdToDraw;
        }

        // 2. Fill remaining net cash need using Non-AGI sources (Cash and Roth: 0% tax, 0 AGI)
        if (remNetNeeded > 0.01) {
          const nonAgiSources = depletingAccessible
            .filter(item => isSourceNonAgi(item.source) && getAvailBal(item.source.id, item.beginBal) > 0)
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

          nonAgiSources.forEach(item => {
            if (remNetNeeded <= 0.01) return;
            const avail = getAvailBal(item.source.id, item.beginBal);
            const wd = Math.min(avail, remNetNeeded);
            if (wd > 0) {
              withdrawalsBySource[item.source.id] = (withdrawalsBySource[item.source.id] || 0) + wd;
              remNetNeeded = Math.max(0, remNetNeeded - wd);
              acaNonAgiWdUsed += wd;
            }
          });
        }

        // 3. Fill from Brokerage / Capital gains accounts if still needed (grossed up for cap gains tax)
        if (remNetNeeded > 0.01) {
          const brokerageSources = depletingAccessible.filter(
            item => !item.isTaxDeferred && !isSourceNonAgi(item.source) && getAvailBal(item.source.id, item.beginBal) > 0
          );
          brokerageSources.forEach(item => {
            if (remNetNeeded <= 0.01) return;
            const rate = getSourceMarginalTaxRate(item.source);
            const avail = getAvailBal(item.source.id, item.beginBal);
            const grossNeeded = remNetNeeded / (1 - rate);
            const wd = Math.min(avail, grossNeeded);
            if (wd > 0) {
              withdrawalsBySource[item.source.id] = (withdrawalsBySource[item.source.id] || 0) + wd;
              remNetNeeded = Math.max(0, remNetNeeded - wd * (1 - rate));
            }
          });
        }

        // 4. Safety net: If living expenses are still unfunded, draw remainder from any available balances
        if (remNetNeeded > 0.01) {
          depletingAccessible.forEach(item => {
            if (remNetNeeded <= 0.01) return;
            const rate = getSourceMarginalTaxRate(item.source);
            const avail = getAvailBal(item.source.id, item.beginBal);
            if (avail > 0) {
              const grossNeeded = remNetNeeded / (1 - rate);
              const wd = Math.min(avail, grossNeeded);
              withdrawalsBySource[item.source.id] = (withdrawalsBySource[item.source.id] || 0) + wd;
              remNetNeeded = Math.max(0, remNetNeeded - wd * (1 - rate));
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

        // 1. Fill any accessible non-tax-deferred sources with priority ahead of the tax-deferred tier
        depletingAccessible
          .filter(item => !item.isTaxDeferred && item.orderKey < minTdOrderKey)
          .forEach(item => {
            if (remNetNeeded <= 0.01) return;
            const rate = getSourceMarginalTaxRate(item.source);
            const avail = getAvailBal(item.source.id, item.beginBal);
            const wd = Math.min(avail, remNetNeeded / (1 - rate));
            if (wd > 0) {
              withdrawalsBySource[item.source.id] = (withdrawalsBySource[item.source.id] || 0) + wd;
              remNetNeeded = Math.max(0, remNetNeeded - wd * (1 - rate));
            }
          });

        // 2. Tax-deferred tier: Draw from both Primary and Spouse pre-tax accounts in tandem
        if (remNetNeeded > 0.01) {
          const tdGrossNeeded = remNetNeeded / (1 - incRate);
          const totalTdBal = primaryTdBal + spouseTdBal;
          const tdWithdrawalNeeded = Math.min(tdGrossNeeded, totalTdBal);

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
              primaryTarget = totalTdBal > 0 ? tdWithdrawalNeeded * (primaryTdBal / totalTdBal) : 0;
              spouseTarget = totalTdBal > 0 ? tdWithdrawalNeeded * (spouseTdBal / totalTdBal) : 0;
            }

            let primRem = primaryTarget;
            primaryTdItems.forEach(item => {
              const avail = getAvailBal(item.source.id, item.beginBal);
              const wd = Math.min(avail, primRem);
              if (wd > 0) {
                withdrawalsBySource[item.source.id] = (withdrawalsBySource[item.source.id] || 0) + wd;
                primRem -= wd;
                tdWithdrawalByOwner.primary += wd;
              }
            });

            let spRem = spouseTarget;
            spouseTdItems.forEach(item => {
              const avail = getAvailBal(item.source.id, item.beginBal);
              const wd = Math.min(avail, spRem);
              if (wd > 0) {
                withdrawalsBySource[item.source.id] = (withdrawalsBySource[item.source.id] || 0) + wd;
                spRem -= wd;
                tdWithdrawalByOwner.spouse += wd;
              }
            });

            remNetNeeded = Math.max(0, remNetNeeded - tdWithdrawalNeeded * (1 - incRate));
          }
        }

        // 3. Fill any non-tax-deferred sources with priority after the tax-deferred tier
        depletingAccessible
          .filter(item => !item.isTaxDeferred && item.orderKey >= minTdOrderKey)
          .forEach(item => {
            if (remNetNeeded <= 0.01) return;
            const rate = getSourceMarginalTaxRate(item.source);
            const avail = getAvailBal(item.source.id, item.beginBal);
            const wd = Math.min(avail, remNetNeeded / (1 - rate));
            if (wd > 0) {
              withdrawalsBySource[item.source.id] = (withdrawalsBySource[item.source.id] || 0) + wd;
              remNetNeeded = Math.max(0, remNetNeeded - wd * (1 - rate));
            }
          });
      } else {
        // Standard sequential priority waterfall with exact source-specific tax gross-up
        depletingAccessible.forEach(item => {
          if (remNetNeeded <= 0.01) return;
          const rate = getSourceMarginalTaxRate(item.source);
          const avail = getAvailBal(item.source.id, item.beginBal);
          const normalWd = Math.min(avail, remNetNeeded / (1 - rate));
          if (normalWd > 0) {
            withdrawalsBySource[item.source.id] = (withdrawalsBySource[item.source.id] || 0) + normalWd;
            remNetNeeded = Math.max(0, remNetNeeded - normalWd * (1 - rate));

            if (item.isTaxDeferred) {
              if (item.owner === 'spouse') {
                tdWithdrawalByOwner.spouse += normalWd;
              } else {
                tdWithdrawalByOwner.primary += normalWd;
              }
            }
          }
        });
      }
    }

    // Safe destination for taxable RMD surplus reinvestment (Brokerage or Cash ONLY — never Roth IRA or Pre-Tax)
    const reinvestAcct =
      sources.find(s => s.monthly === 'N' && (s.taxType === 'Capital Gain' || s.accountType === 'brokerage')) ||
      sources.find(s => s.monthly === 'N' && isSourceCash(s)) ||
      null;

    if (!reinvestAcct) {
      rmdSurplusReinvested = 0;
    }

    // Actual pre-tax balance remaining after living/RMD withdrawals, immediately prior to Roth conversion
    const preTaxBalanceBeforeConv = processedSources
      .filter(s => !s.isMonthly && s.isTaxDef)
      .reduce((sum, s) => sum + getAvailBal(s.id, beginBalanceBySource[s.id] || 0), 0);

    // Systematic Roth Conversion logic (if enabled)
    // IRS imposes no minimum age on Roth conversions, so all tax-deferred accounts with remaining balance qualify.
    let rothConvertedAmount = 0;
    let rothConversionTax = 0;
    const conversionDeductionsBySource: Record<string, number> = {};
    const rothConversionByOwner = { primary: 0, spouse: 0 };

    if (rothConfig?.enabled && age >= rothConfig.startAge && age <= rothConfig.endAge) {
      // Calculate taxable income before conversion across ALL depleting sources (including RMDs)
      let currentTaxableLivingWd = 0;
      processedSources.forEach(s => {
        if (s.isMonthly) return;
        const wd = withdrawalsBySource[s.id] || 0;
        if (wd <= 0) return;
        if (s.isTaxDef || s.taxType === 'Income') {
          currentTaxableLivingWd += wd;
        } else if (s.taxType === 'Capital Gain' || s.source.accountType === 'brokerage') {
          currentTaxableLivingWd += wd * rates.capgainPct;
        }
      });

      const baseTaxableIncome = totalSalary + guarTaxable + currentTaxableLivingWd;
      const bracketRoom = Math.max(0, rothConfig.bracketRoomMaxIncome - baseTaxableIncome);
      const annualCap = rothConfig.annualCap > 0 ? rothConfig.annualCap : Infinity;

      // All tax-deferred accounts sorted by priority (no withdrawal-age gate for Roth conversions)
      const allPreTaxSources = processedSources
        .filter(s => !s.isMonthly && s.isTaxDef)
        .sort((a, b) => a.orderKey - b.orderKey);

      const primaryPreTaxItems = allPreTaxSources.filter(s => s.owner !== 'spouse');
      const spousePreTaxItems = hasSpouse ? allPreTaxSources.filter(s => s.owner === 'spouse') : [];

      const availPrimaryPreTax = primaryPreTaxItems.reduce(
        (sum, s) => sum + getAvailBal(s.id, beginBalanceBySource[s.id] || 0),
        0
      );
      const availSpousePreTax = spousePreTaxItems.reduce(
        (sum, s) => sum + getAvailBal(s.id, beginBalanceBySource[s.id] || 0),
        0
      );
      const availablePreTax = availPrimaryPreTax + availSpousePreTax;

      const fedConvRate = rothConfig.targetBracketRate || rates.fedBracket;
      const totalConvRate = Math.min(0.95, Math.max(0, fedConvRate + rates.stateRate));

      let maxAllowedByAca = Infinity;
      if (acaEnabled && isAcaApplicable) {
        const magiRoom = Math.max(0, acaTargetLimitForYear - baseTaxableIncome);
        if (rothConfig.taxPaymentMethod === 'outsideBrokerage' && totalConvRate > 0) {
          // During ACA years, Cash pays conversion tax first (0 MAGI); any spillover into Brokerage
          // generates capital gains MAGI per dollar of conversion.
          const availCashForTax = depletingAccessible
            .filter(i => isSourceCash(i.source))
            .reduce((sum, i) => sum + getAvailBal(i.source.id, i.beginBal), 0);
          const maxConvCoveredByCash = availCashForTax / totalConvRate;
          if (magiRoom <= maxConvCoveredByCash) {
            maxAllowedByAca = magiRoom;
          } else {
            const remMagiAfterCash = magiRoom - maxConvCoveredByCash;
            const brokMagiFactor = 1 + (totalConvRate / (1 - cgEffRate)) * rates.capgainPct;
            maxAllowedByAca = maxConvCoveredByCash + remMagiAfterCash / brokMagiFactor;
          }
        } else {
          maxAllowedByAca = magiRoom;
        }
      }

      const maxConversion = Math.min(bracketRoom, annualCap, availablePreTax, maxAllowedByAca);
      if (maxConversion > 100) {
        rothConvertedAmount = maxConversion;
        rothConversionTax = maxConversion * totalConvRate;

        if (hasSpouse) {
          // 2-Person Household: Convert equally (50% / 50%) from both people's tax-deferred accounts,
          // with automatic spillover if one spouse has less pre-tax balance than their 50% share.
          const halfConv = maxConversion / 2;
          let primConvTarget = Math.min(availPrimaryPreTax, halfConv);
          let spConvTarget = Math.min(availSpousePreTax, halfConv);
          let remConv = maxConversion - (primConvTarget + spConvTarget);

          if (remConv > 0) {
            if (availPrimaryPreTax > primConvTarget) {
              const addPrim = Math.min(availPrimaryPreTax - primConvTarget, remConv);
              primConvTarget += addPrim;
              remConv -= addPrim;
            }
            if (remConv > 0 && availSpousePreTax > spConvTarget) {
              const addSp = Math.min(availSpousePreTax - spConvTarget, remConv);
              spConvTarget += addSp;
              remConv -= addSp;
            }
          }

          let primRem = primConvTarget;
          primaryPreTaxItems.forEach(s => {
            if (primRem > 0) {
              const currentWd = withdrawalsBySource[s.id] || 0;
              const availableInAcct = Math.max(0, (beginBalanceBySource[s.id] || 0) - currentWd);
              const deduct = Math.min(availableInAcct, primRem);
              if (deduct > 0) {
                withdrawalsBySource[s.id] = currentWd + deduct;
                conversionDeductionsBySource[s.id] = deduct;
                rothConversionByOwner.primary += deduct;
                primRem -= deduct;
              }
            }
          });

          let spRem = spConvTarget;
          spousePreTaxItems.forEach(s => {
            if (spRem > 0) {
              const currentWd = withdrawalsBySource[s.id] || 0;
              const availableInAcct = Math.max(0, (beginBalanceBySource[s.id] || 0) - currentWd);
              const deduct = Math.min(availableInAcct, spRem);
              if (deduct > 0) {
                withdrawalsBySource[s.id] = currentWd + deduct;
                conversionDeductionsBySource[s.id] = deduct;
                rothConversionByOwner.spouse += deduct;
                spRem -= deduct;
              }
            }
          });
        } else {
          // Single-Person Household: Deduct conversion amount from pre-tax accounts in priority order
          let convRemaining = maxConversion;
          primaryPreTaxItems.forEach(s => {
            if (convRemaining > 0) {
              const currentWd = withdrawalsBySource[s.id] || 0;
              const availableInAcct = Math.max(0, (beginBalanceBySource[s.id] || 0) - currentWd);
              const deduct = Math.min(availableInAcct, convRemaining);
              if (deduct > 0) {
                withdrawalsBySource[s.id] = currentWd + deduct;
                conversionDeductionsBySource[s.id] = deduct;
                rothConversionByOwner.primary += deduct;
                convRemaining -= deduct;
              }
            }
          });
        }
      }
    }

    // Find owner-matched destination Roth accounts
    const allRothCandidates = sources.filter(s => s.monthly === 'N' && isSourceRoth(s));
    const fallbackTaxFreeCandidates = sources.filter(
      s => s.monthly === 'N' && s.taxType === 'N/a' && !isSourceCash(s)
    );
    const rothPool =
      allRothCandidates.length > 0
        ? allRothCandidates
        : fallbackTaxFreeCandidates.length > 0
        ? fallbackTaxFreeCandidates
        : sources.filter(s => s.monthly === 'N' && s.taxType === 'N/a');

    const explicitTargetRoth = rothConfig?.targetRothAccountId
      ? sources.find(s => s.id === rothConfig.targetRothAccountId)
      : undefined;

    const primaryRothAcct =
      (!hasSpouse && explicitTargetRoth) ||
      (explicitTargetRoth && (explicitTargetRoth.owner || 'primary') === 'primary'
        ? explicitTargetRoth
        : undefined) ||
      rothPool.find(s => (s.owner || 'primary') === 'primary') ||
      rothPool.find(s => s.owner === 'joint') ||
      explicitTargetRoth ||
      rothPool[0];

    const spouseRothAcct = hasSpouse
      ? (explicitTargetRoth && explicitTargetRoth.owner === 'spouse'
          ? explicitTargetRoth
          : undefined) ||
        rothPool.find(s => s.owner === 'spouse') ||
        rothPool.find(s => s.owner === 'joint') ||
        primaryRothAcct
      : undefined;

    // Deduct conversion taxes from accessible outside Brokerage / Cash accounts
    // Brokerage liquidations are grossed up for capital gains tax and properly taxed/counted in MAGI.
    let rothTaxPaidOutside = 0;
    const taxPaidOutsideBySource: Record<string, number> = {};
    if (rothConvertedAmount > 0 && rothConfig?.taxPaymentMethod === 'outsideBrokerage') {
      let taxRemaining = rothConversionTax;
      const accessibleBrokerageSources = depletingAccessible.filter(
        i => i.source.taxType === 'Capital Gain' || i.source.accountType === 'brokerage'
      );
      const accessibleCashSources = depletingAccessible.filter(i => isSourceCash(i.source));

      // During ACA years, draw Cash first (0 MAGI impact), then Brokerage; otherwise Brokerage first, then Cash.
      const outsideTaxSources = (acaEnabled && isAcaApplicable)
        ? [...accessibleCashSources, ...accessibleBrokerageSources]
        : [...accessibleBrokerageSources, ...accessibleCashSources];

      for (const acct of outsideTaxSources) {
        if (taxRemaining <= 0.01) break;
        const curWd = withdrawalsBySource[acct.source.id] || 0;
        const avail = Math.max(0, acct.beginBal - curWd);
        if (avail <= 0) continue;

        const isBrok = acct.source.taxType === 'Capital Gain' || acct.source.accountType === 'brokerage';
        const effRate = isBrok ? cgEffRate : 0;
        const drawGross = Math.min(avail, taxRemaining / (1 - effRate));
        if (drawGross > 0) {
          const netTaxCovered = drawGross * (1 - effRate);
          withdrawalsBySource[acct.source.id] = curWd + drawGross;
          taxPaidOutsideBySource[acct.source.id] = (taxPaidOutsideBySource[acct.source.id] || 0) + drawGross;
          taxRemaining = Math.max(0, taxRemaining - netTaxCovered);
          rothTaxPaidOutside += netTaxCovered;
        }
      }
    }

    // Calculate net Roth deposits per destination Roth account (matching each person's converted amount)
    const rothDepositBySource: Record<string, number> = {};
    if (rothConvertedAmount > 0) {
      const unpaidTax = Math.max(0, rothConversionTax - rothTaxPaidOutside);
      const netTotalToRoth =
        rothConfig?.taxPaymentMethod === 'withhold'
          ? Math.max(0, rothConvertedAmount - rothConversionTax)
          : Math.max(0, rothConvertedAmount - unpaidTax);
      const netRatio = rothConvertedAmount > 0 ? netTotalToRoth / rothConvertedAmount : 0;

      if (hasSpouse) {
        const primaryNetToRoth = rothConversionByOwner.primary * netRatio;
        const spouseNetToRoth = rothConversionByOwner.spouse * netRatio;
        if (primaryRothAcct && primaryNetToRoth > 0) {
          rothDepositBySource[primaryRothAcct.id] =
            (rothDepositBySource[primaryRothAcct.id] || 0) + primaryNetToRoth;
        }
        if (spouseRothAcct && spouseNetToRoth > 0) {
          rothDepositBySource[spouseRothAcct.id] =
            (rothDepositBySource[spouseRothAcct.id] || 0) + spouseNetToRoth;
        }
      } else if (primaryRothAcct && netTotalToRoth > 0) {
        rothDepositBySource[primaryRothAcct.id] =
          (rothDepositBySource[primaryRothAcct.id] || 0) + netTotalToRoth;
      }
    }

    // Actual total withdrawals across all accounts
    let wdTotal = 0;
    let ordinaryLivingWd = 0;
    let capGainLivingWd = 0;
    let taxFreeLivingWd = 0;

    sources.forEach(s => {
      const totWd = withdrawalsBySource[s.id] || 0;
      const convDeduct = conversionDeductionsBySource[s.id] || 0;
      const outsideTaxDeduct = taxPaidOutsideBySource[s.id] || 0;
      const nonConvWd = Math.max(0, totWd - convDeduct);
      const livingWd = Math.max(0, nonConvWd - outsideTaxDeduct);

      wdTotal += totWd;

      if (s.taxType === 'Income' || isTaxDeferredSource(s)) {
        ordinaryLivingWd += livingWd;
      } else if (s.taxType === 'Capital Gain' || s.accountType === 'brokerage') {
        // Include brokerage sales used to pay outside Roth conversion taxes in capital gains & MAGI
        capGainLivingWd += nonConvWd;
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
    const acaMagi = taxableOrdinaryIncome + taxableCapGains + rothConvertedAmount;
    let acaQualified = false;
    let acaSubsidySavings = 0;

    if (isAcaApplicable) {
      const baseUnsubsidized = acaConfig?.unsubsidizedAnnualPremium ?? (expenses.expMedPremium * 12 > 0 ? expenses.expMedPremium * 12 : 21600);
      const hSize = (acaConfig?.householdSize ?? (hasSpouse ? 2 : 1)) as 1 | 2;
      // If only 1 of 2 spouses is pre-Medicare (other is already on Medicare), prorate ACA benchmark premium to 1 enrollee
      const acaEnrolleeFrac =
        hasSpouse && spouseAge !== undefined && hSize === 2 && (isPrimaryPreMedicare !== isSpousePreMedicare)
          ? 0.5
          : 1.0;
      const unsubsidizedAnnualPrem = baseUnsubsidized * acaEnrolleeFrac * cumMedicalInflation;
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

    // Only credit ACA subsidy savings into an account when ACA optimization is enabled
    const acaDestAcct = (acaEnabled && isAcaApplicable && acaQualified && acaSubsidySavings > 0)
      ? resolveAcaCreditAccount(sources, acaConfig)
      : null;
    const acaCreditedAmount = acaDestAcct ? acaSubsidySavings : 0;

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

        // Redirect RMD surplus into taxable brokerage/cash account (never Roth IRA)
        if (reinvestAcct && s.id === reinvestAcct.id && rmdSurplusReinvested > 0) {
          remaining += rmdSurplusReinvested;
        }

        // Deposit systematic Roth conversion into corresponding owner's Roth account
        const rothDeposit = rothDepositBySource[s.id] || 0;
        if (rothDeposit > 0) {
          remaining += rothDeposit;
        }

        // Reinvest/credit ACA subsidy savings into chosen account (defaults to Savings/Cash)
        if (acaDestAcct && s.id === acaDestAcct.id && acaCreditedAmount > 0) {
          remaining += acaCreditedAmount;
        }

        const endBal = remaining * (1 + effInvestRate);
        endBalanceBySource[s.id] = endBal;
        combEndBal += endBal;
      } else {
        endBalanceBySource[s.id] = 0;
      }

      incomeBySource[s.id] = wd + guar;
    });

    // Check depleted status (aligned between row `depleted` flag and `fundsRunOutYear` within life horizon)
    const inLifeHorizon = age <= scenario.lifeExpAge || (hasSpouse && spouseAge !== undefined && spouseAge <= (scenario.spouseLifeExpAge || 92));
    const depleted = combEndBal <= 0 && inLifeHorizon;
    if (combEndBal <= 0 && firstZeroYearIdx === null) {
      firstZeroYearIdx = yr;
      yearsFundingLasts = yr;
    }
    if (depleted && fundsRunOutYear === null) {
      fundsRunOutYear = calYear;
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
      cumGeneralInflation,
      rmdTotal,
      rmdDivisor,
      rmdSurplusGross,
      rmdSurplusReinvested,
      rmdBySource,
      preTaxBalanceBeforeConv,
      rothConvertedAmount,
      rothConversionTax,
      rothConversionByOwner,
      rothConvertedBySource: conversionDeductionsBySource,
      rothDepositBySource,
      primaryRothAccountName: primaryRothAcct?.name,
      spouseRothAccountName: spouseRothAcct?.name,
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
      acaCreditAccountId: acaDestAcct?.id,
      acaCreditAccountName: acaDestAcct?.name,
      acaCreditedAmount,
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
        cumGeneralInflation: y.cumGeneralInflation ?? 1,
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
        creditedToAccountName: y.acaCreditAccountName,
      };
    });

  return {
    baselineSummary: baseline.summary,
    acaSummary: withAca.summary,
    baselineYears: baseline.years,
    acaYears: withAca.years,
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
        .filter(s => s.monthly === 'N' && isTaxDeferredSource(s))
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
        cumGeneralInflation: y.cumGeneralInflation ?? 1,
        bracketRoom,
        convertedAmount: convAmt,
        primaryConverted: y.rothConversionByOwner?.primary ?? convAmt,
        spouseConverted: y.rothConversionByOwner?.spouse ?? 0,
        primaryRothName: y.primaryRothAccountName,
        spouseRothName: y.spouseRothAccountName,
        conversionTax: convTax,
        preTaxBalanceBefore: y.preTaxBalanceBeforeConv ?? (preTaxBal + convAmt),
        preTaxBalanceAfter: preTaxBal,
        rothBalanceAfter: rothBal,
      };
    });

  // Calculate RMD savings across ALL years where either Primary or Spouse has RMDs
  withRoth.years.forEach((y, idx) => {
    const baseY = baseline.years[idx];
    const baseRmd = baseY?.rmdTotal ?? 0;
    const rothRmd = y.rmdTotal ?? 0;
    if (baseRmd > 0 || rothRmd > 0) {
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
    baselineYears: baseline.years,
    rothYears: withRoth.years,
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

  // Baseline return curve under the active stress preset so Monte Carlo reflects stress regimes
  const presetMeanReturn = (yr: number): number => {
    if (stressPreset === 'crash2008') {
      if (yr === 0) return -0.37;
      if (yr === 1) return -0.10;
      if (yr === 2) return 0.26;
      if (yr === 3) return 0.15;
      if (yr === 4) return 0.12;
      return config.rates.investRate;
    }
    if (stressPreset === 'stagflation') {
      return yr < 5 ? 0.020 : 0.040;
    }
    if (stressPreset === 'earlyBear') {
      if (yr === 0) return -0.12;
      if (yr === 1) return -0.15;
      if (yr === 2) return -0.08;
      return config.rates.investRate;
    }
    if (stressPreset === 'bull') {
      return 0.085;
    }
    return config.rates.investRate;
  };

  const allRunBalances: number[][] = Array.from({ length: projYears }, () => []);
  let successfulRuns = 0;

  for (let r = 0; r < runsCount; r++) {
    const customRates: number[] = [];
    for (let yr = 0; yr < projYears; yr++) {
      const sampled = randNormal(presetMeanReturn(yr), volatility);
      customRates.push(sampled);
    }

    const res = runSimulation(config, stressPreset, undefined, customRates);
    let runSuccess = true;

    res.years.forEach((y, yr) => {
      const deflator =
        dollarMode === 'real'
          ? (y.cumGeneralInflation ?? Math.pow(1 + config.rates.inflationRate, yr))
          : 1;
      const val = y.combEndBal / (deflator > 0 ? deflator : 1);
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
