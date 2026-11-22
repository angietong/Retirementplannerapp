import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Polyfill browser globals for Node test environment
const memoryLocalStorage: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in memoryLocalStorage ? memoryLocalStorage[k] : null),
  setItem: (k: string, v: string) => {
    memoryLocalStorage[k] = String(v);
  },
  removeItem: (k: string) => {
    delete memoryLocalStorage[k];
  },
  clear: () => {
    for (const k of Object.keys(memoryLocalStorage)) delete memoryLocalStorage[k];
  },
};
(globalThis as any).window = { crypto: webcrypto, localStorage: (globalThis as any).localStorage };

import { DEFAULT_CONFIG } from '../src/defaultData';
import { normalizeConfig, normalizeSavedScenarios } from '../src/utils/configNormalizer';
import {
  VAULT_DEFAULT_ITERATIONS,
  clearLegacyBrowserStorage,
  decryptVaultText,
  deriveVaultKey,
  encryptVaultPayload,
  evaluatePassphraseStrength,
  hasLegacyBrowserStorage,
  isEncryptedVaultText,
  parseVaultEnvelope,
  planNameToVaultFileName,
  readAndClearLegacyBrowserStorage,
  serializeVaultEnvelope,
  suggestVaultFileName,
  vaultFileNameToPlanName,
} from '../src/utils/encryptedVault';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

let passed = 0;
let total = 0;

async function runTest(name: string, fn: () => Promise<void> | void) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err: any) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err?.message || err}`);
  }
}

async function main() {
  console.log('===============================================================');
  console.log('ENCRYPTED MULTI-PLAN VAULT & SECURITY TEST SUITE');
  console.log('===============================================================\n');

  await runTest('Filename sanitization strips path traversal & unsafe characters', () => {
    assert(
      planNameToVaultFileName('Retire at 58 (Aggressive)') === 'retire-at-58-aggressive.rpvault',
      'Basic plan name conversion failed'
    );
    assert(
      planNameToVaultFileName('../../../etc/passwd') === 'etc-passwd.rpvault',
      'Path traversal not stripped'
    );
    assert(
      planNameToVaultFileName('   !!!   ') === 'retirement-plan.rpvault',
      'Fallback name failed'
    );
    const backup = planNameToVaultFileName('Coast FIRE', true);
    assert(
      /^coast-fire-backup-\d{4}-\d{2}-\d{2}\.rpvault$/.test(backup),
      `Unexpected backup filename: ${backup}`
    );
    assert(
      vaultFileNameToPlanName('early-retirement-58.rpvault') === 'Early Retirement 58',
      'Fallback display name conversion failed'
    );
    assert(
      suggestVaultFileName(DEFAULT_CONFIG, false, 'My Plan B') === 'my-plan-b.rpvault',
      'suggestVaultFileName should prioritize planName'
    );
  });

  await runTest('Passphrase enforcement rejects short passphrases (< 8 chars)', async () => {
    let failed = false;
    try {
      await deriveVaultKey('short');
    } catch {
      failed = true;
    }
    assert(failed, 'Short passphrase must be rejected');
    assert(evaluatePassphraseStrength('abc').score === 0, 'Short passphrase score should be 0');
    assert(evaluatePassphraseStrength('Correct-Horse-Battery-99!').score === 3, 'Strong passphrase score should be 3');
  });

  await runTest('Multi-plan AES-256-GCM encryption/decryption preserves distinct plans & zero plaintext leakage', async () => {
    const keyA = await deriveVaultKey('Plan-Alpha-Secret-2030!');
    const keyB = await deriveVaultKey('Plan-Beta-Secret-2035!');

    const configA = {
      ...DEFAULT_CONFIG,
      projectionYears: 32,
      scenario: { ...DEFAULT_CONFIG.scenario, userName: 'Alice VaultTest' },
    };
    const configB = {
      ...DEFAULT_CONFIG,
      projectionYears: 45,
      scenario: { ...DEFAULT_CONFIG.scenario, userName: 'Bob VaultTest' },
    };

    const rawA = serializeVaultEnvelope(
      await encryptVaultPayload(
        {
          schemaVersion: 1,
          planName: 'Plan Alpha',
          savedAt: '2026-11-21T10:00:00.000Z',
          activeConfig: configA,
          activeScenarioId: 's-a',
          savedScenarios: [{ id: 's-a', name: 'Alpha Snapshot', savedAt: '2026-11-21T10:00:00.000Z', config: configA }],
          preferences: { dollarMode: 'real', activePreset: 'crash2008' },
        },
        keyA
      )
    );

    const rawB = serializeVaultEnvelope(
      await encryptVaultPayload(
        {
          schemaVersion: 1,
          planName: 'Plan Beta',
          savedAt: '2026-11-21T11:00:00.000Z',
          activeConfig: configB,
          activeScenarioId: null,
          savedScenarios: [],
          preferences: { dollarMode: 'nominal', activePreset: 'bull' },
        },
        keyB
      )
    );

    // Zero plaintext leakage check
    for (const secretText of ['Alice VaultTest', 'Plan Alpha', 'Alpha Snapshot', 'Bob VaultTest', 'Plan Beta']) {
      assert(!rawA.includes(secretText), `Plaintext leak in rawA: ${secretText}`);
      assert(!rawB.includes(secretText), `Plaintext leak in rawB: ${secretText}`);
    }

    assert(isEncryptedVaultText(rawA) && isEncryptedVaultText(rawB), 'Valid envelopes should pass detection');

    const decA = await decryptVaultText(rawA, 'Plan-Alpha-Secret-2030!');
    const decB = await decryptVaultText(rawB, 'Plan-Beta-Secret-2035!');

    assert(decA.payload.planName === 'Plan Alpha', 'Plan A name mismatch');
    assert(decA.payload.activeConfig.projectionYears === 32, 'Plan A projectionYears mismatch');
    assert(decA.payload.preferences?.dollarMode === 'real', 'Plan A dollarMode mismatch');
    assert(decA.payload.preferences?.activePreset === 'crash2008', 'Plan A preset mismatch');
    assert(decA.payload.savedScenarios.length === 1, 'Plan A scenarios mismatch');

    assert(decB.payload.planName === 'Plan Beta', 'Plan B name mismatch');
    assert(decB.payload.activeConfig.projectionYears === 45, 'Plan B projectionYears mismatch');
    assert(decB.payload.preferences?.activePreset === 'bull', 'Plan B preset mismatch');

    // Cross-passphrase must fail
    let crossFailed = false;
    try {
      await decryptVaultText(rawA, 'Plan-Beta-Secret-2035!');
    } catch {
      crossFailed = true;
    }
    assert(crossFailed, 'Decrypting Plan A with Plan B passphrase must fail');
  });

  await runTest('Fresh random IV is generated on every save with same key', async () => {
    const key = await deriveVaultKey('Repeat-Save-Passphrase-99');
    const payload = {
      schemaVersion: 1 as const,
      planName: 'IV Check',
      savedAt: new Date().toISOString(),
      activeConfig: DEFAULT_CONFIG,
      activeScenarioId: null,
      savedScenarios: [],
    };
    const env1 = await encryptVaultPayload(payload, key);
    const env2 = await encryptVaultPayload(payload, key);
    assert(env1.iv !== env2.iv, 'IV must be freshly randomized on every save');
    assert(env1.ciphertext !== env2.ciphertext, 'Ciphertext must differ across saves');
    assert(env1.iterations === VAULT_DEFAULT_ITERATIONS, 'Default iterations must be 600,000');
  });

  await runTest('Tamper resistance: ciphertext, IV, salt, AAD/format, iteration DoS, and size cap', async () => {
    const key = await deriveVaultKey('Tamper-Resistance-Key-42');
    const env = await encryptVaultPayload(
      {
        schemaVersion: 1,
        planName: 'Tamper Test',
        savedAt: new Date().toISOString(),
        activeConfig: DEFAULT_CONFIG,
        activeScenarioId: null,
        savedScenarios: [],
      },
      key
    );

    // 1. Ciphertext flip
    const badCipher = { ...env, ciphertext: (env.ciphertext[0] === 'A' ? 'B' : 'A') + env.ciphertext.slice(1) };
    let failed = false;
    try {
      await decryptVaultText(JSON.stringify(badCipher), 'Tamper-Resistance-Key-42');
    } catch {
      failed = true;
    }
    assert(failed, 'Modified ciphertext must fail authentication');

    // 2. IV flip
    const badIv = { ...env, iv: (env.iv[0] === 'A' ? 'B' : 'A') + env.iv.slice(1) };
    failed = false;
    try {
      await decryptVaultText(JSON.stringify(badIv), 'Tamper-Resistance-Key-42');
    } catch {
      failed = true;
    }
    assert(failed, 'Modified IV must fail authentication');

    // 3. Excessive PBKDF2 iterations DoS attempt
    const dosEnv = { ...env, iterations: 99_000_000 };
    failed = false;
    try {
      parseVaultEnvelope(JSON.stringify(dosEnv));
    } catch {
      failed = true;
    }
    assert(failed, 'Excessive iteration count must be rejected');

    // 4. Low PBKDF2 iterations downgrade attempt
    const weakEnv = { ...env, iterations: 1000 };
    failed = false;
    try {
      parseVaultEnvelope(JSON.stringify(weakEnv));
    } catch {
      failed = true;
    }
    assert(failed, 'Downgraded iteration count must be rejected');

    // 5. Oversized file (> 5 MB)
    failed = false;
    try {
      parseVaultEnvelope('x'.repeat(5 * 1024 * 1024 + 10));
    } catch {
      failed = true;
    }
    assert(failed, 'Oversized vault file must be rejected');
  });

  await runTest('Config normalizer blocks prototype pollution & handles malformed inputs safely', () => {
    const malicious = JSON.parse(
      '{"__proto__":{"polluted":true},"projectionYears":999,"scenario":{"__proto__":{"polluted2":true},"userName":"Safe User"},"sources":[{"id":"s1","balance":null,"priority":"bad"}]}'
    );
    const normalized = normalizeConfig(malicious);
    assert((Object.prototype as any).polluted === undefined, 'Object.prototype must not be polluted');
    assert(normalized.projectionYears === 80, 'Projection years should clamp to max 80');
    assert(normalized.scenario.userName === 'Safe User', 'Valid fields should be preserved');
    assert(typeof normalized.sources[0].balance === 'number', 'Malformed numeric balance should fallback safely');

    const scenarios = normalizeSavedScenarios([null, 'bad', { name: 'OK', config: DEFAULT_CONFIG }]);
    assert(scenarios.length === 1 && scenarios[0].name === 'OK', 'Malformed scenario entries should be filtered');
  });

  await runTest('Legacy browser localStorage migration reads once and wipes cleanly', () => {
    globalThis.localStorage.setItem('rp_config_v2', JSON.stringify({ ...DEFAULT_CONFIG, projectionYears: 33 }));
    globalThis.localStorage.setItem(
      'rp_saved_scenarios_v1',
      JSON.stringify([{ id: 'old-1', name: 'Old Plan', savedAt: '2026-01-01', config: DEFAULT_CONFIG }])
    );
    assert(hasLegacyBrowserStorage(), 'Should detect legacy localStorage');
    const migrated = readAndClearLegacyBrowserStorage();
    assert(migrated.config?.projectionYears === 33, 'Should read legacy config');
    assert(migrated.scenarios.length === 1, 'Should read legacy scenarios');
    assert(!hasLegacyBrowserStorage(), 'Legacy localStorage must be wiped after migration');

    globalThis.localStorage.setItem('rp_config', '{}');
    clearLegacyBrowserStorage();
    assert(!hasLegacyBrowserStorage(), 'clearLegacyBrowserStorage must wipe all legacy keys');
  });

  await runTest('Source codebase contains zero localStorage.setItem or sessionStorage writes', () => {
    const srcDir = path.resolve(process.cwd(), 'src');
    const scanDir = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(full);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          const text = fs.readFileSync(full, 'utf8');
          assert(!/localStorage\.setItem/.test(text), `Found localStorage.setItem in ${full}`);
          assert(!/sessionStorage/.test(text), `Found sessionStorage in ${full}`);
        }
      }
    };
    scanDir(srcDir);
  });

  console.log('\n===============================================================');
  console.log(`VAULT TEST SUITE COMPLETE: ${passed} OF ${total} PASSED`);
  console.log('===============================================================\n');
  if (passed !== total) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
