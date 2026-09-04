import React, { useState, useMemo } from 'react';
import { DEFAULT_CONFIG } from './defaultData';
import { PlannerConfig } from './types';
import { runSimulation } from './engine';
import { exportToExcel } from './exportExcel';
import { Header } from './components/Header';
import { KeyResultsCards } from './components/KeyResultsCards';
import { ChartsSection } from './components/ChartsSection';
import { PlanTable } from './components/PlanTable';
import { InputsSection } from './components/InputsSection';
import { PhaseExplanationCard } from './components/PhaseExplanationCard';

export function App() {
  const [config, setConfig] = useState<PlannerConfig>(() => {
    const saved = localStorage.getItem('rp_config_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved config', e);
      }
    }
    return DEFAULT_CONFIG;
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'table' | 'inputs'>('overview');

  // Recalculate whenever config updates
  const simulationResults = useMemo(() => {
    return runSimulation(config);
  }, [config]);

  const handleConfigChange = (updated: PlannerConfig) => {
    setConfig(updated);
    try {
      localStorage.setItem('rp_config_v1', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset all parameters and income sources back to defaults?')) {
      setConfig(DEFAULT_CONFIG);
      localStorage.removeItem('rp_config_v1');
    }
  };

  const handleExport = () => {
    exportToExcel(config, simulationResults);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Header
        config={config}
        summary={simulationResults.summary}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onReset={handleReset}
        onExport={handleExport}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* KPI Cards across the top for immediate situational awareness */}
        <KeyResultsCards summary={simulationResults.summary} config={config} />

        {/* Tab 1: Overview Dashboard */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <PhaseExplanationCard config={config} />

            {/* Featured Depletion Chart with interactive toggle */}
            <ChartsSection config={config} years={simulationResults.years} showAll={false} />

            {/* Quick table preview */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Simulation Snapshot (First 10 Years)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Preview of the annual plan. View the Simulation Table tab for all {config.projectionYears} years and per-account breakdowns.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('table')}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-md transition-colors"
                >
                  View All {config.projectionYears} Years &rarr;
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-3">Year</th>
                      <th className="py-2.5 px-3">Age</th>
                      <th className="py-2.5 px-3">Phase</th>
                      <th className="py-2.5 px-3 text-right">Guaranteed</th>
                      <th className="py-2.5 px-3 text-right">Withdrawal</th>
                      <th className="py-2.5 px-3 text-right">Expenses</th>
                      <th className="py-2.5 px-3 text-right">Total Tax</th>
                      <th className="py-2.5 px-3 text-right font-bold">End Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {simulationResults.years.slice(0, 10).map(y => (
                      <tr key={y.yr} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 font-semibold text-slate-900 font-sans">{y.calYear}</td>
                        <td className="py-2 px-3 text-slate-600 font-sans">{y.age.toFixed(1)}</td>
                        <td className="py-2 px-3 font-sans">
                          <span className="text-[10px] font-medium bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                            Phase {y.phase}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-emerald-700 font-medium">
                          {y.guarTotal > 0
                            ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(y.guarTotal)
                            : '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-indigo-700 font-medium">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(y.wdTotal)}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-900">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(y.expenses)}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(y.totalTax)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(y.combEndBal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: All Visualizations */}
        {activeTab === 'charts' && (
          <div className="space-y-6">
            <ChartsSection config={config} years={simulationResults.years} showAll={true} />
          </div>
        )}

        {/* Tab 3: Full Year-by-Year Simulation Table */}
        {activeTab === 'table' && (
          <div className="space-y-6">
            <PlanTable years={simulationResults.years} config={config} />
          </div>
        )}

        {/* Tab 4: Configuration & Income Sources */}
        {activeTab === 'inputs' && (
          <div className="space-y-6">
            <InputsSection config={config} onChange={handleConfigChange} />
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        Retirement Financial Planner &bull; Transparent priority-based withdrawal sequencing and portfolio depletion engine.
      </footer>
    </div>
  );
}

export default App;
