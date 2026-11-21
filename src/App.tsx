import { useState, useMemo } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { DEFAULT_CONFIG, STRESS_PRESETS } from './defaultData';
import { PlannerConfig, DollarDisplayMode, StressPreset } from './types';
import { runSimulation } from './engine';
import { exportToExcel } from './exportExcel';
import { formatCurrency } from './utils/formatters';
import { Sidebar, NavSection } from './components/Sidebar';
import { Header } from './components/Header';
import { KeyResultsCards } from './components/KeyResultsCards';
import { ChartsSection } from './components/ChartsSection';
import { PlanTable } from './components/PlanTable';
import { InputsSection, InputSubSection } from './components/InputsSection';
import { PhaseExplanationCard } from './components/PhaseExplanationCard';
import { RothConversionSimulator } from './components/RothConversionSimulator';
import { AcaSubsidySimulator } from './components/AcaSubsidySimulator';
import { WhatIfComparisonView } from './components/WhatIfComparisonView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ScenarioManagerModal, SavedScenario } from './components/ScenarioManagerModal';
import { Modal } from './components/Modal';

function normalizeConfig(parsed: any): PlannerConfig {
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
    majorExpenses: Array.isArray(parsed.majorExpenses)
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
    sources:
      Array.isArray(parsed.sources) && parsed.sources.length > 0
        ? parsed.sources.map((s: any, idx: number) => {
            const defaultSource = DEFAULT_CONFIG.sources[idx] || DEFAULT_CONFIG.sources[0];
            return {
              ...defaultSource,
              ...s,
              balance:
                typeof s?.balance === 'number' && !isNaN(s.balance)
                  ? s.balance
                  : defaultSource.balance,
              priority: typeof s?.priority === 'number' ? s.priority : defaultSource.priority,
              taxType: s?.taxType || defaultSource.taxType,
              monthly: s?.monthly || defaultSource.monthly,
            };
          })
        : DEFAULT_CONFIG.sources,
  };
}

function loadSavedConfig(): PlannerConfig {
  try {
    const saved = localStorage.getItem('rp_config_v2');
    if (!saved) return DEFAULT_CONFIG;
    return normalizeConfig(JSON.parse(saved));
  } catch (e) {
    console.warn('Failed to parse saved config, using defaults', e);
    return DEFAULT_CONFIG;
  }
}

function loadSavedScenarios(): SavedScenario[] {
  try {
    const raw = localStorage.getItem('rp_saved_scenarios_v1');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function App() {
  const [config, setConfig] = useState<PlannerConfig>(() => loadSavedConfig());
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(() => loadSavedScenarios());
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dollarMode, setDollarMode] = useState<DollarDisplayMode>('nominal');
  const [activePreset, setActivePreset] = useState<StressPreset>('baseline');
  const [showResetModal, setShowResetModal] = useState(false);
  const [showScenariosModal, setShowScenariosModal] = useState(false);
  const [snapshotView, setSnapshotView] = useState<'first10' | 'rmd' | 'all'>('first10');

  // Undo state when applying a What-If strategy
  const [previousConfigBeforeWhatIf, setPreviousConfigBeforeWhatIf] = useState<PlannerConfig | null>(null);
  const [lastAppliedStrategyName, setLastAppliedStrategyName] = useState<string | null>(null);

  const simulationResults = useMemo(() => {
    return runSimulation(config, activePreset);
  }, [config, activePreset]);

  const persistConfig = (updated: PlannerConfig) => {
    setConfig(updated);
    try {
      localStorage.setItem('rp_config_v2', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
  };

  const handleConfigChange = (updated: PlannerConfig) => {
    persistConfig(updated);
  };

  const persistScenarios = (next: SavedScenario[]) => {
    setSavedScenarios(next);
    try {
      localStorage.setItem('rp_saved_scenarios_v1', JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to persist scenarios', e);
    }
  };

  const handleSaveScenario = (name: string) => {
    const entry: SavedScenario = {
      id: `scen-${Date.now()}`,
      name,
      savedAt: new Date().toISOString(),
      config: JSON.parse(JSON.stringify(config)),
    };
    const next = [entry, ...savedScenarios];
    persistScenarios(next);
    setActiveScenarioId(entry.id);
  };

  const handleLoadScenario = (scen: SavedScenario) => {
    persistConfig(normalizeConfig(scen.config));
    setActiveScenarioId(scen.id);
  };

  const handleDeleteScenario = (id: string) => {
    const next = savedScenarios.filter(s => s.id !== id);
    persistScenarios(next);
    if (activeScenarioId === id) setActiveScenarioId(null);
  };

  const handleImportConfig = (imported: PlannerConfig, label?: string) => {
    const normalized = normalizeConfig(imported);
    persistConfig(normalized);
    if (label) {
      const entry: SavedScenario = {
        id: `scen-${Date.now()}`,
        name: label,
        savedAt: new Date().toISOString(),
        config: normalized,
      };
      persistScenarios([entry, ...savedScenarios]);
      setActiveScenarioId(entry.id);
    }
  };

  const handleResetConfirm = () => {
    setConfig(DEFAULT_CONFIG);
    setActivePreset('baseline');
    setDollarMode('nominal');
    setActiveScenarioId(null);
    setPreviousConfigBeforeWhatIf(null);
    setLastAppliedStrategyName(null);
    localStorage.removeItem('rp_config_v2');
    setShowResetModal(false);
  };

  const handleApplyWhatIf = (nextConfig: PlannerConfig, strategyName: string) => {
    setPreviousConfigBeforeWhatIf(config);
    setLastAppliedStrategyName(strategyName);
    persistConfig(nextConfig);
  };

  const handleUndoWhatIf = () => {
    if (!previousConfigBeforeWhatIf) return;
    persistConfig(previousConfigBeforeWhatIf);
    setPreviousConfigBeforeWhatIf(null);
    setLastAppliedStrategyName(null);
  };

  const handleExport = () => {
    exportToExcel(config, simulationResults, dollarMode);
  };

  const currentPresetInfo = STRESS_PRESETS.find(p => p.id === activePreset) || STRESS_PRESETS[0];
  const activeScenarioObj = savedScenarios.find(s => s.id === activeScenarioId) || null;

  const hasSpouse = Boolean(config.scenario?.hasSpouse);
  const primaryName = (config.scenario?.userName || 'Primary').split(' ')[0] || 'Primary';
  const spouseName = (config.scenario?.spouseName || 'Spouse').split(' ')[0] || 'Spouse';
  const rmdAge = config.milestones.rmdAge ?? 73;

  const getDeflator = (yrIndex: number, cumInflation?: number) => {
    if (dollarMode === 'nominal') return 1;
    if (cumInflation && cumInflation > 0) return cumInflation;
    return Math.pow(1 + config.rates.inflationRate, yrIndex);
  };

  const isInputSection = activeSection.startsWith('inputs-');
  const inputSubSection: InputSubSection = isInputSection
    ? (activeSection.replace('inputs-', '') as InputSubSection)
    : 'sources';

  const snapshotRows = useMemo(() => {
    if (snapshotView === 'first10') return simulationResults.years.slice(0, 10);
    if (snapshotView === 'rmd') {
      return simulationResults.years.filter(
        y => y.age >= rmdAge || (hasSpouse && (y.spouseAge ?? 0) >= rmdAge)
      );
    }
    return simulationResults.years;
  }, [simulationResults.years, snapshotView, rmdAge, hasSpouse]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Persistent Desktop Sidebar + Mobile Drawer */}
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        config={config}
        savedCount={savedScenarios.length}
        activeScenarioName={activeScenarioObj?.name ?? null}
        onOpenScenarios={() => setShowScenariosModal(true)}
        onReset={() => setShowResetModal(true)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Right Workspace Column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <Header
          config={config}
          activeSection={activeSection}
          activeScenarioName={activeScenarioObj?.name ?? null}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenScenarios={() => setShowScenariosModal(true)}
          onExport={handleExport}
        />

        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Unified Global Scenario Controls Strip */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 mb-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                Market Scenario
              </span>
              <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg gap-0.5 overflow-x-auto max-w-full">
                {STRESS_PRESETS.map(preset => {
                  const isSelected = activePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setActivePreset(preset.id)}
                      title={preset.description}
                      className={`px-3 py-1.5 min-h-[34px] rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        isSelected
                          ? 'bg-slate-900 text-white font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {preset.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                Valuation
              </span>
              <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setDollarMode('nominal')}
                  className={`px-3 py-1.5 min-h-[34px] rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    dollarMode === 'nominal'
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Nominal ($)
                </button>
                <button
                  type="button"
                  onClick={() => setDollarMode('real')}
                  className={`px-3 py-1.5 min-h-[34px] rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    dollarMode === 'real'
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Real (Today&apos;s $)
                </button>
              </div>
            </div>
          </div>

          {/* Contextual KPI Presentation: Full KPIs on Overview, Live Impact Strip on Inputs */}
          {activeSection === 'overview' && (
            <KeyResultsCards
              summary={simulationResults.summary}
              years={simulationResults.years}
              config={config}
              dollarMode={dollarMode}
              stressPresetName={currentPresetInfo?.name}
              isCustomStress={activePreset !== 'baseline'}
            />
          )}

          {isInputSection && (
            <KeyResultsCards
              summary={simulationResults.summary}
              years={simulationResults.years}
              config={config}
              dollarMode={dollarMode}
              stressPresetName={currentPresetInfo?.name}
              isCustomStress={activePreset !== 'baseline'}
              compact
            />
          )}

          {/* VIEW 1: Overview Dashboard */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <PhaseExplanationCard config={config} />

              <ChartsSection
                config={config}
                years={simulationResults.years}
                showAll={false}
                dollarMode={dollarMode}
                stressPreset={activePreset}
              />

              {/* Active Optimization Strategies Strip */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setActiveSection('roth')}
                  className="text-left bg-white rounded-xl border border-slate-200 hover:border-emerald-300 p-4 transition-colors flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">Roth Conversion Strategy</span>
                    <span className={`text-xs font-semibold ${config.rothConversion?.enabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {config.rothConversion?.enabled ? 'Active' : 'Off'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {config.rothConversion?.enabled
                      ? `Converting up to ${formatCurrency(config.rothConversion.annualCap)}/yr from age ${config.rothConversion.startAge}–${config.rothConversion.endAge}.`
                      : 'Simulate pre-RMD bracket filling to lower future Age 73+ tax spikes.'}
                  </p>
                  <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
                    Open Roth Simulator <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('aca')}
                  className="text-left bg-white rounded-xl border border-slate-200 hover:border-emerald-300 p-4 transition-colors flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">ACA Subsidy Bridge</span>
                    <span className={`text-xs font-semibold ${config.acaOptimization?.enabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {config.acaOptimization?.enabled ? 'Active' : 'Off'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {config.acaOptimization?.enabled
                      ? `Capping pre-Medicare MAGI at ${formatCurrency(config.acaOptimization.targetMagilimit)} using Cash/Roth reserves.`
                      : 'Keep pre-65 taxable MAGI under the ACA cliff to capture health premium credits.'}
                  </p>
                  <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
                    Open ACA Planner <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('whatif')}
                  className="text-left bg-white rounded-xl border border-slate-200 hover:border-emerald-300 p-4 transition-colors flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">What-If Optimization Lab</span>
                    <span className="text-xs font-medium text-slate-400">5 Strategies</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Compare automated strategies for minimum taxes, lowest RMDs, max spending, or maximum legacy wealth.
                  </p>
                  <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
                    Compare Strategies <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              </div>

              {/* Clean Snapshot Preview Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Simulation Snapshot (
                      {snapshotView === 'first10'
                        ? 'First 10 Years'
                        : snapshotView === 'rmd'
                        ? `RMD Years, Age ${rmdAge}+`
                        : `All ${simulationResults.years.length} Years`}
                      )
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {dollarMode === 'real' ? "Real (Today's Purchasing Power)" : 'Nominal Future Dollars'} · Open the Ledger for account-by-account details.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg">
                      {(
                        [
                          { id: 'first10', label: 'First 10 Yrs' },
                          { id: 'rmd', label: `RMD (${rmdAge}+)` },
                          { id: 'all', label: 'All Years' },
                        ] as const
                      ).map(v => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSnapshotView(v.id)}
                          className={`px-2.5 py-1.5 min-h-[32px] rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                            snapshotView === v.id
                              ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection('table')}
                      className="px-3 py-1.5 min-h-[34px] text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg border border-emerald-200 transition-colors whitespace-nowrap"
                    >
                      Full Ledger &rarr;
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                        <th className="py-3 px-4">Year</th>
                        <th className="py-3 px-3">{hasSpouse ? primaryName : 'Age'}</th>
                        {hasSpouse && <th className="py-3 px-3">{spouseName}</th>}
                        <th className="py-3 px-3">Phase</th>
                        <th className="py-3 px-3 text-right">Guaranteed</th>
                        <th className="py-3 px-3 text-right">Mandated RMD</th>
                        <th className="py-3 px-3 text-right">Withdrawal</th>
                        <th className="py-3 px-3 text-right">Expenses</th>
                        <th className="py-3 px-3 text-right">Total Tax</th>
                        <th className="py-3 px-4 text-right text-slate-800">End Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {snapshotRows.map(y => {
                        const deflator = getDeflator(y.yr, y.cumGeneralInflation);
                        const guar = y.guarTotal / deflator;
                        const rmd = (y.rmdTotal || 0) / deflator;
                        const wd = y.wdTotal / deflator;
                        const exp = y.expenses / deflator;
                        const tax = y.totalTax / deflator;
                        const endBal = y.combEndBal / deflator;
                        const isRmdReached = y.age >= rmdAge || (hasSpouse && (y.spouseAge ?? 0) >= rmdAge);

                        return (
                          <tr key={y.yr} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-semibold text-slate-900 tabular-nums">{y.calYear}</td>
                            <td className="py-2.5 px-3 text-slate-600 tabular-nums">{y.age.toFixed(1)}</td>
                            {hasSpouse && (
                              <td className="py-2.5 px-3 text-slate-600 tabular-nums">
                                {y.spouseAge !== undefined ? y.spouseAge.toFixed(1) : '—'}
                              </td>
                            )}
                            <td className="py-2.5 px-3 text-slate-600">P{y.phase}</td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700">
                              {guar > 0 ? formatCurrency(guar) : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {rmd > 0 ? (
                                <span className="text-amber-700 font-semibold">{formatCurrency(rmd)}</span>
                              ) : isRmdReached ? (
                                <span className="text-slate-400">$0</span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                              {formatCurrency(wd)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                              {formatCurrency(exp)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                              {formatCurrency(tax)}
                            </td>
                            <td className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold ${y.combEndBal <= 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                              {formatCurrency(endBal)}
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

          {/* VIEW 2: All Visualizations + Monte Carlo */}
          {activeSection === 'charts' && (
            <ChartsSection
              config={config}
              years={simulationResults.years}
              showAll={true}
              dollarMode={dollarMode}
              stressPreset={activePreset}
            />
          )}

          {/* VIEW 3: Year-by-Year Ledger */}
          {activeSection === 'table' && (
            <PlanTable
              years={simulationResults.years}
              config={config}
              dollarMode={dollarMode}
            />
          )}

          {/* VIEW 4: Roth Conversions */}
          {activeSection === 'roth' && (
            <RothConversionSimulator
              config={config}
              stressPreset={activePreset}
              dollarMode={dollarMode}
              onUpdateConfig={handleConfigChange}
            />
          )}

          {/* VIEW 5: ACA Subsidy Bridge */}
          {activeSection === 'aca' && (
            <AcaSubsidySimulator
              config={config}
              stressPreset={activePreset}
              dollarMode={dollarMode}
              onUpdateConfig={handleConfigChange}
            />
          )}

          {/* VIEW 6: What-If Lab */}
          {activeSection === 'whatif' && (
            <WhatIfComparisonView
              config={config}
              stressPreset={activePreset}
              dollarMode={dollarMode}
              getDeflator={getDeflator}
              onApplyStrategy={handleApplyWhatIf}
              previousConfig={previousConfigBeforeWhatIf}
              lastAppliedName={lastAppliedStrategyName}
              onUndoApply={handleUndoWhatIf}
            />
          )}

          {/* VIEW 7–10: Configuration Workspace */}
          {isInputSection && (
            <InputsSection
              config={config}
              section={inputSubSection}
              onChange={handleConfigChange}
              onNavigateToAcaSimulator={() => setActiveSection('aca')}
            />
          )}
        </main>

        <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
          Retirement Financial Planner · Priority-based withdrawal sequencing and depletion projection engine
        </footer>
      </div>

      {/* Accessible Saved Scenarios & JSON Backup Modal */}
      <ScenarioManagerModal
        open={showScenariosModal}
        onClose={() => setShowScenariosModal(false)}
        currentConfig={config}
        savedScenarios={savedScenarios}
        activeScenarioId={activeScenarioId}
        onSaveScenario={handleSaveScenario}
        onLoadScenario={handleLoadScenario}
        onDeleteScenario={handleDeleteScenario}
        onImportConfig={handleImportConfig}
      />

      {/* Accessible Reset Confirmation Modal */}
      <Modal
        open={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Reset Planner to Baseline?"
        subtitle="Restores default sample household parameters and accounts"
        icon={
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        }
      >
        <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
          This will clear your current unsaved adjustments in browser storage and restore the default 2-person sample scenario. Your named snapshots in Saved Plans will remain intact.
        </p>
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setShowResetModal(false)}
            className="px-4 py-2 min-h-[40px] text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleResetConfirm}
            className="px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
          >
            Reset to Baseline
          </button>
        </div>
      </Modal>

      <OfflineIndicator />
    </div>
  );
}

export default App;
