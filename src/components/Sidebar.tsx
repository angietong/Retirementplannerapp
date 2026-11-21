import React from 'react';
import {
  LayoutDashboard,
  LineChart,
  TableProperties,
  RefreshCw,
  HeartPulse,
  GitCompare,
  Wallet,
  Users,
  Receipt,
  Percent,
  RotateCcw,
  ShieldCheck,
  Lock,
  FilePlus2,
  FolderOpen,
  X,
} from 'lucide-react';
import { PlannerConfig } from '../types';

export type NavSection =
  | 'overview'
  | 'charts'
  | 'table'
  | 'roth'
  | 'aca'
  | 'whatif'
  | 'inputs-sources'
  | 'inputs-scenario'
  | 'inputs-expenses'
  | 'inputs-rates';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  config: PlannerConfig;
  savedCount: number;
  activePlanName: string | null;
  isVaultUnlocked: boolean;
  vaultFileName: string | null;
  hasUnsavedChanges: boolean;
  onNewPlan: () => void;
  onOpenPlan: () => void;
  onOpenVault: () => void;
  onReset: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavGroup {
  label: string;
  items: {
    id: NavSection;
    label: string;
    icon: React.FC<{ className?: string }>;
    meta?: string;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  config,
  savedCount,
  activePlanName,
  isVaultUnlocked,
  vaultFileName,
  hasUnsavedChanges,
  onNewPlan,
  onOpenPlan,
  onOpenVault,
  onReset,
  mobileOpen,
  onCloseMobile,
}) => {
  const navGroups: NavGroup[] = [
    {
      label: 'Analyze',
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'charts', label: 'Charts & Monte Carlo', icon: LineChart },
        { id: 'table', label: 'Year-by-Year Ledger', icon: TableProperties },
      ],
    },
    {
      label: 'Optimize',
      items: [
        {
          id: 'roth',
          label: 'Roth Conversions',
          icon: RefreshCw,
          meta: config.rothConversion?.enabled ? 'On' : undefined,
        },
        {
          id: 'aca',
          label: 'ACA Subsidy Bridge',
          icon: HeartPulse,
          meta: config.acaOptimization?.enabled ? 'On' : undefined,
        },
        { id: 'whatif', label: 'What-If Lab', icon: GitCompare },
      ],
    },
    {
      label: 'Configure',
      items: [
        {
          id: 'inputs-sources',
          label: 'Accounts & Income',
          icon: Wallet,
          meta: String(config.sources.length),
        },
        { id: 'inputs-scenario', label: 'Household & Milestones', icon: Users },
        {
          id: 'inputs-expenses',
          label: 'Expenses & Events',
          icon: Receipt,
          meta: (config.majorExpenses?.length || 0) > 0 ? `+${config.majorExpenses?.length}` : undefined,
        },
        { id: 'inputs-rates', label: 'Rates & Taxes', icon: Percent },
      ],
    },
  ];

  const handleSelect = (id: NavSection) => {
    onSelectSection(id);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 select-none">
      {/* Brand Lockup */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 shrink-0">
        <button
          type="button"
          onClick={() => handleSelect('overview')}
          className="flex items-center gap-2.5 text-left focus-visible:outline-emerald-600 rounded-md"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm tracking-tight shrink-0">
            RP
          </div>
          <span className="text-[15px] font-bold text-slate-900 tracking-tight whitespace-nowrap">
            RetirePlan
          </span>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          className="lg:hidden p-2 min-w-[40px] min-h-[40px] text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Groups */}
      <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navGroups.map(group => (
          <div key={group.label}>
            <div className="px-3 mb-2 text-xs font-semibold text-slate-400 tracking-wide">
              {group.label}
            </div>
            <ul className="space-y-1">
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 min-h-[40px] rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-800 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-emerald-600' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.meta && (
                        <span
                          className={`text-xs tabular-nums shrink-0 ${
                            item.meta === 'On'
                              ? 'text-emerald-700 font-semibold'
                              : isActive
                              ? 'text-emerald-700'
                              : 'text-slate-400'
                          }`}
                        >
                          {item.meta}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Sidebar Utility Footer */}
      <div className="p-3 border-t border-slate-200 space-y-2 bg-slate-50/60 shrink-0">
        {/* Active Plan / Vault Card */}
        <button
          type="button"
          onClick={() => {
            onCloseMobile();
            onOpenVault();
          }}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 min-h-[42px] rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:border-emerald-300 transition-colors text-left"
        >
          <span className="flex items-center gap-2 min-w-0">
            {isVaultUnlocked ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Lock className="w-4 h-4 text-slate-400 shrink-0" />
            )}
            <span className="min-w-0">
              <span className="block font-semibold text-slate-800 truncate">
                {activePlanName || (isVaultUnlocked ? vaultFileName : 'Unsaved Session')}
              </span>
              {vaultFileName && (
                <span className="block text-[11px] font-mono text-slate-400 truncate">
                  {vaultFileName}
                </span>
              )}
            </span>
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            {hasUnsavedChanges && (
              <span
                className="w-2 h-2 rounded-full bg-amber-500"
                title="Unsaved changes"
              />
            )}
            {savedCount > 0 && (
              <span className="text-xs text-slate-400 tabular-nums">{savedCount}</span>
            )}
          </span>
        </button>

        {/* Direct New Plan & Open Plan Actions */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => {
              onCloseMobile();
              onNewPlan();
            }}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 min-h-[36px] rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 transition-colors"
          >
            <FilePlus2 className="w-3.5 h-3.5 shrink-0" />
            <span>New Plan</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onCloseMobile();
              onOpenPlan();
            }}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 min-h-[36px] rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Open Plan</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onCloseMobile();
            onReset();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-medium text-slate-500 hover:text-rose-700 hover:bg-rose-50/70 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
          Reset to Baseline
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen z-30">
        {sidebarContent}
      </aside>

      {/* Mobile / iPad slide-over drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
