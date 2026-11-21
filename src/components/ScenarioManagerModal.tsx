import React, { useState, useRef } from 'react';
import { Bookmark, Plus, Trash2, Check, Download, Upload, FolderOpen } from 'lucide-react';
import { PlannerConfig } from '../types';
import { Modal } from './Modal';
import { formatCurrency } from '../utils/formatters';

export interface SavedScenario {
  id: string;
  name: string;
  savedAt: string;
  config: PlannerConfig;
}

interface ScenarioManagerModalProps {
  open: boolean;
  onClose: () => void;
  currentConfig: PlannerConfig;
  savedScenarios: SavedScenario[];
  activeScenarioId: string | null;
  onSaveScenario: (name: string) => void;
  onLoadScenario: (scenario: SavedScenario) => void;
  onDeleteScenario: (id: string) => void;
  onImportConfig: (config: PlannerConfig, label?: string) => void;
}

export const ScenarioManagerModal: React.FC<ScenarioManagerModalProps> = ({
  open,
  onClose,
  currentConfig,
  savedScenarios,
  activeScenarioId,
  onSaveScenario,
  onLoadScenario,
  onDeleteScenario,
  onImportConfig,
}) => {
  const [newName, setNewName] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onSaveScenario(trimmed);
    setNewName('');
    setStatusMessage({ type: 'success', text: `Saved "${trimmed}" to local browser storage.` });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleExportJson = () => {
    try {
      const payload = {
        app: 'RetirementFinancialPlanner',
        version: 2,
        exportedAt: new Date().toISOString(),
        config: currentConfig,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (currentConfig.scenario.userName || 'retirement-plan')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
      a.href = url;
      a.download = `${safeName}-plan-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage({ type: 'success', text: 'Plan backup downloaded as JSON.' });
      setTimeout(() => setStatusMessage(null), 3500);
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to export plan JSON.' });
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const importedConfig: PlannerConfig = parsed?.config && parsed.config.scenario ? parsed.config : parsed;
        if (!importedConfig || !importedConfig.scenario || !Array.isArray(importedConfig.sources)) {
          throw new Error('Invalid plan file structure');
        }
        onImportConfig(importedConfig, file.name.replace(/\.json$/i, ''));
        setStatusMessage({ type: 'success', text: `Loaded plan from ${file.name}.` });
        setTimeout(() => setStatusMessage(null), 3500);
      } catch {
        setStatusMessage({ type: 'error', text: 'Could not read file. Select a valid Retirement Planner JSON backup.' });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const totalAssets = (cfg: PlannerConfig) =>
    cfg.sources.filter(s => s.monthly === 'N').reduce((sum, s) => sum + (s.balance || 0), 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Saved Plans & Backup"
      subtitle="Save multiple retirement variations locally or back up your plan as JSON"
      maxWidthClass="max-w-xl"
      icon={
        <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
          <FolderOpen className="w-5 h-5" />
        </div>
      }
    >
      <div className="space-y-5">
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

        {/* Save current configuration */}
        <form onSubmit={handleSave} className="space-y-2">
          <label htmlFor="new-scenario-name" className="block text-xs font-semibold text-slate-700">
            Save Current Configuration as a Named Snapshot
          </label>
          <div className="flex gap-2">
            <input
              id="new-scenario-name"
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Retire at 58, Conservative 5% Return"
              className="flex-1 min-h-[40px] border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newName.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Save Snapshot
            </button>
          </div>
        </form>

        {/* Saved list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Saved Snapshots ({savedScenarios.length})
            </span>
          </div>

          {savedScenarios.length === 0 ? (
            <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70">
              <Bookmark className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
              <p className="text-xs text-slate-600 font-medium">No saved snapshots yet</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Save your current plan above before testing big retirement date or spending changes.
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
                        Retire {scen.config.scenario.retDate} · {formatCurrency(totalAssets(scen.config))} portfolio · Saved {new Date(scen.savedAt).toLocaleDateString()}
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
        </div>

        {/* JSON Export / Import */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Transfer plans between devices or keep an offline JSON backup.
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Import JSON
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Backup JSON
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
