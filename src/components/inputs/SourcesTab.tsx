import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { PlannerConfig, IncomeSource, SourceOwner, TaxType } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { NumericInput } from '../NumericInput';

interface SourcesTabProps {
  config: PlannerConfig;
  hasSpouse: boolean;
  primaryName: string;
  spouseName: string;
  onAddSource: (monthly: 'N' | 'Y') => void;
  onRemoveSource: (id: string) => void;
  onUpdateSource: (id: string, updates: Partial<IncomeSource>) => void;
  onMoveDepletingPriority: (sourceId: string, direction: 'up' | 'down') => void;
}

export const SourcesTab: React.FC<SourcesTabProps> = ({
  config,
  hasSpouse,
  primaryName,
  spouseName,
  onAddSource,
  onRemoveSource,
  onUpdateSource,
  onMoveDepletingPriority,
}) => {
  const depletingSources = config.sources
    .filter(s => s.monthly === 'N')
    .sort((a, b) => a.priority - b.priority);

  const guaranteedSources = config.sources
    .filter(s => s.monthly === 'Y')
    .sort((a, b) => a.startAge - b.startAge);

  const totalPortfolio = depletingSources.reduce((sum, s) => sum + (s.balance || 0), 0);
  const totalGuaranteedAnnual = guaranteedSources.reduce((sum, s) => sum + (s.annualPayment || 0), 0);
  const atLimit = config.sources.length >= 20;

  const handleCategoryChange = (source: IncomeSource, nextCategory: NonNullable<IncomeSource['accountType']>) => {
    let suggestedTax: TaxType = source.taxType;
    if (nextCategory === '401k' || nextCategory === 'ira') suggestedTax = 'Income';
    else if (nextCategory === 'brokerage') suggestedTax = 'Capital Gain';
    else if (nextCategory === 'roth' || nextCategory === 'cash') suggestedTax = 'N/a';

    onUpdateSource(source.id, {
      accountType: nextCategory,
      taxType: suggestedTax,
    });
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Depleting Portfolio Accounts */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900">
                Depleting Portfolio Accounts ({depletingSources.length})
              </h3>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-semibold text-emerald-700 font-mono tabular-nums">
                {formatCurrency(totalPortfolio)} total
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Ordered by liquidation priority (top account is drawn first once eligible). Use arrows to reorder drawdown sequence.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onAddSource('N')}
            disabled={atLimit}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Portfolio Account
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                <th className="py-3 px-3 w-24">Priority</th>
                <th className="py-3 px-3 min-w-[180px]">Account Name</th>
                <th className="py-3 px-3 min-w-[140px]">Category</th>
                {hasSpouse && <th className="py-3 px-3 min-w-[120px]">Owner</th>}
                <th className="py-3 px-3 text-right min-w-[135px]">Starting Balance</th>
                <th className="py-3 px-3 min-w-[135px]">Tax Treatment</th>
                <th className="py-3 px-3 text-center w-24">Unlock Age</th>
                <th className="py-3 px-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {depletingSources.length === 0 ? (
                <tr>
                  <td colSpan={hasSpouse ? 8 : 7} className="py-8 text-center text-slate-500 text-sm">
                    No depleting portfolio accounts configured yet.
                  </td>
                </tr>
              ) : (
                depletingSources.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center font-mono font-semibold text-xs tabular-nums">
                          {idx + 1}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => onMoveDepletingPriority(s.id, 'up')}
                            aria-label={`Move ${s.name} up in priority`}
                            className="p-1.5 min-w-[30px] min-h-[30px] rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-25 flex items-center justify-center"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === depletingSources.length - 1}
                            onClick={() => onMoveDepletingPriority(s.id, 'down')}
                            aria-label={`Move ${s.name} down in priority`}
                            className="p-1.5 min-w-[30px] min-h-[30px] rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-25 flex items-center justify-center"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={s.name}
                        onChange={e => onUpdateSource(s.id, { name: e.target.value })}
                        className="w-full min-h-[38px] font-medium text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:outline-none rounded-lg px-2.5 py-1.5 text-[13px] bg-white"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={s.accountType || 'other'}
                        onChange={e => handleCategoryChange(s, e.target.value as NonNullable<IncomeSource['accountType']>)}
                        className="w-full min-h-[38px] border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:outline-none rounded-lg px-2.5 py-1.5 text-[13px] text-slate-800 bg-white"
                      >
                        <option value="401k">401(k) / 403(b)</option>
                        <option value="ira">Traditional IRA</option>
                        <option value="roth">Roth IRA / 401(k)</option>
                        <option value="brokerage">Taxable Brokerage</option>
                        <option value="cash">Cash / Savings</option>
                        <option value="other">Other Asset</option>
                      </select>
                    </td>
                    {hasSpouse && (
                      <td className="py-2.5 px-3">
                        <select
                          value={s.owner || 'primary'}
                          onChange={e => onUpdateSource(s.id, { owner: e.target.value as SourceOwner })}
                          className="w-full min-h-[38px] border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:outline-none rounded-lg px-2.5 py-1.5 text-[13px] text-slate-800 bg-white"
                        >
                          <option value="primary">{primaryName}</option>
                          <option value="spouse">{spouseName}</option>
                          <option value="joint">Joint</option>
                        </select>
                      </td>
                    )}
                    <td className="py-2.5 px-3">
                      <NumericInput
                        prefix="$"
                        formatWithCommas
                        min={0}
                        value={s.balance}
                        fallbackValue={0}
                        onChange={val => onUpdateSource(s.id, { balance: val })}
                        className="w-full min-h-[38px] text-right font-mono text-[13px] text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:outline-none rounded-lg pr-2.5 py-1.5 bg-white"
                        ariaLabel={`${s.name} balance`}
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={s.taxType}
                        onChange={e => onUpdateSource(s.id, { taxType: e.target.value as TaxType })}
                        className="w-full min-h-[38px] border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:outline-none rounded-lg px-2.5 py-1.5 text-[13px] text-slate-800 bg-white"
                      >
                        <option value="Income">Ordinary Income</option>
                        <option value="Capital Gain">Capital Gain</option>
                        <option value="N/a">Tax-Free</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <NumericInput
                        min={0}
                        max={100}
                        step={0.5}
                        value={s.startAge}
                        fallbackValue={55}
                        onChange={val => onUpdateSource(s.id, { startAge: val })}
                        className="w-full min-h-[38px] text-center font-mono text-[13px] text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:outline-none rounded-lg px-2 py-1.5 bg-white"
                        ariaLabel={`${s.name} start age`}
                      />
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onRemoveSource(s.id)}
                        aria-label={`Remove ${s.name}`}
                        className="p-2 min-w-[36px] min-h-[36px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center justify-center mx-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Guaranteed Income Streams */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900">
                Guaranteed Income Streams ({guaranteedSources.length})
              </h3>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-semibold text-emerald-700 font-mono tabular-nums">
                {formatCurrency(totalGuaranteedAnnual)}/yr once all active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Non-depleting recurring income such as Social Security, Pensions, and Annuities.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onAddSource('Y')}
            disabled={atLimit}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 text-emerald-600" />
            Add Guaranteed Stream
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                <th className="py-3 px-4 min-w-[200px]">Stream Name</th>
                {hasSpouse && <th className="py-3 px-3 min-w-[120px]">Owner</th>}
                <th className="py-3 px-3 text-right min-w-[150px]">Annual Payment</th>
                <th className="py-3 px-3 min-w-[140px]">Tax Treatment</th>
                <th className="py-3 px-3 text-center w-24">Start Age</th>
                <th className="py-3 px-3 min-w-[180px]">Notes</th>
                <th className="py-3 px-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {guaranteedSources.length === 0 ? (
                <tr>
                  <td colSpan={hasSpouse ? 7 : 6} className="py-8 text-center text-slate-500 text-sm">
                    No guaranteed income streams added (e.g. Social Security or Pension).
                  </td>
                </tr>
              ) : (
                guaranteedSources.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4">
                      <input
                        type="text"
                        value={s.name}
                        onChange={e => onUpdateSource(s.id, { name: e.target.value })}
                        className="w-full min-h-[38px] font-medium text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:outline-none rounded-lg px-2.5 py-1.5 text-[13px] bg-white"
                      />
                    </td>
                    {hasSpouse && (
                      <td className="py-2.5 px-3">
                        <select
                          value={s.owner || 'primary'}
                          onChange={e => onUpdateSource(s.id, { owner: e.target.value as SourceOwner })}
                          className="w-full min-h-[38px] border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:outline-none rounded-lg px-2.5 py-1.5 text-[13px] text-slate-800 bg-white"
                        >
                          <option value="primary">{primaryName}</option>
                          <option value="spouse">{spouseName}</option>
                          <option value="joint">Joint</option>
                        </select>
                      </td>
                    )}
                    <td className="py-2.5 px-3">
                      <NumericInput
                        prefix="$"
                        suffix="/yr"
                        formatWithCommas
                        min={0}
                        value={s.annualPayment}
                        fallbackValue={0}
                        onChange={val => onUpdateSource(s.id, { annualPayment: val })}
                        className="w-full min-h-[38px] text-right font-mono text-[13px] text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:outline-none rounded-lg py-1.5 bg-white"
                        ariaLabel={`${s.name} annual payment`}
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={s.taxType}
                        onChange={e => onUpdateSource(s.id, { taxType: e.target.value as TaxType })}
                        className="w-full min-h-[38px] border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:outline-none rounded-lg px-2.5 py-1.5 text-[13px] text-slate-800 bg-white"
                      >
                        <option value="Income">Ordinary Income</option>
                        <option value="Capital Gain">Capital Gain</option>
                        <option value="N/a">Tax-Free</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <NumericInput
                        min={0}
                        max={100}
                        integer
                        value={s.startAge}
                        fallbackValue={65}
                        onChange={val => onUpdateSource(s.id, { startAge: val })}
                        className="w-full min-h-[38px] text-center font-mono text-[13px] text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:outline-none rounded-lg px-2 py-1.5 bg-white"
                        ariaLabel={`${s.name} start age`}
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={s.notes}
                        placeholder="Optional note"
                        onChange={e => onUpdateSource(s.id, { notes: e.target.value })}
                        className="w-full min-h-[38px] text-slate-600 border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:outline-none rounded-lg px-2.5 py-1.5 text-[13px] bg-white"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onRemoveSource(s.id)}
                        aria-label={`Remove ${s.name}`}
                        className="p-2 min-w-[36px] min-h-[36px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center justify-center mx-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
