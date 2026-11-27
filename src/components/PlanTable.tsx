import React, { useState } from 'react';
import { ChevronDown, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { YearSimulationResult, PlannerConfig, DollarDisplayMode } from '../types';
import { isSourceAccessible, getSourcePenaltyFreeAge, isTaxDeferredSource, getPhaseDefinitions } from '../engine';
import { formatCurrency } from '../utils/formatters';

interface PlanTableProps {
  years: YearSimulationResult[];
  config: PlannerConfig;
  dollarMode?: DollarDisplayMode;
}

type ColumnPreset = 'cashflow' | 'taxes' | 'full';

export const PlanTable: React.FC<PlanTableProps> = ({
  years,
  config,
  dollarMode = 'nominal',
}) => {
  const [expandedYear, setExpandedYear] = useState<number | null>(null);
  const [filterPhase, setFilterPhase] = useState<string>('all');
  const [columnPreset, setColumnPreset] = useState<ColumnPreset>('cashflow');

  const hasSpouse = Boolean(config.scenario?.hasSpouse);
  const primaryName = (config.scenario?.userName || 'Primary').split(' ')[0] || 'Primary';
  const spouseName = (config.scenario?.spouseName || 'Spouse').split(' ')[0] || 'Spouse';
  const rmdAge = config.milestones.rmdAge ?? 73;
  const phaseDefinitions = getPhaseDefinitions(config);
  const phaseLabelByNum = new Map(phaseDefinitions.map(p => [p.phase, p.shortLabel]));

  const toggleExpand = (yr: number) => {
    setExpandedYear(expandedYear === yr ? null : yr);
  };

  const getDeflator = (yrIndex: number, cumInflation?: number) => {
    if (dollarMode === 'nominal') return 1;
    if (cumInflation && cumInflation > 0) return cumInflation;
    return Math.pow(1 + config.rates.inflationRate, yrIndex);
  };

  const filteredYears = years.filter(y => {
    if (filterPhase === 'all') return true;
    if (filterPhase === 'depleted') return y.depleted;
    return y.phase.toString() === filterPhase;
  });

  const showSalary = columnPreset === 'cashflow' || columnPreset === 'full';
  const showGuar = columnPreset === 'cashflow' || columnPreset === 'full';
  const showRmd = columnPreset === 'taxes' || columnPreset === 'full';
  const showTaxBreakdown = columnPreset === 'taxes' || columnPreset === 'full';
  const showEventsCol = columnPreset === 'cashflow' || columnPreset === 'full';

  const visibleColCount =
    5 + // Expand, Year, Age, Phase, End Balance, Status -> actually count precisely below
    (hasSpouse ? 1 : 0) +
    (showSalary ? 1 : 0) +
    (showGuar ? 1 : 0) +
    (showRmd ? 1 : 0) +
    1 + // Withdrawals
    1 + // Expenses
    (showTaxBreakdown ? 3 : 0) +
    1 + // Total Tax
    (showEventsCol ? 1 : 0) +
    1; // Status

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Year-by-Year Simulation Ledger
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {dollarMode === 'real' ? "Real (Today's Purchasing Power)" : 'Nominal Future Dollars'} · Select any row to inspect account-by-account liquidation and tax details.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Column Preset Switcher */}
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg">
            {(
              [
                { id: 'cashflow', label: 'Cash Flow' },
                { id: 'taxes', label: 'Taxes & RMDs' },
                { id: 'full', label: 'Full Ledger' },
              ] as const
            ).map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setColumnPreset(preset.id)}
                className={`px-3 py-1.5 min-h-[34px] rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  columnPreset === preset.id
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Phase Filter */}
          <select
            aria-label="Filter by retirement phase"
            value={filterPhase}
            onChange={e => setFilterPhase(e.target.value)}
            className="min-h-[38px] border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 bg-white focus:border-emerald-600 focus:outline-none"
          >
            <option value="all">All Years ({years.length})</option>
            {phaseDefinitions.map(p => (
              <option key={p.phase} value={String(p.phase)}>
                Phase {p.phase}: {p.label}
              </option>
            ))}
            <option value="depleted">Depleted Years Only</option>
          </select>
        </div>
      </div>

      {/* Scrollable Table with Sticky Header & Sticky Left Year Column */}
      <div className="overflow-auto max-h-[68vh]">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200">
            <tr className="text-slate-500 font-semibold text-[11px]">
              <th className="py-3 px-3 w-9 sticky left-0 z-30 bg-slate-50"></th>
              <th className="py-3 px-3 sticky left-9 z-30 bg-slate-50 border-r border-slate-200/80 whitespace-nowrap">
                Year
              </th>
              <th className="py-3 px-3 whitespace-nowrap">{hasSpouse ? `${primaryName}` : 'Age'}</th>
              {hasSpouse && <th className="py-3 px-3 whitespace-nowrap">{spouseName}</th>}
              <th className="py-3 px-3 whitespace-nowrap">Phase</th>
              {showSalary && <th className="py-3 px-3 text-right whitespace-nowrap">Salary</th>}
              {showGuar && <th className="py-3 px-3 text-right whitespace-nowrap">Guaranteed</th>}
              {showRmd && <th className="py-3 px-3 text-right whitespace-nowrap">Mandated RMD</th>}
              <th className="py-3 px-3 text-right whitespace-nowrap">Withdrawals</th>
              <th className="py-3 px-3 text-right whitespace-nowrap">Expenses</th>
              {showTaxBreakdown && (
                <>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Fed Tax</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">State Tax</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Cap Gain</th>
                </>
              )}
              <th className="py-3 px-3 text-right whitespace-nowrap">Total Tax</th>
              {showEventsCol && <th className="py-3 px-3 whitespace-nowrap">Events</th>}
              <th className="py-3 px-3 text-right font-bold text-slate-800 whitespace-nowrap">End Balance</th>
              <th className="py-3 px-3 text-right whitespace-nowrap">Status</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {filteredYears.length === 0 ? (
              <tr>
                <td colSpan={visibleColCount} className="py-12 text-center text-slate-500 text-sm">
                  No years match this phase filter.
                </td>
              </tr>
            ) : (
              filteredYears.map(y => {
                const isExpanded = expandedYear === y.yr;
                const deflator = getDeflator(y.yr, y.cumGeneralInflation);

                const salaryAdj = y.salary / deflator;
                const guarAdj = y.guarTotal / deflator;
                const rmdAdj = (y.rmdTotal || 0) / deflator;
                const wdAdj = y.wdTotal / deflator;
                const expAdj = y.expenses / deflator;
                const fedTaxAdj = y.fedTax / deflator;
                const stateTaxAdj = y.stateTax / deflator;
                const capGainTaxAdj = y.capGainTax / deflator;
                const totalTaxAdj = y.totalTax / deflator;
                const endBalAdj = y.combEndBal / deflator;

                const eventTags: string[] = [];
                if ((y.rmdTotal || 0) > 0) eventTags.push('RMD');
                if ((y.rothConvertedAmount || 0) > 0) eventTags.push('Roth');
                if (y.isAcaApplicable && y.acaQualified && (y.acaSubsidySavings || 0) > 0) eventTags.push('ACA');
                if ((y.majorExpenses || 0) > 0) eventTags.push('Major');

                const stickyBg = y.depleted
                  ? 'bg-rose-50'
                  : isExpanded
                  ? 'bg-emerald-50'
                  : 'bg-white group-hover:bg-slate-50';

                return (
                  <React.Fragment key={y.yr}>
                    <tr
                      onClick={() => toggleExpand(y.yr)}
                      className={`group cursor-pointer transition-colors ${
                        y.depleted
                          ? 'bg-rose-50/70 text-rose-950'
                          : isExpanded
                          ? 'bg-emerald-50/50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className={`py-2.5 px-2 text-center sticky left-0 z-10 ${stickyBg}`}>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            toggleExpand(y.yr);
                          }}
                          aria-expanded={isExpanded}
                          aria-label={`Toggle details for year ${y.calYear}`}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                      <td
                        className={`py-2.5 px-3 font-semibold text-slate-900 tabular-nums whitespace-nowrap sticky left-9 z-10 border-r border-slate-100 ${stickyBg}`}
                      >
                        {y.calYear}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 tabular-nums whitespace-nowrap">
                        {y.age.toFixed(1)}
                      </td>
                      {hasSpouse && (
                        <td className="py-2.5 px-3 text-slate-600 tabular-nums whitespace-nowrap">
                          {y.spouseAge !== undefined ? y.spouseAge.toFixed(1) : '—'}
                        </td>
                      )}
                      <td
                        className="py-2.5 px-3 text-slate-600 whitespace-nowrap"
                        title={`Phase ${y.phase}: ${phaseLabelByNum.get(y.phase) ?? ''}`}
                      >
                        P{y.phase}
                      </td>
                      {showSalary && (
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {salaryAdj > 0 ? formatCurrency(salaryAdj) : '—'}
                        </td>
                      )}
                      {showGuar && (
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                          {guarAdj > 0 ? formatCurrency(guarAdj) : '—'}
                        </td>
                      )}
                      {showRmd && (
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          {rmdAdj > 0 ? (
                            <span className="text-amber-700 font-semibold">{formatCurrency(rmdAdj)}</span>
                          ) : y.age >= rmdAge || (hasSpouse && (y.spouseAge ?? 0) >= rmdAge) ? (
                            <span className="text-slate-400">$0</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900 font-medium whitespace-nowrap">
                        {formatCurrency(wdAdj)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatCurrency(expAdj)}
                      </td>
                      {showTaxBreakdown && (
                        <>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                            {formatCurrency(fedTaxAdj)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                            {formatCurrency(stateTaxAdj)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                            {formatCurrency(capGainTaxAdj)}
                          </td>
                        </>
                      )}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 font-medium whitespace-nowrap">
                        {formatCurrency(totalTaxAdj)}
                      </td>
                      {showEventsCol && (
                        <td className="py-2.5 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                          {eventTags.length > 0 ? eventTags.join(' · ') : '—'}
                        </td>
                      )}
                      <td
                        className={`py-2.5 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                          y.combEndBal <= 0 ? 'text-rose-600' : 'text-slate-900'
                        }`}
                      >
                        {formatCurrency(endBalAdj)}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {y.depleted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Depleted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Funded
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded Year Detail Inspector */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90 border-b border-slate-200">
                        <td colSpan={visibleColCount} className="p-4 sm:p-5">
                          <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-200">
                              <div className="text-xs font-bold text-slate-900">
                                Year {y.calYear} · {primaryName} Age {y.age.toFixed(1)}
                                {hasSpouse && y.spouseAge !== undefined ? ` · ${spouseName} Age ${y.spouseAge.toFixed(1)}` : ''} · Phase {y.phase} ({phaseLabelByNum.get(y.phase) ?? ''})
                              </div>
                              <div className="text-xs text-slate-500 tabular-nums">
                                Expenses: General {formatCurrency((y.generalExpenses || 0) / deflator)}
                                {config.expenses.usePhaseExpenses && y.baseMonthlyLivingExpense !== undefined
                                  ? ` (${formatCurrency(y.baseMonthlyLivingExpense)}/mo base)`
                                  : ''}{' '}
                                · Healthcare {formatCurrency((y.medicalExpenses || 0) / deflator)} {y.isMedicareActive ? '(Medicare)' : '(Pre-Medicare)'}
                                {(y.majorExpenses || 0) > 0 && ` · Major +${formatCurrency((y.majorExpenses || 0) / deflator)}`}
                              </div>
                            </div>

                            {/* Key Event Callouts (flat subtle strips, no nested card clutter) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                              {(y.majorExpenses || 0) > 0 && (
                                <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 space-y-1">
                                  <div className="font-semibold text-amber-900">Scheduled Major Expenses</div>
                                  {y.majorExpensesList?.map((m, idx) => (
                                    <div key={idx} className="flex justify-between text-amber-950 tabular-nums">
                                      <span className="truncate">{m.name}</span>
                                      <span className="font-mono font-semibold">{formatCurrency(m.amount / deflator)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {((y.rmdTotal || 0) > 0 || y.age >= rmdAge || (hasSpouse && (y.spouseAge ?? 0) >= rmdAge)) && (
                                <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                                  <div className="font-semibold text-slate-900">IRS RMD Summary</div>
                                  <div className="flex justify-between text-slate-700 tabular-nums">
                                    <span>Mandated RMD{y.rmdDivisor ? ` (Div ${y.rmdDivisor})` : ''}</span>
                                    <span className="font-mono font-semibold text-amber-700">
                                      {formatCurrency(rmdAdj)}
                                    </span>
                                  </div>
                                  {(y.rmdSurplusGross || 0) > 0 ? (
                                    <div className="text-[11px] text-emerald-700 tabular-nums">
                                      Surplus {formatCurrency((y.rmdSurplusReinvested || 0) / deflator)} net reinvested to brokerage
                                    </div>
                                  ) : (
                                    <div className="text-[11px] text-slate-500">
                                      {(y.rmdTotal || 0) > 0
                                        ? 'Fully absorbed by annual living withdrawals'
                                        : 'Pre-tax accounts at $0 beginning balance'}
                                    </div>
                                  )}
                                </div>
                              )}

                              {(y.rothConvertedAmount || 0) > 0 && (
                                <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                                  <div className="font-semibold text-slate-900">Systematic Roth Conversion</div>
                                  <div className="flex justify-between tabular-nums">
                                    <span className="text-slate-600">Converted</span>
                                    <span className="font-mono font-semibold text-emerald-700">
                                      {formatCurrency((y.rothConvertedAmount || 0) / deflator)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between tabular-nums">
                                    <span className="text-slate-600">Conversion Tax</span>
                                    <span className="font-mono text-rose-600">
                                      {formatCurrency((y.rothConversionTax || 0) / deflator)}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {y.isAcaApplicable && (
                                <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                                  <div className="font-semibold text-slate-900">ACA Subsidy Bridge</div>
                                  <div className="flex justify-between tabular-nums">
                                    <span className="text-slate-600">Household MAGI / Limit</span>
                                    <span className="font-mono font-semibold">
                                      {formatCurrency((y.acaMagi || 0) / deflator)} / {formatCurrency((y.acaTargetLimit || 0) / deflator)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between tabular-nums">
                                    <span className="text-slate-600">Annual Subsidy Credit</span>
                                    <span className={`font-mono font-semibold ${y.acaQualified ? 'text-emerald-700' : 'text-slate-500'}`}>
                                      {y.acaQualified && (y.acaSubsidySavings || 0) > 0
                                        ? `+${formatCurrency((y.acaSubsidySavings || 0) / deflator)}`
                                        : '$0 (Over limit)'}
                                    </span>
                                  </div>
                                  {y.acaCreditAccountName && (y.acaCreditedAmount || 0) > 0 && (
                                    <div className="text-[11px] text-emerald-700">
                                      Credited to {y.acaCreditAccountName}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Account Liquidation & Cash Flow Tables */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                              <div>
                                <h4 className="text-xs font-semibold text-slate-700 mb-2">
                                  Depleting Accounts (By Priority)
                                </h4>
                                <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                                  {config.sources
                                    .filter(s => s.monthly === 'N')
                                    .sort((a, b) => a.priority - b.priority)
                                    .map(s => {
                                      const beg = (y.beginBalanceBySource[s.id] || 0) / deflator;
                                      const wd = (y.withdrawalsBySource[s.id] || 0) / deflator;
                                      const end = (y.endBalanceBySource[s.id] || 0) / deflator;
                                      const owner = s.owner || 'primary';
                                      const accessible = isSourceAccessible(s, y.age, y.spouseAge, config.milestones, hasSpouse);
                                      const penaltyFreeAge = getSourcePenaltyFreeAge(s, config.milestones, owner === 'spouse');
                                      const rmdAmt = (y.rmdBySource?.[s.id] || 0) / deflator;
                                      const rothOut = (y.rothConvertedBySource?.[s.id] || 0) / deflator;
                                      const rothIn = (y.rothDepositBySource?.[s.id] || 0) / deflator;

                                      return (
                                        <div key={s.id} className="px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px]">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-slate-400 font-mono tabular-nums w-4">#{s.priority}</span>
                                            <span className="font-medium text-slate-900 truncate">{s.name}</span>
                                            {!accessible && (
                                              <span className="text-amber-700 shrink-0">Locked &lt;{penaltyFreeAge}</span>
                                            )}
                                          </div>
                                          <div className="font-mono tabular-nums flex items-center gap-3 flex-wrap text-slate-600 shrink-0">
                                            <span>Beg {formatCurrency(beg)}</span>
                                            {isTaxDeferredSource(s) && rmdAmt > 0 && (
                                              <span className="text-amber-700 font-semibold">RMD {formatCurrency(rmdAmt)}</span>
                                            )}
                                            <span className={wd > 0 ? 'text-slate-900 font-semibold' : 'text-slate-400'}>
                                              W/D {formatCurrency(wd)}
                                            </span>
                                            {rothOut > 0 && (
                                              <span className="text-indigo-700">Conv -{formatCurrency(rothOut)}</span>
                                            )}
                                            {rothIn > 0 && (
                                              <span className="text-emerald-700">+Roth {formatCurrency(rothIn)}</span>
                                            )}
                                            <span className="text-slate-900 font-semibold">End {formatCurrency(end)}</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>

                              <div>
                                <h4 className="text-xs font-semibold text-slate-700 mb-2">
                                  Guaranteed Income &amp; Earned Salary
                                </h4>
                                <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                                  {config.sources
                                    .filter(s => s.monthly === 'Y')
                                    .map(s => {
                                      const payment = (y.guaranteedBySource[s.id] || 0) / deflator;
                                      return (
                                        <div key={s.id} className="px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
                                          <div className="text-slate-700 truncate">
                                            <span className="font-medium text-slate-900">{s.name}</span>
                                            <span className="text-slate-400 ml-1.5">starts age {s.startAge}</span>
                                          </div>
                                          <span className={`font-mono tabular-nums ${payment > 0 ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                                            {payment > 0 ? `${formatCurrency(payment)}/yr` : 'Inactive'}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  {y.salary > 0 && (
                                    <div className="px-3 py-2 flex items-center justify-between gap-2 text-[11px] bg-slate-50/70">
                                      <span className="font-medium text-slate-800">Active Work Salary</span>
                                      <span className="font-mono tabular-nums font-semibold text-slate-900">
                                        {formatCurrency(salaryAdj)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
