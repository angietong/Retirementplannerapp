import * as XLSX from 'xlsx';
import { PlannerConfig, YearSimulationResult, PlanSummary, DollarDisplayMode } from './types';
import { resolveAcaCreditAccount, getPhaseDefinitions, buildDefaultPhaseExpenses } from './engine';

export function exportToExcel(
  config: PlannerConfig,
  results: { years: YearSimulationResult[]; summary: PlanSummary },
  dollarMode: DollarDisplayMode = 'nominal'
) {
  const wb = XLSX.utils.book_new();
  const hasSpouse = Boolean(config.scenario?.hasSpouse);
  const primaryName = (config.scenario?.userName || 'Primary').split(' ')[0] || 'Primary';
  const spouseName = (config.scenario?.spouseName || 'Spouse').split(' ')[0] || 'Spouse';
  const dollarModeLabel = dollarMode === 'real' ? "Real (Today's $)" : 'Nominal (Future $)';

  const getDeflator = (y: YearSimulationResult): number => {
    if (dollarMode === 'nominal') return 1;
    if (y.cumGeneralInflation && y.cumGeneralInflation > 0) return y.cumGeneralInflation;
    return Math.pow(1 + config.rates.inflationRate, y.yr);
  };

  const resolvedAcaCredit = resolveAcaCreditAccount(config.sources, config.acaOptimization);
  const phaseDefinitions = getPhaseDefinitions(config);
  const phaseLabelByNum = new Map(phaseDefinitions.map(p => [p.phase, p.shortLabel]));
  const phaseExpMap = buildDefaultPhaseExpenses(config.expenses.expDaily, config.expenses.phaseExpDaily);

  // 1. Inputs Tab
  const inputRows: (string | number | boolean)[][] = [
    ['Retirement Financial Planner — Inputs'],
    ['User-editable parameters, assumptions, and household configuration'],
    ['Export Valuation Mode', dollarModeLabel],
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
    ['Primary 401(k) / 403(b) Access Age (Rule of 55)', config.milestones.four01kAge ?? config.milestones.retireAcctAge ?? 55],
    ['Primary IRA / Roth Access Age', config.milestones.iraAge ?? config.milestones.retireAcctAge ?? 60],
    ['Primary Social Security Start Age', config.milestones.ssMinAge],
    ...(hasSpouse
      ? [
          ['Spouse 401(k) / 403(b) Access Age', config.milestones.spouseFour01kAge ?? config.milestones.four01kAge ?? 55],
          ['Spouse IRA / Roth Access Age', config.milestones.spouseIraAge ?? config.milestones.iraAge ?? 60],
          ['Spouse Social Security Start Age', config.milestones.spouseSsMinAge ?? config.milestones.ssMinAge ?? 62],
        ]
      : []),
    ['Medicare Start Age', config.milestones.medicareAge],
    ['Required Minimum Distribution (RMD) Age', config.milestones.rmdAge],
    [],
    ['Tax-Deferred Early Depletion Strategy'],
    ['Synchronized Pre-Tax Drawdown Enabled?', config.taxDeferredStrategy?.enabled ?? true],
    ['Drawdown Allocation Method', config.taxDeferredStrategy?.method ?? 'proportional'],
    [],
    ['Rate Assumptions'],
    ['Annual Investment Rate of Return', config.rates.investRate],
    ['Annual General Inflation Rate', config.rates.inflationRate],
    ['Annual Medical Inflation Rate', config.rates.medicalInflationRate ?? 0.045],
    ['Federal Tax Bracket', config.rates.fedBracket],
    ['State Tax Rate', config.rates.stateRate],
    ['Capital Gain Tax Rate', config.rates.capgainRate],
    ['Capital Gain Share of Taxable', config.rates.capgainPct],
    [],
    ["Monthly Expenses (Today's Base Dollars)"],
    ['Day-to-day Living Expense ($/mo)', config.expenses.expDaily],
    ['Vary Day-to-day Living Expense by Phase?', Boolean(config.expenses.usePhaseExpenses)],
    ...(config.expenses.usePhaseExpenses
      ? phaseDefinitions.map(def => [
          `  Phase ${def.phase} — ${def.label} ($/mo)`,
          phaseExpMap[def.key],
        ])
      : []),
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
    ['Prioritize Cash Before Roth?', config.acaOptimization?.prioritizeCashBeforeRoth ?? true],
    ['Credit Subsidy Back to Account?', config.acaOptimization?.adjustMedicalExpensesWithSubsidy ?? true],
    ['ACA Credit Destination Account', resolvedAcaCredit ? resolvedAcaCredit.name : 'Auto (None)'],
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

  // Compute summary metrics respecting active dollarMode
  const lastYear = results.years[results.years.length - 1];
  const finalBalanceDisplay = lastYear
    ? Math.round(results.summary.finalBalance / getDeflator(lastYear))
    : Math.round(results.summary.finalBalance);

  const totalTaxesDisplay = Math.round(
    results.years.reduce((sum, y) => sum + y.totalTax / getDeflator(y), 0)
  );
  const totalWithdrawalsDisplay = Math.round(
    results.years.reduce((sum, y) => sum + y.wdTotal / getDeflator(y), 0)
  );
  const totalAcaSavedDisplay = Math.round(
    results.years.reduce(
      (sum, y) => sum + (y.acaQualified ? (y.acaSubsidySavings || 0) / getDeflator(y) : 0),
      0
    )
  );

  // 2. Plan Tab
  const planHeaders: string[] = [
    'Year',
    hasSpouse ? `${primaryName} Age` : 'Age',
    ...(hasSpouse ? [`${spouseName} Age`] : []),
    'Phase',
    'Phase Name',
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
    ...(hasSpouse ? [`${primaryName} Roth Conv.`, `${spouseName} Roth Conv.`] : []),
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
    [`Valuation Mode: ${dollarModeLabel}`],
    [],
    ['Key Results Summary'],
    ['Funds Run Out Year', results.summary.fundsRunOutYear ?? 'Not depleted within horizon'],
    ['Years Funding Lasts', results.summary.yearsFundingLasts],
    ['Starting Combined Balance', Math.round(results.summary.startingCombinedBalance)],
    ['Ending Combined Balance', finalBalanceDisplay],
    ['Total Taxes Projected', totalTaxesDisplay],
    ['Total Withdrawals Projected', totalWithdrawalsDisplay],
    ['Total ACA Healthcare Subsidies Saved', totalAcaSavedDisplay],
    [],
    planHeaders
  ];

  results.years.forEach(y => {
    const deflator = getDeflator(y);
    const row: (string | number)[] = [
      y.calYear,
      parseFloat(y.age.toFixed(1)),
      ...(hasSpouse ? [y.spouseAge !== undefined ? parseFloat(y.spouseAge.toFixed(1)) : '—'] : []),
      y.phase,
      phaseLabelByNum.get(y.phase) ?? '',
      Math.round(y.salary / deflator),
      Math.round(y.guarTotal / deflator),
      Math.round(y.wdTotal / deflator),
      Math.round(y.expenses / deflator),
      Math.round((y.generalExpenses || 0) / deflator),
      Math.round((y.medicalExpenses || 0) / deflator),
      Math.round((y.majorExpenses || 0) / deflator),
      y.isMedicareActive ? 'YES' : 'NO',
      Math.round((y.rmdTotal || 0) / deflator),
      y.rmdDivisor || 0,
      Math.round((y.rmdSurplusReinvested || 0) / deflator),
      Math.round((y.rothConvertedAmount || 0) / deflator),
      ...(hasSpouse
        ? [
            Math.round((y.rothConversionByOwner?.primary || 0) / deflator),
            Math.round((y.rothConversionByOwner?.spouse || 0) / deflator),
          ]
        : []),
      Math.round((y.rothConversionTax || 0) / deflator),
      Math.round(y.fedTax / deflator),
      Math.round(y.stateTax / deflator),
      Math.round(y.capGainTax / deflator),
      Math.round(y.totalTax / deflator),
      Math.round(y.combEndBal / deflator),
      y.acaMagi !== undefined ? Math.round(y.acaMagi / deflator) : '',
      y.acaTargetLimit !== undefined ? Math.round(y.acaTargetLimit / deflator) : '',
      y.acaQualified && (y.acaSubsidySavings || 0) > 0 ? Math.round((y.acaSubsidySavings || 0) / deflator) : 0,
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
    const deflator = getDeflator(y);
    const row: (string | number)[] = [
      y.calYear,
      ...config.sources.map(s => Math.round((y.incomeBySource[s.id] || 0) / deflator)),
      Math.round((y.generalExpenses || 0) / deflator),
      Math.round((y.medicalExpenses || 0) / deflator),
      Math.round((y.majorExpenses || 0) / deflator),
      Math.round(y.expenses / deflator),
      Math.round((y.rmdTotal || 0) / deflator),
      Math.round(y.fedTax / deflator),
      Math.round(y.stateTax / deflator),
      Math.round(y.capGainTax / deflator),
      Math.round(y.combEndBal / deflator),
      ...config.sources.map(s => Math.round((y.endBalanceBySource[s.id] || 0) / deflator))
    ];
    chartDataRows.push(row);
  });

  const wsChartData = XLSX.utils.aoa_to_sheet(chartDataRows);
  XLSX.utils.book_append_sheet(wb, wsChartData, 'ChartData');

  // Trigger download
  const cleanName = config.scenario.userName.replace(/\s+/g, '_');
  XLSX.writeFile(wb, `${cleanName}_Retirement_Plan.xlsx`);
}
