import React from 'react';
import { Users } from 'lucide-react';
import { PlannerConfig, ScenarioParams, MilestoneAges } from '../../types';
import { NumericInput } from '../NumericInput';

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
      {/* Household Mode Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Household Structure</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Model a 2-person household with separate birth dates, retirement timelines, salaries, and account ownership.
          </p>
        </div>

        <label className="inline-flex items-center gap-3 cursor-pointer select-none px-4 py-2 min-h-[42px] rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 transition-colors shrink-0">
          <input
            type="checkbox"
            checked={hasSpouse}
            onChange={e => onUpdateScenario('hasSpouse', e.target.checked)}
            className="sr-only peer"
          />
          <div className="relative w-10 h-6 bg-slate-300 rounded-full peer peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4" />
          <span className="text-xs font-semibold text-slate-900 whitespace-nowrap">
            {hasSpouse ? '2-Person Household' : 'Individual Plan'}
          </span>
        </label>
      </div>

      {/* Primary & Spouse Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Primary Member ({primaryName})</h3>
            <p className="text-xs text-slate-500 mt-0.5">Core retirement horizon and pre-retirement salary</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
            <input
              type="text"
              value={config.scenario.userName}
              onChange={e => onUpdateScenario('userName', e.target.value)}
              className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Birth Date</label>
              <input
                type="date"
                value={config.scenario.birthDate}
                onChange={e => onUpdateScenario('birthDate', e.target.value)}
                className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Target Retirement Date</label>
              <input
                type="date"
                value={config.scenario.retDate}
                onChange={e => onUpdateScenario('retDate', e.target.value)}
                className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pre-Retirement Salary</label>
              <NumericInput
                prefix="$"
                formatWithCommas
                min={0}
                fallbackValue={0}
                value={config.scenario.retSalary}
                onChange={val => onUpdateScenario('retSalary', val)}
                className="w-full min-h-[40px] border border-slate-300 rounded-lg pr-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Life Expectancy</label>
              <NumericInput
                suffix="yrs"
                min={50}
                max={120}
                integer
                fallbackValue={90}
                value={config.scenario.lifeExpAge}
                onChange={val => onUpdateScenario('lifeExpAge', val)}
                className="w-full min-h-[40px] border border-slate-300 rounded-lg pl-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Taxable Income Share of Withdrawals
            </label>
            <NumericInput
              suffix="%"
              step={5}
              min={0}
              max={100}
              displayScale={100}
              fallbackValue={0.7}
              value={config.scenario.taxablePct}
              onChange={val => onUpdateScenario('taxablePct', val)}
              className="w-full min-h-[40px] border border-slate-300 rounded-lg pl-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              Target proportion of withdrawals drawn from ordinary-income accounts vs. capital gains / tax-free.
            </p>
          </div>
        </div>

        {/* Spouse Card */}
        {hasSpouse ? (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Spouse / Partner ({spouseName})</h3>
              <p className="text-xs text-slate-500 mt-0.5">Individual retirement date, salary, and longevity target</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Spouse Name</label>
              <input
                type="text"
                value={config.scenario.spouseName || ''}
                onChange={e => onUpdateScenario('spouseName', e.target.value)}
                placeholder="e.g. Jane Doe"
                className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Spouse Birth Date</label>
                <input
                  type="date"
                  value={config.scenario.spouseBirthDate || ''}
                  onChange={e => onUpdateScenario('spouseBirthDate', e.target.value)}
                  className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Spouse Retirement Date</label>
                <input
                  type="date"
                  value={config.scenario.spouseRetDate || ''}
                  onChange={e => onUpdateScenario('spouseRetDate', e.target.value)}
                  className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Spouse Salary</label>
                <NumericInput
                  prefix="$"
                  formatWithCommas
                  min={0}
                  fallbackValue={0}
                  value={config.scenario.spouseRetSalary || 0}
                  onChange={val => onUpdateScenario('spouseRetSalary', val)}
                  className="w-full min-h-[40px] border border-slate-300 rounded-lg pr-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Spouse Life Expectancy</label>
                <NumericInput
                  suffix="yrs"
                  min={50}
                  max={120}
                  integer
                  fallbackValue={92}
                  value={config.scenario.spouseLifeExpAge || 92}
                  onChange={val => onUpdateScenario('spouseLifeExpAge', val)}
                  className="w-full min-h-[40px] border border-slate-300 rounded-lg pl-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <p className="text-xs text-slate-500 pt-1 leading-relaxed">
              Spouse-owned accounts unlock according to {spouseName}&apos;s milestone ages, and household sustainability is evaluated through both life expectancies.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 flex flex-col items-center justify-center text-center">
            <Users className="w-8 h-8 text-slate-400 mb-2" />
            <h4 className="text-sm font-semibold text-slate-800">Single-Person Plan Active</h4>
            <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
              Enable 2-Person Household above to model a spouse&apos;s separate retirement date, Social Security, and accounts.
            </p>
            <button
              type="button"
              onClick={() => onUpdateScenario('hasSpouse', true)}
              className="mt-4 px-4 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Add Spouse / Partner
            </button>
          </div>
        )}
      </div>

      {/* Milestone Ages & Statutory Rules */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Milestone Ages &amp; Distribution Rules</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Controls penalty-free retirement account access, Medicare transition, and mandatory RMD start ages.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-slate-600 mb-3">{primaryName}&apos;s Account Access Ages</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">401(k) / Rule of 55 Age</label>
              <NumericInput
                suffix="yrs"
                step={0.5}
                min={30}
                max={90}
                fallbackValue={55}
                value={config.milestones.four01kAge ?? config.milestones.retireAcctAge ?? 55}
                onChange={val => onUpdateMilestone('four01kAge', val)}
                className="w-full min-h-[40px] border border-slate-300 rounded-lg pl-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">IRA / Roth Access Age</label>
              <NumericInput
                suffix="yrs"
                step={0.5}
                min={30}
                max={90}
                fallbackValue={60}
                value={config.milestones.iraAge ?? config.milestones.retireAcctAge ?? 60}
                onChange={val => onUpdateMilestone('iraAge', val)}
                className="w-full min-h-[40px] border border-slate-300 rounded-lg pl-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Social Security Start Age</label>
              <NumericInput
                suffix="yrs"
                min={50}
                max={75}
                integer
                fallbackValue={62}
                value={config.milestones.ssMinAge}
                onChange={val => onUpdateMilestone('ssMinAge', val)}
                className="w-full min-h-[40px] border border-slate-300 rounded-lg pl-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {hasSpouse && (
          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-600 mb-3">{spouseName}&apos;s Account Access Ages</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Spouse 401(k) Age</label>
                <NumericInput
                  suffix="yrs"
                  step={0.5}
                  min={30}
                  max={90}
                  fallbackValue={55}
                  value={config.milestones.spouseFour01kAge ?? config.milestones.four01kAge ?? 55}
                  onChange={val => onUpdateMilestone('spouseFour01kAge', val)}
                  className="w-full min-h-[40px] border border-slate-300 rounded-lg pl-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Spouse IRA / Roth Age</label>
                <NumericInput
                  suffix="yrs"
                  step={0.5}
                  min={30}
                  max={90}
                  fallbackValue={60}
                  value={config.milestones.spouseIraAge ?? config.milestones.iraAge ?? 60}
                  onChange={val => onUpdateMilestone('spouseIraAge', val)}
                  className="w-full min-h-[40px] border border-slate-300 rounded-lg pl-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Spouse Social Security Start Age</label>
                <NumericInput
                  suffix="yrs"
                  min={50}
                  max={75}
                  integer
                  fallbackValue={62}
                  value={config.milestones.spouseSsMinAge ?? config.milestones.ssMinAge ?? 62}
                  onChange={val => onUpdateMilestone('spouseSsMinAge', val)}
                  className="w-full min-h-[40px] border border-slate-300 rounded-lg pl-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100">
          <h4 className="text-xs font-semibold text-slate-600 mb-3">Statutory Milestones</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Medicare Start Age</label>
              <NumericInput
                suffix="yrs"
                min={50}
                max={80}
                integer
                fallbackValue={65}
                value={config.milestones.medicareAge}
                onChange={val => onUpdateMilestone('medicareAge', val)}
                className="w-full min-h-[40px] border border-slate-300 rounded-lg pl-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">IRS RMD Start Age (SECURE 2.0)</label>
              <NumericInput
                suffix="yrs"
                min={65}
                max={85}
                integer
                fallbackValue={73}
                value={config.milestones.rmdAge}
                onChange={val => onUpdateMilestone('rmdAge', val)}
                className="w-full min-h-[40px] border border-slate-300 rounded-lg pl-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Synchronized Tax-Deferred Drawdown */}
        <div className="pt-4 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="max-w-2xl">
              <h4 className="text-sm font-semibold text-slate-900">
                Synchronized Pre-Tax Early Depletion Strategy
              </h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Draws from eligible tax-deferred 401(k)/IRA accounts in tandem across household members once penalty-free, reducing future Age {config.milestones.rmdAge} RMD tax spikes.
              </p>
            </div>
            <label className="inline-flex items-center gap-2.5 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={config.taxDeferredStrategy?.enabled ?? true}
                onChange={e =>
                  onUpdateTaxDeferredStrategy({
                    enabled: e.target.checked,
                    method: config.taxDeferredStrategy?.method ?? 'proportional',
                  })
                }
                className="sr-only peer"
              />
              <div className="relative w-10 h-6 bg-slate-300 rounded-full peer peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4" />
              <span className="text-xs font-semibold text-slate-800">
                {(config.taxDeferredStrategy?.enabled ?? true) ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>

          {(config.taxDeferredStrategy?.enabled ?? true) && (
            <div className="mt-4 max-w-md">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Household Pre-Tax Allocation Method
              </label>
              <select
                value={config.taxDeferredStrategy?.method ?? 'proportional'}
                onChange={e =>
                  onUpdateTaxDeferredStrategy({
                    enabled: config.taxDeferredStrategy?.enabled ?? true,
                    method: e.target.value as 'proportional' | 'equal',
                  })
                }
                className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:border-emerald-600 focus:outline-none"
              >
                <option value="proportional">Proportional to Account Balances (Recommended)</option>
                <option value="equal">Equal 50 / 50 Split Between Spouses</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
