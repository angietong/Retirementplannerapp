import * as XLSX from 'xlsx';
import { PlannerConfig, YearSimulationResult, PlanSummary } from './types';

export function exportToExcel(
  config: PlannerConfig,
  results: { years: YearSimulationResult[]; summary: PlanSummary }
) {
  const wb = XLSX.utils.book_new();
  const hasSpouse = Boolean(config.scenario?.hasSpouse);
  const primaryName = (config.scenario?.userName || 'Primary').split(' ')[0] || 'Primary';
  const spouseName = (config.scenario?.spouseName || 'Spouse').split(' ')[0] || 'Spouse';

  // 1. Inputs Tab
  const inputRows: (string | number | boolean)[][] = [
    ['Retirement Financial Planner — Inputs'],
    ['User-editable parameters, assumptions, and household configuration'],
    [],
    ['Household Scenario Parameters'],
    ['Household Type', hasSpouse ? '2-Person Household (With Spouse)' : 'Single Person'],
    ['Primary User Name', config.scenario.userName],
    ['Primary Birth Date', config.scenario.birthDate],
    ['Primary Retirement Date', config.scenario.retDate],
    ['Primary Retirement Salary', config.scenario.retSalary],
    ['Primary Life Expectancy Age', config.scenario.lifeExpAge],
  ];

  if (hasSpouse) {
    inputRows.push(
      ['Spouse Name', config.scenario.spouseName || ''],
      ['Spouse Birth Date', config.scenario.spouseBirthDate || ''],
      ['Spouse Retirement Date', config.scenario.spouseRetDate || ''],
      ['Spouse Retirement Salary', config.scenario.spouseRetSalary || 0],
      ['Spouse Life Expectancy Age', config.scenario.spouseLifeExpAge || 92]
    );
  }

  inputRows.push(
    ['Taxable Income Share %', config.scenario.taxablePct],
    [],
    ['Milestone Ages'],
    ['401(k) / 403(b) Access Age (Rule of 55)', config.milestones.four01kAge ?? config.milestones.retireAcctAge ?? 55],
    ['IRA / Roth Access Age', config.milestones.iraAge ?? config.milestones.retireAcctAge ?? 60],
    ['Social Security Earliest Age', config.milestones.ssMinAge],
    ['Medicare Start Age', config.milestones.medicareAge],
    ['Required Minimum Distribution (RMD) Age', config.milestones.rmdAge],
    [],
    ['Rate Assumptions'],
    ['Annual Investment Rate of Return (%)', config.rates.investRate],
    ['Annual General Inflation Rate (%)', config.rates.inflationRate],
    ['Annual Medical Inflation Rate (%)', config.rates.medicalInflationRate ?? 0.045],
    ['Federal Tax Bracket (%)', config.rates.fedBracket],
    ['State Tax Rate (%)', config.rates.stateRate],
    ['Capital Gain Tax Rate (%)', config.rates.capgainRate],
    ['Capital Gain Share of Taxable (%)', config.rates.capgainPct],
    [],
    ['Monthly Expenses (Today\'s Base Dollars)'],
    ['Day-to-day Living Expense ($/mo)', config.expenses.expDaily],
    ['Pre-Medicare Medical Premium ($/mo)', config.expenses.expMedPremium],
    ['Pre-Medicare Medical OOP ($/mo)', config.expenses.expMedOop],
    ['Different Post-Medicare Expenses Enabled?', config.expenses.hasMedicarePostExp ?? true],
    ['Post-Medicare Medical Premium ($/mo)', config.expenses.expMedPremiumPost ?? 320],
    ['Post-Medicare Medical OOP ($/mo)', config.expenses.expMedOopPost ?? 180],
    [],
    ['Scheduled Major Annual Expenses (Up to 10 by Specified Age)'],
    ['Expense Name', 'Target Age', 'Amount ($)', 'Inflation Adjusted', 'Notes'],
    ...(config.majorExpenses && config.majorExpenses.length > 0
      ? config.majorExpenses.map(m => [
          m.name,
          m.age,
          m.amount,
          m.inflationAdjusted !== false ? 'YES' : 'NO',
          m.notes || ''
        ])
      : [['(None configured)', '', '', '', '']]),
    [],
    ['Systematic Roth Conversion Strategy'],
    ['Roth Conversion Active?', config.rothConversion?.enabled ?? false],
    ['Conversion Start Age', config.rothConversion?.startAge ?? 60],
    ['Conversion End Age', config.rothConversion?.endAge ?? 72],
    ['Target Bracket Dollar Ceiling', config.rothConversion?.bracketRoomMaxIncome ?? 201050],
    ['Max Annual Conversion Cap', config.rothConversion?.annualCap ?? 50000],
    ['Tax Payment Method', config.rothConversion?.taxPaymentMethod ?? 'outsideBrokerage'],
    [],
    ['ACA Healthcare Subsidy Drawdown Optimization'],
    ['ACA Optimization Active?', config.acaOptimization?.enabled ?? false],
    ['Target MAGI Limit ($)', config.acaOptimization?.targetMagilimit ?? 84600],
    ['ACA FPL Preset', config.acaOptimization?.preset ?? 'fpl400'],
    ['Household Size', config.acaOptimization?.householdSize ?? (hasSpouse ? 2 : 1)],
    ['Unsubsidized Annual Premium ($)', config.acaOptimization?.unsubsidizedAnnualPremium ?? 21600],
    ['Bridge End Age (Medicare)', config.acaOptimization?.endAge ?? 65],
    [],
    ['Income & Asset Sources (Up to 20 — lower priority withdrawn first)'],
    ['Source Name', 'Account Category', 'Owner', 'Balance ($)', 'Priority', 'Monthly (Y/N)', 'Tax Type', 'Annual Payment ($)', 'Start Age', 'Notes']
  );

  config.sources.forEach(s => {
    inputRows.push([
      s.name,
      s.accountType || 'other',
      s.owner || 'primary',
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
  const planHeaders: string[] = [
    'Year',
    hasSpouse ? `${primaryName} Age` : 'Age',
    ...(hasSpouse ? [`${spouseName} Age`] : []),
    'Phase',
    'Salary',
    'Guaranteed Income',
    'Withdrawals',
    'Total Expenses',
    'General Living Expenses',
    'Medical Expenses',
    'Major Expenses',
    'Medicare Active',
    'IRS RMD Amount',
    'IRS Divisor',
    'RMD Surplus Reinvested',
    'Roth Converted',
    'Roth Conv. Tax',
    'Federal Tax',
    'State Tax',
    'Capital Gain Tax',
    'Total Tax',
    'Combined End Balance',
    'ACA MAGI',
    'ACA Target Limit',
    'ACA Subsidy Saved',
    'ACA Credited To Account',
    'Depleted?'
  ];

  const planRows: (string | number)[][] = [
    ['Retirement Financial Plan'],
    [`Household: ${config.scenario.userName}${hasSpouse ? ` & ${config.scenario.spouseName}` : ''}`],
    [],
    ['Key Results Summary'],
    ['Funds Run Out Year', results.summary.fundsRunOutYear ?? 'Not depleted within horizon'],
    ['Years Funding Lasts', results.summary.yearsFundingLasts],
    ['Starting Combined Balance', results.summary.startingCombinedBalance],
    ['Ending Combined Balance', results.summary.finalBalance],
    ['Total Taxes Projected', results.summary.totalTaxesPaid],
    ['Total Withdrawals Projected', results.summary.totalWithdrawals],
    ['Total ACA Healthcare Subsidies Saved', results.summary.totalAcaSubsidiesSaved ?? 0],
    [],
    planHeaders
  ];

  results.years.forEach(y => {
    const row: (string | number)[] = [
      y.calYear,
      parseFloat(y.age.toFixed(1)),
      ...(hasSpouse ? [y.spouseAge !== undefined ? parseFloat(y.spouseAge.toFixed(1)) : '—'] : []),
      y.phase,
      Math.round(y.salary),
      Math.round(y.guarTotal),
      Math.round(y.wdTotal),
      Math.round(y.expenses),
      Math.round(y.generalExpenses || 0),
      Math.round(y.medicalExpenses || 0),
      Math.round(y.majorExpenses || 0),
      y.isMedicareActive ? 'YES' : 'NO',
      Math.round(y.rmdTotal || 0),
      y.rmdDivisor || 0,
      Math.round(y.rmdSurplusReinvested || 0),
      Math.round(y.rothConvertedAmount || 0),
      Math.round(y.rothConversionTax || 0),
      Math.round(y.fedTax),
      Math.round(y.stateTax),
      Math.round(y.capGainTax),
      Math.round(y.totalTax),
      Math.round(y.combEndBal),
      y.acaMagi !== undefined ? Math.round(y.acaMagi) : '',
      y.acaTargetLimit !== undefined ? Math.round(y.acaTargetLimit) : '',
      y.acaQualified && (y.acaSubsidySavings || 0) > 0 ? Math.round(y.acaSubsidySavings || 0) : 0,
      y.acaQualified && (y.acaCreditedAmount || 0) > 0 ? (y.acaCreditAccountName || '') : '',
      y.depleted ? 'YES' : ''
    ];
    planRows.push(row);
  });

  const wsPlan = XLSX.utils.aoa_to_sheet(planRows);
  XLSX.utils.book_append_sheet(wb, wsPlan, 'Plan');

  // 3. ChartData Tab
  const chartDataHeaders = [
    'Cal Year',
    ...config.sources.map(s => `Income: ${s.name}`),
    'General Expenses',
    'Medical Expenses',
    'Major Expenses',
    'Total Expenses',
    'RMD Mandated',
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
      Math.round(y.generalExpenses || 0),
      Math.round(y.medicalExpenses || 0),
      Math.round(y.majorExpenses || 0),
      Math.round(y.expenses),
      Math.round(y.rmdTotal || 0),
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
  const cleanName = config.scenario.userName.replace(/\s+/g, '_');
  XLSX.writeFile(wb, `${cleanName}_Retirement_Plan.xlsx`);
}
