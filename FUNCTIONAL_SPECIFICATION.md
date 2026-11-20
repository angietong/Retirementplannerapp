# Retirement Financial Planner — Platform-Agnostic Functional & Calculation Specification

## 1. Purpose & Functional Scope

The **Retirement Financial Planner** is a multi-decade household cash-flow, tax, withdrawal-sequencing, and wealth-projection system. Given a household's demographic timelines, income sources, investment accounts, tax rates, living and healthcare expenses, and milestone events, the system simulates annual financial state across a configurable projection horizon (default: 40 years) and evaluates portfolio longevity, tax efficiency, and optimization strategies.

### Core Capabilities
1. **Single & 2-Person Household Simulation**: Models primary and optional spouse members with independent birth dates, retirement dates, active salaries, Social Security start ages, penalty-free account access ages, and life expectancies.
2. **Priority-Based Asset Liquidation Cascade**: Distinguishes between depletable investment accounts and recurring non-depleting guaranteed income streams, enforcing statutory age gates (Rule of 55, IRA age 59½/60, Social Security, Medicare, RMD).
3. **Decoupled Expense Escalation & Milestone Spending**: Separates general living inflation from healthcare inflation, shifts medical costs at Medicare eligibility (either Primary or Spouse reaching Medicare age), and injects up to 10 scheduled one-time major expenses at designated ages.
4. **Adaptive 2-Pass Tax-Aware Withdrawal Gross-Up**: Computes required gross withdrawals via an initial baseline estimate followed by an adaptive second pass using actual per-account marginal tax burdens (`0%` for Cash/Roth, `capgainPct * capgainRate` for Brokerage, `incRate` for Pre-Tax) so net after-tax proceeds cover annual spending needs without over-withdrawing from low-tax or tax-free accounts.
5. **Dual-Spouse Pre-Tax Drawdown Balancing**: Optionally balances pre-tax withdrawals across both spouses' accounts (`proportional` or `equal`) to flatten late-life tax brackets and mitigate future Required Minimum Distributions (RMDs).
6. **IRS RMD Enforcement & Surplus Reinvestment**: Calculates annual RMDs starting at RMD age using the IRS Uniform Lifetime Table (Publication 590-B, Table III) and reinvests surplus net distributions into an accessible taxable brokerage account.
7. **Systematic Roth Conversion Engine**: Models pre-RMD tax-bracket-filling Roth conversions, including **equal 50/50 dual-spouse conversion splits with automatic spillover** and **owner-matched Roth destination transfers** (with strict account-type and tax-type integrity).
8. **ACA Pre-Medicare Healthcare Subsidy Optimizer**: Caps Adjusted Gross Income (AGI/MAGI) prior to Medicare eligibility to capture ACA Premium Tax Credits using tax-aware Cash/Roth and low-MAGI Brokerage bridges, crediting earned subsidies back into a designated account.
9. **Historical Stress Presets & Monte Carlo Analysis**: Evaluates sequence-of-returns and stagflation shocks alongside stochastic market return simulations centered on the active stress regime to compute percentile wealth trajectories and success probability.
10. **Automated What-If Strategy Comparisons**: Runs multi-strategy optimizations comparing Baseline, ACA Subsidy, Minimum Lifetime Tax, Minimum Future RMD, Maximum Sustainable Spending, and Maximum Estate Net Worth.
11. **Dual Valuation Modes & Workbook Export**: Expresses all monetary outputs across every view and comparator in either **Nominal (Future)** dollars or **Real (Today's Purchasing Power)** dollars using actual per-year cumulative general inflation (`cumGeneralInflation`), and exports inputs, annual projections, and per-account series into a structured multi-sheet workbook respecting the active valuation mode.

---

## 2. User Inputs & Domain Data Model

All configuration state is encapsulated in a root configuration structure (`PlannerConfig`).

### 2.1 Household & Scenario Parameters (`ScenarioParams`)
| Field | Type | Default | Description & Validation Rules |
| :--- | :--- | :--- | :--- |
| `userName` | String | `"John Doe"` | Primary member full name. |
| `birthDate` | ISO Date (`YYYY-MM-DD`) | `"1970-06-15"` | Primary member date of birth (parsed in local calendar time to avoid UTC timezone shift). |
| `retDate` | ISO Date (`YYYY-MM-DD`) | `"2030-07-01"` | Primary target retirement date (defines simulation Year 0). |
| `retSalary` | Number (`>= 0`) | `150000` | Primary gross annual salary prior to retirement. |
| `ssStartDate` | ISO Date (`YYYY-MM-DD`) | `"2037-06-15"` | Primary planned Social Security start date (metadata/reference). |
| `pensionStartDate` | ISO Date (`YYYY-MM-DD`) | `"2032-06-15"` | Primary pension start date (metadata/reference). |
| `taxablePct` | Decimal (`0.0 – 1.0`) | `0.70` | Estimated taxable share of withdrawals used in Pass 1 of the gross-up equation (edited as `0–100%` in user inputs). |
| `lifeExpAge` | Number (`50 – 120`) | `90` | Primary planning life expectancy age. |
| `hasSpouse` | Boolean | `true` | Enables 2-person household modeling (`false` = single person). |
| `spouseName` | String (Optional) | `"Jane Doe"` | Spouse full name. |
| `spouseBirthDate` | ISO Date (Optional) | `"1972-04-20"` | Spouse date of birth (parsed in local calendar time). |
| `spouseRetDate` | ISO Date (Optional) | `"2032-07-01"` | Spouse target retirement date. |
| `spouseRetSalary` | Number (Optional) | `95000` | Spouse gross annual salary prior to `spouseRetDate`. |
| `spouseLifeExpAge` | Number (Optional) | `92` | Spouse planning life expectancy age. |
| `spouseSsStartDate` | ISO Date (Optional) | `"2039-04-20"` | Spouse planned Social Security start date. |
| `projectionYears` | Integer (`>= 1`) | `40` | Total number of annual periods simulated starting at `retYear`. |

### 2.2 Milestone Ages (`MilestoneAges`)
| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `four01kAge` | Number (`30 – 90`) | `55` | Primary penalty-free access age for employer plans (`401k`/`403b`, Rule of 55). |
| `iraAge` | Number (`30 – 90`) | `60` | Primary penalty-free access age for Traditional/Roth IRAs (e.g., `59.5` or `60`). |
| `ssMinAge` | Number (`50 – 75`) | `62` | Primary earliest Social Security eligibility age (drives Phase 4 transition). |
| `spouseFour01kAge` | Number (Optional) | `55` | Spouse penalty-free access age for `401k`/`403b` (falls back to `four01kAge`). |
| `spouseIraAge` | Number (Optional) | `60` | Spouse penalty-free access age for IRAs (falls back to `iraAge`). |
| `spouseSsMinAge` | Number (Optional) | `62` | Spouse earliest Social Security age (falls back to `ssMinAge`). |
| `medicareAge` | Number (`50 – 80`) | `65` | Age when Medicare begins and post-Medicare healthcare costs activate. |
| `rmdAge` | Number (`65 – 85`) | `73` | Age when IRS Required Minimum Distributions begin (SECURE 2.0 default: `73`). |
| `retireAcctAge` | Number (Legacy Fallback) | `undefined` | Optional fallback if `four01kAge` or `iraAge` is omitted in imported data. |

### 2.3 Economic, Inflation & Tax Rate Assumptions (`RateAssumptions`)
All percentages are stored internally as decimals (e.g., `0.06` = `6%`) and presented/edited in user inputs on a percentage scale (`0–100%`, e.g., `6` = `6%`).

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `investRate` | Decimal | `0.06` (`6%`) | Expected annual nominal investment return on remaining end-of-year balances. |
| `inflationRate` | Decimal | `0.025` (`2.5%`) | Annual general CPI inflation rate (escalates living expenses, ACA FPL, and inflation-adjusted major expenses). |
| `medicalInflationRate` | Decimal (Optional) | `0.045` (`4.5%`) | Decoupled annual healthcare inflation rate (escalates medical premiums, OOP, and ACA unsubsidized premiums). |
| `fedBracket` | Decimal | `0.22` (`22%`) | Effective/marginal federal ordinary income tax rate applied to ordinary taxable income. |
| `stateRate` | Decimal | `0.05` (`5%`) | State income tax rate applied to ordinary taxable income (and Roth conversions). |
| `capgainRate` | Decimal | `0.15` (`15%`) | Long-term capital gains tax rate applied to taxable capital gain distributions. |
| `capgainPct` | Decimal (`0.0 – 1.0`) | `0.60` (`60%`) | Fraction of a Capital Gain account withdrawal that represents taxable gain (cost-basis exclusion = `1 - capgainPct`). |

### 2.4 Recurring Monthly Expenses (`MonthlyExpenses`)
All amounts represent monthly values in Year 0 (today's base dollars).

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `expDaily` | Number (`>= 0`) | `5500` | Day-to-day after-tax living expenses per month (housing, food, utilities, travel). |
| `expMedPremium` | Number (`>= 0`) | `750` | Pre-Medicare monthly health insurance premium. |
| `expMedOop` | Number (`>= 0`) | `350` | Pre-Medicare monthly medical out-of-pocket costs. |
| `hasMedicarePostExp` | Boolean | `true` | Enables separate post-Medicare medical expense amounts once Medicare is active. |
| `expMedPremiumPost` | Number (Optional) | `320` | Post-Medicare monthly premium (Part B/D, Medigap). |
| `expMedOopPost` | Number (Optional) | `180` | Post-Medicare monthly out-of-pocket medical costs. |

### 2.5 Scheduled Major One-Time Annual Expenses (`MajorExpense[]`, Max: 10)
| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | Generated | Unique identifier. |
| `name` | String | `"Major Expense N"` | Descriptive label (e.g., `"Home Renovation / Roof"`, `"New Vehicle"`). |
| `age` | Number (`50 – 110`) | `65` | Primary member's target age when the expense occurs. |
| `amount` | Number (`>= 0`) | `30000` | Cost of the event. |
| `inflationAdjusted` | Boolean | `true` | If `true`, escalates from Year 0 by `cumGeneralInflation`; if `false`, stays fixed at nominal `amount`. |
| `notes` | String (Optional) | `""` | Free-form notes. |

### 2.6 Income & Asset Sources (`IncomeSource[]`, Max: 20)
| Field | Type | Constraints / Allowed Values | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | Unique | Account identifier. |
| `name` | String | Non-empty string | Account or stream name (also inspected as fallback for category detection when `accountType` is omitted). |
| `accountType` | Enum | `'401k' \| 'ira' \| 'roth' \| 'brokerage' \| 'cash' \| 'other'` | Account classification governing penalty-free age, tax buckets, RMD eligibility, and ACA/Roth routing. |
| `owner` | Enum | `'primary' \| 'spouse' \| 'joint'` | Ownership attribution governing access age, RMD divisor age, and Roth transfer routing. |
| `balance` | Number (`>= 0`) | Active when `monthly = 'N'` | Initial Year 0 account balance. Ignored (`0`) when `monthly = 'Y'`. |
| `priority` | Integer (`>= 1`) | Lower = drawn earlier | Liquidation cascade priority order. Adding a new account assigns `max(existing priorities) + 1`. |
| `monthly` | Enum | `'Y'` (Guaranteed Flow) \| `'N'` (Depleting Asset) | `'N'` = investment/cash pool that earns returns and depletes; `'Y'` = fixed lifetime/annuity annual payment. |
| `taxType` | Enum | `'Income' \| 'Capital Gain' \| 'N/a'` | `'Income'` = ordinary income; `'Capital Gain'` = taxable brokerage; `'N/a'` = tax-free (Roth/Cash). |
| `annualPayment` | Number (`>= 0`) | Active when `monthly = 'Y'` | Gross annual guaranteed cash flow once `startAge` is reached. |
| `startAge` | Number | `>= 0` | Custom access/start age override (for guaranteed streams, always used; for `401k`/`ira`/`roth`, overrides milestone if `> 0`). |
| `notes` | String | Text | Explanatory annotation. |

### 2.7 Tax-Deferred Early Drawdown Strategy (`TaxDeferredWithdrawalStrategy`)
| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enabled` | Boolean | `true` | Enables synchronized pre-tax withdrawal balancing between Primary and Spouse once both have accessible tax-deferred balances. |
| `method` | Enum | `'proportional'` | `'proportional'` (allocates in proportion to each spouse's accessible pre-tax balance) or `'equal'` (splits 50/50 with spillover). |

### 2.8 Systematic Roth Conversion Configuration (`RothConversionConfig`)
| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enabled` | Boolean | `false` | Enables annual bracket-filling Roth conversions. |
| `startAge` | Number (`50 – 85`) | `60` | Minimum Primary age to begin Roth conversions. |
| `endAge` | Number (`50 – 90`) | `72` | Maximum Primary age to execute Roth conversions (typically `rmdAge - 1`). |
| `targetBracketRate` | Decimal | `0.22` | Marginal federal tax rate applied to conversion dollars (e.g., `0.12`, `0.22`, `0.24`). |
| `bracketRoomMaxIncome` | Number | `201050` (MFJ) / `100525` (Single) | Maximum household taxable income ceiling for conversions. |
| `annualCap` | Number | `50000` | Maximum gross annual conversion cap (`<= 0` treated as unlimited). |
| `taxPaymentMethod` | Enum | `'outsideBrokerage'` | `'outsideBrokerage'` (pays conversion tax from Brokerage then Cash) or `'withhold'` (withholds tax directly from converted dollars). |
| `sourceAccountId` | String (Optional) | `undefined` | Optional preferred source identifier. |
| `targetRothAccountId` | String (Optional) | `undefined` | Optional explicit Roth destination account ID override. |

### 2.9 ACA Healthcare Subsidy Optimization (`AcaOptimizationConfig`)
| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enabled` | Boolean | `false` | Enables pre-Medicare AGI-capped drawdown to preserve ACA Premium Tax Credits. |
| `preset` | Enum | `'fpl400'` | `'fpl200' \| 'fpl250' \| 'fpl300' \| 'fpl400' \| 'custom'`. |
| `householdSize` | `1 \| 2` | `2` (or `1` if Single) | Determines statutory Federal Poverty Level (FPL) baseline: 1 person = `$15,650`, 2 persons = `$21,150`. |
| `customMagilimit` | Number (Optional) | `84600` | User-specified Year 0 MAGI limit when `preset = 'custom'`. |
| `targetMagilimit` | Number | `84600` | Computed Year 0 MAGI threshold (`2.0x`, `2.5x`, `3.0x`, `4.0x` of FPL base, or `customMagilimit`). |
| `unsubsidizedAnnualPremium` | Number | `21600` | Estimated Year 0 annual unsubsidized ACA Silver benchmark premium. |
| `endAge` | Number | `65` | Age at which ACA optimization ends (Medicare eligibility). |
| `prioritizeCashBeforeRoth` | Boolean | `true` | If `true`, bridges AGI gap with Cash before Roth; if `false`, Roth before Cash. |
| `adjustMedicalExpensesWithSubsidy` | Boolean | `true` | Controls whether earned ACA subsidy credits are reinvested back into a portfolio account. |
| `creditAccountId` | String (Optional) | `'src-5'` (Savings) | Account ID receiving earned ACA subsidy credits, or `'__none__'` to disable crediting. |

---

## 3. Core Simulation Engine — Calculation Logic

For each deterministic run (or each path of Monte Carlo), the engine simulates `yr = 0, 1, ..., projectionYears - 1`.

### 3.1 Initialization & Age Calculations
1. **Local Date Parsing (`parseLocalDate`)**:
   - All `YYYY-MM-DD` dates (`birthDate`, `retDate`, `spouseBirthDate`, `spouseRetDate`) are parsed using local year/month/day components (`new Date(y, m - 1, d)`) so UTC-to-local timezone offsets never shift dates across day or year boundaries.
2. **Calendar Retirement Year (`retYear`) & Retirement Age (`retAge`)**:
   - `retAge = (retDate - birthDate) / 365.25 days` (fallback `60` if non-positive or invalid).
   - If `hasSpouse`: `retSpouseAge = (retDate - spouseBirthDate) / 365.25 days` (fallback `58`).
3. **Retirement-Year Work Fraction (`primaryWorkFrac`)**:
   - `daysWorked = retDate - Jan 1 of retYear` (in days).
   - `primaryWorkFrac = clamp(daysWorked / 365, 0, 1)`.
4. **Composite Tax Rate Constants**:
   - `incRate = fedBracket + stateRate`
   - `rTax = taxablePct * ((1 - capgainPct) * incRate + capgainPct * capgainRate)`
5. **Source Metadata & Classification Helpers**:
   - **`isTaxDeferredSource(s)`**:
     - Returns `false` if `monthly === 'Y'`, `taxType === 'N/a'`, `taxType === 'Capital Gain'`, or if `accountType` is explicitly `'cash' | 'brokerage' | 'roth' | 'other'`.
     - Returns `true` if `accountType === '401k' || accountType === 'ira'`.
     - For legacy/unspecified `accountType`, returns `true` if `taxType === 'Income'` or name contains `'401k' | '403b' | 'ira' | 'traditional'` (excluding `'roth'`).
   - **`isSourceCash(s)`**: `accountType === 'cash'` or name contains `'cash' | 'savings' | 'checking' | 'money market'`.
   - **`isSourceRoth(s)`**: `accountType === 'roth'` or name contains `'roth'`.
   - **`isSourceNonAgi(s)`**: `false` if `taxType` is `'Income' | 'Capital Gain'`; `true` if `taxType === 'N/a'`, `accountType` is `'cash' | 'roth'`, or name contains `'cash' | 'savings' | 'checking' | 'roth' | 'hsa'`.
   - **Order Key**: `orderKey = (priority ?? 9999) + index * 0.0001` (guarantees deterministic tie-breaking).
6. **Account Penalty-Free Access Age (`getSourcePenaltyFreeAge`)**:
   - Owner-specific `four01kAge` and `iraAge` are selected (`spouseFour01kAge` / `spouseIraAge` if `owner === 'spouse'`).
   - If `401k` (or name matches `401k|403b|employer`): returns `s.startAge` if `> 0`, else `four01kAge`.
   - If `ira` or `roth` (or name matches `ira|roth`): returns `s.startAge` if `> 0`, else `iraAge`.
   - Otherwise returns `s.startAge || 0`.
7. **Account Accessibility (`isSourceAccessible`)**:
   - `owner === 'spouse'`: accessible iff `hasSpouse && spouseAge !== undefined && spouseAge >= reqAge`.
   - `owner === 'joint'`: accessible iff `age >= reqAge || (hasSpouse && spouseAge !== undefined && spouseAge >= reqAge)`.
   - `owner === 'primary'`: accessible iff `age >= reqAge`.

---

### 3.2 Per-Year Execution Pipeline (Order of Operations)

For each year index `yr`:

#### Step 1: Calendar Year, Rounded Ages & Economic Rates
- `calYear = retYear + yr`
- `age = round((retAge + yr) * 10) / 10`
- `spouseAge = hasSpouse ? round((retSpouseAge + yr) * 10) / 10 : undefined`
  *(Ages are rounded to 1 decimal place at the start of the loop so milestone comparisons such as `age >= 73` match displayed age values without floating-point drift.)*
- **Stress Preset Effective Rates**:
  - `effInflationRate` and `effMedicalInflationRate` always honor the active `stressPreset` (even when `overrideInvestRates` is supplied by Monte Carlo).
  - `effInvestRate` uses `overrideInvestRates[yr]` when supplied by Monte Carlo, otherwise uses the `stressPreset` deterministic schedule:

| Preset ID | Condition | `effInvestRate` | `effInflationRate` | `effMedicalInflationRate` |
| :--- | :--- | :--- | :--- | :--- |
| `baseline` | All years | `rates.investRate` | `rates.inflationRate` | `rates.medicalInflationRate ?? 0.045` |
| `crash2008` | `yr = 0,1,2,3,4` / `>= 5` | `-37%, -10%, +26%, +15%, +12%` / `investRate` | `rates.inflationRate` | `rates.medicalInflationRate` |
| `stagflation` | `yr < 5` / `yr >= 5` | `2.0%` / `4.0%` | `7.5%` / `4.0%` | `9.5%` / `6.0%` |
| `earlyBear` | `yr = 0,1,2` / `>= 3` | `-12%, -15%, -8%` / `investRate` | `rates.inflationRate` | `rates.medicalInflationRate` |
| `bull` | All years | `8.5%` | `2.0%` | `3.8%` |

- **Cumulative Inflation Compounding** (applied for `yr > 0`; Year 0 factor is `1.0`):
  - `cumGeneralInflation *= (1 + effInflationRate)`
  - `cumMedicalInflation *= (1 + effMedicalInflationRate)`
  - `cumGeneralInflation` is stored on each `YearSimulationResult` and comparison row for exact Real-dollar deflation.

#### Step 2: Decoupled Expenses & Scheduled Major Events
- `isMedicareActive = (age >= medicareAge) || (hasSpouse && spouseAge !== undefined && spouseAge >= medicareAge)`
- Select base monthly medical amounts: if `isMedicareActive && expenses.hasMedicarePostExp`, use `expMedPremiumPost` and `expMedOopPost`; otherwise `expMedPremium` and `expMedOop`.
- **Major Expenses (Exact One-Shot Age Matching)**:
  - Each `m` in `majorExpenses` where `m.amount > 0` is matched to at most **one** simulation year `yr` whose primary `age` is closest to `m.age` (`|age - m.age| <= 0.55`, breaking ties in favor of the earlier year). This prevents half-year ages (such as `64.5` and `65.5`) from triggering a single scheduled expense twice.
  - `nominalAmount = (m.inflationAdjusted !== false) ? m.amount * cumGeneralInflation : m.amount`
  - Accumulate into `yrMajorExpenses`.
- **Total Annual Expenses**:
  - `yrGeneralExpenses = 12 * expDaily * cumGeneralInflation`
  - `yrMedicalExpenses = 12 * (baseMedPremium + baseMedOop) * cumMedicalInflation`
  - `yrExpenses = yrGeneralExpenses + yrMedicalExpenses + yrMajorExpenses`

#### Step 3: Active Work Salary & Retirement Phase Classification
- **Primary Salary**:
  - `calYear < retYear`: `primarySalary = retSalary`, `currWorkFrac = 1`, `remFrac = 0`.
  - `calYear === retYear`: `primarySalary = retSalary * primaryWorkFrac`, `currWorkFrac = primaryWorkFrac`, `remFrac = 1 - primaryWorkFrac`.
  - `calYear > retYear`: `primarySalary = 0`, `currWorkFrac = 0`, `remFrac = 1`.
- **Spouse Salary** (if `hasSpouse && spouseRetSalary > 0`):
  - `calYear < spouseRetYear`: `spouseSalary = spouseRetSalary`.
  - `calYear === spouseRetYear` (with valid `spouseRetDate`): prorated by `(spouseRetDate - Jan 1 of spouseRetYear) / 365`, clamped `[0, 1]`.
  - `calYear > spouseRetYear`: `spouseSalary = 0`.
- `totalSalary = primarySalary + spouseSalary`
- **Phase Determination (`0` to `5`)**:
  - If `yr === 0`: `phase = 0` (Retirement transition year).
  - Else (`yr > 0`):
    - `ssReached = hasSpouse ? (age >= ssMinAge || spouseAge >= spouseSsMinAge) : (age >= ssMinAge)`
    - `rmdReached = hasSpouse ? (age >= rmdAge || spouseAge >= rmdAge) : (age >= rmdAge)`
    - `age < four01kAge` &rarr; `Phase 1` (Early Retirement / Pre-401k Access)
    - `age < iraAge` &rarr; `Phase 2` (401(k) Rule of 55 Access)
    - `!ssReached && age < medicareAge` &rarr; `Phase 3` (IRA Access / Pre-Medicare & Pre-SS)
    - `!rmdReached` &rarr; `Phase 4` (Social Security & Medicare Era)
    - `rmdReached` &rarr; `Phase 5` (RMD Mandate Era)

#### Step 4: Guaranteed Non-Depleting Income
For each source with `monthly === 'Y'`:
- Active check:
  - `owner === 'spouse'`: active if `hasSpouse && spouseAge >= reqAge`.
  - `owner === 'joint'`: active if `hasSpouse ? max(age, spouseAge) >= reqAge : age >= reqAge`.
  - `owner === 'primary'`: active if `age >= reqAge`.
- If active, `guaranteedBySource[id] = annualPayment`; added to `guarTotal`, and if `taxType === 'Income'`, added to `guarTaxable`.
- `taxOther = guarTaxable + totalSalary`.

#### Step 5: IRS Required Minimum Distribution (RMD) Calculation
Using IRS Publication 590-B Table III Uniform Lifetime Divisors (`age 70 = 29.1`, `73 = 26.5`, `75 = 24.6`, `80 = 20.2`, `85 = 16.0`, `90 = 12.2`, `95 = 8.9`, `100 = 6.4`, ..., `120+ = 2.0`; ages `< 70` extrapolate `max(2.0, 29.1 + (70 - floor(age)) * 0.9)`):
- For each source where `!s.isMonthly && s.isTaxDef`:
  - `ownerAge = age` (or `spouseAge` if `owner === 'spouse'`; `max(age, spouseAge)` if `owner === 'joint'`).
  - If `ownerAge >= rmdAge`:
    - `divisor = getIrsRmdDivisor(ownerAge)`
    - `rmdBySource[id] = max(0, beginBalanceBySource[id]) / divisor`
    - Accumulate into `rmdTotal`; set `rmdDivisor` to the first active divisor (or calculate `rmdDivisor` for `age >= rmdAge || spouseAge >= rmdAge` even if pre-tax balances are `$0`).

#### Step 6: Adaptive 2-Pass Gross-Up & Living Withdrawal Liquidation Cascade
All accessible depleting sources (`depletingAccessible`) are sorted ascending by `orderKey`.

1. **Net Spending Need Prior to Portfolio Withdrawals**:
   $$\text{netSpendingNeed} = \text{yrExpenses} - (\text{guarTotal} + \text{totalSalary}) + \text{incRate} \times \text{taxOther}$$
2. **Pass 1 (Initial Gross-Up Estimate)**:
   $$\text{pass1Target} = \max\left(0,\; \frac{\text{netSpendingNeed}}{\max(0.0001,\; 1 - r_{\text{Tax}})}\right)$$
   Run `executeLivingCascade(pass1Target)` to determine which specific accounts would be drawn at that level.
3. **Pass 2 (Account-Specific Marginal Tax Adjustment)**:
   - Measure the actual effective tax rate on the Pass 1 withdrawals:
     $$\text{actualEffTaxRate} = \frac{\text{ordinaryWd}_1 \times \text{incRate} + \text{capGainWd}_1 \times \text{capgainPct} \times \text{capgainRate}}{\text{totalDrawn}_1}$$
     *(If `totalDrawn_1 === 0`, uses the marginal tax rate of the first available accessible account: `incRate` for Pre-Tax/Income, `capgainPct * capgainRate` for Capital Gain, `0` for Tax-Free.)*
   - Recompute the exact required gross withdrawal:
     $$\text{baseWdTotal} = \max\left(0,\; \frac{\text{netSpendingNeed}}{\max(0.0001,\; 1 - \text{actualEffTaxRate})}\right)$$
   - Run `executeLivingCascade(baseWdTotal)` for the final living withdrawal allocation.

Inside `executeLivingCascade(targetWdAmount)`, three mutually exclusive execution paths exist:

##### Path A: ACA Healthcare Subsidy Optimization (`acaEnabled && isAcaApplicable`)
Where `isAcaApplicable = (age < acaEndAge) && (!hasSpouse || spouseAge < acaEndAge)` (both members in the household are pre-Medicare) and `acaTargetLimitForYear = baseAcaTargetLimit * cumGeneralInflation`.
1. Compute `unavoidableAgi = totalSalary + guarTaxable`, `totalIncomeWithWd = unavoidableAgi + targetWdAmount`, `remainingAgiHeadroom = max(0, acaTargetLimitForYear - unavoidableAgi)`, and `availableNonAgiBal` (sum of accessible Cash + Roth balances).
2. **Phase 0 Income Override**: If `phase === 0` and any of:
   - `unavoidableAgi >= acaTargetLimitForYear - 1.0`, OR
   - `totalIncomeWithWd >= acaTargetLimitForYear - 1.0`, OR
   - `neededNonAgiBridge > availableNonAgiBal`,
   then set `allowablePreTaxDraw = targetWdAmount` and flag `isPhase0AcaIncomeOverride = true`. Otherwise, `allowablePreTaxDraw = min(targetWdAmount, remainingAgiHeadroom)`.
3. **4-Stage Drawdown**:
   - **Stage 1 (Pre-Tax Capped Draw)**: Draw up to `min(allowablePreTaxDraw, totalTdBal)` from accessible tax-deferred accounts. If `canBalanceTd`, split between Primary and Spouse using `equal` or `proportional`; otherwise draw in priority order. Track `agiHeadroomLeft = max(0, remainingAgiHeadroom - drawnPreTax)`.
   - **Stage 2 (Non-AGI Bridge)**: Fund `needNonAgi = max(0, targetWdAmount - filledSoFar)` from accessible Non-AGI accounts sorted by preference (`prioritizeCashBeforeRoth ? Cash -> Roth : Roth -> Cash`, tie-breaking by `orderKey`).
   - **Stage 3 (Taxable Brokerage Within Remaining AGI Headroom)**: If Cash/Roth bridge accounts are insufficient, draw from accessible Capital Gain / Brokerage accounts. Each `$1` of Brokerage withdrawal adds `capgainPct` to MAGI, so the maximum ACA-safe Brokerage draw is `agiHeadroomLeft / capgainPct` (or unlimited if `capgainPct === 0`). If capping at `agiHeadroomLeft` cannot cover the remaining living need, the engine draws what is required to meet living expenses.
   - **Stage 4 (Safety Net Fallback)**: If living need is still unfunded, sweep remaining balances across all `depletingAccessible` accounts in priority order.

##### Path B: Synchronized Multi-Member Pre-Tax Drawdown (`!ACA && canBalanceTd`)
Active when `taxDeferredStrategy.enabled && hasSpouse && primaryTdBal > 0 && spouseTdBal > 0`.
1. **Stage 1 (Higher-Priority Non-Tax-Deferred)**: Fund `targetWdAmount` from accessible non-tax-deferred sources whose `orderKey < min(tdOrderKeys)`.
2. **Stage 2 (Balanced Tax-Deferred Tier)**: Draw `tdWithdrawalNeeded = min(targetWdAmount - filledSoFar, primaryTdBal + spouseTdBal)` split across Primary (`owner !== 'spouse'`) and Spouse (`owner === 'spouse'`) tax-deferred accounts:
   - If `method === 'equal'`: target `tdWithdrawalNeeded / 2` for each spouse, capping at available balance and spilling any shortfall to the other spouse.
   - If `method === 'proportional'`: target `tdWithdrawalNeeded * (ownerTdBal / totalTdBal)` for each spouse.
   - Allocate each spouse's target across their own pre-tax accounts in priority order.
3. **Stage 3 (Lower-Priority Non-Tax-Deferred)**: Fund any remaining shortfall from accessible non-tax-deferred sources with `orderKey >= min(tdOrderKeys)`.

##### Path C: Standard Sequential Priority Waterfall
Iterate through `depletingAccessible` in `orderKey` order, filling `targetWdAmount` sequentially up to each account's `beginBal`.

#### Step 7: Mandated RMD Enforcement & Surplus Reinvestment
1. For every accessible depleting source: if `acctRmd > normalWd`, increase `withdrawalsBySource[id]` to `min(beginBal, acctRmd)`.
2. Any forced addition (`excess = min(beginBal, acctRmd) - normalWd`) is summed into `rmdSurplusGross`.
3. Reinvest net RMD surplus into the primary **accessible** Taxable Brokerage account (fallback: first accessible non-Income depleting source):
   $$\text{rmdSurplusReinvested} = \max\left(0,\; \text{rmdSurplusGross} \times (1 - (\text{fedBracket} + \text{stateRate}))\right)$$

#### Step 8: Pre-Conversion Pre-Tax Snapshot & Systematic Roth Conversion Engine
Before executing Roth conversions, the engine records `preTaxBalanceBeforeConv` — the exact sum of remaining pre-tax (`isTaxDeferredSource`) balances after all living and RMD withdrawals have been deducted, prior to Roth conversion and annual growth.

Active when `rothConfig.enabled && age >= rothConfig.startAge && age <= rothConfig.endAge`:
1. **Compute Conversion Headroom**:
   - Sum taxable living + RMD withdrawals so far: `currentTaxableLivingWd` (`100%` of tax-deferred/`Income` withdrawals + `capgainPct` of Capital Gain withdrawals).
   - `bracketRoom = max(0, bracketRoomMaxIncome - (totalSalary + guarTaxable + currentTaxableLivingWd))`
   - `annualCap = rothConfig.annualCap > 0 ? rothConfig.annualCap : Infinity`
   - Remaining pre-tax balances post-living/RMD withdrawals are partitioned by owner: `availPrimaryPreTax` (`owner !== 'spouse'`) and `availSpousePreTax` (`owner === 'spouse'`), summing to `availablePreTax`.
   - If `acaEnabled && isAcaApplicable`: `maxAllowedByAca = max(0, acaTargetLimitForYear - (totalSalary + guarTaxable + currentTaxableLivingWd))`, preventing conversions from disqualifying ACA subsidies.
   - `maxConversion = min(bracketRoom, annualCap, availablePreTax, maxAllowedByAca)`
   - Execute only if `maxConversion > 100`.
2. **Conversion Tax Calculation**:
   - `fedConvRate = rothConfig.targetBracketRate || rates.fedBracket`
   - `rothConversionTax = maxConversion * (fedConvRate + rates.stateRate)`
3. **Pre-Tax Account Deduction (Single vs. 2-Person Equal Split)**:
   - **Single Person (`!hasSpouse`)**: Deduct `maxConversion` from Primary pre-tax accounts in priority order; track `rothConversionByOwner.primary`.
   - **2-Person Household (`hasSpouse`)**:
     - Allocate `halfConv = maxConversion / 2` to Primary and `halfConv` to Spouse, capped by each person's `availPrimaryPreTax` and `availSpousePreTax`.
     - **Automatic Spillover**: If either spouse has less remaining pre-tax balance than `maxConversion / 2`, any unused conversion remainder automatically rolls over to the other spouse's remaining pre-tax balance so the household captures the full allowable conversion.
     - Deduct each spouse's target across their own tax-deferred accounts in priority order, recording `conversionDeductionsBySource[id]` and `rothConversionByOwner.{primary, spouse}`.
4. **Conversion Tax Payment (`taxPaymentMethod`)**:
   - If `'outsideBrokerage'`: withdraw up to `rothConversionTax` first from accessible `brokerageAcct`, then from accessible Cash sources; record `rothTaxPaidOutside` and `taxPaidOutsideBySource[id]`.
   - Any Brokerage withdrawal used to pay conversion taxes is subject to capital gains tax (`brokerageTaxDraw * capgainPct * capgainRate`).
5. **Owner-Matched Net Transfer to Roth Accounts**:
   - `unpaidTax = max(0, rothConversionTax - rothTaxPaidOutside)`
   - `netTotalToRoth = (taxPaymentMethod === 'withhold') ? max(0, maxConversion - rothConversionTax) : max(0, maxConversion - unpaidTax)`
   - `netRatio = netTotalToRoth / maxConversion`
   - **Strict Destination Resolution**:
     - `primaryRothAcct`: prefers `targetRothAccountId` (if non-monthly, non-tax-deferred, and owned by primary/joint), else `owner === 'primary'` Roth (`isSourceRoth`), else `joint` Roth, else any `isSourceRoth` account, else any non-tax-deferred `taxType === 'N/a'` account. Never falls back to a pre-tax or brokerage account.
     - `spouseRothAcct`: prefers `targetRothAccountId` (if owned by spouse), else `owner === 'spouse'` Roth (`isSourceRoth`), else `joint` Roth, falling back to `primaryRothAcct`.
   - Deposit `rothConversionByOwner.primary * netRatio` into `primaryRothAcct` and `rothConversionByOwner.spouse * netRatio` into `spouseRothAcct` (`rothDepositBySource`).

#### Step 9: Final Annual Tax Liability Computation
For each source, separate living/RMD withdrawals and outside conversion-tax draws from Roth conversion principal:
$$\text{nonConvWd}_s = \max(0,\; \text{withdrawalsBySource}[s] - \text{conversionDeductionsBySource}[s])$$
Aggregate `nonConvWd` into `ordinaryLivingWd` (Income / Tax-Deferred), `capGainLivingWd` (Capital Gain / Brokerage — which includes any Brokerage withdrawal used to pay conversion taxes outside), and `taxFreeLivingWd` (Cash / Roth).
- `taxableOrdinaryIncome = taxOther + ordinaryLivingWd`
- `taxableCapGains = capGainLivingWd * rates.capgainPct`
- `fedTax = (rates.fedBracket * taxableOrdinaryIncome) + (rothConvertedAmount * fedConvRate)`
- `stateTax = (rates.stateRate * taxableOrdinaryIncome) + (rothConvertedAmount * rates.stateRate)`
- `capGainTax = rates.capgainRate * taxableCapGains`
- `totalTax = fedTax + stateTax + capGainTax`

#### Step 10: ACA Healthcare Subsidy Evaluation & Portfolio Credit
If `isAcaApplicable`:
- `acaMagi = taxableOrdinaryIncome + taxableCapGains + rothConvertedAmount`
- `inflatedFplBase = ACA_FPL_BASE[householdSize] * cumGeneralInflation` (where `ACA_FPL_BASE[1] = 15650`, `ACA_FPL_BASE[2] = 21150`)
- `fplRatio = acaMagi / inflatedFplBase`
- `unsubsidizedAnnualPrem = baseUnsubsidized * cumMedicalInflation`
- **Hard Cliff Disqualification**: If `acaMagi > acaTargetLimitForYear + 1.0`, `qualified = false`, `subsidyAmount = 0`.
- **ACA Sliding Scale Expected Household Contribution Rate (`rate`)**:
  - `fplRatio <= 1.50` &rarr; `0.0%`
  - `1.50 < fplRatio <= 2.00` &rarr; linearly `0.0% -> 2.0%`
  - `2.00 < fplRatio <= 2.50` &rarr; linearly `2.0% -> 4.0%`
  - `2.50 < fplRatio <= 3.00` &rarr; linearly `4.0% -> 6.0%`
  - `3.00 < fplRatio <= 4.00` &rarr; linearly `6.0% -> 8.5%`
  - `fplRatio > 4.00` &rarr; `8.5%`
- `expectedContribution = min(unsubsidizedAnnualPrem, max(0, acaMagi * rate))`
- `acaSubsidySavings = max(0, unsubsidizedAnnualPrem - expectedContribution)`
- `acaQualified = (acaMagi <= acaTargetLimitForYear + 1.0) && (acaSubsidySavings > 0)`
- **Destination Account Credit**: If `isAcaApplicable && acaQualified && acaSubsidySavings > 0`, resolve credit destination via `resolveAcaCreditAccount` (disabled if `adjustMedicalExpensesWithSubsidy === false` or `creditAccountId === '__none__'`; otherwise uses configured `creditAccountId`, defaulting to Cash/Savings, then Brokerage, then first depleting account). Add `acaSubsidySavings` to that account prior to compounding.

#### Step 11: End-of-Year Balance Compounding & Cash-Flow Shortfall Depletion Detection
For each depleting account (`monthly === 'N'`):
$$\text{remaining}_s = \max(0,\; \text{beginBal}_s - \text{withdrawalsBySource}_s) + \text{rmdSurplus}_s + \text{rothDeposit}_s + \text{acaCredit}_s$$
$$\text{endBal}_s = \text{remaining}_s \times (1 + \text{effInvestRate})$$
- `combEndBal = sum(endBal_s)`
- **Cash-Flow Shortfall & Depletion Detection**:
  - `livingAndRmdWd = sum(nonConvWd_s)`
  - `netAfterTaxInflow = totalSalary + guarTotal + livingAndRmdWd - (totalTax - rothConversionTax) - rmdSurplusReinvested`
  - `hasCashflowShortfall = (netAfterTaxInflow < yrExpenses - 1.0)` (detects shortfall even if an age-locked account still holds unaccessible funds).
  - `inLifeHorizon = (age <= lifeExpAge) || (hasSpouse && spouseAge <= spouseLifeExpAge)`
  - `depleted = ((combEndBal <= 0 || hasCashflowShortfall) && inLifeHorizon)`
  - Record the first year where `combEndBal <= 0 || hasCashflowShortfall` as `fundsRunOutYear` and `yearsFundingLasts = yr`.

---

## 4. Analytical, Optimization & Comparison Engines

### 4.1 Monte Carlo Stochastic Simulation
- Executed lazily only when the Monte Carlo analysis mode is active.
- Generates `N` simulation runs (default `250`) across `projectionYears`.
- For each run and each year `yr`, samples an annual investment return using a Box-Muller standard normal transform centered on the active `stressPreset` mean return curve (`presetMeanReturn(yr)`) with configurable standard deviation `volatility` (default `0.12`, range `0.05 – 0.25`).
- Runs `runSimulation(config, stressPreset, undefined, customRates)` so stress-preset inflation (`stagflation`, `bull`, etc.) is preserved inside each stochastic run.
- Applies `dollarMode` deflation (`y.cumGeneralInflation` if `'real'`, `1` if `'nominal'`) to each run's `combEndBal`.
- Computes per-year sorted distribution percentiles (`p10`, `p25`, `p50`, `p75`, `p90`) and `successProbability = round((runsWithNoDepletion / runsCount) * 100)`.

### 4.2 Systematic Roth Conversion Comparator
Compares `runSimulation(..., { ...rothConfig, enabled: false })` vs. `runSimulation(..., { ...rothConfig, enabled: true })` and returns full `baselineYears` and `rothYears` series alongside schedule rows:
- **KPIs** (deflated per-year by `y.cumGeneralInflation` when viewed in Real mode):
  - `lifetimeTaxSavings = baseline.totalTaxesPaid - withRoth.totalTaxesPaid`
  - `finalBalanceDifference = withRoth.finalBalance - baseline.finalBalance`
  - `totalConverted`, `totalConversionTaxesPaid`
  - `rmdLifetimeSavings`: sum across **all** simulation years where `baseRmd > 0 || rothRmd > 0` (capturing older-spouse RMDs even before Primary reaches `rmdAge`) of `max(0, baseRmd - rothRmd) * (fedBracket + stateRate)`
  - `peakRmdReduction`: maximum annual RMD reduction across all years with RMDs.
- **Conversion Schedule**: Year-by-year table including `cumGeneralInflation`, `bracketRoom`, `convertedAmount`, `primaryConverted`, `spouseConverted`, destination Roth account names, `conversionTax`, `preTaxBalanceBefore` (from exact `preTaxBalanceBeforeConv`), `preTaxBalanceAfter`, and `rothBalanceAfter`.

### 4.3 ACA Subsidy Comparator
Compares `runSimulation(..., { ...acaConfig, enabled: false })` vs. `runSimulation(..., { ...acaConfig, enabled: true })` and returns full `baselineYears` and `acaYears` series:
- **KPIs** (deflated per-year by `y.cumGeneralInflation` when viewed in Real mode): `totalSubsidiesSaved`, `preMedicareYearsSubsidized`, `totalPreMedicareYears`, `preTaxDrawsDeferredToNonAgi` (cumulative reduction in pre-tax withdrawals vs baseline during pre-Medicare years), `finalBalanceDifference`.
- **Pre-Medicare Schedule**: Yearly `cumGeneralInflation`, MAGI vs inflated Target Limit, Pre-Tax vs Non-AGI bridge draws, Phase 0 override status, qualification status, subsidy saved, and destination credit account.

### 4.4 Automated What-If Strategy Comparison Engine (6 Scenarios)
Evaluates and compares 5 automated optimization strategies against the user's `Baseline Strategy`:

| Scenario ID | Strategy Objective | Algorithmic Logic |
| :--- | :--- | :--- |
| `baseline` | Baseline Strategy | Runs user's exact configured priorities and rules. |
| `acaSubsidy` | ACA Health Subsidy | Forces `acaOptimization.enabled = true` over pre-Medicare gap years (`endAge = medicareAge`). |
| `minTax` | Minimize Lifetime Tax | Reorders priorities (`Cash [1] -> Brokerage [2] -> Pre-Tax [3] -> Roth [4]`) and performs a grid search across conversion bracket ceilings (`[0, 12%, 22%, 24%]`) and annual caps (`[$0, $25k, $50k, $75k, $100k]`) selecting the solvent run with lowest `totalTaxesPaid`. |
| `minRmd` | Minimize Future RMD | Reorders priorities (`Pre-Tax [1] -> Cash [2] -> Brokerage [3] -> Roth [4]`) and searches conversion bracket ceilings (`[22%, 24%]`) and caps (`[$30k, $60k, $90k, $150k]`) selecting the solvent run with lowest peak annual RMD (tie-breaking on within-`$1` equal peak RMDs by highest ending `finalBalance` so smaller caps that already achieve `$0` RMD are preferred). |
| `maxSpending` | Maximize Lifetime Spending | Uses tax-efficient ordering and executes an **18-iteration binary search** on an `expDaily` multiplier across `[0.20, 4.00]` to find the maximum sustainable lifestyle spending (`~0.5%` precision) with `fundsRunOutYear === null`. |
| `maxEstate` | Maximize Estate Net Worth | Isolates Roth accounts at `priority = 99` (`Cash [1] -> Brokerage [2] -> Pre-Tax [3] -> Roth [99]`) and evaluates no conversion vs. 12% ($40k cap) vs. 22% ($50k cap) conversions, selecting the solvent run with highest terminal `finalBalance`. |

---

## 5. Valuation Adjustment, Outputs & Data Portability

### 5.1 Nominal vs. Real (Today's Purchasing Power) Deflation
Every annual monetary output `V` at year index `yr` can be expressed in two modes across all dashboards, simulators, comparators, charts, and workbook exports:
- **Nominal Mode (`Future $`)**: `V_display = V`
- **Real Mode (`Today's $`)**: `V_display = V / cumGeneralInflation_yr` (falling back to `(1 + inflationRate)^yr` only if `cumGeneralInflation` is absent).
When summarizing cumulative multi-year metrics (such as lifetime taxes, total withdrawals, total Roth conversions, RMD tax savings, or cumulative ACA subsidies) under Real Mode, each year's cash flow is deflated by that year's `cumGeneralInflation` before summing; terminal net worth is deflated by the terminal year's `cumGeneralInflation`, and Peak Annual RMD is deflated by the `cumGeneralInflation` of the specific year in which the peak RMD occurs.

### 5.2 Key Outputs Produced
- **Portfolio Summary (`PlanSummary`)**: `fundsRunOutYear` (`null` if sustained), `yearsFundingLasts`, `startingCombinedBalance`, `totalTaxesPaid`, `totalWithdrawals`, `finalBalance`, `totalAcaSubsidiesSaved`, `acaYearsQualified`.
- **Year-by-Year Simulation Records (`YearSimulationResult[]`)**:
  - Timeline, demographics & inflation (`yr`, `calYear`, `age`, `spouseAge`, `phase`, `workFrac`, `remFrac`, `cumGeneralInflation`).
  - Cash inflows (`salary`, `primarySalary`, `spouseSalary`, `guarTotal`, `guarTaxable`, `wdTotal`).
  - Expenses & tax totals (`expenses`, `generalExpenses`, `medicalExpenses`, `majorExpenses`, `majorExpensesList`, `isMedicareActive`, `fedTax`, `stateTax`, `capGainTax`, `totalTax`).
  - Mandate & strategy telemetry (`rmdTotal`, `rmdDivisor`, `rmdBySource`, `rmdSurplusGross`, `rmdSurplusReinvested`, `preTaxBalanceBeforeConv`, `rothConvertedAmount`, `rothConversionTax`, `rothConversionByOwner`, `rothConvertedBySource`, `rothDepositBySource`, `isSynchronizedTdActive`, `tdWithdrawalByOwner`, `acaMagi`, `acaTargetLimit`, `acaQualified`, `acaSubsidySavings`, `acaCreditAccountName`, `acaCreditedAmount`).
  - Account-level maps (`beginBalanceBySource`, `withdrawalsBySource`, `guaranteedBySource`, `incomeBySource`, `endBalanceBySource`, `combEndBal`, `depleted`).

### 5.3 Interactive Views, Filtering & Multi-Sheet Export
- **Snapshot & Simulation Filters**: Support filtering projection rows by First 10 Years, RMD Years (`age >= rmdAge || spouseAge >= rmdAge`), All Years, Retirement Phase (`0–5`), or Depleted Years Only, with drill-down inspection showing per-account beginning balance, withdrawal, RMD, Roth conversion outflow/inflow, ACA credit, and ending balance.
- **Spreadsheet Workbook Export (`.xlsx`)**:
  - Honors the active `dollarMode` (`Nominal (Future $)` or `Real (Today's $)`), recording the active Valuation Mode in the `Inputs` and `Plan` headers and deflating all monetary values in `Plan` and `ChartData` when exported in Real mode.
  1. **`Inputs` Sheet**: Complete dump of valuation mode, household parameters, primary and spouse milestone ages, tax-deferred early depletion strategy, rate/tax assumptions, monthly expenses, major scheduled expenses, Roth conversion configuration, ACA optimization & credit destination settings, and all income/asset sources.
  2. **`Plan` Sheet**: Summary KPI block followed by the full annual projection table (ages, phase, salary, guaranteed income, withdrawals, expense breakdown, Medicare flag, RMD/divisor/reinvestment, total and per-spouse Roth conversions, taxes, ending balance, ACA MAGI/limit/subsidy/credit destination, depletion flag).
  3. **`ChartData` Sheet**: Time-series matrix containing annual `Income: <Source>` columns, disaggregated expense/tax columns, RMD totals, combined balance, and `Balance: <Source>` columns.
- **State Persistence & Safe Recovery**: Configuration changes persist locally (`rp_config_v2`) with deep schema merging on load so missing nested fields safely hydrate from baseline defaults while intentionally emptied arrays (such as deleting all major expenses) remain empty. Offline execution is supported via local PWA service-worker asset caching with zero external API dependencies.
