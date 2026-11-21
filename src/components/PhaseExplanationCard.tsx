import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { PlannerConfig } from '../types';
import { formatCurrency } from '../utils/formatters';

interface PhaseExplanationCardProps {
  config: PlannerConfig;
}

interface TimelineMilestone {
  id: string;
  phase: string;
  title: string;
  ageLabel: string;
  year: number;
  detail: string;
  tone: 'emerald' | 'slate' | 'amber';
}

export const PhaseExplanationCard: React.FC<PhaseExplanationCardProps> = ({ config }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const milestones = useMemo<TimelineMilestone[]>(() => {
    const birthYear = parseInt((config.scenario.birthDate || '1970-06-15').split('-')[0], 10) || 1970;
    const retYear = parseInt((config.scenario.retDate || '2030-07-01').split('-')[0], 10) || 2030;
    const retAge = Math.max(40, retYear - birthYear);
    const four01kAge = config.milestones.four01kAge ?? config.milestones.retireAcctAge ?? 55;
    const iraAge = config.milestones.iraAge ?? config.milestones.retireAcctAge ?? 60;
    const ssAge = config.milestones.ssMinAge ?? 62;
    const medicareAge = config.milestones.medicareAge ?? 65;
    const rmdAge = config.milestones.rmdAge ?? 73;

    const primaryName = (config.scenario.userName || 'Primary').split(' ')[0];
    const items: TimelineMilestone[] = [
      {
        id: 'retire',
        phase: 'Phase 0',
        title: `${primaryName} Retires`,
        ageLabel: `Age ${retAge}`,
        year: retYear,
        detail: `Target retirement on ${config.scenario.retDate}. Partial-year earned salary offsets expenses; remaining months draw from accessible accounts.`,
        tone: 'emerald',
      },
      {
        id: 'rule55',
        phase: 'Phase 2',
        title: '401(k) Access',
        ageLabel: `Age ${four01kAge}`,
        year: birthYear + Math.round(four01kAge),
        detail: `Employer 401(k) / 403(b) plans unlock penalty-free at age ${four01kAge} (Rule of 55 separation from service).`,
        tone: 'slate',
      },
      {
        id: 'ira',
        phase: 'Phase 3',
        title: 'IRA & Roth',
        ageLabel: `Age ${iraAge}`,
        year: birthYear + Math.round(iraAge),
        detail: `Traditional and Roth IRAs become accessible without early withdrawal penalties starting at age ${iraAge}.`,
        tone: 'slate',
      },
      {
        id: 'ss',
        phase: 'Phase 4',
        title: 'Social Security',
        ageLabel: `Age ${ssAge}+`,
        year: birthYear + Math.round(ssAge),
        detail: `Earliest Social Security eligibility begins at age ${ssAge}. Guaranteed income streams reduce portfolio drawdown pressure.`,
        tone: 'slate',
      },
      {
        id: 'medicare',
        phase: 'Phase 4',
        title: 'Medicare',
        ageLabel: `Age ${medicareAge}`,
        year: birthYear + Math.round(medicareAge),
        detail: `Healthcare transitions from pre-65 private / ACA marketplace coverage to Medicare Part B/D & Medigap at age ${medicareAge}.`,
        tone: 'emerald',
      },
      {
        id: 'rmd',
        phase: 'Phase 5',
        title: 'IRS RMDs',
        ageLabel: `Age ${rmdAge}`,
        year: birthYear + Math.round(rmdAge),
        detail: `Required Minimum Distributions begin at age ${rmdAge} on remaining pre-tax 401(k)/IRA balances. Surplus above expenses reinvests to brokerage.`,
        tone: 'amber',
      },
    ];

    return items.sort((a, b) => a.year - b.year);
  }, [config]);

  const majorExpenses = config.majorExpenses || [];
  const activeMilestone = milestones.find(m => m.id === selectedId) || null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Retirement Milestone Timeline</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select any milestone to inspect how withdrawal rules shift across your retirement horizon.
          </p>
        </div>
        {majorExpenses.length > 0 && (
          <div className="text-xs text-slate-500 tabular-nums">
            {majorExpenses.length} scheduled major {majorExpenses.length === 1 ? 'expense' : 'expenses'} ({formatCurrency(majorExpenses.reduce((s, m) => s + (m.amount || 0), 0))})
          </div>
        )}
      </div>

      {/* Horizontal Milestone Track */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {milestones.map(m => {
          const isSelected = selectedId === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedId(isSelected ? null : m.id)}
              aria-expanded={isSelected}
              className={`text-left p-3 rounded-lg border transition-colors min-h-[76px] flex flex-col justify-between ${
                isSelected
                  ? 'bg-emerald-50/70 border-emerald-500'
                  : 'bg-slate-50/60 border-slate-200/80 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 tabular-nums">
                <span className="font-semibold text-slate-700">{m.year}</span>
                <span>{m.ageLabel}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-1">
                <span
                  className={`text-xs font-semibold truncate ${
                    m.tone === 'emerald'
                      ? 'text-emerald-800'
                      : m.tone === 'amber'
                      ? 'text-amber-800'
                      : 'text-slate-900'
                  }`}
                >
                  {m.title}
                </span>
                {isSelected ? (
                  <ChevronUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Contextual Detail Strip */}
      {activeMilestone && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
          <div>
            <span className="font-semibold text-slate-900">
              {activeMilestone.phase} · {activeMilestone.title} ({activeMilestone.year}, {activeMilestone.ageLabel}):
            </span>{' '}
            {activeMilestone.detail}
          </div>
        </div>
      )}
    </div>
  );
};
