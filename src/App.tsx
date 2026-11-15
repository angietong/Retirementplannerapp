import React, { useState, useMemo } from 'react';
import { Zap, AlertTriangle, TrendingDown, Clock, ShieldAlert, Sparkles } from 'lucide-react';
import { DEFAULT_CONFIG, STRESS_PRESETS } from './defaultData';
import { PlannerConfig, DollarDisplayMode, StressPreset } from './types';
import { runSimulation } from './engine';
import { exportToExcel } from './exportExcel';
import { Header } from './components/Header';
import { KeyResultsCards } from './components/KeyResultsCards';
import { ChartsSection } from './components/ChartsSection';
import { PlanTable } from './components/PlanTable';
import { InputsSection } from './components/InputsSection';
import { PhaseExplanationCard } from './components/PhaseExplanationCard';
import { RothConversionSimulator } from './components/RothConversionSimulator';
import { AcaSubsidySimulator } from './components/AcaSubsidySimulator';
import { WhatIfComparisonView } from './components/WhatIfComparisonView';
import { OfflineIndicator } from './components/OfflineIndicator';

function loadSavedConfig(): PlannerConfig {
  try {
    const saved = localStorage.getItem('rp_config_v2');
    if (!saved) return DEFAULT_CONFIG;
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_CONFIG;

    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      scenario: {
        ...DEFAULT_CONFIG.scenario,
        ...(parsed.scenario || {}),
      },
      milestones: {
        ...DEFAULT_CONFIG.milestones,
        ...(parsed.milestones || {}),
        rmdAge: Number(parsed.milestones?.rmdAge) || DEFAULT_CONFIG.milestones.rmdAge,
        medicareAge: Number(parsed.milestones?.medicareAge) || DEFAULT_CONFIG.milestones.medicareAge,
      },
      rates: {
        ...DEFAULT_CONFIG.rates,
        ...(parsed.rates || {}),
      },
      expenses: {
        ...DEFAULT_CONFIG.expenses,
        ...(parsed.expenses || {}),
      },
      majorExpenses: Array.isArray(parsed.majorExpenses) && parsed.majorExpenses.length > 0
        ? parsed.majorExpenses
        : DEFAULT_CONFIG.majorExpenses,
      rothConversion: {
        ...DEFAULT_CONFIG.rothConversion,
        ...(parsed.rothConversion || {}),
      },
      taxDeferredStrategy: {
        ...DEFAULT_CONFIG.taxDeferredStrategy,
        ...(parsed.taxDeferredStrategy || {}),
      },
      acaOptimization: {
        ...DEFAULT_CONFIG.acaOptimization,
        ...(parsed.acaOptimization || {}),
        adjustMedicalExpensesWithSubsidy:
          parsed.acaOptimization?.creditAccountId !== undefined
            ? parsed.acaOptimization.adjustMedicalExpensesWithSubsidy
            : true,
        creditAccountId:
          parsed.acaOptimization?.creditAccountId ?? DEFAULT_CONFIG.acaOptimization?.creditAccountId,
      },
      sources: Array.isArray(parsed.sources) && parsed.sources.length > 0
        ? parsed.sources.map((s: any, idx: number) => {
            const defaultSource = DEFAULT_CONFIG.sources[idx] || DEFAULT_CONFIG.sources[0];
            return {
              ...defaultSource,
              ...s,
              balance: typeof s?.balance === 'number' && !isNaN(s.balance) ? s.balance : defaultSource.balance,
              priority: typeof s?.priority === 'number' ? s.priority : defaultSource.priority,
              taxType: s?.taxType || defaultSource.taxType,
              monthly: s?.monthly || defaultSource.monthly,
            };
          })
        : DEFAULT_CONFIG.sources,
    };
  } catch (e) {
    console.warn('Failed to parse saved config, using defaults', e);
    return DEFAULT_CONFIG;
  }
}

export function App() {
  const [config, setConfig] = useState<PlannerConfig>(() => loadSavedConfig());

  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'table' | 'roth' | 'aca' | 'whatif' | 'inputs'>('overview');
  const [dollarMode, setDollarMode] = useState<DollarDisplayMode>('nominal');
  const [activePreset, setActivePreset] = useState<StressPreset>('baseline');
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [snapshotView, setSnapshotView] = useState<'first10' | 'rmd' | 'all'>('first10');

  // Recalculate whenever config or activePreset updates
  const simulationResults = useMemo(() => {
    return runSimulation(config, activePreset);
  }, [config, activePreset]);

  const handleConfigChange = (updated: PlannerConfig) => {
    setConfig(updated);
    try {
      localStorage.setItem('rp_config_v2', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
  };

  const handleResetConfirm = () => {
    setConfig(DEFAULT_CONFIG);
    setActivePreset('baseline');
    setDollarMode('nominal');
    localStorage.removeItem('rp_config_v2');
    setShowResetModal(false);
  };

  const handleExport = () => {
    exportToExcel(config, simulationResults);
  };

  const currentPresetInfo = STRESS_PRESETS.find(p => p.id === activePreset) || STRESS_PRESETS[0];

  const hasSpouse = Boolean(config.scenario?.hasSpouse);
  const primaryName = (config.scenario?.userName || 'Primary').split(' ')[0] || 'Primary';
  const spouseName = (config.scenario?.spouseName || 'Spouse').split(' ')[0] || 'Spouse';

  const getDeflator = (yrIndex: number) => {
    if (dollarMode === 'nominal') return 1;
    return Math.pow(1 + config.rates.inflationRate, yrIndex);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Header
        config={config}
        summary={simulationResults.summary}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onReset={() => setShowResetModal(true)}
        onExport={handleExport}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Scenario Controls & Stress Test Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 mb-5 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Scenario Stress Presets:
            </span>
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium flex-wrap gap-0.5">
              {STRESS_PRESETS.map(preset => {
                const isSelected = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => setActivePreset(preset.id)}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      isSelected
                        ? 'bg-slate-900 text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                    title={preset.description}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
            {currentPresetInfo && (
              <span className="text-[11px] text-slate-500 hidden lg:inline ml-1 italic">
                ({currentPresetInfo.description})
              </span>
            )}
          </div>

          {/* Dollar Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Valuation:</span>
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
              <button
                onClick={() => setDollarMode('nominal')}
                className={`px-3 py-1 rounded-md transition-all ${
                  dollarMode === 'nominal'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Nominal ($)
              </button>
              <button
                onClick={() => setDollarMode('real')}
                className={`px-3 py-1 rounded-md transition-all ${
                  dollarMode === 'real'
                    ? 'bg-emerald-700 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Real (Today's $)
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards across the top for immediate situational awareness */}
        <KeyResultsCards
          summary={simulationResults.summary}
          years={simulationResults.years}
          config={config}
          dollarMode={dollarMode}
          stressPresetName={currentPresetInfo?.name}
          isCustomStress={activePreset !== 'baseline'}
        />

        {/* Tab 1: Overview Dashboard */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <PhaseExplanationCard config={config} />

            {/* Featured Depletion Chart with interactive toggle */}
            <ChartsSection
              config={config}
              years={simulationResults.years}
              showAll={false}
              dollarMode={dollarMode}
              onDollarModeChange={setDollarMode}
            />

            {/* Quick table preview */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Simulation Snapshot ({snapshotView === 'first10' ? 'First 10 Years' : snapshotView === 'rmd' ? `RMD Years (Age ${config.milestones.rmdAge ?? 73}+)` : `All ${simulationResults.years.length} Years`})
                  </h3>
                  <p className="text-xs text-slate-500">
                    {dollarMode === 'real' ? "Values displayed in Real (Today's Purchasing Power) Dollars." : 'Values displayed in Nominal Future Dollars.'}{' '}
                    View the Simulation Table tab for per-account breakdowns.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
                    <button
                      onClick={() => setSnapshotView('first10')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        snapshotView === 'first10'
                          ? 'bg-white text-slate-900 font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      First 10 Yrs
                    </button>
                    <button
                      onClick={() => setSnapshotView('rmd')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        snapshotView === 'rmd'
                          ? 'bg-amber-600 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      RMD Years (Age {config.milestones.rmdAge ?? 73}+)
                    </button>
                    <button
                      onClick={() => setSnapshotView('all')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        snapshotView === 'all'
                          ? 'bg-white text-slate-900 font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All {simulationResults.years.length} Yrs
                    </button>
                  </div>
                  <button
                    onClick={() => setActiveTab('table')}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-md transition-colors"
                  >
                    Detailed Table &rarr;
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-3">Year</th>
                      <th className="py-2.5 px-3">{hasSpouse ? `${primaryName} Age` : 'Age'}</th>
                      {hasSpouse && <th className="py-2.5 px-3">{spouseName} Age</th>}
                      <th className="py-2.5 px-3">Phase</th>
                      <th className="py-2.5 px-3 text-right">Guaranteed</th>
                      <th className="py-2.5 px-3 text-right">Mandated RMD</th>
                      <th className="py-2.5 px-3 text-right">Withdrawal</th>
                      <th className="py-2.5 px-3 text-right">Expenses</th>
                      <th className="py-2.5 px-3 text-right">Total Tax</th>
                      <th className="py-2.5 px-3 text-right font-bold">End Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {(snapshotView === 'first10'
                      ? simulationResults.years.slice(0, 10)
                      : snapshotView === 'rmd'
                      ? simulationResults.years.filter(
                          y =>
                            y.age >= (config.milestones.rmdAge ?? 73) ||
                            (hasSpouse && (y.spouseAge ?? 0) >= (config.milestones.rmdAge ?? 73))
                        )
                      : simulationResults.years
                    ).map(y => {
                      const deflator = getDeflator(y.yr);
                      const guar = y.guarTotal / deflator;
                      const rmd = (y.rmdTotal || 0) / deflator;
                      const wd = y.wdTotal / deflator;
                      const exp = y.expenses / deflator;
                      const tax = y.totalTax / deflator;
                      const endBal = y.combEndBal / deflator;
                      const rmdAge = config.milestones.rmdAge ?? 73;
                      const isRmdAgeReached = y.age >= rmdAge || (hasSpouse && (y.spouseAge ?? 0) >= rmdAge);

                      return (
                        <tr key={y.yr} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 font-semibold text-slate-900 font-sans">{y.calYear}</td>
                          <td className="py-2 px-3 text-slate-600 font-sans">{y.age.toFixed(1)}</td>
                          {hasSpouse && (
                            <td className="py-2 px-3 text-slate-600 font-sans">
                              {y.spouseAge !== undefined ? y.spouseAge.toFixed(1) : '—'}
                            </td>
                          )}
                          <td className="py-2 px-3 font-sans">
                            <span className="text-[10px] font-medium bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                              Phase {y.phase}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-emerald-700 font-medium">
                            {guar > 0
                              ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(guar)
                              : '—'}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {rmd > 0 ? (
                              <span className="text-amber-700 font-bold">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(rmd)}
                              </span>
                            ) : isRmdAgeReached ? (
                              <span className="text-slate-400 text-[10px] font-sans" title="Pre-tax 401(k)/IRA accounts have $0 remaining balance">
                                $0 (Pre-tax $0)
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right text-indigo-700 font-medium">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(wd)}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-900">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(exp)}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(tax)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(endBal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: All Visualizations */}
        {activeTab === 'charts' && (
          <div className="space-y-6">
            <ChartsSection
              config={config}
              years={simulationResults.years}
              showAll={true}
              dollarMode={dollarMode}
              onDollarModeChange={setDollarMode}
            />
          </div>
        )}

        {/* Tab 3: Full Year-by-Year Simulation Table */}
        {activeTab === 'table' && (
          <div className="space-y-6">
            <PlanTable
              years={simulationResults.years}
              config={config}
              dollarMode={dollarMode}
              onDollarModeChange={setDollarMode}
            />
          </div>
        )}

        {/* Tab 4: Systematic Roth Conversion Simulator */}
        {activeTab === 'roth' && (
          <div className="space-y-6">
            <RothConversionSimulator
              config={config}
              stressPreset={activePreset}
              dollarMode={dollarMode}
              onUpdateConfig={handleConfigChange}
            />
          </div>
        )}

        {/* Tab 5: ACA Healthcare Subsidy Optimization */}
        {activeTab === 'aca' && (
          <div className="space-y-6">
            <AcaSubsidySimulator
              config={config}
              stressPreset={activePreset}
              dollarMode={dollarMode}
              onUpdateConfig={handleConfigChange}
            />
          </div>
        )}

        {/* Tab 6: What-If Optimization Scenarios */}
        {activeTab === 'whatif' && (
          <div className="space-y-6">
            <WhatIfComparisonView
              config={config}
              stressPreset={activePreset}
              dollarMode={dollarMode}
              getDeflator={getDeflator}
            />
          </div>
        )}

        {/* Tab 7: Configuration & Income Sources */}
        {activeTab === 'inputs' && (
          <div className="space-y-6">
            <InputsSection
              config={config}
              onChange={handleConfigChange}
              onNavigateToAcaSimulator={() => setActiveTab('aca')}
            />
          </div>
        )}
      </main>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-lg">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Reset Planner to Baseline?</h3>
                <p className="text-xs text-slate-500">This will reset all accounts, milestone ages, and rates.</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Are you sure you want to restore the default sample scenario, 2-person household parameters, and baseline accounts? Any unsaved custom account adjustments in browser storage will be cleared.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetConfirm}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition-colors"
              >
                Reset All Parameters
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        Retirement Financial Planner &bull; Transparent priority-based withdrawal sequencing and portfolio depletion engine.
      </footer>

      <OfflineIndicator />
    </div>
  );
}

export default App;
