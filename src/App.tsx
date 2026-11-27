import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, ArrowRight, ShieldCheck, Lock } from 'lucide-react';
import { DEFAULT_CONFIG, STRESS_PRESETS } from './defaultData';
import { PlannerConfig, DollarDisplayMode, StressPreset, SavedScenario } from './types';
import { runSimulation, getPhaseDefinitions } from './engine';
import { exportToExcel } from './exportExcel';
import { formatCurrency } from './utils/formatters';
import { normalizeConfig } from './utils/configNormalizer';
import {
  FileSystemFileHandleLike,
  VAULT_FILE_EXTENSION,
  VaultKeyMaterial,
  VaultPayload,
  canUseDirectFileSystem,
  clearLegacyBrowserStorage,
  decryptVaultText,
  deriveVaultKey,
  downloadEncryptedVaultFile,
  encryptVaultPayload,
  hasLegacyBrowserStorage,
  isEncryptedVaultText,
  pickOpenVaultFileHandle,
  pickSaveVaultFileHandle,
  readAndClearLegacyBrowserStorage,
  serializeVaultEnvelope,
  suggestVaultFileName,
  vaultFileNameToPlanName,
  writeToFileHandle,
} from './utils/encryptedVault';
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
import {
  VaultManagerModal,
  PendingVaultFile,
  NewPlanOrigin,
} from './components/VaultManagerModal';
import { Modal } from './components/Modal';

export function App() {
  // Configuration & snapshots live strictly in memory until encrypted to a .rpvault file
  const [config, setConfig] = useState<PlannerConfig>(() => DEFAULT_CONFIG);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  // Encrypted Vault & Active Plan session state (key material stays non-extractable in RAM only)
  const [activePlanName, setActivePlanName] = useState<string | null>(null);
  const [vaultKeyMaterial, setVaultKeyMaterial] = useState<VaultKeyMaterial | null>(null);
  const [vaultFileHandle, setVaultFileHandle] = useState<FileSystemFileHandleLike | null>(null);
  const [vaultFileName, setVaultFileName] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSaveToFile, setAutoSaveToFile] = useState(true);
  const [hasLegacyBrowserData, setHasLegacyBrowserData] = useState<boolean>(() =>
    hasLegacyBrowserStorage()
  );
  const [vaultToast, setVaultToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [externalPendingFile, setExternalPendingFile] = useState<PendingVaultFile | null>(null);
  const quickOpenFileInputRef = useRef<HTMLInputElement>(null);

  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dollarMode, setDollarMode] = useState<DollarDisplayMode>('nominal');
  const [activePreset, setActivePreset] = useState<StressPreset>('baseline');
  const [showResetModal, setShowResetModal] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [vaultModalMode, setVaultModalMode] = useState<
    'vault' | 'snapshots' | 'new-plan' | 'save-current' | 'unlock'
  >('vault');
  const [snapshotView, setSnapshotView] = useState<'first10' | 'rmd' | 'all'>('first10');

  // Undo state when applying a What-If strategy
  const [previousConfigBeforeWhatIf, setPreviousConfigBeforeWhatIf] = useState<PlannerConfig | null>(null);
  const [lastAppliedStrategyName, setLastAppliedStrategyName] = useState<string | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setVaultToast({ type, text });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setVaultToast(null), 3600);
  }, []);

  const simulationResults = useMemo(() => {
    return runSimulation(config, activePreset);
  }, [config, activePreset]);

  const buildVaultPayload = useCallback(
    (overrides?: {
      planName?: string;
      activeConfig?: PlannerConfig;
      activeScenarioId?: string | null;
      savedScenarios?: SavedScenario[];
      dollarMode?: DollarDisplayMode;
      activePreset?: StressPreset;
    }): VaultPayload => {
      return {
        schemaVersion: 1,
        planName: overrides?.planName ?? activePlanName ?? undefined,
        savedAt: new Date().toISOString(),
        activeConfig: overrides?.activeConfig ?? config,
        activeScenarioId:
          overrides?.activeScenarioId !== undefined ? overrides.activeScenarioId : activeScenarioId,
        savedScenarios: overrides?.savedScenarios ?? savedScenarios,
        preferences: {
          dollarMode: overrides?.dollarMode ?? dollarMode,
          activePreset: overrides?.activePreset ?? activePreset,
        },
      };
    },
    [activePlanName, config, activeScenarioId, savedScenarios, dollarMode, activePreset]
  );

  const handleConfigChange = (updated: PlannerConfig) => {
    setConfig(updated);
    setHasUnsavedChanges(true);
  };

  const handleSaveScenario = (name: string) => {
    const entry: SavedScenario = {
      id: `scen-${Date.now()}`,
      name,
      savedAt: new Date().toISOString(),
      config: JSON.parse(JSON.stringify(config)),
    };
    setSavedScenarios(prev => [entry, ...prev]);
    setActiveScenarioId(entry.id);
    setHasUnsavedChanges(true);
  };

  const handleLoadScenario = (scen: SavedScenario) => {
    setConfig(normalizeConfig(scen.config));
    setActiveScenarioId(scen.id);
    setHasUnsavedChanges(true);
  };

  const handleDeleteScenario = (id: string) => {
    setSavedScenarios(prev => prev.filter(s => s.id !== id));
    if (activeScenarioId === id) setActiveScenarioId(null);
    setHasUnsavedChanges(true);
  };

  const handleImportLegacyJson = (imported: PlannerConfig, label?: string) => {
    const normalized = normalizeConfig(imported);
    setConfig(normalized);
    if (label) {
      const entry: SavedScenario = {
        id: `scen-${Date.now()}`,
        name: label,
        savedAt: new Date().toISOString(),
        config: normalized,
      };
      setSavedScenarios(prev => [entry, ...prev]);
      setActiveScenarioId(entry.id);
    }
    setHasUnsavedChanges(true);
  };

  const handleMigrateLegacyBrowserData = () => {
    const { config: legacyConfig, scenarios: legacyScenarios } = readAndClearLegacyBrowserStorage();
    if (legacyConfig) setConfig(legacyConfig);
    if (legacyScenarios.length > 0) setSavedScenarios(legacyScenarios);
    setHasLegacyBrowserData(false);
    setHasUnsavedChanges(true);
  };

  const handleDiscardLegacyBrowserData = () => {
    clearLegacyBrowserStorage();
    setHasLegacyBrowserData(false);
  };

  const handleCreatePlanVault = async ({
    planName,
    fileName,
    passphrase,
    origin,
  }: {
    planName: string;
    fileName: string;
    passphrase: string;
    origin: NewPlanOrigin;
  }) => {
    const cleanPlanName = planName.trim();
    const normalizedFileName = fileName.endsWith(VAULT_FILE_EXTENSION)
      ? fileName
      : `${fileName}${VAULT_FILE_EXTENSION}`;

    const nextConfig: PlannerConfig =
      origin === 'fresh' ? JSON.parse(JSON.stringify(DEFAULT_CONFIG)) : config;
    const nextScenarios: SavedScenario[] = origin === 'fresh' ? [] : savedScenarios;
    const nextScenarioId: string | null = origin === 'fresh' ? null : activeScenarioId;
    const nextDollarMode: DollarDisplayMode = origin === 'fresh' ? 'nominal' : dollarMode;
    const nextPreset: StressPreset = origin === 'fresh' ? 'baseline' : activePreset;

    const keyMaterial = await deriveVaultKey(passphrase);
    const payload = buildVaultPayload({
      planName: cleanPlanName,
      activeConfig: nextConfig,
      activeScenarioId: nextScenarioId,
      savedScenarios: nextScenarios,
      dollarMode: nextDollarMode,
      activePreset: nextPreset,
    });
    const envelope = await encryptVaultPayload(payload, keyMaterial);
    const serialized = serializeVaultEnvelope(envelope);

    const handle = await pickSaveVaultFileHandle(normalizedFileName);
    if (handle) {
      await writeToFileHandle(handle, serialized);
      setVaultFileHandle(handle);
      setVaultFileName(handle.name);
      setAutoSaveToFile(true);
    } else {
      downloadEncryptedVaultFile(serialized, normalizedFileName);
      setVaultFileHandle(null);
      setVaultFileName(normalizedFileName);
    }

    setConfig(nextConfig);
    setSavedScenarios(nextScenarios);
    setActiveScenarioId(nextScenarioId);
    setDollarMode(nextDollarMode);
    setActivePreset(nextPreset);
    setActivePlanName(cleanPlanName);
    setVaultKeyMaterial(keyMaterial);
    setLastSavedAt(payload.savedAt);
    setHasUnsavedChanges(false);
    setPreviousConfigBeforeWhatIf(null);
    setLastAppliedStrategyName(null);
    showToast('success', `Created plan "${cleanPlanName}" (${handle?.name || normalizedFileName}).`);
  };

  const handleOpenRawPlanFile = (
    fileName: string,
    content: string,
    handle: FileSystemFileHandleLike | null
  ) => {
    if (isEncryptedVaultText(content)) {
      setExternalPendingFile({ fileName, content, handle });
      setVaultModalMode('unlock');
      setShowVaultModal(true);
      return;
    }

    // Legacy unencrypted JSON fallback
    try {
      const parsed = JSON.parse(content);
      const importedConfig: PlannerConfig =
        parsed?.config && parsed.config.scenario ? parsed.config : parsed;
      if (!importedConfig || !importedConfig.scenario || !Array.isArray(importedConfig.sources)) {
        throw new Error('Invalid file format');
      }
      const cleanName = vaultFileNameToPlanName(fileName);
      handleImportLegacyJson(importedConfig, cleanName);
      setActivePlanName(cleanName);
      setExternalPendingFile(null);
      setVaultModalMode('save-current');
      setShowVaultModal(true);
      showToast('success', `Loaded legacy JSON "${fileName}". Save it as an encrypted vault.`);
    } catch {
      showToast(
        'error',
        `Unrecognized file. Select an encrypted ${VAULT_FILE_EXTENSION} plan vault.`
      );
    }
  };

  const handleTriggerOpenPlan = async () => {
    if (canUseDirectFileSystem()) {
      try {
        const picked = await pickOpenVaultFileHandle();
        if (picked) {
          handleOpenRawPlanFile(picked.fileName, picked.content, picked.handle);
        }
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        showToast('error', err?.message || 'Could not open plan file.');
        return;
      }
    }
    quickOpenFileInputRef.current?.click();
  };

  const handleQuickOpenFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'Selected file exceeds the 5 MB limit.');
      if (quickOpenFileInputRef.current) quickOpenFileInputRef.current.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      handleOpenRawPlanFile(file.name, String(reader.result || ''), null);
      if (quickOpenFileInputRef.current) quickOpenFileInputRef.current.value = '';
    };
    reader.onerror = () => {
      showToast('error', 'Failed to read selected file.');
      if (quickOpenFileInputRef.current) quickOpenFileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleTriggerNewPlan = () => {
    setExternalPendingFile(null);
    setVaultModalMode('new-plan');
    setShowVaultModal(true);
  };

  const handleUnlockVault = async (file: PendingVaultFile, passphrase: string) => {
    const { payload, keyMaterial } = await decryptVaultText(file.content, passphrase);
    const resolvedPlanName = payload.planName || vaultFileNameToPlanName(file.fileName);
    setConfig(payload.activeConfig);
    setSavedScenarios(payload.savedScenarios);
    setActiveScenarioId(payload.activeScenarioId);
    if (payload.preferences) {
      setDollarMode(payload.preferences.dollarMode);
      setActivePreset(payload.preferences.activePreset);
    }
    setActivePlanName(resolvedPlanName);
    setVaultKeyMaterial(keyMaterial);
    setVaultFileHandle(file.handle);
    setVaultFileName(file.fileName);
    setLastSavedAt(payload.savedAt);
    setHasUnsavedChanges(false);
    setPreviousConfigBeforeWhatIf(null);
    setLastAppliedStrategyName(null);
    setExternalPendingFile(null);
    showToast('success', `Opened plan "${resolvedPlanName}" (${file.fileName}).`);
  };

  const handleSaveVault = useCallback(async () => {
    if (!vaultKeyMaterial) {
      setExternalPendingFile(null);
      setVaultModalMode('save-current');
      setShowVaultModal(true);
      return;
    }
    const payload = buildVaultPayload();
    const envelope = await encryptVaultPayload(payload, vaultKeyMaterial);
    const serialized = serializeVaultEnvelope(envelope);
    const fileName = vaultFileName || suggestVaultFileName(config, false, activePlanName);

    if (vaultFileHandle) {
      await writeToFileHandle(vaultFileHandle, serialized);
      setLastSavedAt(payload.savedAt);
      setHasUnsavedChanges(false);
      showToast('success', `Saved encrypted changes to ${vaultFileHandle.name}.`);
    } else {
      downloadEncryptedVaultFile(serialized, fileName);
      setVaultFileName(fileName);
      setLastSavedAt(payload.savedAt);
      setHasUnsavedChanges(false);
      showToast('success', `Downloaded updated encrypted vault (${fileName}).`);
    }
  }, [vaultKeyMaterial, buildVaultPayload, vaultFileName, config, activePlanName, vaultFileHandle, showToast]);

  const handleDownloadBackupCopy = async () => {
    if (!vaultKeyMaterial) {
      setExternalPendingFile(null);
      setVaultModalMode('save-current');
      setShowVaultModal(true);
      return;
    }
    const payload = buildVaultPayload();
    const envelope = await encryptVaultPayload(payload, vaultKeyMaterial);
    const serialized = serializeVaultEnvelope(envelope);
    const backupName = suggestVaultFileName(config, true, activePlanName);
    downloadEncryptedVaultFile(serialized, backupName);
    showToast('success', `Encrypted backup downloaded (${backupName}).`);
  };

  const handleChangePassphrase = async (newPassphrase: string) => {
    const newKeyMaterial = await deriveVaultKey(newPassphrase);
    const payload = buildVaultPayload();
    const envelope = await encryptVaultPayload(payload, newKeyMaterial);
    const serialized = serializeVaultEnvelope(envelope);
    const fileName = vaultFileName || suggestVaultFileName(config, false, activePlanName);

    if (vaultFileHandle) {
      await writeToFileHandle(vaultFileHandle, serialized);
    } else {
      downloadEncryptedVaultFile(serialized, fileName);
    }

    setVaultKeyMaterial(newKeyMaterial);
    setLastSavedAt(payload.savedAt);
    setHasUnsavedChanges(false);
    showToast('success', 'Vault passphrase updated and file re-encrypted.');
  };

  const handleLockVault = () => {
    setActivePlanName(null);
    setVaultKeyMaterial(null);
    setVaultFileHandle(null);
    setVaultFileName(null);
    setLastSavedAt(null);
    setHasUnsavedChanges(false);
    setConfig(DEFAULT_CONFIG);
    setSavedScenarios([]);
    setActiveScenarioId(null);
    setActivePreset('baseline');
    setDollarMode('nominal');
    setPreviousConfigBeforeWhatIf(null);
    setLastAppliedStrategyName(null);
  };

  // Optional auto-save to linked local file handle (debounced)
  useEffect(() => {
    if (!autoSaveToFile || !vaultKeyMaterial || !vaultFileHandle || !hasUnsavedChanges) return;
    const timer = window.setTimeout(async () => {
      try {
        const payload = buildVaultPayload();
        const envelope = await encryptVaultPayload(payload, vaultKeyMaterial);
        const serialized = serializeVaultEnvelope(envelope);
        await writeToFileHandle(vaultFileHandle, serialized);
        setLastSavedAt(payload.savedAt);
        setHasUnsavedChanges(false);
      } catch {
        setAutoSaveToFile(false);
        showToast('error', 'Auto-save to linked file failed. Click Save Plan to save manually.');
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [autoSaveToFile, vaultKeyMaterial, vaultFileHandle, hasUnsavedChanges, buildVaultPayload, showToast]);

  // Ctrl/Cmd + S shortcut to save encrypted vault
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (vaultKeyMaterial) {
          handleSaveVault().catch(() => {
            showToast('error', 'Failed to save encrypted vault.');
          });
        } else {
          setExternalPendingFile(null);
          setVaultModalMode('save-current');
          setShowVaultModal(true);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [vaultKeyMaterial, handleSaveVault, showToast]);

  // Warn before closing tab if there are unsaved in-memory edits
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleResetConfirm = () => {
    setConfig(DEFAULT_CONFIG);
    setActivePreset('baseline');
    setDollarMode('nominal');
    setActiveScenarioId(null);
    setPreviousConfigBeforeWhatIf(null);
    setLastAppliedStrategyName(null);
    setAutoSaveToFile(false);
    setHasUnsavedChanges(Boolean(vaultKeyMaterial));
    setShowResetModal(false);
  };

  const handleApplyWhatIf = (nextConfig: PlannerConfig, strategyName: string) => {
    setPreviousConfigBeforeWhatIf(config);
    setLastAppliedStrategyName(strategyName);
    handleConfigChange(nextConfig);
  };

  const handleUndoWhatIf = () => {
    if (!previousConfigBeforeWhatIf) return;
    handleConfigChange(previousConfigBeforeWhatIf);
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
      {/* Hidden global file input for 1-click Open Plan fallback */}
      <input
        ref={quickOpenFileInputRef}
        type="file"
        accept=".rpvault,application/octet-stream,application/json,.json"
        onChange={handleQuickOpenFileInputChange}
        className="hidden"
      />

      {/* Persistent Desktop Sidebar + Mobile Drawer */}
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        config={config}
        savedCount={savedScenarios.length}
        activePlanName={activePlanName}
        isVaultUnlocked={Boolean(vaultKeyMaterial)}
        vaultFileName={vaultFileName}
        hasUnsavedChanges={hasUnsavedChanges}
        onNewPlan={handleTriggerNewPlan}
        onOpenPlan={handleTriggerOpenPlan}
        onOpenVault={() => {
          setExternalPendingFile(null);
          setVaultModalMode('vault');
          setShowVaultModal(true);
        }}
        onReset={() => setShowResetModal(true)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Right Workspace Column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <Header
          config={config}
          activeSection={activeSection}
          activePlanName={activePlanName}
          activeScenarioName={activeScenarioObj?.name ?? null}
          isVaultUnlocked={Boolean(vaultKeyMaterial)}
          vaultFileName={vaultFileName}
          hasUnsavedChanges={hasUnsavedChanges}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onNewPlan={handleTriggerNewPlan}
          onOpenPlan={handleTriggerOpenPlan}
          onOpenVault={() => {
            setExternalPendingFile(null);
            setVaultModalMode('vault');
            setShowVaultModal(true);
          }}
          onQuickSaveVault={() => {
            handleSaveVault().catch(() => {
              showToast('error', 'Failed to save encrypted vault.');
            });
          }}
          onExport={handleExport}
        />

        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* One-time migration banner if legacy browser localStorage data exists */}
          {hasLegacyBrowserData && (
            <div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2.5 text-xs text-amber-900">
                <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                <span>
                  <strong className="font-semibold">Encrypted File Storage Active:</strong> Previous unencrypted data was found in browser storage. Migrate it into an encrypted <code className="font-mono">{VAULT_FILE_EXTENSION}</code> vault and wipe browser storage.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    handleMigrateLegacyBrowserData();
                    setExternalPendingFile(null);
                    setVaultModalMode('save-current');
                    setShowVaultModal(true);
                  }}
                  className="px-3 py-1.5 min-h-[34px] rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  Migrate to Encrypted File
                </button>
                <button
                  type="button"
                  onClick={handleDiscardLegacyBrowserData}
                  className="px-3 py-1.5 min-h-[34px] rounded-lg bg-white hover:bg-amber-100/60 border border-amber-300 text-amber-900 text-xs font-medium transition-colors whitespace-nowrap"
                >
                  Clear Old Data
                </button>
              </div>
            </div>
          )}

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
                            <td
                              className="py-2.5 px-3 text-slate-600"
                              title={`Phase ${y.phase}: ${getPhaseDefinitions(config).find(p => p.phase === y.phase)?.shortLabel ?? ''}`}
                            >
                              P{y.phase}
                            </td>
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
              years={simulationResults.years}
              onChange={handleConfigChange}
              onNavigateToAcaSimulator={() => setActiveSection('aca')}
            />
          )}
        </main>

        <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
          Retirement Financial Planner · AES-256-GCM encrypted file storage · Zero browser localStorage persistence
        </footer>
      </div>

      {/* Encrypted Vault & Plan Snapshots Modal */}
      <VaultManagerModal
        open={showVaultModal}
        initialMode={vaultModalMode}
        externalPendingFile={externalPendingFile}
        onClearExternalPendingFile={() => setExternalPendingFile(null)}
        onClose={() => setShowVaultModal(false)}
        currentConfig={config}
        savedScenarios={savedScenarios}
        activeScenarioId={activeScenarioId}
        activePlanName={activePlanName}
        isVaultUnlocked={Boolean(vaultKeyMaterial)}
        vaultFileName={vaultFileName}
        hasLinkedFileHandle={Boolean(vaultFileHandle)}
        hasUnsavedChanges={hasUnsavedChanges}
        lastSavedAt={lastSavedAt}
        autoSaveToFile={autoSaveToFile}
        hasLegacyBrowserData={hasLegacyBrowserData}
        onToggleAutoSave={setAutoSaveToFile}
        onCreatePlanVault={handleCreatePlanVault}
        onUnlockVault={handleUnlockVault}
        onSaveVault={handleSaveVault}
        onDownloadBackupCopy={handleDownloadBackupCopy}
        onChangePassphrase={handleChangePassphrase}
        onLockVault={handleLockVault}
        onImportLegacyJson={handleImportLegacyJson}
        onMigrateLegacyBrowserData={handleMigrateLegacyBrowserData}
        onDiscardLegacyBrowserData={handleDiscardLegacyBrowserData}
        onSaveScenario={handleSaveScenario}
        onLoadScenario={handleLoadScenario}
        onDeleteScenario={handleDeleteScenario}
      />

      {/* Accessible Reset Confirmation Modal */}
      <Modal
        open={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Reset Session to Baseline?"
        subtitle="Restores default sample household parameters and accounts in memory"
        icon={
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        }
      >
        <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
          This restores the default 2-person sample plan in your current session. Your encrypted <code className="font-mono text-xs">{VAULT_FILE_EXTENSION}</code> file on disk is not overwritten unless you explicitly save.
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

      {/* Non-blocking Vault Save Toast */}
      {vaultToast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 ${
            vaultToast.type === 'success'
              ? 'bg-slate-900 text-white border-slate-800'
              : 'bg-rose-600 text-white border-rose-700'
          }`}
        >
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{vaultToast.text}</span>
        </div>
      )}

      <OfflineIndicator />
    </div>
  );
}

export default App;
