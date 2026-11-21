import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Upload,
  Download,
  Save,
  KeyRound,
  Eye,
  EyeOff,
  Bookmark,
  Plus,
  Trash2,
  Check,
  HardDrive,
  FileKey2,
  FilePlus2,
  FolderOpen,
  AlertTriangle,
} from 'lucide-react';
import { PlannerConfig, SavedScenario } from '../types';
import { Modal } from './Modal';
import { formatCurrency } from '../utils/formatters';
import {
  FileSystemFileHandleLike,
  VAULT_FILE_EXTENSION,
  canUseDirectFileSystem,
  evaluatePassphraseStrength,
  isEncryptedVaultText,
  pickOpenVaultFileHandle,
  planNameToVaultFileName,
  suggestVaultFileName,
} from '../utils/encryptedVault';

export interface PendingVaultFile {
  fileName: string;
  content: string;
  handle: FileSystemFileHandleLike | null;
}

export type NewPlanOrigin = 'fresh' | 'current';

interface VaultManagerModalProps {
  open: boolean;
  initialMode?: 'vault' | 'snapshots' | 'new-plan' | 'save-current' | 'unlock';
  externalPendingFile?: PendingVaultFile | null;
  onClearExternalPendingFile?: () => void;
  onClose: () => void;
  currentConfig: PlannerConfig;
  savedScenarios: SavedScenario[];
  activeScenarioId: string | null;
  // Active Plan & Vault state
  activePlanName: string | null;
  isVaultUnlocked: boolean;
  vaultFileName: string | null;
  hasLinkedFileHandle: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt: string | null;
  autoSaveToFile: boolean;
  hasLegacyBrowserData: boolean;
  // Vault & Plan actions
  onToggleAutoSave: (enabled: boolean) => void;
  onCreatePlanVault: (options: {
    planName: string;
    fileName: string;
    passphrase: string;
    origin: NewPlanOrigin;
  }) => Promise<void>;
  onUnlockVault: (file: PendingVaultFile, passphrase: string) => Promise<void>;
  onSaveVault: () => Promise<void>;
  onDownloadBackupCopy: () => Promise<void>;
  onChangePassphrase: (newPassphrase: string) => Promise<void>;
  onLockVault: () => void;
  onImportLegacyJson: (config: PlannerConfig, label?: string) => void;
  onMigrateLegacyBrowserData: () => void;
  onDiscardLegacyBrowserData: () => void;
  // Snapshot actions
  onSaveScenario: (name: string) => void;
  onLoadScenario: (scenario: SavedScenario) => void;
  onDeleteScenario: (id: string) => void;
}

export const VaultManagerModal: React.FC<VaultManagerModalProps> = ({
  open,
  initialMode = 'vault',
  externalPendingFile = null,
  onClearExternalPendingFile,
  onClose,
  currentConfig,
  savedScenarios,
  activeScenarioId,
  activePlanName,
  isVaultUnlocked,
  vaultFileName,
  hasLinkedFileHandle,
  hasUnsavedChanges,
  lastSavedAt,
  autoSaveToFile,
  hasLegacyBrowserData,
  onToggleAutoSave,
  onCreatePlanVault,
  onUnlockVault,
  onSaveVault,
  onDownloadBackupCopy,
  onChangePassphrase,
  onLockVault,
  onImportLegacyJson,
  onMigrateLegacyBrowserData,
  onDiscardLegacyBrowserData,
  onSaveScenario,
  onLoadScenario,
  onDeleteScenario,
}) => {
  const [activeTab, setActiveTab] = useState<'vault' | 'snapshots'>('vault');
  const [subView, setSubView] = useState<'overview' | 'create' | 'unlock' | 'rekey'>('overview');

  // New Plan / Create Vault fields
  const [planNameInput, setPlanNameInput] = useState('');
  const [customFileName, setCustomFileName] = useState('');
  const [fileNameManuallyEdited, setFileNameManuallyEdited] = useState(false);
  const [newPlanOrigin, setNewPlanOrigin] = useState<NewPlanOrigin>('current');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);

  // Pending file for unlock
  const [pendingFile, setPendingFile] = useState<PendingVaultFile | null>(null);
  const [unlockPassphrase, setUnlockPassphrase] = useState('');
  const [showUnlockPassphrase, setShowUnlockPassphrase] = useState(false);

  // Snapshots tab state
  const [newSnapshotName, setNewSnapshotName] = useState('');

  // Feedback / busy state
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const directFsSupported = canUseDirectFileSystem();

  useEffect(() => {
    if (!open) return;
    setStatusMessage(null);
    setPassphrase('');
    setConfirmPassphrase('');
    setUnlockPassphrase('');
    setShowPassphrase(false);
    setShowUnlockPassphrase(false);
    setFileNameManuallyEdited(false);

    if (externalPendingFile) {
      setPendingFile(externalPendingFile);
      setActiveTab('vault');
      setSubView('unlock');
      return;
    }

    setPendingFile(null);

    if (initialMode === 'snapshots') {
      setActiveTab('snapshots');
      setSubView('overview');
    } else if (initialMode === 'new-plan') {
      setActiveTab('vault');
      setSubView('create');
      setPlanNameInput('');
      setCustomFileName('');
      setNewPlanOrigin('fresh');
    } else if (initialMode === 'save-current') {
      const defaultPlanName =
        activePlanName ||
        (currentConfig.scenario?.userName
          ? `${currentConfig.scenario.userName} Retirement Plan`
          : 'My Retirement Plan');
      setActiveTab('vault');
      setSubView('create');
      setPlanNameInput(defaultPlanName);
      setCustomFileName(planNameToVaultFileName(defaultPlanName));
      setNewPlanOrigin('current');
    } else {
      setActiveTab('vault');
      setSubView('overview');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMode, externalPendingFile]);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
  };

  const handlePlanNameChange = (value: string) => {
    setPlanNameInput(value);
    if (!fileNameManuallyEdited) {
      setCustomFileName(value.trim() ? planNameToVaultFileName(value) : '');
    }
  };

  const openCreateForm = (origin: NewPlanOrigin) => {
    setStatusMessage(null);
    setPassphrase('');
    setConfirmPassphrase('');
    setFileNameManuallyEdited(false);
    setNewPlanOrigin(origin);
    if (origin === 'current') {
      const baseName =
        activePlanName ||
        (currentConfig.scenario?.userName
          ? `${currentConfig.scenario.userName} Retirement Plan`
          : 'My Retirement Plan');
      setPlanNameInput(baseName);
      setCustomFileName(planNameToVaultFileName(baseName));
    } else {
      setPlanNameInput('');
      setCustomFileName('');
    }
    setActiveTab('vault');
    setSubView('create');
  };

  const handleChooseFileToOpen = async () => {
    setStatusMessage(null);
    if (directFsSupported) {
      try {
        const picked = await pickOpenVaultFileHandle();
        if (picked) {
          handleLoadedRawFile(picked.fileName, picked.content, picked.handle);
          return;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        showStatus('error', err?.message || 'Could not open file.');
        return;
      }
    }
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showStatus('error', 'Selected file exceeds the 5 MB limit.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      handleLoadedRawFile(file.name, content, null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.onerror = () => {
      showStatus('error', 'Failed to read selected file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleLoadedRawFile = (
    fileName: string,
    content: string,
    handle: FileSystemFileHandleLike | null
  ) => {
    if (isEncryptedVaultText(content)) {
      setPendingFile({ fileName, content, handle });
      setUnlockPassphrase('');
      setSubView('unlock');
      setActiveTab('vault');
      return;
    }

    // Legacy unencrypted JSON backup support
    try {
      const parsed = JSON.parse(content);
      const importedConfig: PlannerConfig =
        parsed?.config && parsed.config.scenario ? parsed.config : parsed;
      if (!importedConfig || !importedConfig.scenario || !Array.isArray(importedConfig.sources)) {
        throw new Error('Invalid file format');
      }
      const cleanName = fileName.replace(/\.json$/i, '');
      onImportLegacyJson(importedConfig, cleanName);
      setPlanNameInput(cleanName);
      setCustomFileName(planNameToVaultFileName(cleanName));
      setFileNameManuallyEdited(false);
      setNewPlanOrigin('current');
      setSubView('create');
      showStatus(
        'success',
        `Loaded legacy JSON "${fileName}". Set a passphrase below to save it as an encrypted ${VAULT_FILE_EXTENSION} vault.`
      );
    } catch {
      showStatus(
        'error',
        `Unrecognized file format. Select an encrypted ${VAULT_FILE_EXTENSION} vault or a legacy RetirePlan JSON backup.`
      );
    }
  };

  const handleSubmitUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingFile || !unlockPassphrase) return;
    setIsBusy(true);
    setStatusMessage(null);
    try {
      await onUnlockVault(pendingFile, unlockPassphrase);
      setPendingFile(null);
      setUnlockPassphrase('');
      onClearExternalPendingFile?.();
      setSubView('overview');
      onClose();
    } catch (err: any) {
      showStatus('error', err?.message || 'Incorrect passphrase or corrupted vault file.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPlanName = planNameInput.trim();
    if (!trimmedPlanName) {
      showStatus('error', 'Please enter a name for this plan.');
      return;
    }
    if (passphrase.length < 8) {
      showStatus('error', 'Passphrase must be at least 8 characters long.');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      showStatus('error', 'Passphrases do not match.');
      return;
    }
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const rawFileName = customFileName.trim() || planNameToVaultFileName(trimmedPlanName);
      const safeFileName = rawFileName.replace(/[/\\]/g, '-');
      await onCreatePlanVault({
        planName: trimmedPlanName,
        fileName: safeFileName,
        passphrase,
        origin: newPlanOrigin,
      });
      setPassphrase('');
      setConfirmPassphrase('');
      setSubView('overview');
      onClose();
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        showStatus('error', err?.message || 'Failed to save encrypted plan vault.');
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubmitRekey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase.length < 8) {
      showStatus('error', 'New passphrase must be at least 8 characters long.');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      showStatus('error', 'Passphrases do not match.');
      return;
    }
    setIsBusy(true);
    setStatusMessage(null);
    try {
      await onChangePassphrase(passphrase);
      setPassphrase('');
      setConfirmPassphrase('');
      setSubView('overview');
      showStatus('success', 'Passphrase updated and vault re-encrypted.');
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        showStatus('error', err?.message || 'Failed to update passphrase.');
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleQuickSave = async () => {
    if (!isVaultUnlocked) {
      openCreateForm('current');
      return;
    }
    setIsBusy(true);
    setStatusMessage(null);
    try {
      await onSaveVault();
      showStatus(
        'success',
        hasLinkedFileHandle
          ? `Encrypted changes saved directly to ${vaultFileName}.`
          : `Updated encrypted vault downloaded (${vaultFileName}).`
      );
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        showStatus('error', err?.message || 'Failed to save encrypted vault.');
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleBackupCopy = async () => {
    if (!isVaultUnlocked) {
      openCreateForm('current');
      return;
    }
    setIsBusy(true);
    setStatusMessage(null);
    try {
      await onDownloadBackupCopy();
      showStatus('success', 'Encrypted backup copy downloaded.');
    } catch (err: any) {
      showStatus('error', err?.message || 'Failed to export encrypted backup.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleAddSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSnapshotName.trim();
    if (!trimmed) return;
    onSaveScenario(trimmed);
    setNewSnapshotName('');
    showStatus(
      'success',
      isVaultUnlocked
        ? `Added snapshot "${trimmed}". Save your plan to write it to ${vaultFileName}.`
        : `Added snapshot "${trimmed}" to session. Save as an encrypted vault file to keep it on disk.`
    );
  };

  const strength = evaluatePassphraseStrength(passphrase);
  const totalAssets = (cfg: PlannerConfig) =>
    cfg.sources.filter(s => s.monthly === 'N').reduce((sum, s) => sum + (s.balance || 0), 0);

  return (
    <Modal
      open={open}
      onClose={() => {
        onClearExternalPendingFile?.();
        onClose();
      }}
      title="Plans & Encrypted Vaults"
      subtitle="Create separate plans in their own AES-256-GCM encrypted .rpvault files or open an existing plan"
      maxWidthClass="max-w-xl"
      icon={
        <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
          <FileKey2 className="w-5 h-5" />
        </div>
      }
    >
      <div className="space-y-4">
        {/* Hidden universal file picker fallback */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".rpvault,application/octet-stream,application/json,.json"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Modal Section Tabs */}
        <div className="inline-flex w-full bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('vault')}
            className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5 ${
              activeTab === 'vault'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Plan Vault Files
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('snapshots')}
            className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5 ${
              activeTab === 'snapshots'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 text-slate-500" />
            Snapshots in Plan ({savedScenarios.length})
          </button>
        </div>

        {/* Status Banner */}
        {statusMessage && (
          <div
            className={`px-3.5 py-2.5 rounded-lg text-xs font-medium border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Legacy localStorage one-time migration notice */}
        {hasLegacyBrowserData && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <span className="font-semibold">Legacy browser storage data detected.</span>{' '}
                Import your previous plan into this session so you can save it to an encrypted{' '}
                <code className="font-mono">{VAULT_FILE_EXTENSION}</code> file, and clear unencrypted browser storage.
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap pl-6">
              <button
                type="button"
                onClick={() => {
                  onMigrateLegacyBrowserData();
                  openCreateForm('current');
                  showStatus(
                    'success',
                    'Imported previous data and cleared browser storage. Name your plan and set a passphrase below to save your encrypted vault.'
                  );
                }}
                className="px-3 py-1.5 min-h-[34px] rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors"
              >
                Import & Wipe Browser Storage
              </button>
              <button
                type="button"
                onClick={() => {
                  onDiscardLegacyBrowserData();
                  showStatus('success', 'Legacy browser storage cleared.');
                }}
                className="px-3 py-1.5 min-h-[34px] rounded-lg bg-white hover:bg-amber-100/60 border border-amber-300 text-amber-900 text-xs font-medium transition-colors"
              >
                Discard & Clear
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: PLAN VAULT FILES */}
        {activeTab === 'vault' && (
          <div className="space-y-4">
            {/* Current Plan Status Summary */}
            <div
              className={`rounded-xl border p-4 ${
                isVaultUnlocked
                  ? 'bg-emerald-50/40 border-emerald-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isVaultUnlocked
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isVaultUnlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 truncate">
                        {isVaultUnlocked
                          ? activePlanName || vaultFileName || 'Active Encrypted Plan'
                          : 'Unsaved In-Memory Session'}
                      </span>
                      {hasUnsavedChanges && (
                        <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                          Unsaved changes
                        </span>
                      )}
                    </div>
                    {isVaultUnlocked && vaultFileName && (
                      <div className="text-[11px] font-mono text-emerald-800 mt-0.5 truncate">
                        File: {vaultFileName}
                      </div>
                    )}
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      {isVaultUnlocked ? (
                        <>
                          {hasLinkedFileHandle
                            ? 'Linked directly to local encrypted file.'
                            : 'Encrypted plan vault active.'}{' '}
                          {lastSavedAt
                            ? `Last saved ${new Date(lastSavedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}.`
                            : ''}
                        </>
                      ) : (
                        'Create a new named plan or open an existing .rpvault file. Nothing is written to browser storage.'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {isVaultUnlocked && hasLinkedFileHandle && (
                <div className="mt-3 pt-3 border-t border-emerald-200/70 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoSaveToFile}
                      onChange={e => onToggleAutoSave(e.target.checked)}
                      className="w-4 h-4 rounded accent-emerald-600"
                    />
                    <span>Auto-encrypt & save edits directly to {vaultFileName}</span>
                  </label>
                  <HardDrive className="w-4 h-4 text-emerald-700 shrink-0" />
                </div>
              )}
            </div>

            {/* SUB-VIEW: OVERVIEW */}
            {subView === 'overview' && (
              <div className="space-y-3">
                {/* Primary Plan Actions: New Plan & Open Plan always prominent */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => openCreateForm(isVaultUnlocked ? 'fresh' : 'current')}
                    className="text-left p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 transition-colors space-y-1"
                  >
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                      <FilePlus2 className="w-4 h-4 text-emerald-600" />
                      New Plan
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Name a new plan (fresh or copied from current) and save it to its own encrypted{' '}
                      <code className="font-mono text-[11px]">{VAULT_FILE_EXTENSION}</code> file.
                    </p>
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={handleChooseFileToOpen}
                    className="text-left p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors space-y-1"
                  >
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                      <FolderOpen className="w-4 h-4 text-slate-600" />
                      Open Plan
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Open and decrypt a different{' '}
                      <code className="font-mono text-[11px]">{VAULT_FILE_EXTENSION}</code> plan vault to view and configure.
                    </p>
                  </button>
                </div>

                {/* Active Vault Management Actions */}
                {isVaultUnlocked && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={handleQuickSave}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        {hasLinkedFileHandle ? 'Save Plan to File' : 'Save Updated Vault'}
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={handleBackupCopy}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 text-xs font-semibold transition-colors"
                      >
                        <Download className="w-4 h-4 text-slate-500" />
                        Download Backup Copy
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setPassphrase('');
                          setConfirmPassphrase('');
                          setStatusMessage(null);
                          setSubView('rekey');
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[38px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                        Change Passphrase
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          onLockVault();
                          showStatus('success', 'Plan locked and session data cleared from memory.');
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[38px] rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs font-medium transition-colors"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Lock & Clear Session
                      </button>
                    </div>
                  </>
                )}

                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Separate Vault Files Per Plan
                  </div>
                  <p className="leading-relaxed">
                    Each plan is stored in its own encrypted{' '}
                    <code className="font-mono">{VAULT_FILE_EXTENSION}</code> file using{' '}
                    <span className="font-mono font-medium text-slate-700">AES-256-GCM</span> and{' '}
                    <span className="font-mono font-medium text-slate-700">PBKDF2-SHA256</span> (600,000 iterations).
                    You can maintain as many plans as you want (e.g. Base Plan, Early Retirement, Spouse Survivor) and switch between them anytime with <strong>Open Plan</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* SUB-VIEW: NEW PLAN / CREATE ENCRYPTED VAULT */}
            {subView === 'create' && (
              <form onSubmit={handleSubmitCreate} className="space-y-3.5 p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900">
                    New Plan &amp; Encrypted Vault File
                  </h4>
                  <button
                    type="button"
                    onClick={() => setSubView('overview')}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800"
                  >
                    Back
                  </button>
                </div>

                {/* Unsaved warning if starting fresh while current edits are unsaved */}
                {hasUnsavedChanges && newPlanOrigin === 'fresh' && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between gap-2 text-[11px] text-amber-900">
                    <span>
                      Current plan has unsaved edits that will be replaced if you start fresh.
                    </span>
                    {isVaultUnlocked && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={handleQuickSave}
                        className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-semibold whitespace-nowrap shrink-0"
                      >
                        Save Current First
                      </button>
                    )}
                  </div>
                )}

                {/* Starting configuration selector */}
                <div className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-700">Starting Point</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewPlanOrigin('fresh')}
                      className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                        newPlanOrigin === 'fresh'
                          ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-semibold">Start Fresh</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Clean default baseline values
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPlanOrigin('current')}
                      className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                        newPlanOrigin === 'current'
                          ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-semibold">Copy Current Plan</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Keep current accounts &amp; inputs
                      </div>
                    </button>
                  </div>
                </div>

                {/* Plan Name */}
                <div className="space-y-1.5">
                  <label htmlFor="new-plan-name" className="block text-xs font-semibold text-slate-700">
                    Plan Name
                  </label>
                  <input
                    id="new-plan-name"
                    type="text"
                    autoFocus
                    required
                    value={planNameInput}
                    onChange={e => handlePlanNameChange(e.target.value)}
                    placeholder="e.g. Retire at 58, Conservative Market, Coast FIRE"
                    className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                {/* Vault File Name (auto-derived from Plan Name, editable) */}
                <div className="space-y-1.5">
                  <label htmlFor="vault-filename" className="block text-xs font-semibold text-slate-700">
                    Encrypted Vault File Name
                  </label>
                  <input
                    id="vault-filename"
                    type="text"
                    value={customFileName}
                    onChange={e => {
                      setCustomFileName(e.target.value);
                      setFileNameManuallyEdited(true);
                    }}
                    placeholder={suggestVaultFileName(currentConfig, false, planNameInput)}
                    className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500">
                    Automatically generated from your plan name. Each plan saves to its own{' '}
                    <code className="font-mono">{VAULT_FILE_EXTENSION}</code> file.
                  </p>
                </div>

                {/* Passphrase */}
                <div className="space-y-1.5">
                  <label htmlFor="vault-passphrase" className="block text-xs font-semibold text-slate-700">
                    Vault Passphrase (min. 8 characters)
                  </label>
                  <div className="relative">
                    <input
                      id="vault-passphrase"
                      type={showPassphrase ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={passphrase}
                      onChange={e => setPassphrase(e.target.value)}
                      placeholder="Choose a strong passphrase for this vault"
                      className="w-full min-h-[40px] border border-slate-300 rounded-lg pl-3 pr-10 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(v => !v)}
                      aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700"
                    >
                      {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className={`text-[11px] font-medium ${strength.colorClass}`}>{strength.label}</div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="vault-confirm-passphrase" className="block text-xs font-semibold text-slate-700">
                    Confirm Passphrase
                  </label>
                  <input
                    id="vault-confirm-passphrase"
                    type={showPassphrase ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassphrase}
                    onChange={e => setConfirmPassphrase(e.target.value)}
                    placeholder="Re-enter passphrase"
                    className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Store your passphrase in a password manager. Because encryption runs 100% on your device, lost passphrases cannot be recovered.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSubView('overview')}
                    className="px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isBusy ||
                      !planNameInput.trim() ||
                      passphrase.length < 8 ||
                      passphrase !== confirmPassphrase
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {isBusy ? 'Encrypting…' : 'Create & Save Plan Vault'}
                  </button>
                </div>
              </form>
            )}

            {/* SUB-VIEW: UNLOCK EXISTING PLAN VAULT */}
            {subView === 'unlock' && pendingFile && (
              <form onSubmit={handleSubmitUnlock} className="space-y-3.5 p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900">Open Encrypted Plan</h4>
                    <p className="text-xs font-mono text-slate-500 truncate mt-0.5">{pendingFile.fileName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingFile(null);
                      onClearExternalPendingFile?.();
                      setSubView('overview');
                    }}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 shrink-0"
                  >
                    Cancel
                  </button>
                </div>

                {hasUnsavedChanges && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                    Opening this plan will replace your current unsaved session edits.
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="unlock-passphrase" className="block text-xs font-semibold text-slate-700">
                    Enter Vault Passphrase
                  </label>
                  <div className="relative">
                    <input
                      id="unlock-passphrase"
                      type={showUnlockPassphrase ? 'text' : 'password'}
                      autoComplete="current-password"
                      autoFocus
                      value={unlockPassphrase}
                      onChange={e => setUnlockPassphrase(e.target.value)}
                      placeholder="Enter passphrase to decrypt plan"
                      className="w-full min-h-[40px] border border-slate-300 rounded-lg pl-3 pr-10 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowUnlockPassphrase(v => !v)}
                      aria-label={showUnlockPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700"
                    >
                      {showUnlockPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleChooseFileToOpen}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Choose Different File
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingFile(null);
                        onClearExternalPendingFile?.();
                        setSubView('overview');
                      }}
                      className="px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isBusy || !unlockPassphrase}
                      className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      {isBusy ? 'Decrypting…' : 'Decrypt & Open Plan'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* SUB-VIEW: CHANGE PASSPHRASE */}
            {subView === 'rekey' && (
              <form onSubmit={handleSubmitRekey} className="space-y-3.5 p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900">Change Vault Passphrase</h4>
                  <button
                    type="button"
                    onClick={() => setSubView('overview')}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800"
                  >
                    Back
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="rekey-passphrase" className="block text-xs font-semibold text-slate-700">
                    New Passphrase (min. 8 characters)
                  </label>
                  <div className="relative">
                    <input
                      id="rekey-passphrase"
                      type={showPassphrase ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={passphrase}
                      onChange={e => setPassphrase(e.target.value)}
                      placeholder="Enter new passphrase"
                      className="w-full min-h-[40px] border border-slate-300 rounded-lg pl-3 pr-10 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(v => !v)}
                      aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700"
                    >
                      {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className={`text-[11px] font-medium ${strength.colorClass}`}>{strength.label}</div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="rekey-confirm" className="block text-xs font-semibold text-slate-700">
                    Confirm New Passphrase
                  </label>
                  <input
                    id="rekey-confirm"
                    type={showPassphrase ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassphrase}
                    onChange={e => setConfirmPassphrase(e.target.value)}
                    placeholder="Re-enter new passphrase"
                    className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSubView('overview')}
                    className="px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isBusy || passphrase.length < 8 || passphrase !== confirmPassphrase}
                    className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    {isBusy ? 'Re-encrypting…' : 'Update & Save Vault'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: PLAN SNAPSHOTS (STORED INSIDE THE CURRENT ENCRYPTED VAULT) */}
        {activeTab === 'snapshots' && (
          <div className="space-y-4">
            <form onSubmit={handleAddSnapshot} className="space-y-2">
              <label htmlFor="new-snapshot-name" className="block text-xs font-semibold text-slate-700">
                Save Current Configuration as a Named Snapshot
              </label>
              <div className="flex gap-2">
                <input
                  id="new-snapshot-name"
                  type="text"
                  value={newSnapshotName}
                  onChange={e => setNewSnapshotName(e.target.value)}
                  placeholder="e.g. Retire at 58, Conservative 5% Return"
                  className="flex-1 min-h-[40px] border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newSnapshotName.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Add Snapshot
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Snapshots are saved inside the currently active plan&apos;s{' '}
                <code className="font-mono">{VAULT_FILE_EXTENSION}</code> file.
              </p>
            </form>

            {savedScenarios.length === 0 ? (
              <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70">
                <Bookmark className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
                <p className="text-xs text-slate-600 font-medium">No snapshots in this plan yet</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Save snapshots to keep variations inside this vault, or use <strong>New Plan</strong> to save a separate encrypted vault file.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {savedScenarios.map(scen => {
                  const isActive = scen.id === activeScenarioId;
                  return (
                    <div
                      key={scen.id}
                      className={`flex items-center justify-between gap-3 px-4 py-3 ${
                        isActive ? 'bg-emerald-50/50' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 truncate">
                            {scen.name}
                          </span>
                          {isActive && (
                            <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Active
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                          Retire {scen.config.scenario.retDate} · {formatCurrency(totalAssets(scen.config))} portfolio ·{' '}
                          {new Date(scen.savedAt).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onLoadScenario(scen);
                            onClose();
                          }}
                          className="px-3 py-1.5 min-h-[36px] text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors"
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteScenario(scen.id)}
                          aria-label={`Delete ${scen.name}`}
                          className="p-2 min-w-[36px] min-h-[36px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {hasUnsavedChanges && (
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-3">
                <span className="text-xs text-amber-700 font-medium">
                  Plan has unsaved snapshot changes.
                </span>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handleQuickSave}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[36px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isVaultUnlocked ? 'Save Plan' : 'Encrypt & Save Plan'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
