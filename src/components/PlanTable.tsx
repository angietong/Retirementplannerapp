import React, { useState } from 'react';
import { ChevronDown, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { YearSimulationResult, PlannerConfig, DollarDisplayMode } from '../types';
import { isSourceAccessible, getSourcePenaltyFreeAge } from '../engine';

interface PlanTableProps {
  years: YearSimulationResult[];
  config: PlannerConfig;
  dollarMode?: DollarDisplayMode;
  onDollarModeChange?: (mode: DollarDisplayMode) => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const PlanTable: React.FC<PlanTableProps> = ({
  years,
  config,
  dollarMode = 'nominal',
  onDollarModeChange,
}) => {
  const [expandedYear, setExpandedYear] = useState<number | null>(null);
  const [filterPhase, setFilterPhase] = useState<string>('all');

  const hasSpouse = Boolean(config.scenario.hasSpouse);
  const primaryName = config.scenario.userName.split(' ')[0] || 'Primary';
  const spouseName = (config.scenario.spouseName || 'Spouse').split(' ')[0] || 'Spouse';

  const toggleExpand = (yr: number) => {
    setExpandedYear(expandedYear === yr ? null : yr);
  };

  const getDeflator = (yrIndex: number) => {
    if (dollarMode === 'nominal') return 1;
    return Math.pow(1 + config.rates.inflationRate, yrIndex);
  };

  const filteredYears = years.filter(y => {
    if (filterPhase === 'all') return true;
    if (filterPhase === 'depleted') return y.depleted;
    return y.phase.toString() === filterPhase;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/70">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Year-by-Year Simulation Table</h2>
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-medium">
              {dollarMode === 'real' ? "Real ($) Today's Value" : 'Nominal ($) Future Dollars'}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Interactive breakdown matching the Excel Plan worksheet formulas & liquidation priority cascade.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Dollar Mode Toggle */}
          <div className="inline-flex items-center bg-white p-0.5 rounded-lg border border-slate-300 shadow-2xs">
            <button
              onClick={() => onDollarModeChange && onDollarModeChange('nominal')}
              className={`px-2 py-1 rounded text-xs transition-all ${
                dollarMode === 'nominal'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Nominal $
            </button>
            <button
              onClick={() => onDollarModeChange && onDollarModeChange('real')}
              className={`px-2 py-1 rounded text-xs transition-all ${
                dollarMode === 'real'
                  ? 'bg-emerald-700 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Real (Today's $)
            </button>
          </div>

          <label className="text-slate-600 font-medium">Filter Phase:</label>
          <select
            value={filterPhase}
            onChange={e => setFilterPhase(e.target.value)}
            className="border border-slate-300 rounded-md px-2.5 py-1 text-slate-800 bg-white shadow-2xs focus:outline-emerald-500"
          >
            <option value="all">All Years ({years.length})</option>
            <option value="0">Phase 0: Retirement Year Proration</option>
            <option value="1">Phase 1: Pre-Milestones</option>
            <option value="2">Phase 2: 401k/IRA Access (Age {config.milestones.retireAcctAge}+)</option>
            <option value="3">Phase 3: SS Min (Age {config.milestones.ssMinAge}+)</option>
            <option value="4">Phase 4: Medicare (Age {config.milestones.medicareAge}+)</option>
            <option value="5">Phase 5: RMDs (Age {config.milestones.rmdAge}+)</option>
            <option value="depleted">Depleted Years Only</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <th className="py-3 px-3 w-8"></th>
              <th className="py-3 px-3">Year</th>
              <th className="py-3 px-3">{hasSpouse ? `${primaryName} Age` : 'Age'}</th>
              {hasSpouse && <th className="py-3 px-3">{spouseName} Age</th>}
              <th className="py-3 px-3">Phase</th>
              <th className="py-3 px-3 text-right">Salary</th>
              <th className="py-3 px-3 text-right">Guar. Income</th>
              <th className="py-3 px-3 text-right">Withdrawals</th>
              <th className="py-3 px-3 text-right">Expenses</th>
              <th className="py-3 px-3 text-right">Federal Tax</th>
              <th className="py-3 px-3 text-right">State Tax</th>
              <th className="py-3 px-3 text-right">Cap Gain Tax</th>
              <th className="py-3 px-3 text-right">Total Tax</th>
              <th className="py-3 px-3 text-right font-bold">End Balance</th>
              <th className="py-3 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {filteredYears.map(y => {
              const isExpanded = expandedYear === y.yr;
              const deflator = getDeflator(y.yr);

              const salaryAdj = y.salary / deflator;
              const guarAdj = y.guarTotal / deflator;
              const wdAdj = y.wdTotal / deflator;
              const expAdj = y.expenses / deflator;
              const fedTaxAdj = y.fedTax / deflator;
              const stateTaxAdj = y.stateTax / deflator;
              const capGainTaxAdj = y.capGainTax / deflator;
              const totalTaxAdj = y.totalTax / deflator;
              const endBalAdj = y.combEndBal / deflator;

              return (
                <React.Fragment key={y.yr}>
                  <tr
                    onClick={() => toggleExpand(y.yr)}
                    className={`cursor-pointer transition-colors hover:bg-slate-50/80 ${
                      y.depleted
                        ? 'bg-red-50/40 text-red-950 font-semibold'
                        : isExpanded
                        ? 'bg-emerald-50/30'
                        : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center text-slate-400">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 font-sans">{y.calYear}</td>
                    <td className="py-2.5 px-3 text-slate-600 font-sans">{y.age.toFixed(1)}</td>
                    {hasSpouse && (
                      <td className="py-2.5 px-3 text-slate-600 font-sans">
                        {y.spouseAge !== undefined ? y.spouseAge.toFixed(1) : '—'}
                      </td>
                    )}
                    <td className="py-2.5 px-3 font-sans">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          y.phase === 0
                            ? 'bg-amber-100 text-amber-800'
                            : y.phase === 1
                            ? 'bg-blue-100 text-blue-800'
                            : y.phase === 2
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        Phase {y.phase}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600">
                      {salaryAdj > 0 ? formatCurrency(salaryAdj) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-700">
                      {guarAdj > 0 ? formatCurrency(guarAdj) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-indigo-700 font-medium">
                      <div>{formatCurrency(wdAdj)}</div>
                      {y.rmdTotal !== undefined && y.rmdTotal > 0 && (
                        <div className="text-[10px] font-sans font-medium text-amber-800 bg-amber-50 rounded px-1 inline-block mt-0.5" title={`Mandated IRS RMD: ${formatCurrency(y.rmdTotal / deflator)}`}>
                          RMD: {formatCurrency(y.rmdTotal / deflator)}
                        </div>
                      )}
                      {y.rothConvertedAmount !== undefined && y.rothConvertedAmount > 0 && (
                        <div className="text-[10px] font-sans font-medium text-purple-800 bg-purple-50 rounded px-1 inline-block mt-0.5 ml-1" title={`Systematic Roth Conversion: ${formatCurrency(y.rothConvertedAmount / deflator)}`}>
                          Roth: {formatCurrency(y.rothConvertedAmount / deflator)}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-900">
                      <div>{formatCurrency(expAdj)}</div>
                      {y.medicalExpenses !== undefined && (
                        <div className="text-[10px] font-sans text-slate-400" title={`General: ${formatCurrency((y.generalExpenses || 0) / deflator)} | Healthcare: ${formatCurrency(y.medicalExpenses / deflator)}`}>
                          Med: {formatCurrency(y.medicalExpenses / deflator)}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600">
                      {formatCurrency(fedTaxAdj)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600">
                      {formatCurrency(stateTaxAdj)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600">
                      {formatCurrency(capGainTaxAdj)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                      {formatCurrency(totalTaxAdj)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-bold ${
                        y.combEndBal <= 0 ? 'text-red-600' : 'text-slate-900'
                      }`}
                    >
                      {formatCurrency(endBalAdj)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-sans">
                      {y.depleted ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                          <AlertCircle className="w-3 h-3" />
                          DEPLETED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" />
                          OK
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded Detail Drawer */}
                  {isExpanded && (
                    <tr className="bg-slate-50 font-sans border-b border-slate-200">
                      <td colSpan={hasSpouse ? 15 : 14} className="p-4">
                        <div className="text-xs space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <span className="font-bold text-slate-800">
                              Year {y.calYear} ({primaryName}: Age {y.age.toFixed(1)}
                              {hasSpouse && y.spouseAge !== undefined ? ` • ${spouseName}: Age ${y.spouseAge.toFixed(1)}` : ''}) — Detailed Account Liquidation Cascade
                            </span>
                            <span className="text-slate-500">
                              Taxable Income Target: {formatCurrency(y.taxTarget / deflator)} &bull; Non-Taxable Target: {formatCurrency(y.nonTaxTarget / deflator)}
                            </span>
                          </div>

                          {/* Decoupled Expenses and RMD Surplus Banner */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Decoupled Expenses</span>
                              <div className="text-xs text-slate-700 mt-0.5 space-y-0.5">
                                <div>General Living: <span className="font-semibold text-slate-900">{formatCurrency((y.generalExpenses || 0) / deflator)}</span></div>
                                <div>Healthcare: <span className="font-semibold text-purple-700">{formatCurrency((y.medicalExpenses || 0) / deflator)}</span> {y.isMedicareActive ? '(Medicare Active)' : '(Pre-Medicare)'}</div>
                              </div>
                            </div>

                            {y.isSynchronizedTdActive && y.tdWithdrawalByOwner && (
                              <div className="bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200">
                                <span className="text-[10px] uppercase font-bold text-emerald-800 block">Synchronized Pre-Tax Drawdown</span>
                                <div className="text-xs text-emerald-900 mt-0.5 space-y-0.5">
                                  <div className="font-semibold text-emerald-950">Pre-tax accounts drawing in tandem:</div>
                                  <div className="flex items-center gap-2">
                                    <span>{primaryName}: <strong>{formatCurrency(y.tdWithdrawalByOwner.primary / deflator)}</strong></span>
                                    <span>•</span>
                                    <span>{spouseName}: <strong>{formatCurrency(y.tdWithdrawalByOwner.spouse / deflator)}</strong></span>
                                  </div>
                                  <div className="text-[10px] text-emerald-700">Early depletion slashes future RMD exposure.</div>
                                </div>
                              </div>
                            )}

                            {y.rmdTotal !== undefined && y.rmdTotal > 0 && (
                              <div className="bg-amber-50/70 p-2.5 rounded-lg border border-amber-200">
                                <span className="text-[10px] uppercase font-bold text-amber-800 block">IRS SECURE 2.0 RMD (Age 73+)</span>
                                <div className="text-xs text-amber-900 mt-0.5 space-y-0.5">
                                  <div>Mandated RMD: <span className="font-bold">{formatCurrency(y.rmdTotal / deflator)}</span> (Divisor: {y.rmdDivisor})</div>
                                  {y.rmdSurplusGross !== undefined && y.rmdSurplusGross > 0 ? (
                                    <div className="text-emerald-700 font-medium">
                                      Surplus {formatCurrency(y.rmdSurplusGross / deflator)} → <span className="font-bold">{formatCurrency((y.rmdSurplusReinvested || 0) / deflator)}</span> net redirected to Brokerage
                                    </div>
                                  ) : (
                                    <div className="text-slate-500 text-[10px]">Fully absorbed by living expense withdrawals</div>
                                  )}
                                </div>
                              </div>
                            )}

                            {y.rothConvertedAmount !== undefined && y.rothConvertedAmount > 0 && (
                              <div className="bg-purple-50/70 p-2.5 rounded-lg border border-purple-200">
                                <span className="text-[10px] uppercase font-bold text-purple-800 block">Roth Conversion Strategy</span>
                                <div className="text-xs text-purple-900 mt-0.5 space-y-0.5">
                                  <div>Converted to Roth: <span className="font-bold">{formatCurrency(y.rothConvertedAmount / deflator)}</span></div>
                                  <div>Conversion Tax: <span className="font-semibold text-rose-600">{formatCurrency((y.rothConversionTax || 0) / deflator)}</span></div>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Depleting Assets breakdown */}
                            <div className="bg-white p-3 rounded-lg border border-slate-200">
                              <h4 className="font-semibold text-slate-800 mb-2">
                                Depleting Accounts (Liquidation Priority)
                              </h4>
                              <div className="space-y-1.5">
                                {config.sources
                                  .filter(s => s.monthly === 'N')
                                  .sort((a, b) => a.priority - b.priority)
                                  .map(s => {
                                    const beg = (y.beginBalanceBySource[s.id] || 0) / deflator;
                                    const wd = (y.withdrawalsBySource[s.id] || 0) / deflator;
                                    const end = (y.endBalanceBySource[s.id] || 0) / deflator;
                                    const owner = s.owner || 'primary';
                                    const isAccessible = isSourceAccessible(s, y.age, y.spouseAge, config.milestones, hasSpouse);
                                    const penaltyFreeAge = getSourcePenaltyFreeAge(s, config.milestones, owner === 'spouse');

                                    return (
                                      <div
                                        key={s.id}
                                        className="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 last:border-0"
                                      >
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[9px]">
                                            {s.priority}
                                          </span>
                                          <span className="font-medium text-slate-800">{s.name}</span>
                                          {hasSpouse && (
                                            <span className={`text-[9px] px-1 py-0.2 rounded font-medium ${
                                              owner === 'spouse' ? 'bg-purple-50 text-purple-700' :
                                              owner === 'joint' ? 'bg-indigo-50 text-indigo-700' :
                                              'bg-blue-50 text-blue-700'
                                            }`}>
                                              {owner === 'spouse' ? spouseName : owner === 'joint' ? 'Joint' : primaryName}
                                            </span>
                                          )}
                                          {!isAccessible ? (
                                            <span className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded">
                                              Locked (penalty-free at age {penaltyFreeAge})
                                            </span>
                                          ) : (
                                            (s.taxType === 'Income' || s.accountType === '401k' || s.accountType === 'ira') && (
                                              <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1 rounded font-medium">
                                                Eligible (age {penaltyFreeAge}+)
                                              </span>
                                            )
                                          )}
                                        </div>
                                        <div className="font-mono text-right space-x-2">
                                          <span className="text-slate-500">Beg: {formatCurrency(beg)}</span>
                                          <span className={wd > 0 ? 'text-indigo-600 font-bold' : 'text-slate-400'}>
                                            W/D: {wd > 0 ? formatCurrency(wd) : '$0'}
                                          </span>
                                          <span className="text-slate-800 font-medium">End: {formatCurrency(end)}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>

                            {/* Guaranteed Cashflows */}
                            <div className="bg-white p-3 rounded-lg border border-slate-200">
                              <h4 className="font-semibold text-slate-800 mb-2">
                                Guaranteed Cash Flow Streams (Non-depleting)
                              </h4>
                              <div className="space-y-1.5">
                                {config.sources
                                  .filter(s => s.monthly === 'Y')
                                  .map(s => {
                                    const rawPayment = y.guaranteedBySource[s.id] || 0;
                                    const payment = rawPayment / deflator;
                                    const isActive = payment > 0;
                                    const owner = s.owner || 'primary';

                                    return (
                                      <div
                                        key={s.id}
                                        className="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 last:border-0"
                                      >
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-medium text-slate-800">{s.name}</span>
                                          {hasSpouse && (
                                            <span className={`text-[9px] px-1 py-0.2 rounded font-medium ${
                                              owner === 'spouse' ? 'bg-purple-50 text-purple-700' :
                                              owner === 'joint' ? 'bg-indigo-50 text-indigo-700' :
                                              'bg-blue-50 text-blue-700'
                                            }`}>
                                              {owner === 'spouse' ? spouseName : owner === 'joint' ? 'Joint' : primaryName}
                                            </span>
                                          )}
                                          <span className="text-slate-400 text-[10px]">
                                            ({s.taxType}, starts {s.startAge})
                                          </span>
                                        </div>
                                        <div className="font-mono text-right">
                                          <span className={isActive ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                                            {isActive ? `${formatCurrency(payment)}/yr` : 'Inactive'}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                              {y.salary > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1 text-[11px]">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-slate-800">
                                      Total Active Work Salary
                                    </span>
                                    <span className="font-mono font-bold text-amber-700">
                                      {formatCurrency(y.salary / deflator)}
                                    </span>
                                  </div>
                                  {hasSpouse && (
                                    <div className="text-[10px] text-slate-500 flex justify-between">
                                      <span>
                                        {primaryName}: {formatCurrency((y.primarySalary || 0) / deflator)} | {spouseName}: {formatCurrency((y.spouseSalary || 0) / deflator)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
