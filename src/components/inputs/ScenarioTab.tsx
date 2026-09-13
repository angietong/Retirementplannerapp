import React from 'react';
import { Users, User, Heart } from 'lucide-react';
import { PlannerConfig, ScenarioParams, MilestoneAges } from '../../types';

interface ScenarioTabProps {
  config: PlannerConfig;
  hasSpouse: boolean;
  primaryName: string;
  spouseName: string;
  onUpdateScenario: (key: keyof ScenarioParams, value: any) => void;
  onUpdateMilestone: (key: keyof MilestoneAges, value: number) => void;
  onUpdateTaxDeferredStrategy: (strategy: { enabled: boolean; method: 'proportional' | 'equal' }) => void;
}

export const ScenarioTab: React.FC<ScenarioTabProps> = ({
  config,
  hasSpouse,
  primaryName,
  spouseName,
  onUpdateScenario,
  onUpdateMilestone,
  onUpdateTaxDeferredStrategy,
}) => {
  return (
    <div className="space-y-6">
      {/* 2-Person Household Toggle Banner */}
      <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-indigo-950">2-Person Household Projection (With Spouse)</h4>
            <p className="text-xs text-indigo-700">
              Model both spouses with individual birth dates, retirement ages, salaries, and account ownership.
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={hasSpouse}
            onChange={e => onUpdateScenario('hasSpouse', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          <span className="ml-2 text-xs font-semibold text-slate-800">
            {hasSpouse ? 'Enabled' : 'Single Person'}
          </span>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Primary User Section */}
        <div className="space-y-4 p-4 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <User className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Primary Household Member ({primaryName})
            </h3>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              value={config.scenario.userName}
              onChange={e => onUpdateScenario('userName', e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Birth Date</label>
              <input
                type="date"
                value={config.scenario.birthDate}
                onChange={e => onUpdateScenario('birthDate', e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Target Retirement Date</label>
              <input
                type="date"
                value={config.scenario.retDate}
                onChange={e => onUpdateScenario('retDate', e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Retirement Salary ($)
              </label>
              <input
                type="number"
                value={config.scenario.retSalary}
                onChange={e => onUpdateScenario('retSalary', parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Life Expectancy Age</label>
              <input
                type="number"
                value={config.scenario.lifeExpAge}
                onChange={e => onUpdateScenario('lifeExpAge', parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Taxable Income % (Withdrawal Share)
            </label>
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={config.scenario.taxablePct}
              onChange={e => onUpdateScenario('taxablePct', parseFloat(e.target.value) || 0)}
              className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-0.5">
              Portion of asset withdrawals subject to ordinary income vs capital gains / tax-free.
            </p>
          </div>
        </div>

        {/* Spouse Section */}
        {hasSpouse ? (
          <div className="space-y-4 p-4 rounded-xl border border-indigo-200 bg-indigo-50/20">
            <div className="flex items-center gap-2 border-b border-indigo-200 pb-2">
              <Heart className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-indigo-950">
                Spouse Details ({spouseName})
              </h3>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Spouse Name</label>
              <input
                type="text"
                value={config.scenario.spouseName || ''}
                onChange={e => onUpdateScenario('spouseName', e.target.value)}
                placeholder="e.g. Jane Doe"
                className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500 bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Spouse Birth Date</label>
                <input
                  type="date"
                  value={config.scenario.spouseBirthDate || ''}
                  onChange={e => onUpdateScenario('spouseBirthDate', e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Spouse Retirement Date</label>
                <input
                  type="date"
                  value={config.scenario.spouseRetDate || ''}
                  onChange={e => onUpdateScenario('spouseRetDate', e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Spouse Salary ($)
                </label>
                <input
                  type="number"
                  value={config.scenario.spouseRetSalary || 0}
                  onChange={e => onUpdateScenario('spouseRetSalary', parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Spouse Life Expectancy</label>
                <input
                  type="number"
                  value={config.scenario.spouseLifeExpAge || 92}
                  onChange={e => onUpdateScenario('spouseLifeExpAge', parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500 bg-white"
                />
              </div>
            </div>

            <p className="text-[11px] text-indigo-700 mt-2 bg-indigo-50 p-2.5 rounded-lg">
              💡 When enabled, spouse accounts unlock at their specific start ages, and household sustainability protects both spouses through their life expectancies.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center">
            <Users className="w-10 h-10 text-slate-400 mb-2" />
            <h4 className="text-sm font-semibold text-slate-700">Single Person Plan</h4>
            <p className="text-xs text-slate-500 max-w-xs mt-1">
              Toggle &quot;2-Person Household&quot; above to add a spouse with separate retirement dates, incomes, and account accessibility.
            </p>
            <button
              onClick={() => onUpdateScenario('hasSpouse', true)}
              className="mt-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium transition-colors"
            >
              Enable Spouse Planning
            </button>
          </div>
        )}
      </div>

      {/* Milestone Ages */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
          Milestone Ages & Distribution Rules
        </h3>

        {/* Primary Milestones */}
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            {primaryName}&apos;s Milestones
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                401(k) / 403(b) Access Age (Rule of 55)
              </label>
              <input
                type="number"
                step="0.5"
                value={config.milestones.four01kAge ?? config.milestones.retireAcctAge ?? 55}
                onChange={e => onUpdateMilestone('four01kAge', parseFloat(e.target.value) || 55)}
                className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">Employer plan early withdrawal</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                IRA / Roth Access Age
              </label>
              <input
                type="number"
                step="0.5"
                value={config.milestones.iraAge ?? config.milestones.retireAcctAge ?? 60}
                onChange={e => onUpdateMilestone('iraAge', parseFloat(e.target.value) || 60)}
                className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">IRS penalty-free age (e.g. 59.5)</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Social Security Earliest Age
              </label>
              <input
                type="number"
                value={config.milestones.ssMinAge}
                onChange={e => onUpdateMilestone('ssMinAge', parseFloat(e.target.value) || 62)}
                className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">Earliest claim age (e.g. 62)</p>
            </div>
          </div>
        </div>

        {/* Spouse Milestones */}
        {hasSpouse && (
          <div className="pt-3 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              {spouseName}&apos;s Milestones
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Spouse 401(k) / 403(b) Access Age
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={config.milestones.spouseFour01kAge ?? config.milestones.four01kAge ?? 55}
                  onChange={e => onUpdateMilestone('spouseFour01kAge', parseFloat(e.target.value) || 55)}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Employer plan early withdrawal</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Spouse IRA / Roth Access Age
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={config.milestones.spouseIraAge ?? config.milestones.iraAge ?? 60}
                  onChange={e => onUpdateMilestone('spouseIraAge', parseFloat(e.target.value) || 60)}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">IRS penalty-free age (e.g. 59.5)</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Spouse Social Security Earliest Age
                </label>
                <input
                  type="number"
                  value={config.milestones.spouseSsMinAge ?? config.milestones.ssMinAge ?? 62}
                  onChange={e => onUpdateMilestone('spouseSsMinAge', parseFloat(e.target.value) || 62)}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Earliest claim age (e.g. 62)</p>
              </div>
            </div>
          </div>
        )}

        {/* Shared / Statutory Milestones */}
        <div className="pt-3 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            Shared Statutory Milestones
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Medicare Start Age
              </label>
              <input
                type="number"
                value={config.milestones.medicareAge}
                onChange={e => onUpdateMilestone('medicareAge', parseFloat(e.target.value) || 65)}
                className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">Standard: Age 65</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Required Minimum Dist. (RMD) Age
              </label>
              <input
                type="number"
                value={config.milestones.rmdAge}
                onChange={e => onUpdateMilestone('rmdAge', parseFloat(e.target.value) || 73)}
                className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">SECURE 2.0: Age 73</p>
            </div>
          </div>
        </div>

        {/* Tax-Deferred Drawdown & RMD Mitigation Strategy */}
        <div className="pt-4 border-t border-slate-200">
          <div className="bg-gradient-to-r from-emerald-50/70 to-teal-50/70 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">
                    ⚡
                  </span>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Tax-Deferred 401(k) / IRA Early Depletion Strategy
                  </h4>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Starts withdrawing from tax-deferred accounts as soon as each member becomes penalty-free eligible (Rule of 55 for 401(k), 59½/60 for IRA).
                  When the second member becomes eligible, withdrawals balance across both members&apos; pre-tax accounts to accelerate early depletion and slash future RMD tax spikes.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={config.taxDeferredStrategy?.enabled ?? true}
                  onChange={e => {
                    onUpdateTaxDeferredStrategy({
                      enabled: e.target.checked,
                      method: config.taxDeferredStrategy?.method ?? 'proportional',
                    });
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {(config.taxDeferredStrategy?.enabled ?? true) && (
              <div className="mt-3 pt-3 border-t border-emerald-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Drawdown Allocation Method
                  </label>
                  <select
                    value={config.taxDeferredStrategy?.method ?? 'proportional'}
                    onChange={e => {
                      onUpdateTaxDeferredStrategy({
                        enabled: config.taxDeferredStrategy?.enabled ?? true,
                        method: e.target.value as 'proportional' | 'equal',
                      });
                    }}
                    className="w-full border border-emerald-200 rounded-md px-2.5 py-1.5 text-xs text-slate-900 bg-white focus:outline-emerald-500"
                  >
                    <option value="proportional">Proportional to Balances (Optimal for RMD Mitigation)</option>
                    <option value="equal">Equal 50 / 50 Split Between Spouses</option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Proportional drawdown smoothly drains both accounts in tandem relative to asset size.
                  </p>
                </div>

                <div className="bg-white/80 p-2.5 rounded border border-emerald-100 text-[11px] text-slate-700 space-y-1">
                  <span className="font-semibold text-emerald-900 block">Dynamic Transition Workflow:</span>
                  <div>1. Prior to second member eligibility: First member supplies 100% of required pre-tax living withdrawals.</div>
                  <div>2. Upon second member turning eligible (e.g. age 60): Second member begins withdrawals, automatically lowering first member&apos;s withdrawals.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
