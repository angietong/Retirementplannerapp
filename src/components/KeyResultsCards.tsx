import React from 'react';
import { ShieldAlert, ShieldCheck, Clock, Wallet, ReceiptText, TrendingUp } from 'lucide-react';
import { PlanSummary, PlannerConfig } from '../types';

interface KeyResultsCardsProps {
  summary: PlanSummary;
  config: PlannerConfig;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const KeyResultsCards: React.FC<KeyResultsCardsProps> = ({ summary, config }) => {
  const isSustained = summary.fundsRunOutYear === null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Sustainability / Depletion Status */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Fund Depletion</span>
          {isSustained ? (
            <span className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </span>
          ) : (
            <span className="p-1.5 rounded-md bg-amber-50 text-amber-600">
              <ShieldAlert className="w-5 h-5" />
            </span>
          )}
        </div>
        <div>
          <div className={`text-2xl font-bold ${isSustained ? 'text-emerald-700' : 'text-amber-700'}`}>
            {isSustained ? 'Not Depleted' : `Year ${summary.fundsRunOutYear}`}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isSustained
              ? `Portfolio sustains through age ${config.scenario.lifeExpAge}+`
              : `Funds run out during the ${summary.yearsFundingLasts}th year`}
          </p>
        </div>
      </div>

      {/* Years Funding Lasts */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Years Funding Lasts</span>
          <span className="p-1.5 rounded-md bg-sky-50 text-sky-600">
            <Clock className="w-5 h-5" />
          </span>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900">
            {summary.yearsFundingLasts} Years
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Across {config.projectionYears}-year simulated retirement horizon
          </p>
        </div>
      </div>

      {/* Starting Combined Balance */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Starting Portfolio</span>
          <span className="p-1.5 rounded-md bg-indigo-50 text-indigo-600">
            <Wallet className="w-5 h-5" />
          </span>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900">
            {formatCurrency(summary.startingCombinedBalance)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Sum of all initial depleting asset accounts
          </p>
        </div>
      </div>

      {/* Lifetime Tax Liability */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Est. Lifetime Taxes</span>
          <span className="p-1.5 rounded-md bg-purple-50 text-purple-600">
            <ReceiptText className="w-5 h-5" />
          </span>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900">
            {formatCurrency(summary.totalTaxesPaid)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Federal, state, and capital gains projections
          </p>
        </div>
      </div>
    </div>
  );
};
