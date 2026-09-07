import React from 'react';
import { CalendarClock, Milestone, ShieldCheck, HeartPulse, Scale } from 'lucide-react';
import { PlannerConfig } from '../types';

interface PhaseExplanationCardProps {
  config: PlannerConfig;
}

export const PhaseExplanationCard: React.FC<PhaseExplanationCardProps> = ({ config }) => {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs mb-6">
      <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
        <Milestone className="w-4 h-4 text-emerald-600" />
        Retirement Phase System & Milestones
      </h3>
      <p className="text-xs text-slate-500 mb-3">
        The simulation dynamically segments your retirement timeline into distinct phases as milestone ages unlock new cash flows or legal distribution rules:
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 font-bold text-amber-800 mb-1">
            <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
            Phase 0: Retirement Year
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Target retirement: <span className="font-semibold">{config.scenario.retDate}</span>
            {config.scenario.hasSpouse && config.scenario.spouseRetDate ? (
              <span> (Spouse: <span className="font-semibold">{config.scenario.spouseRetDate}</span>)</span>
            ) : null}
            . Partial salary is earned, with remaining months covered via withdrawals.
          </p>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 font-bold text-blue-800 mb-1">
            <Milestone className="w-3.5 h-3.5 text-blue-600" />
            Phase 1: Pre-Milestones
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            First full retirement year until age {config.milestones.retireAcctAge}. Taps accessible accounts (like taxable brokerage or savings) before penalty-free 401k access.
          </p>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 font-bold text-emerald-800 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Phase 2: 401k/IRA Access
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Unlocks at age <span className="font-semibold">{config.milestones.retireAcctAge}</span>. Tax-deferred accounts can be tapped penalty-free in priority order.
          </p>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 font-bold text-sky-800 mb-1">
            <HeartPulse className="w-3.5 h-3.5 text-sky-600" />
            Phase 3: Medicare & SS
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Social Security at age <span className="font-semibold">{config.milestones.ssMinAge}</span> and Medicare at <span className="font-semibold">{config.milestones.medicareAge}</span>. Guaranteed income reduces portfolio withdrawal pressure.
          </p>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 font-bold text-purple-800 mb-1">
            <Scale className="w-3.5 h-3.5 text-purple-600" />
            Phase 4+: RMD Age
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Begins at age <span className="font-semibold">{config.milestones.rmdAge}</span>. Required minimum distributions commence for tax-deferred accounts.
          </p>
        </div>
      </div>
    </div>
  );
};
