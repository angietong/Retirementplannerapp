import React from 'react';
import { renderToString } from 'react-dom/server';

const mockStorage: Record<string, string> = {};
global.localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => { mockStorage[key] = val; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { for (const k in mockStorage) delete mockStorage[k]; },
  length: 0,
  key: () => null,
} as any;

if (typeof window === 'undefined') {
  (global as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: global.localStorage,
    navigator: { onLine: true },
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  };
}

import { DEFAULT_CONFIG, STRESS_PRESETS } from '../src/defaultData';
import { runSimulation } from '../src/engine';
import { Header } from '../src/components/Header';
import { KeyResultsCards } from '../src/components/KeyResultsCards';
import { ChartsSection } from '../src/components/ChartsSection';
import { PlanTable } from '../src/components/PlanTable';
import { InputsSection } from '../src/components/InputsSection';
import { PhaseExplanationCard } from '../src/components/PhaseExplanationCard';
import { RothConversionSimulator } from '../src/components/RothConversionSimulator';
import { AcaSubsidySimulator } from '../src/components/AcaSubsidySimulator';
import { WhatIfComparisonView } from '../src/components/WhatIfComparisonView';

console.log('Testing components in isolation across all modes and presets...');

const configs = [
  { name: 'Default 2-Person Couple', config: DEFAULT_CONFIG },
  {
    name: 'Single Person',
    config: {
      ...DEFAULT_CONFIG,
      scenario: { ...DEFAULT_CONFIG.scenario, hasSpouse: false },
      acaOptimization: { ...DEFAULT_CONFIG.acaOptimization, householdSize: 1 as const },
    },
  },
  {
    name: 'ACA Enabled with adjustMedicalExpensesWithSubsidy',
    config: {
      ...DEFAULT_CONFIG,
      acaOptimization: { ...DEFAULT_CONFIG.acaOptimization, enabled: true, adjustMedicalExpensesWithSubsidy: true },
    },
  },
  {
    name: 'Roth Conversion Enabled outsideBrokerage',
    config: {
      ...DEFAULT_CONFIG,
      rothConversion: { ...DEFAULT_CONFIG.rothConversion, enabled: true, taxPaymentMethod: 'outsideBrokerage' as const },
    },
  },
  {
    name: 'Roth Conversion Enabled fromConversion',
    config: {
      ...DEFAULT_CONFIG,
      rothConversion: { ...DEFAULT_CONFIG.rothConversion, enabled: true, taxPaymentMethod: 'fromConversion' as const },
    },
  },
];

for (const c of configs) {
  for (const preset of STRESS_PRESETS) {
    const sim = runSimulation(c.config, preset.id);
    for (const dollarMode of ['nominal', 'real'] as const) {
      try {
        renderToString(
          <Header
            config={c.config}
            summary={sim.summary}
            activeTab="overview"
            setActiveTab={() => {}}
            onReset={() => {}}
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
        renderToString(<PhaseExplanationCard config={c.config} />);
        renderToString(
          <ChartsSection
            config={c.config}
            years={sim.years}
            showAll={true}
            dollarMode={dollarMode}
            onDollarModeChange={() => {}}
          />
        );
        renderToString(
          <PlanTable
            years={sim.years}
            config={c.config}
            dollarMode={dollarMode}
            onDollarModeChange={() => {}}
          />
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
            getDeflator={(yr) => Math.pow(1 + c.config.rates.inflationRate, yr)}
          />
        );
        renderToString(
          <InputsSection
            config={c.config}
            onChange={() => {}}
            onNavigateToAcaSimulator={() => {}}
          />
        );
      } catch (err: any) {
        console.error(`[FAIL] ${c.name} | ${preset.id} | ${dollarMode}:`, err.stack || err.message);
        process.exit(1);
      }
    }
  }
}

console.log('ALL COMPONENTS AND TABS RENDERED CLEANLY WITHOUT ERRORS!');
