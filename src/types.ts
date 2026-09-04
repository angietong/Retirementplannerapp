export type TaxType = 'Income' | 'Capital Gain' | 'N/a';
export type MonthlyIndicator = 'Y' | 'N';

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
}

export interface MilestoneAges {
  rmdAge: number;
  medicareAge: number;
  ssMinAge: number;
  retireAcctAge: number;
}

export interface RateAssumptions {
  investRate: number;
  inflationRate: number;
  fedBracket: number;
  stateRate: number;
  capgainRate: number;
  capgainPct: number;
}

export interface MonthlyExpenses {
  expDaily: number;
  expMedPremium: number;
  expMedOop: number;
}

export interface PlannerConfig {
  scenario: ScenarioParams;
  milestones: MilestoneAges;
  rates: RateAssumptions;
  expenses: MonthlyExpenses;
  sources: IncomeSource[];
  projectionYears: number;
}

export interface YearSimulationResult {
  yr: number;
  calYear: number;
  age: number;
  phase: number;
  workFrac: number;
  remFrac: number;
  salary: number;
  expenses: number;
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
  withdrawalsBySource: Record<string, number>;
  guaranteedBySource: Record<string, number>;
  incomeBySource: Record<string, number>;
  endBalanceBySource: Record<string, number>;
  beginBalanceBySource: Record<string, number>;
}

export interface PlanSummary {
  fundsRunOutYear: number | null;
  yearsFundingLasts: number;
  startingCombinedBalance: number;
  totalTaxesPaid: number;
  totalWithdrawals: number;
  finalBalance: number;
}
