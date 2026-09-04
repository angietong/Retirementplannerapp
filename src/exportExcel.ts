import * as XLSX from 'xlsx';
import { PlannerConfig, YearSimulationResult, PlanSummary } from './types';

export function exportToExcel(
  config: PlannerConfig,
  results: { years: YearSimulationResult[]; summary: PlanSummary }
) {
  const wb = XLSX.utils.book_new();

  // 1. Inputs Tab
  const inputRows: (string | number | boolean)[][] = [
    ['Retirement Financial Planner — Inputs'],
    ['User-editable parameters and scenario configuration'],
    [],
    ['Scenario Parameters'],
    ['User name', config.scenario.userName],
    ['Birth date', config.scenario.birthDate],
    ['Retirement year salary', config.scenario.retSalary],
    ['Target retirement date', config.scenario.retDate],
    ['Social Security start date', config.scenario.ssStartDate],
    ['Pension start date', config.scenario.pensionStartDate],
    ['Taxable income percentage', config.scenario.taxablePct],
    ['Life expectancy age', config.scenario.lifeExpAge],
    [],
    ['Milestone Ages'],
    ['RMD age', config.milestones.rmdAge],
    ['Medicare start age', config.milestones.medicareAge],
    ['Social Security min start age', config.milestones.ssMinAge],
    ['401k / IRA withdrawal age', config.milestones.retireAcctAge],
    [],
    ['Rate Assumptions'],
    ['Annual investment rate of return', config.rates.investRate],
    ['Annual inflation rate', config.rates.inflationRate],
    ['Target federal tax bracket', config.rates.fedBracket],
    ['State tax rate', config.rates.stateRate],
    ['Capital gain tax rate', config.rates.capgainRate],
    ['Capital-gain share of taxable income', config.rates.capgainPct],
    [],
    ['Monthly Expenses (today\'s dollars)'],
    ['Day-to-day after-tax expense', config.expenses.expDaily],
    ['Medical premium', config.expenses.expMedPremium],
    ['Medical out-of-pocket expense', config.expenses.expMedOop],
    [],
    ['Income Sources (up to 20 — lower priority withdrawn first)'],
    ['Source name / type', 'Balance', 'Priority', 'Monthly (Y/N)', 'Tax type', 'Annual payment', 'Start age', 'Notes']
  ];

  config.sources.forEach(s => {
    inputRows.push([
      s.name,
      s.balance,
      s.priority,
      s.monthly,
      s.taxType,
      s.annualPayment,
      s.startAge,
      s.notes
    ]);
  });

  const wsInputs = XLSX.utils.aoa_to_sheet(inputRows);
  XLSX.utils.book_append_sheet(wb, wsInputs, 'Inputs');

  // 2. Plan Tab
  const planRows: (string | number)[][] = [
    ['Retirement Financial Plan'],
    [`Plan for: ${config.scenario.userName}`],
    [],
    ['Key Results'],
    ['Funds run out (year)', results.summary.fundsRunOutYear ?? 'Not depleted within horizon'],
    ['Years funding lasts', results.summary.yearsFundingLasts],
    ['Starting combined balance', results.summary.startingCombinedBalance],
    ['Total taxes projected', results.summary.totalTaxesPaid],
    ['Total withdrawals projected', results.summary.totalWithdrawals],
    [],
    [
      'Year',
      'Age',
      'Phase',
      'Salary',
      'Guaranteed Income',
      'Withdrawals',
      'Expenses',
      'Federal Tax',
      'State Tax',
      'Capital Gain Tax',
      'Total Tax',
      'Combined Balance',
      'Depleted?'
    ]
  ];

  results.years.forEach(y => {
    planRows.push([
      y.calYear,
      y.age,
      y.phase,
      Math.round(y.salary),
      Math.round(y.guarTotal),
      Math.round(y.wdTotal),
      Math.round(y.expenses),
      Math.round(y.fedTax),
      Math.round(y.stateTax),
      Math.round(y.capGainTax),
      Math.round(y.totalTax),
      Math.round(y.combEndBal),
      y.depleted ? 'YES' : ''
    ]);
  });

  const wsPlan = XLSX.utils.aoa_to_sheet(planRows);
  XLSX.utils.book_append_sheet(wb, wsPlan, 'Plan');

  // 3. ChartData Tab
  const chartDataHeaders = [
    'Cal Year',
    ...config.sources.map(s => `Income: ${s.name}`),
    'Expenses',
    'Federal Tax',
    'State Tax',
    'Capital Gain Tax',
    'Combined Balance',
    ...config.sources.map(s => `Balance: ${s.name}`)
  ];

  const chartDataRows: (string | number)[][] = [chartDataHeaders];

  results.years.forEach(y => {
    const row: (string | number)[] = [
      y.calYear,
      ...config.sources.map(s => Math.round(y.incomeBySource[s.id] || 0)),
      Math.round(y.expenses),
      Math.round(y.fedTax),
      Math.round(y.stateTax),
      Math.round(y.capGainTax),
      Math.round(y.combEndBal),
      ...config.sources.map(s => Math.round(y.endBalanceBySource[s.id] || 0))
    ];
    chartDataRows.push(row);
  });

  const wsChartData = XLSX.utils.aoa_to_sheet(chartDataRows);
  XLSX.utils.book_append_sheet(wb, wsChartData, 'ChartData');

  // Trigger download
  XLSX.writeFile(wb, `${config.scenario.userName.replace(/\s+/g, '_')}_Retirement_Plan.xlsx`);
}
