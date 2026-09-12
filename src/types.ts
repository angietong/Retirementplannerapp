export type TaxType = 'Income' | 'Capital Gain' | 'N/a';
export type MonthlyIndicator = 'Y' | 'N';
export type SourceOwner = 'primary' | 'spouse' | 'joint';
export type DollarDisplayMode = 'nominal' | 'real';
export type StressPreset = 'baseline' | 'crash2008' | 'stagflation' | 'earlyBear' | 'bull';

export interface StressPresetConfig {
  id: StressPreset;
  name: string;
  description: string;
  tag: string;
}

export interface IncomeSource {
  id: string;
  name: string;
  balance: number;
  priority: number;
  monthly: MonthlyIndicator;
  taxType: TaxType;
  annualPayment: number;
  startAge: number;
  notes: string;
  owner?: SourceOwner;
  accountType?: '401k' | 'ira' | 'roth' | 'brokerage' | 'cash' | 'other';
}

export interface ScenarioParams {
  userName: string;
  birthDate: string;
  retSalary: number;
  retDate: string;
  ssStartDate: string;
  pensionStartDate: string;
  taxablePct: number;
  lifeExpAge: number;
  // 2-person household fields
  hasSpouse?: boolean;
  spouseName?: string;
  spouseBirthDate?: string;
  spouseRetSalary?: number;
  spouseRetDate?: string;
  spouseLifeExpAge?: number;
  spouseSsStartDate?: string;
}

export interface MilestoneAges {
  rmdAge: number;
  medicareAge: number;
  ssMinAge: number;
  four01kAge: number;
  iraAge: number;
  spouseFour01kAge?: number;
  spouseIraAge?: number;
  spouseSsMinAge?: number;
  retireAcctAge?: number; // legacy fallback
}

export interface RateAssumptions {
  investRate: number;
  inflationRate: number;
  medicalInflationRate?: number;
  fedBracket: number;
  stateRate: number;
  capgainRate: number;
  capgainPct: number;
}

export interface MonthlyExpenses {
  expDaily: number;
  expMedPremium: number;
  expMedOop: number;
  hasMedicarePostExp?: boolean;
  expMedPremiumPost?: number;
  expMedOopPost?: number;
}

export interface MajorExpense {
  id: string;
  name: string;
  age: number;
  amount: number;
  inflationAdjusted?: boolean;
  notes?: string;
}

export interface RothConversionConfig {
  enabled: boolean;
  startAge: number;
  endAge: number;
  targetBracketRate: number;
  bracketRoomMaxIncome: number;
  annualCap: number;
  taxPaymentMethod: 'outsideBrokerage' | 'withhold';
  sourceAccountId?: string;
  targetRothAccountId?: string;
}

export interface TaxDeferredWithdrawalStrategy {
  enabled: boolean;
  method: 'proportional' | 'equal';
}

export interface PlannerConfig {
  scenario: ScenarioParams;
  milestones: MilestoneAges;
  rates: RateAssumptions;
  expenses: MonthlyExpenses;
  majorExpenses?: MajorExpense[];
  sources: IncomeSource[];
  projectionYears: number;
  rothConversion?: RothConversionConfig;
  taxDeferredStrategy?: TaxDeferredWithdrawalStrategy;
}

export interface YearSimulationResult {
  yr: number;
  calYear: number;
  age: number;
  spouseAge?: number;
  phase: number;
  workFrac: number;
  remFrac: number;
  salary: number;
  primarySalary?: number;
  spouseSalary?: number;
  expenses: number;
  generalExpenses?: number;
  medicalExpenses?: number;
  majorExpenses?: number;
  majorExpensesList?: { name: string; amount: number }[];
  isMedicareActive?: boolean;
  guarTotal: number;
  guarTaxable: number;
  taxOther: number;
  wdTotal: number;
  taxTarget: number;
  nonTaxTarget: number;
  fedTax: number;
  stateTax: number;
  capGainTax: number;
  totalTax: number;
  combEndBal: number;
  depleted: boolean;
  effectiveReturnRate?: number;
  effectiveInflationRate?: number;
  effectiveMedicalInflationRate?: number;
  // RMD calculations & surplus redirection
  rmdTotal?: number;
  rmdDivisor?: number;
  rmdSurplusGross?: number;
  rmdSurplusReinvested?: number;
  rmdBySource?: Record<string, number>;
  // Roth conversion tracking
  rothConvertedAmount?: number;
  rothConversionTax?: number;
  // Synchronized household pre-tax drawdown tracking
  isSynchronizedTdActive?: boolean;
  tdWithdrawalByOwner?: { primary: number; spouse: number };
  withdrawalsBySource: Record<string, number>;
  guaranteedBySource: Record<string, number>;
  incomeBySource: Record<string, number>;
  endBalanceBySource: Record<string, number>;
  beginBalanceBySource: Record<string, number>;
}

export interface RothComparisonResult {
  baselineSummary: PlanSummary;
  rothSummary: PlanSummary;
  lifetimeTaxSavings: number;
  finalBalanceDifference: number;
  totalConverted: number;
  totalConversionTaxesPaid: number;
  rmdLifetimeSavings: number;
  peakRmdReduction: number;
  conversionSchedule: {
    year: number;
    age: number;
    spouseAge?: number;
    bracketRoom: number;
    convertedAmount: number;
    conversionTax: number;
    preTaxBalanceBefore: number;
    preTaxBalanceAfter: number;
    rothBalanceAfter: number;
  }[];
}

export interface PlanSummary {
  fundsRunOutYear: number | null;
  yearsFundingLasts: number;
  startingCombinedBalance: number;
  totalTaxesPaid: number;
  totalWithdrawals: number;
  finalBalance: number;
}

export interface MonteCarloPercentileResult {
  years: number[];
  calYears: number[];
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
  successProbability: number;
  runsCount: number;
  volatility: number;
}

