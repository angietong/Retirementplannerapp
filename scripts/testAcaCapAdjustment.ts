import { DEFAULT_CONFIG, ACA_FPL_BASE, getAcaFplLimit } from '../src/defaultData';
import { runSimulation, calculateAcaSubsidy } from '../src/engine';
import { AcaFplPreset, StressPreset } from '../src/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
}

console.log('========================================================================');
console.log('FOCUSED TEST SUITE: ACA CAP INCOME ADJUSTMENT (YEAR-TO-YEAR INFLATION)');
console.log('========================================================================\n');

let passCount = 0;
let totalCount = 0;

function runTest(name: string, fn: () => void) {
  totalCount++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passCount++;
  } catch (err: any) {
    console.error(`[FAIL] ${name}`);
    console.error(`       ${err.message}`);
  }
}

// ------------------------------------------------------------------------
// TEST 1: Baseline Year-over-Year Compounding at Standard Inflation Rate (2.5%)
// ------------------------------------------------------------------------
runTest('Baseline (2.5% inflation): ACA Cap compounds exactly at (1 + inflation) year-over-year', () => {
  const baseLimit = 84600; // 400% FPL for couple
  const config = {
    ...DEFAULT_CONFIG,
    rates: {
      ...DEFAULT_CONFIG.rates,
      inflationRate: 0.025, // 2.5%
    },
    acaOptimization: {
      enabled: true,
      preset: 'fpl400' as AcaFplPreset,
      householdSize: 2 as const,
      targetMagilimit: baseLimit,
      customMagilimit: baseLimit,
      unsubsidizedAnnualPremium: 21600,
      endAge: 65,
      prioritizeCashBeforeRoth: true,
      adjustMedicalExpensesWithSubsidy: false,
    },
  };

  const sim = runSimulation(config, 'baseline');
  const preMedYears = sim.years.filter(y => y.isAcaApplicable && y.acaTargetLimit !== undefined);

  console.log('\n  Year-by-Year Projected ACA Cap (Baseline 2.5% inflation):');
  let expectedCumInflation = 1.0;

  preMedYears.forEach((y, idx) => {
    const nominalCap = y.acaTargetLimit!;
    const expectedCap = baseLimit * expectedCumInflation;
    assert(
      Math.abs(nominalCap - expectedCap) < 0.01,
      `Year ${y.calYear} (idx ${idx}): expected $${expectedCap.toFixed(2)}, got $${nominalCap.toFixed(2)}`
    );

    const inflationGrowth = idx > 0 ? (nominalCap / preMedYears[idx - 1].acaTargetLimit! - 1) * 100 : 0;
    console.log(
      `    Year ${y.calYear} (Age ${y.age.toFixed(1)}): Nominal Cap = $${Math.round(nominalCap).toLocaleString()} | Real Value = $${Math.round(nominalCap / expectedCumInflation).toLocaleString()} ${idx > 0 ? `(+${inflationGrowth.toFixed(2)}% YoY)` : '(Base Year)'}`
    );

    // Compound inflation for next year
    expectedCumInflation *= (1 + 0.025);
  });
});

// ------------------------------------------------------------------------
// TEST 2: Stress Presets with Varying Inflation (Stagflation 7.5% vs Bull 2.0%)
// ------------------------------------------------------------------------
runTest('Dynamic Stress Presets: Cap accelerates under Stagflation (7.5%) and slows under Bull (2.0%)', () => {
  const baseLimit = 84600;
  const acaConfig = {
    enabled: true,
    preset: 'fpl400' as AcaFplPreset,
    householdSize: 2 as const,
    targetMagilimit: baseLimit,
    customMagilimit: baseLimit,
    unsubsidizedAnnualPremium: 21600,
    endAge: 65,
    prioritizeCashBeforeRoth: true,
    adjustMedicalExpensesWithSubsidy: false,
  };

  const stagSim = runSimulation(DEFAULT_CONFIG, 'stagflation', undefined, undefined, acaConfig);
  const bullSim = runSimulation(DEFAULT_CONFIG, 'bull', undefined, undefined, acaConfig);

  const stagY3 = stagSim.years.find(y => y.yr === 3 && y.isAcaApplicable);
  const bullY3 = bullSim.years.find(y => y.yr === 3 && y.isAcaApplicable);

  assert(stagY3 !== undefined && bullY3 !== undefined, 'Year 3 should be accessible in both presets');

  console.log('\n  Year 3 ACA Cap Comparison under Market Shocks:');
  console.log(`    Stagflation (7.5% shock): Year 3 Cap = $${Math.round(stagY3!.acaTargetLimit!).toLocaleString()}`);
  console.log(`    Bull Market (2.0% inflation): Year 3 Cap = $${Math.round(bullY3!.acaTargetLimit!).toLocaleString()}`);

  assert(
    stagY3!.acaTargetLimit! > bullY3!.acaTargetLimit!,
    'Stagflation inflated cap must be higher than Bull market cap due to higher cumulative inflation'
  );
});

// ------------------------------------------------------------------------
// TEST 3: All FPL Benchmark Presets (400%, 300%, 250%, 200%, Custom)
// ------------------------------------------------------------------------
runTest('All FPL Presets (400%, 300%, 250%, 200%, Custom) scale year-over-year with inflation', () => {
  const presets: { preset: AcaFplPreset; custom?: number; name: string }[] = [
    { preset: 'fpl400', name: '400% FPL Cliff' },
    { preset: 'fpl300', name: '300% FPL Benchmark' },
    { preset: 'fpl250', name: '250% FPL Sweet Spot' },
    { preset: 'fpl200', name: '200% FPL Low Premium' },
    { preset: 'custom', custom: 75000, name: 'Custom Limit ($75k)' },
  ];

  console.log('\n  Testing 5-Year Inflation Trajectory across all FPL Presets:');

  presets.forEach(p => {
    const baseLimit = getAcaFplLimit(2, p.preset, p.custom);
    const acaConf = {
      enabled: true,
      preset: p.preset,
      householdSize: 2 as const,
      targetMagilimit: baseLimit,
      customMagilimit: baseLimit,
      unsubsidizedAnnualPremium: 21600,
      endAge: 65,
      prioritizeCashBeforeRoth: true,
      adjustMedicalExpensesWithSubsidy: false,
    };

    const sim = runSimulation(DEFAULT_CONFIG, 'baseline', undefined, undefined, acaConf);
    const y0 = sim.years[0];
    const y4 = sim.years[4];

    assert(y0.acaTargetLimit === baseLimit, `${p.name}: Year 0 cap should match base limit`);
    assert(y4.acaTargetLimit! > baseLimit, `${p.name}: Year 4 cap should be higher than base limit`);

    console.log(
      `    ${p.name.padEnd(22)}: Base Yr 0 = $${Math.round(y0.acaTargetLimit!).toLocaleString()} -> Yr 4 = $${Math.round(y4.acaTargetLimit!).toLocaleString()}`
    );
  });
});

// ------------------------------------------------------------------------
// TEST 4: Pre-Tax Withdrawal Headroom Expansion
// ------------------------------------------------------------------------
runTest('Allowable pre-tax headroom expands with inflation so living expenses do not pinch subsidy', () => {
  const baseLimit = 84600;
  const config = {
    ...DEFAULT_CONFIG,
    scenario: {
      ...DEFAULT_CONFIG.scenario,
      retSalary: 0, // fully retired, no wages
      spouseRetSalary: 0,
    },
    acaOptimization: {
      enabled: true,
      preset: 'fpl400' as AcaFplPreset,
      householdSize: 2 as const,
      targetMagilimit: baseLimit,
      customMagilimit: baseLimit,
      unsubsidizedAnnualPremium: 21600,
      endAge: 65,
      prioritizeCashBeforeRoth: true,
      adjustMedicalExpensesWithSubsidy: false,
    },
  };

  const sim = runSimulation(config, 'baseline');
  const y1 = sim.years[1];
  const y3 = sim.years[3];

  console.log('\n  Allowable Pre-Tax Draws (Headroom) over Time:');
  console.log(`    Year ${y1.calYear}: Cap = $${Math.round(y1.acaTargetLimit!).toLocaleString()} | Pre-Tax Drawn = $${Math.round(y1.acaAgiConstrainedWd || 0).toLocaleString()}`);
  console.log(`    Year ${y3.calYear}: Cap = $${Math.round(y3.acaTargetLimit!).toLocaleString()} | Pre-Tax Drawn = $${Math.round(y3.acaAgiConstrainedWd || 0).toLocaleString()}`);

  assert(y3.acaTargetLimit! > y1.acaTargetLimit!, 'Year 3 cap should be greater than Year 1 cap');
});

// ------------------------------------------------------------------------
// TEST 5: calculateAcaSubsidy Inflation Parity
// ------------------------------------------------------------------------
runTest('calculateAcaSubsidy maintains exact FPL ratio and contribution percentage when scaled with inflation', () => {
  const baseFpl = ACA_FPL_BASE[2]; // $21,150
  const unsubsidizedBase = 21600;

  // Year 0 (cumInflation = 1.0): MAGI = $52,875 (250% FPL)
  const yr0 = calculateAcaSubsidy({
    magi: baseFpl * 2.5,
    householdSize: 2,
    unsubsidizedPremium: unsubsidizedBase,
    targetLimit: baseFpl * 4,
    cumInflation: 1.0,
  });

  // Year 5 with 15% cumulative inflation (cumInflation = 1.15):
  // Nominal MAGI = $52,875 * 1.15 = $60,806.25
  // Nominal Premium = $21,600 * 1.15 = $24,840
  const yr5 = calculateAcaSubsidy({
    magi: baseFpl * 2.5 * 1.15,
    householdSize: 2,
    unsubsidizedPremium: unsubsidizedBase * 1.15,
    targetLimit: baseFpl * 4 * 1.15,
    cumInflation: 1.15,
  });

  assert(yr0.qualified === true && yr5.qualified === true, 'Both years must qualify for subsidy');
  assert(
    Math.abs(yr0.fplRatio - yr5.fplRatio) < 0.001,
    `FPL ratios must be identical: yr0=${yr0.fplRatio}, yr5=${yr5.fplRatio}`
  );

  const subsidyRatio = yr5.subsidyAmount / yr0.subsidyAmount;
  console.log('\n  Subsidy Inflation Scaling Check:');
  console.log(`    Base Subsidy (Yr 0):      $${Math.round(yr0.subsidyAmount).toLocaleString()} (FPL: ${(yr0.fplRatio * 100).toFixed(0)}%)`);
  console.log(`    Inflated Subsidy (Yr 5):  $${Math.round(yr5.subsidyAmount).toLocaleString()} (FPL: ${(yr5.fplRatio * 100).toFixed(0)}%)`);
  console.log(`    Subsidy Growth Factor:    ${subsidyRatio.toFixed(3)}x (matches 1.15x inflation perfectly)`);

  assert(Math.abs(subsidyRatio - 1.15) < 0.01, 'Subsidy amount must scale proportionally with inflation');
});

console.log('\n========================================================================');
console.log(`TEST RUN COMPLETE: ${passCount} OF ${totalCount} TESTS PASSED`);
console.log('========================================================================\n');

if (passCount !== totalCount) {
  process.exit(1);
}
