import React from 'react';
import { Download, Menu, FolderOpen } from 'lucide-react';
import { PlannerConfig } from '../types';
import { NavSection } from './Sidebar';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  config: PlannerConfig;
  activeSection: NavSection;
  activeScenarioName: string | null;
  onOpenMobileMenu: () => void;
  onOpenScenarios: () => void;
  onExport: () => void;
}

const SECTION_META: Record<NavSection, { group: string; title: string }> = {
  overview: { group: 'Analyze', title: 'Retirement Overview' },
  charts: { group: 'Analyze', title: 'Charts & Monte Carlo' },
  table: { group: 'Analyze', title: 'Year-by-Year Ledger' },
  roth: { group: 'Optimize', title: 'Roth Conversions' },
  aca: { group: 'Optimize', title: 'ACA Subsidy Bridge' },
  whatif: { group: 'Optimize', title: 'What-If Optimization Lab' },
  'inputs-sources': { group: 'Configure', title: 'Accounts & Income Sources' },
  'inputs-scenario': { group: 'Configure', title: 'Household & Milestones' },
  'inputs-expenses': { group: 'Configure', title: 'Expenses & Major Events' },
  'inputs-rates': { group: 'Configure', title: 'Rates & Tax Assumptions' },
};

export const Header: React.FC<HeaderProps> = ({
  config,
  activeSection,
  activeScenarioName,
  onOpenMobileMenu,
  onOpenScenarios,
  onExport,
}) => {
  const meta = SECTION_META[activeSection];
  const householdLabel = config.scenario?.hasSpouse && config.scenario?.spouseName
    ? `${config.scenario.userName || 'Primary'} & ${config.scenario.spouseName}`
    : config.scenario?.userName || 'Primary';

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
      {/* Left: Mobile drawer trigger + contextual breadcrumb & household metadata */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 min-w-[40px] min-h-[40px] -ml-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
            <span className="hidden sm:inline text-slate-400 font-medium">{meta.group}</span>
            <span className="hidden sm:inline text-slate-300 font-normal">/</span>
            <h1 className="truncate">{meta.title}</h1>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
            <span className="font-medium text-slate-700 truncate">{householdLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">Retire {config.scenario?.retDate || '2030-07-01'}</span>
            {activeScenarioName && (
              <>
                <span aria-hidden="true" className="hidden md:inline">·</span>
                <span className="hidden md:inline text-emerald-700 font-medium truncate">
                  {activeScenarioName}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Quiet secondary utilities + 1 Primary Export CTA */}
      <div className="flex items-center gap-2 shrink-0">
        <PWAInstallButton />
        <button
          type="button"
          onClick={onOpenScenarios}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors whitespace-nowrap shrink-0"
        >
          <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
          Plans
        </button>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          title="Download Excel workbook (.xlsx)"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Excel</span>
        </button>
      </div>
    </header>
  );
};
