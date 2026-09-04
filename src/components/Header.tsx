import React from 'react';
import { Download, RotateCcw, ShieldCheck, Calendar, DollarSign, BarChart3, Sliders, TableProperties } from 'lucide-react';
import { PlannerConfig, PlanSummary } from '../types';

interface HeaderProps {
  config: PlannerConfig;
  summary: PlanSummary;
  activeTab: 'overview' | 'charts' | 'table' | 'inputs';
  setActiveTab: (tab: 'overview' | 'charts' | 'table' | 'inputs') => void;
  onReset: () => void;
  onExport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  summary,
  activeTab,
  setActiveTab,
  onReset,
  onExport,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                RP
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Retirement Financial Planner
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Plan for <span className="text-slate-800 font-semibold">{config.scenario.userName}</span> &bull; Target Retirement: {config.scenario.retDate}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              title="Reset parameters to original defaults"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Reset Defaults
            </button>
            <button
              onClick={onExport}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors shadow-xs"
              title="Download Excel spreadsheet matching the official model"
            >
              <Download className="w-3.5 h-3.5" />
              Export to Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-t border-slate-100 -mb-px space-x-6 overflow-x-auto text-sm">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-1 border-b-2 font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Dashboard & Depletion
          </button>
          <button
            onClick={() => setActiveTab('charts')}
            className={`py-3 px-1 border-b-2 font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'charts'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            All Charts (Income, Expenses, Assets)
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={`py-3 px-1 border-b-2 font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'table'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <TableProperties className="w-4 h-4" />
            Year-by-Year Simulation Table
          </button>
          <button
            onClick={() => setActiveTab('inputs')}
            className={`py-3 px-1 border-b-2 font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'inputs'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Edit Inputs & Income Sources ({config.sources.length})
          </button>
        </div>
      </div>
    </header>
  );
};
