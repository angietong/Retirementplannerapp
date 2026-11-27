import React from 'react';
import { renderToString } from 'react-dom/server';

const mockStorage: Record<string, string> = {};
global.localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => {
    mockStorage[key] = val;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const k in mockStorage) delete mockStorage[k];
  },
  length: 0,
  key: () => null,
} as any;

if (typeof window === 'undefined') {
  (global as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: global.localStorage,
    navigator: { onLine: true },
    matchMedia: () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  };
}

import { DEFAULT_CONFIG, STRESS_PRESETS } from '../src/defaultData';
import { runSimulation } from '../src/engine';
import { App } from '../src/App';
import { Sidebar } from '../src/components/Sidebar';
import { Header } from '../src/components/Header';
import { KeyResultsCards } from '../src/components/KeyResultsCards';
import { ChartsSection } from '../src/components/ChartsSection';
import { PlanTable } from '../src/components/PlanTable';
import { InputsSection, InputSubSection } from '../src/components/InputsSection';
import { PhaseExplanationCard } from '../src/components/PhaseExplanationCard';
import { RothConversionSimulator } from '../src/components/RothConversionSimulator';
import { AcaSubsidySimulator } from '../src/components/AcaSubsidySimulator';
import { WhatIfComparisonView } from '../src/components/WhatIfComparisonView';
import { VaultManagerModal } from '../src/components/VaultManagerModal';

console.log('Testing full App and all components across modes, presets, and vault states...');

// 1. Render root App shell
const appHtml = renderToString(<App />);
if (!appHtml.includes('Retirement Overview') || !appHtml.includes('New Plan') || !appHtml.includes('Open Plan')) {
  throw new Error('Root App did not render expected workspace landmarks');
}
console.log('  [PASS] Root <App /> rendered cleanly with New Plan / Open Plan controls');

const configs = [
  { name: 'Default 2-Person Couple', config: DEFAULT_CONFIG },
  {
    name: 'Single Person',
    config: {
      ...DEFAULT_CONFIG,
      scenario: { ...DEFAULT_CONFIG.scenario, hasSpouse: false },
      acaOptimization: { ...DEFAULT_CONFIG.acaOptimization!, householdSize: 1 as const },
    },
  },
  {
    name: 'ACA Enabled with adjustMedicalExpensesWithSubsidy',
    config: {
      ...DEFAULT_CONFIG,
      acaOptimization: {
        ...DEFAULT_CONFIG.acaOptimization!,
        enabled: true,
        adjustMedicalExpensesWithSubsidy: true,
      },
    },
  },
  {
    name: 'Roth Conversion Enabled outsideBrokerage',
    config: {
      ...DEFAULT_CONFIG,
      rothConversion: {
        ...DEFAULT_CONFIG.rothConversion!,
        enabled: true,
        taxPaymentMethod: 'outsideBrokerage' as const,
      },
    },
  },
  {
    name: 'Roth Conversion Enabled withhold',
    config: {
      ...DEFAULT_CONFIG,
      rothConversion: {
        ...DEFAULT_CONFIG.rothConversion!,
        enabled: true,
        taxPaymentMethod: 'withhold' as const,
      },
    },
  },
  {
    name: 'Phased Living Expenses (SS 62 before Medicare 65)',
    config: {
      ...DEFAULT_CONFIG,
      expenses: {
        ...DEFAULT_CONFIG.expenses,
        usePhaseExpenses: true,
        phaseExpDaily: {
          retirement: 6500,
          earlyRetirement: 6400,
          four01k: 6200,
          ira: 6000,
          socialSecurity: 5600,
          medicare: 5200,
          rmd: 4500,
        },
      },
    },
  },
  {
    name: 'Swapped Medicare (65) before SS (67) + Phased Expenses',
    config: {
      ...DEFAULT_CONFIG,
      milestones: {
        ...DEFAULT_CONFIG.milestones,
        ssMinAge: 67,
        spouseSsMinAge: 67,
        medicareAge: 65,
      },
      expenses: {
        ...DEFAULT_CONFIG.expenses,
        usePhaseExpenses: true,
        phaseExpDaily: {
          retirement: 6800,
          earlyRetirement: 6500,
          four01k: 6300,
          ira: 6100,
          socialSecurity: 5400,
          medicare: 5700,
          rmd: 4600,
        },
      },
    },
  },
];

const inputSubSections: InputSubSection[] = ['sources', 'scenario', 'expenses', 'rates'];
let renderCount = 0;

for (const c of configs) {
  for (const preset of STRESS_PRESETS) {
    const sim = runSimulation(c.config, preset.id);
    for (const dollarMode of ['nominal', 'real'] as const) {
      try {
        renderToString(
          <Sidebar
            activeSection="overview"
            onSelectSection={() => {}}
            config={c.config}
            savedCount={2}
            activePlanName="Early Retirement 58"
            isVaultUnlocked={true}
            vaultFileName="early-retirement-58.rpvault"
            hasUnsavedChanges={true}
            onNewPlan={() => {}}
            onOpenPlan={() => {}}
            onOpenVault={() => {}}
            onReset={() => {}}
            mobileOpen={false}
            onCloseMobile={() => {}}
          />
        );
        renderToString(
          <Header
            config={c.config}
            activeSection="overview"
            activePlanName="Early Retirement 58"
            activeScenarioName="Base Snapshot"
            isVaultUnlocked={true}
            vaultFileName="early-retirement-58.rpvault"
            hasUnsavedChanges={true}
            onOpenMobileMenu={() => {}}
            onNewPlan={() => {}}
            onOpenPlan={() => {}}
            onOpenVault={() => {}}
            onQuickSaveVault={() => {}}
            onExport={() => {}}
          />
        );
        renderToString(
          <KeyResultsCards
            summary={sim.summary}
            years={sim.years}
            config={c.config}
            dollarMode={dollarMode}
            stressPresetName={preset.name}
            isCustomStress={preset.id !== 'baseline'}
          />
        );
        renderToString(
          <KeyResultsCards
            summary={sim.summary}
            years={sim.years}
            config={c.config}
            dollarMode={dollarMode}
            stressPresetName={preset.name}
            isCustomStress={preset.id !== 'baseline'}
            compact
          />
        );
        renderToString(<PhaseExplanationCard config={c.config} />);
        renderToString(
          <ChartsSection
            config={c.config}
            years={sim.years}
            showAll={true}
            dollarMode={dollarMode}
            stressPreset={preset.id}
          />
        );
        renderToString(
          <PlanTable years={sim.years} config={c.config} dollarMode={dollarMode} />
        );
        renderToString(
          <RothConversionSimulator
            config={c.config}
            stressPreset={preset.id}
            dollarMode={dollarMode}
            onUpdateConfig={() => {}}
          />
        );
        renderToString(
          <AcaSubsidySimulator
            config={c.config}
            stressPreset={preset.id}
            dollarMode={dollarMode}
            onUpdateConfig={() => {}}
          />
        );
        renderToString(
          <WhatIfComparisonView
            config={c.config}
            stressPreset={preset.id}
            dollarMode={dollarMode}
            getDeflator={yr => Math.pow(1 + c.config.rates.inflationRate, yr)}
            onApplyStrategy={() => {}}
          />
        );
        for (const section of inputSubSections) {
          const sectionHtml = renderToString(
            <InputsSection
              config={c.config}
              section={section}
              years={sim.years}
              onChange={() => {}}
              onNavigateToAcaSimulator={() => {}}
            />
          );
          if (section === 'expenses' && c.config.expenses.usePhaseExpenses) {
            const normalizedHtml = sectionHtml.replace(/<!-- -->/g, '');
            if (!normalizedHtml.includes('Apply Baseline to All') || !normalizedHtml.includes('P6 · RMD Mandate')) {
              throw new Error(`Phased expenses editor did not render expected 7-phase schedule for ${c.name}`);
            }
            if (c.config.milestones.ssMinAge > c.config.milestones.medicareAge) {
              if (!normalizedHtml.includes('P4 · Medicare') || !normalizedHtml.includes('P5 · Social Security')) {
                throw new Error(`Swapped phase order did not render P4 Medicare / P5 Social Security for ${c.name}`);
              }
            } else {
              if (!normalizedHtml.includes('P4 · Social Security') || !normalizedHtml.includes('P5 · Medicare')) {
                throw new Error(`Default phase order did not render P4 Social Security / P5 Medicare for ${c.name}`);
              }
            }
          }
        }
        renderCount++;
      } catch (err: any) {
        console.error(`[FAIL] ${c.name} | ${preset.id} | ${dollarMode}:`, err.stack || err.message);
        process.exit(1);
      }
    }
  }
}

// 2. Render VaultManagerModal across all states
for (const mode of ['vault', 'snapshots', 'new-plan', 'save-current'] as const) {
  const modalHtml = renderToString(
    <VaultManagerModal
      open={true}
      initialMode={mode}
      onClose={() => {}}
      currentConfig={DEFAULT_CONFIG}
      savedScenarios={[
        { id: 's1', name: 'Base Case', savedAt: new Date().toISOString(), config: DEFAULT_CONFIG },
      ]}
      activeScenarioId="s1"
      activePlanName="Retire at 58"
      isVaultUnlocked={mode === 'vault'}
      vaultFileName="retire-at-58.rpvault"
      hasLinkedFileHandle={true}
      hasUnsavedChanges={true}
      lastSavedAt={new Date().toISOString()}
      autoSaveToFile={true}
      hasLegacyBrowserData={false}
      onToggleAutoSave={() => {}}
      onCreatePlanVault={async () => {}}
      onUnlockVault={async () => {}}
      onSaveVault={async () => {}}
      onDownloadBackupCopy={async () => {}}
      onChangePassphrase={async () => {}}
      onLockVault={() => {}}
      onImportLegacyJson={() => {}}
      onMigrateLegacyBrowserData={() => {}}
      onDiscardLegacyBrowserData={() => {}}
      onSaveScenario={() => {}}
      onLoadScenario={() => {}}
      onDeleteScenario={() => {}}
    />
  );
  if (!modalHtml.includes('Plans &amp; Encrypted Vaults')) {
    throw new Error(`VaultManagerModal failed to render properly in mode ${mode}`);
  }
}
console.log(`  [PASS] Rendered ${renderCount} config/preset/dollarMode combinations + 4 VaultManagerModal modes cleanly!`);
console.log('ALL COMPONENTS AND TABS RENDERED CLEANLY WITHOUT ERRORS!');
