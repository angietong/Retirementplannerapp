import React, { useState } from 'react';
import { ChevronDown, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { YearSimulationResult, PlannerConfig } from '../types';

interface PlanTableProps {
  years: YearSimulationResult[];
  config: PlannerConfig;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const PlanTable: React.FC<PlanTableProps> = ({ years, config }) => {
  const [expandedYear, setExpandedYear] = useState<number | null>(null);
  const [filterPhase, setFilterPhase] = useState<string>('all');

  const toggleExpand = (yr: number) => {
    setExpandedYear(expandedYear === yr ? null : yr);
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
          <h2 className="text-base font-bold text-slate-900">Year-by-Year Simulation Table</h2>
          <p className="text-xs text-slate-500">
            Interactive breakdown matching the Excel Plan worksheet formulas & priority cascade.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
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
              <th className="py-3 px-3">Age</th>
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
                      {y.salary > 0 ? formatCurrency(y.salary) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-700">
                      {y.guarTotal > 0 ? formatCurrency(y.guarTotal) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-indigo-700 font-medium">
                      {formatCurrency(y.wdTotal)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-900">
                      {formatCurrency(y.expenses)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600">
                      {formatCurrency(y.fedTax)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600">
                      {formatCurrency(y.stateTax)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600">
                      {formatCurrency(y.capGainTax)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                      {formatCurrency(y.totalTax)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-bold ${
                        y.combEndBal <= 0 ? 'text-red-600' : 'text-slate-900'
                      }`}
                    >
                      {formatCurrency(y.combEndBal)}
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
                      <td colSpan={14} className="p-4">
                        <div className="text-xs space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <span className="font-bold text-slate-800">
                              Year {y.calYear} (Age {y.age.toFixed(1)}) — Detailed Account Liquidation Cascade
                            </span>
                            <span className="text-slate-500">
                              Taxable Income Target: {formatCurrency(y.taxTarget)} &bull; Non-Taxable Target: {formatCurrency(y.nonTaxTarget)}
                            </span>
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
                                    const beg = y.beginBalanceBySource[s.id] || 0;
                                    const wd = y.withdrawalsBySource[s.id] || 0;
                                    const end = y.endBalanceBySource[s.id] || 0;
                                    const isAccessible = y.age >= (s.startAge || 0);

                                    return (
                                      <div
                                        key={s.id}
                                        className="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 last:border-0"
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[9px]">
                                            {s.priority}
                                          </span>
                                          <span className="font-medium text-slate-800">{s.name}</span>
                                          {!isAccessible && (
                                            <span className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded">
                                              Locked (starts at {s.startAge})
                                            </span>
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
                                    const payment = y.guaranteedBySource[s.id] || 0;
                                    const isActive = payment > 0;

                                    return (
                                      <div
                                        key={s.id}
                                        className="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 last:border-0"
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-medium text-slate-800">{s.name}</span>
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
                                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                  <span className="font-medium text-slate-800">
                                    Prorated Work Salary (Phase 0)
                                  </span>
                                  <span className="font-mono font-bold text-amber-700">
                                    {formatCurrency(y.salary)}
                                  </span>
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
