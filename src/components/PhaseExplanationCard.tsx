import React from 'react';
import { CalendarClock, Milestone, ShieldCheck, HeartPulse, Scale } from 'lucide-react';
import { PlannerConfig } from '../types';

interface PhaseExplanationCardProps {
  config: PlannerConfig;
}

export const PhaseExplanationCard: React.FC<PhaseExplanationCardProps> = ({ config }) => {
  const four01kAge = config.milestones.four01kAge ?? config.milestones.retireAcctAge ?? 55;
  const iraAge = config.milestones.iraAge ?? config.milestones.retireAcctAge ?? 60;

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs mb-6">
      <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
        <Milestone className="w-4 h-4 text-emerald-600" />
        Retirement Phase System & Milestones
      </h3>
      <p className="text-xs text-slate-500 mb-3">
        The simulation dynamically segments your retirement timeline into distinct phases as milestone ages unlock new cash flows or legal distribution rules:
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 font-bold text-amber-800 mb-1">
            <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
            Phase 0: Retirement Year
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Target retirement: <span className="font-semibold">{config.scenario.retDate}</span>. Partial salary earned, remaining months covered via cash/brokerage.
          </p>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 font-bold text-blue-800 mb-1">
            <Milestone className="w-3.5 h-3.5 text-blue-600" />
            Phase 1: Pre-401k
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Retirement until age {four01kAge}. Taps accessible cash and taxable brokerage accounts first.
          </p>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 font-bold text-emerald-800 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Phase 2: 401(k) (Rule of 55)
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Unlocks at age <span className="font-semibold">{four01kAge}</span>. Employer plans (401k/403b) become penalty-free upon separation from service.
          </p>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 font-bold text-indigo-800 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            Phase 3: IRA Access
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Unlocks at age <span className="font-semibold">{iraAge}</span>. Traditional and Roth IRAs become accessible without early withdrawal penalties.
          </p>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 font-bold text-sky-800 mb-1">
            <HeartPulse className="w-3.5 h-3.5 text-sky-600" />
            Phase 4: Medicare & SS
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Social Security at age <span className="font-semibold">{config.milestones.ssMinAge}</span> and Medicare at <span className="font-semibold">{config.milestones.medicareAge}</span>.
          </p>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 font-bold text-purple-800 mb-1">
            <Scale className="w-3.5 h-3.5 text-purple-600" />
            Phase 5: RMD Age
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Begins at age <span className="font-semibold">{config.milestones.rmdAge}</span>. Required minimum distributions commence.
          </p>
        </div>
      </div>
    </div>
  );
};
