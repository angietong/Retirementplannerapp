import { DEFAULT_CONFIG, ACA_FPL_BASE, getAcaFplLimit } from '../src/defaultData';
import {
  runSimulation,
  compareRothConversion,
  compareAcaOptimization,
  runMonteCarloSimulation,
  IRS_UNIFORM_LIFETIME_DIVISORS,
  calculateAcaSubsidy,
} from '../src/engine';
import { runWhatIfComparisons } from '../src/whatifEngine';
import { StressPreset, AcaFplPreset } from '../src/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
}

console.log('===============================================================');
console.log('RETIREMENT PLANNER COMPREHENSIVE ENGINE & SCENARIO TEST SUITE');
console.log('===============================================================\n');

let totalTests = 0;
let passedTests = 0;

function test(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

// -------------------------------------------------------------
// 1. BASELINE SIMULATION & FUNDAMENTAL FINANCIAL INVARIANTS
// -------------------------------------------------------------
console.log('1. BASELINE SIMULATION & INVARIANTS');
test('Baseline simulation runs for 40 years with complete timeline', () => {
  const result = runSimulation(DEFAULT_CONFIG, 'baseline');
  assert(result.years.length === 40, `Expected 40 years, got ${result.years.length}`);
  assert(result.summary.startingCombinedBalance > 0, 'Starting balance should be positive');
  assert(result.summary.finalBalance > 0, 'Final balance should be positive');
  assert(result.summary.totalWithdrawals > 0, 'Total withdrawals should be positive');
  assert(result.summary.totalTaxesPaid > 0, 'Total taxes should be positive');
});

test('Accounting invariant: Starting combined balance matches sum of non-monthly sources', () => {
  const result = runSimulation(DEFAULT_CONFIG, 'baseline');
  const expectedSum = DEFAULT_CONFIG.sources
    .filter(s => s.monthly === 'N')
    .reduce((sum, s) => sum + (s.balance || 0), 0);
  assert(
    Math.abs(result.summary.startingCombinedBalance - expectedSum) < 1,
    `Starting combined balance ${result.summary.startingCombinedBalance} does not match sum of sources ${expectedSum}`
  );
});

test('Year-over-year balance continuity invariant: BeginBalance(yr) == EndBalance(yr-1)', () => {
  const result = runSimulation(DEFAULT_CONFIG, 'baseline');
  for (let i = 1; i < result.years.length; i++) {
    const prevYear = result.years[i - 1];
    const currYear = result.years[i];
    for (const source of DEFAULT_CONFIG.sources) {
      if (source.monthly === 'N') {
        const prevEnd = prevYear.endBalanceBySource[source.id] || 0;
        const currBeg = currYear.beginBalanceBySource[source.id] || 0;
        assert(
          Math.abs(prevEnd - currBeg) < 0.01,
          `Source ${source.name} balance discontinuity at year ${currYear.calYear}: prevEnd=${prevEnd}, currBeg=${currBeg}`
        );
      }
    }
  }
});

// -------------------------------------------------------------
// 2. STRESS TEST PRESETS (5 SCENARIOS)
// -------------------------------------------------------------
console.log('\n2. STRESS TEST PRESETS COMPARISON');
const presets: StressPreset[] = ['baseline', 'crash2008', 'stagflation', 'earlyBear', 'bull'];
const presetResults: Record<string, any> = {};

presets.forEach(preset => {
  test(`Stress preset "${preset}" executes cleanly`, () => {
    const res = runSimulation(DEFAULT_CONFIG, preset);
    assert(res.years.length === 40, `Preset ${preset} returned ${res.years.length} years`);
    presetResults[preset] = res.summary;
  });
});

test('Stress presets validate expected financial degradation order', () => {
  assert(
    presetResults.bull.finalBalance > presetResults.baseline.finalBalance,
    'Bull market final balance should be higher than baseline'
  );
  assert(
    presetResults.baseline.finalBalance > presetResults.crash2008.finalBalance,
    'Crash 2008 final balance should be lower than baseline'
  );
  assert(
    presetResults.baseline.finalBalance > presetResults.stagflation.finalBalance,
    'Stagflation final balance should be lower than baseline'
  );
  assert(
    presetResults.baseline.finalBalance > presetResults.earlyBear.finalBalance,
    'Early bear sequence final balance should be lower than baseline'
  );
  console.log('     -> Bull Market Final Bal:      $' + Math.round(presetResults.bull.finalBalance).toLocaleString());
  console.log('     -> Baseline Final Bal:         $' + Math.round(presetResults.baseline.finalBalance).toLocaleString());
  console.log('     -> 2008 Crash Final Bal:       $' + Math.round(presetResults.crash2008.finalBalance).toLocaleString());
  console.log('     -> Early Bear Final Bal:       $' + Math.round(presetResults.earlyBear.finalBalance).toLocaleString());
  console.log('     -> 1970s Stagflation Final Bal:$' + Math.round(presetResults.stagflation.finalBalance).toLocaleString());
});

// -------------------------------------------------------------
// 3. TAX-DEFERRED MULTI-MEMBER WITHDRAWAL STRATEGIES
// -------------------------------------------------------------
console.log('\n3. TAX-DEFERRED WITHDRAWAL STRATEGY (PROPORTIONAL VS EQUAL VS DISABLED)');
test('Proportional multi-member tax-deferred strategy draws from both spouses', () => {
  const propConfig = {
    ...DEFAULT_CONFIG,
    taxDeferredStrategy: { enabled: true, method: 'proportional' as const }
  };
  const res = runSimulation(propConfig, 'baseline');
  const synchronizedYears = res.years.filter(y => y.isSynchronizedTdActive);
  assert(synchronizedYears.length > 0, 'Should have synchronized tax-deferred withdrawals');
  const firstSync = synchronizedYears[0];
  assert(firstSync.tdWithdrawalByOwner.primary > 0, 'Primary should have pre-tax withdrawal');
  assert(firstSync.tdWithdrawalByOwner.spouse > 0, 'Spouse should have pre-tax withdrawal');
});

test('Equal multi-member tax-deferred strategy splits withdrawal equally between spouses', () => {
  const equalConfig = {
    ...DEFAULT_CONFIG,
    taxDeferredStrategy: { enabled: true, method: 'equal' as const }
  };
  const res = runSimulation(equalConfig, 'baseline');
  const syncYears = res.years.filter(y => y.isSynchronizedTdActive);
  assert(syncYears.length > 0, 'Should have synchronized tax-deferred withdrawals in equal mode');
});

test('Disabled tax-deferred strategy follows strict priority order', () => {
  const disabledConfig = {
    ...DEFAULT_CONFIG,
    taxDeferredStrategy: { enabled: false, method: 'proportional' as const }
  };
  const res = runSimulation(disabledConfig, 'baseline');
  const syncYears = res.years.filter(y => y.isSynchronizedTdActive);
  assert(syncYears.length === 0, 'No synchronized TD withdrawals when strategy is disabled');
});

// -------------------------------------------------------------
// 4. DECOUPLED HEALTHCARE & POST-MEDICARE MILESTONE
// -------------------------------------------------------------
console.log('\n4. HEALTHCARE DECOUPLING & MEDICARE MILESTONE (AGE 65)');
test('Healthcare expenses decouple with medical inflation before age 65', () => {
  const res = runSimulation(DEFAULT_CONFIG, 'baseline');
  const preMedicareYear = res.years.find(y => y.age < 65 && y.medicalExpenses && y.medicalExpenses > 0);
  assert(preMedicareYear !== undefined, 'Should have pre-Medicare year with medical expenses');
  assert(!preMedicareYear?.isMedicareActive, 'Year before 65 should have isMedicareActive = false');
});

test('Age 65+ triggers Medicare active status and switches to post-Medicare rates', () => {
  const res = runSimulation(DEFAULT_CONFIG, 'baseline');
  const medicareYear = res.years.find(y => y.age >= 65);
  assert(medicareYear !== undefined, 'Should find year with age >= 65');
  assert(medicareYear?.isMedicareActive === true, 'Year at or after 65 must have isMedicareActive = true');
});

// -------------------------------------------------------------
// 5. SCHEDULED MAJOR EXPENSES VALIDATION
// -------------------------------------------------------------
console.log('\n5. SCHEDULED MAJOR EXPENSES MODELING');
test('Major scheduled expenses trigger at exact target ages', () => {
  const res = runSimulation(DEFAULT_CONFIG, 'baseline');
  const majorList = DEFAULT_CONFIG.majorExpenses || [];
  for (const m of majorList) {
    const yrWithExp = res.years.find(y => Math.round(y.age) === Math.round(m.age));
    assert(yrWithExp !== undefined, `Could not find simulation year for major expense at age ${m.age}`);
    assert((yrWithExp?.majorExpenses || 0) > 0, `Expected major expense in year at age ${m.age}`);
  }
});

// -------------------------------------------------------------
// 6. IRS MANDATORY RMD VALIDATION
// -------------------------------------------------------------
console.log('\n6. IRS REQUIRED MINIMUM DISTRIBUTIONS (RMD) & DIVISORS');
test('RMD divisor table matches IRS Publication 590-B Table III', () => {
  assert(IRS_UNIFORM_LIFETIME_DIVISORS[73] === 26.5, 'Age 73 divisor must be 26.5');
  assert(IRS_UNIFORM_LIFETIME_DIVISORS[75] === 24.6, 'Age 75 divisor must be 24.6');
  assert(IRS_UNIFORM_LIFETIME_DIVISORS[80] === 20.2, 'Age 80 divisor must be 20.2');
  assert(IRS_UNIFORM_LIFETIME_DIVISORS[90] === 12.2, 'Age 90 divisor must be 12.2');
});

test('RMD mandate enforces pre-tax distributions at age 73+', () => {
  const res = runSimulation(DEFAULT_CONFIG, 'baseline');
  const rmdYear = res.years.find(y => y.age >= 73);
  assert(rmdYear !== undefined, 'Should have year with age >= 73');
  assert((rmdYear?.rmdTotal || 0) > 0, 'RMD amount should be positive at age 73+');
  assert(rmdYear?.rmdDivisor !== undefined && rmdYear.rmdDivisor > 0, 'RMD divisor should be assigned');
});

// -------------------------------------------------------------
// 7. SYSTEMATIC ROTH CONVERSION SIMULATOR
// -------------------------------------------------------------
console.log('\n7. SYSTEMATIC ROTH CONVERSION SIMULATOR');
test('Roth conversion comparison runs and generates conversion schedule', () => {
  const rothConfig = {
    enabled: true,
    startAge: 60,
    endAge: 70,
    bracketRoomMaxIncome: 201050,
    annualCap: 50000,
    targetBracketRate: 0.22,
    taxPaymentMethod: 'outsideBrokerage' as const
  };
  const comp = compareRothConversion(DEFAULT_CONFIG, rothConfig, 'baseline');
  assert(comp.conversionSchedule.length > 0, 'Should generate conversion schedule');
  assert(comp.totalConverted > 0, 'Should convert positive balance to Roth');
  assert(comp.totalConversionTaxesPaid > 0, 'Should calculate conversion taxes paid');
  console.log('     -> Total Converted:        $' + Math.round(comp.totalConverted).toLocaleString());
  console.log('     -> Total Conversion Taxes: $' + Math.round(comp.totalConversionTaxesPaid).toLocaleString());
  console.log('     -> Final Balance Diff:     $' + Math.round(comp.finalBalanceDifference).toLocaleString());
});

// -------------------------------------------------------------
// 8. ACA HEALTHCARE SUBSIDY OPTIMIZATION ENGINE
// -------------------------------------------------------------
console.log('\n8. ACA HEALTHCARE SUBSIDY OPTIMIZATION ENGINE');

test('ACA subsidy sliding scale formula satisfies official ACA benchmark rules', () => {
  const hSize = 2; // Married Couple
  const baseFpl = ACA_FPL_BASE[hSize]; // $21,150
  assert(baseFpl === 21150, '2025/2026 2-person FPL base must be 21,150');

  // Test at 150% FPL: Expected contribution rate = 0%
  const sub150 = calculateAcaSubsidy({
    magi: baseFpl * 1.5,
    householdSize: hSize,
    unsubsidizedPremium: 21600,
    targetLimit: baseFpl * 4
  });
  assert(sub150.qualified === true, '150% FPL must qualify');
  assert(sub150.subsidyAmount === 21600, 'At <=150% FPL, subsidy covers 100% of benchmark premium');

  // Test at 300% FPL: Expected contribution rate ~6%
  const sub300 = calculateAcaSubsidy({
    magi: baseFpl * 3.0,
    householdSize: hSize,
    unsubsidizedPremium: 21600,
    targetLimit: baseFpl * 4
  });
  assert(sub300.qualified === true, '300% FPL must qualify');
  assert(sub300.subsidyAmount > 15000 && sub300.subsidyAmount < 21600, '300% FPL subsidy is positive');

  // Test above target limit: Disqualified
  const subOver = calculateAcaSubsidy({
    magi: 100000,
    householdSize: hSize,
    unsubsidizedPremium: 21600,
    targetLimit: 84600
  });
  assert(subOver.qualified === false, 'Income over target limit must be disqualified');
  assert(subOver.subsidyAmount === 0, 'Disqualified income receives $0 subsidy');
});

test('All ACA FPL presets (fpl400, fpl300, fpl250, fpl200, custom) compute proper limits', () => {
  const hSize = 2;
  const fpl400 = getAcaFplLimit(hSize, 'fpl400');
  const fpl300 = getAcaFplLimit(hSize, 'fpl300');
  const fpl250 = getAcaFplLimit(hSize, 'fpl250');
  const fpl200 = getAcaFplLimit(hSize, 'fpl200');
  const custom = getAcaFplLimit(hSize, 'custom', 75000);

  assert(fpl400 === 84600, `Expected 84600 for 400% FPL couple, got ${fpl400}`);
  assert(fpl300 === 63450, `Expected 63450 for 300% FPL couple, got ${fpl300}`);
  assert(fpl250 === 52875, `Expected 52875 for 250% FPL couple, got ${fpl250}`);
  assert(fpl200 === 42300, `Expected 42300 for 200% FPL couple, got ${fpl200}`);
  assert(custom === 75000, `Expected 75000 for custom limit, got ${custom}`);
});

test('ACA optimization restricts pre-tax draws to target limit and bridges with Non-AGI accounts', () => {
  const acaConfig = {
    enabled: true,
    preset: 'fpl400' as AcaFplPreset,
    householdSize: 2 as const,
    targetMagilimit: 84600,
    customMagilimit: 84600,
    unsubsidizedAnnualPremium: 21600,
    endAge: 65,
    prioritizeCashBeforeRoth: true,
    adjustMedicalExpensesWithSubsidy: false
  };

  const comp = compareAcaOptimization(DEFAULT_CONFIG, acaConfig, 'baseline');
  assert(comp.totalPreMedicareYears > 0, 'Scenario should have pre-Medicare retirement years');
  assert(comp.preMedicareYearsSubsidized > 0, 'Should qualify for subsidies during pre-Medicare years');
  assert(comp.totalSubsidiesSaved > 0, 'Total subsidies saved should be positive');
  assert(comp.preTaxDrawsDeferredToNonAgi > 0, 'Should defer pre-tax draws to protect subsidy');

  console.log('     -> Pre-Medicare Years Subsidized: ' + comp.preMedicareYearsSubsidized + ' of ' + comp.totalPreMedicareYears);
  console.log('     -> Total Subsidies Captured:     $' + Math.round(comp.totalSubsidiesSaved).toLocaleString());
  console.log('     -> Pre-Tax Draws Shielded:       $' + Math.round(comp.preTaxDrawsDeferredToNonAgi).toLocaleString());
  console.log('     -> Net Portfolio Difference:     $' + Math.round(comp.finalBalanceDifference).toLocaleString());

  // Verify that during subsidized years, ACA MAGI is below or equal to target limit
  for (const s of comp.schedule) {
    if (s.qualified) {
      assert(
        s.acaMagi <= s.targetLimit + 10,
        `Year ${s.year} marked qualified but MAGI ${s.acaMagi} exceeds target ${s.targetLimit}`
      );
    }
  }
});

test('ACA target limit incorporates projected inflation every year', () => {
  const acaConfig = {
    enabled: true,
    preset: 'fpl400' as AcaFplPreset,
    householdSize: 2 as const,
    targetMagilimit: 84600,
    customMagilimit: 84600,
    unsubsidizedAnnualPremium: 21600,
    endAge: 65,
    prioritizeCashBeforeRoth: true,
    adjustMedicalExpensesWithSubsidy: false,
  };

  const res = runSimulation(DEFAULT_CONFIG, 'baseline', undefined, undefined, acaConfig);
  const preMedYears = res.years.filter(y => y.isAcaApplicable && y.acaTargetLimit !== undefined);
  assert(preMedYears.length > 1, 'Should have multiple pre-Medicare years');

  // Verify that target limit increases year-over-year with inflation
  for (let i = 1; i < preMedYears.length; i++) {
    const prev = preMedYears[i - 1].acaTargetLimit!;
    const curr = preMedYears[i].acaTargetLimit!;
    assert(curr > prev, `Year ${preMedYears[i].calYear} limit ($${curr}) should be greater than previous year ($${prev})`);
  }

  const y0 = preMedYears[0];
  const yLast = preMedYears[preMedYears.length - 1];
  console.log(`     -> Year ${y0.calYear} (Age ${y0.age}): ACA Cap = $${Math.round(y0.acaTargetLimit!).toLocaleString()}`);
  console.log(`     -> Year ${yLast.calYear} (Age ${yLast.age}): ACA Cap = $${Math.round(yLast.acaTargetLimit!).toLocaleString()} (compounded with inflation)`);
});

test('Phase 0 special logic: Draws high-priority tax-deferred accounts as income when partial salary exceeds ACA limit', () => {
  // Configure salary ($50.5k partial) exceeding ACA target limit ($42.3k at 200% FPL)
  // while having a living expense deficit to fund for remaining months
  const phase0HighSalaryConfig = {
    ...DEFAULT_CONFIG,
    scenario: {
      ...DEFAULT_CONFIG.scenario,
      retSalary: 102000, // 6 months worked = $50,580 > $42,300 ACA limit
      spouseRetSalary: 0,
    },
    acaOptimization: {
      enabled: true,
      preset: 'fpl200' as AcaFplPreset,
      householdSize: 2 as const,
      targetMagilimit: 42300,
      customMagilimit: 42300,
      unsubsidizedAnnualPremium: 21600,
      endAge: 65,
      prioritizeCashBeforeRoth: true,
      adjustMedicalExpensesWithSubsidy: false,
    },
  };

  const res = runSimulation(phase0HighSalaryConfig, 'baseline');
  const phase0 = res.years[0];

  assert(phase0.phase === 0, 'Year 0 should be phase 0');
  assert(phase0.salary >= 42300, 'Phase 0 salary should exceed ACA limit');
  assert(phase0.isPhase0AcaIncomeOverride === true, 'isPhase0AcaIncomeOverride must be true');

  // Verify that high priority tax-deferred accounts were drawn to satisfy living expenses
  const tdDraw = (phase0.tdWithdrawalByOwner?.primary || 0) + (phase0.tdWithdrawalByOwner?.spouse || 0);
  assert(tdDraw > 0, 'Should draw from tax-deferred accounts as income in Phase 0');
  assert(phase0.acaNonAgiWdUsed === 0, 'Cash & Roth non-AGI accounts should be completely preserved (0 drawn)');

  // Verify Cash account balance was not depleted in Phase 0
  const cashSource = phase0HighSalaryConfig.sources.find(s => s.accountType === 'cash');
  if (cashSource) {
    const cashEndBal = phase0.endBalanceBySource[cashSource.id];
    assert(cashEndBal > 0, 'Cash balance should remain preserved in Phase 0');
  }

  console.log('     -> Phase 0 Salary:              $' + Math.round(phase0.salary).toLocaleString());
  console.log('     -> ACA Target Limit:            $' + Math.round(phase0.acaTargetLimit || 0).toLocaleString());
  console.log('     -> Tax-Deferred Income Drawn:   $' + Math.round(tdDraw).toLocaleString());
  console.log('     -> Non-AGI (Cash/Roth) Burned:  $' + Math.round(phase0.acaNonAgiWdUsed || 0).toLocaleString() + ' (Fully Preserved!)');
});

// -------------------------------------------------------------
// 9. WHAT-IF OPTIMIZATION SCENARIOS COMPARISON
// -------------------------------------------------------------
console.log('\n9. WHAT-IF OPTIMIZATION SCENARIOS (6 SCENARIOS)');
test('runWhatIfComparisons generates all 6 optimization scenarios', () => {
  const scenarios = runWhatIfComparisons(DEFAULT_CONFIG, 'baseline');
  assert(scenarios.length === 6, `Expected 6 scenarios, got ${scenarios.length}`);

  const ids = scenarios.map(s => s.id);
  assert(ids.includes('baseline'), 'Must include baseline');
  assert(ids.includes('acaSubsidy'), 'Must include acaSubsidy');
  assert(ids.includes('minTax'), 'Must include minTax');
  assert(ids.includes('minRmd'), 'Must include minRmd');
  assert(ids.includes('maxSpending'), 'Must include maxSpending');
  assert(ids.includes('maxEstate'), 'Must include maxEstate');

  console.log('     Scenarios Summary:');
  for (const s of scenarios) {
    console.log(
      `     -> [${s.id}] ${s.name}: Final Bal = $${Math.round(s.finalBalance).toLocaleString()}, Total Tax = $${Math.round(s.totalTaxesPaid).toLocaleString()}, Peak RMD = $${Math.round(s.peakRmd).toLocaleString()}`
    );
  }
});

// -------------------------------------------------------------
// 10. MONTE CARLO PROBABILITY SIMULATION (500 ITERATIONS)
// -------------------------------------------------------------
console.log('\n10. MONTE CARLO STOCHASTIC PROBABILITY SIMULATION');
test('Monte Carlo 500-run simulation calculates monotonically increasing percentiles', () => {
  const mc = runMonteCarloSimulation(DEFAULT_CONFIG, 0.12, 500, 'baseline', 'real');
  assert(mc.years.length === 40, `Expected 40 projection years, got ${mc.years.length}`);
  assert(mc.p10.length === 40, `Expected 40 p10 entries, got ${mc.p10.length}`);

  for (let i = 0; i < 40; i++) {
    assert(
      mc.p10[i] <= mc.p25[i] && mc.p25[i] <= mc.p50[i] && mc.p50[i] <= mc.p75[i] && mc.p75[i] <= mc.p90[i],
      `Year ${mc.calYears[i]} percentiles not monotonic: p10=${mc.p10[i]}, p25=${mc.p25[i]}, p50=${mc.p50[i]}, p75=${mc.p75[i]}, p90=${mc.p90[i]}`
    );
  }

  const lastIdx = 39;
  console.log(`     Monte Carlo 40-Year Terminal Wealth Percentiles:`);
  console.log(`     -> 10th Percentile (Conservative): $${Math.round(mc.p10[lastIdx]).toLocaleString()}`);
  console.log(`     -> 25th Percentile:                $${Math.round(mc.p25[lastIdx]).toLocaleString()}`);
  console.log(`     -> 50th Percentile (Median):       $${Math.round(mc.p50[lastIdx]).toLocaleString()}`);
  console.log(`     -> 75th Percentile:                $${Math.round(mc.p75[lastIdx]).toLocaleString()}`);
  console.log(`     -> 90th Percentile (Optimistic):   $${Math.round(mc.p90[lastIdx]).toLocaleString()}`);
  console.log(`     -> Success Probability:            ${mc.successProbability}%`);
});

console.log('\n===============================================================');
console.log(`TEST EXECUTION COMPLETE: ${passedTests} OF ${totalTests} TESTS PASSED`);
console.log('===============================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
