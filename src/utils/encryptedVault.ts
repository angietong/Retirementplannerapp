import { DollarDisplayMode, PlannerConfig, SavedScenario, StressPreset } from '../types';
import { normalizeConfig, normalizeSavedScenarios } from './configNormalizer';

export const VAULT_FILE_EXTENSION = '.rpvault';
export const VAULT_FORMAT = 'RetirePlanVault';
export const VAULT_VERSION = 1;
export const VAULT_DEFAULT_ITERATIONS = 600_000;
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 2_000_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const MAX_VAULT_FILE_BYTES = 5 * 1024 * 1024; // 5 MB safety limit
const AAD_TEXT = `${VAULT_FORMAT}:v${VAULT_VERSION}`;

export interface VaultPayload {
  schemaVersion: 1;
  planName?: string;
  savedAt: string;
  activeConfig: PlannerConfig;
  activeScenarioId: string | null;
  savedScenarios: SavedScenario[];
  preferences?: {
    dollarMode: DollarDisplayMode;
    activePreset: StressPreset;
  };
}

export interface EncryptedVaultEnvelope {
  format: typeof VAULT_FORMAT;
  version: typeof VAULT_VERSION;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  cipher: 'AES-256-GCM';
  salt: string;
  iv: string;
  ciphertext: string;
}

export interface VaultKeyMaterial {
  key: CryptoKey;
  salt: Uint8Array<ArrayBuffer>;
  iterations: number;
}

// Type declarations for optional File System Access API
export interface FileSystemWritableFileStreamLike {
  write(data: string | Blob | BufferSource): Promise<void>;
  close(): Promise<void>;
}

export interface FileSystemFileHandleLike {
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStreamLike>;
}

interface WindowWithFileSystemAccess extends Window {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandleLike[]>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandleLike>;
}

function getSubtleCrypto(): SubtleCrypto {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error(
      'Web Crypto encryption requires a secure browser context (HTTPS or localhost).'
    );
  }
  return window.crypto.subtle;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function deriveVaultKey(
  passphrase: string,
  salt?: Uint8Array<ArrayBuffer>,
  iterations: number = VAULT_DEFAULT_ITERATIONS
): Promise<VaultKeyMaterial> {
  if (!passphrase || passphrase.length < 8) {
    throw new Error('Passphrase must be at least 8 characters long.');
  }
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const effectiveSalt: Uint8Array<ArrayBuffer> = salt
    ? new Uint8Array(salt)
    : window.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(SALT_BYTES)));

  const baseKey = await subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Non-extractable AES-256-GCM key held only in memory for the current session
  const derivedKey = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: effectiveSalt,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return {
    key: derivedKey,
    salt: effectiveSalt,
    iterations,
  };
}

export async function encryptVaultPayload(
  payload: VaultPayload,
  keyMaterial: VaultKeyMaterial
): Promise<EncryptedVaultEnvelope> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  // Fresh random 96-bit IV on every single save
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = encoder.encode(JSON.stringify(payload));
  const aad = encoder.encode(AAD_TEXT);

  const encryptedBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: aad,
    },
    keyMaterial.key,
    plaintext
  );

  return {
    format: VAULT_FORMAT,
    version: VAULT_VERSION,
    kdf: 'PBKDF2-SHA256',
    iterations: keyMaterial.iterations,
    cipher: 'AES-256-GCM',
    salt: bytesToBase64(keyMaterial.salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
  };
}

export function serializeVaultEnvelope(envelope: EncryptedVaultEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

export function parseVaultEnvelope(rawText: string): EncryptedVaultEnvelope {
  if (rawText.length > MAX_VAULT_FILE_BYTES) {
    throw new Error('Vault file exceeds the maximum supported size (5 MB).');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('Selected file is not a valid encrypted RetirePlan vault.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid vault file structure.');
  }

  const obj = parsed as Record<string, unknown>;
  if (
    obj.format !== VAULT_FORMAT ||
    obj.version !== VAULT_VERSION ||
    obj.kdf !== 'PBKDF2-SHA256' ||
    obj.cipher !== 'AES-256-GCM'
  ) {
    throw new Error('Unrecognized vault file format or unsupported version.');
  }

  const iterations = Number(obj.iterations);
  if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) {
    throw new Error('Invalid key derivation parameters in vault file.');
  }

  if (
    typeof obj.salt !== 'string' ||
    typeof obj.iv !== 'string' ||
    typeof obj.ciphertext !== 'string' ||
    !obj.ciphertext
  ) {
    throw new Error('Vault file is missing required encryption fields.');
  }

  const saltBytes = base64ToBytes(obj.salt);
  const ivBytes = base64ToBytes(obj.iv);
  if (saltBytes.length !== SALT_BYTES || ivBytes.length !== IV_BYTES) {
    throw new Error('Vault encryption metadata is corrupted.');
  }

  return {
    format: VAULT_FORMAT,
    version: VAULT_VERSION,
    kdf: 'PBKDF2-SHA256',
    iterations,
    cipher: 'AES-256-GCM',
    salt: obj.salt,
    iv: obj.iv,
    ciphertext: obj.ciphertext,
  };
}

export function isEncryptedVaultText(rawText: string): boolean {
  try {
    parseVaultEnvelope(rawText);
    return true;
  } catch {
    return false;
  }
}

export async function decryptVaultText(
  rawText: string,
  passphrase: string
): Promise<{ payload: VaultPayload; keyMaterial: VaultKeyMaterial }> {
  const envelope = parseVaultEnvelope(rawText);
  const subtle = getSubtleCrypto();
  const saltBytes = base64ToBytes(envelope.salt);
  const ivBytes = base64ToBytes(envelope.iv);
  const cipherBytes = base64ToBytes(envelope.ciphertext);
  const aad = new TextEncoder().encode(AAD_TEXT);

  const keyMaterial = await deriveVaultKey(passphrase, saltBytes, envelope.iterations);

  let plainBuffer: ArrayBuffer;
  try {
    plainBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes,
        additionalData: aad,
      },
      keyMaterial.key,
      cipherBytes
    );
  } catch {
    throw new Error('Incorrect passphrase or corrupted vault file.');
  }

  let parsedPayload: unknown;
  try {
    const decoded = new TextDecoder().decode(plainBuffer);
    parsedPayload = JSON.parse(decoded);
  } catch {
    throw new Error('Vault decrypted, but contained invalid JSON data.');
  }

  if (!parsedPayload || typeof parsedPayload !== 'object' || Array.isArray(parsedPayload)) {
    throw new Error('Decrypted vault payload has an unexpected structure.');
  }

  const rawObj = parsedPayload as Record<string, unknown>;
  const activeConfig = normalizeConfig(rawObj.activeConfig);
  const savedScenarios = normalizeSavedScenarios(rawObj.savedScenarios);
  const activeScenarioId =
    typeof rawObj.activeScenarioId === 'string' &&
    savedScenarios.some(s => s.id === rawObj.activeScenarioId)
      ? rawObj.activeScenarioId
      : null;

  const rawPrefs = rawObj.preferences as Record<string, unknown> | undefined;
  const dollarMode: DollarDisplayMode =
    rawPrefs?.dollarMode === 'real' ? 'real' : 'nominal';
  const validPresets: StressPreset[] = ['baseline', 'crash2008', 'stagflation', 'earlyBear', 'bull'];
  const activePreset: StressPreset =
    typeof rawPrefs?.activePreset === 'string' && validPresets.includes(rawPrefs.activePreset as StressPreset)
      ? (rawPrefs.activePreset as StressPreset)
      : 'baseline';

  const planName =
    typeof rawObj.planName === 'string' && rawObj.planName.trim()
      ? rawObj.planName.trim().slice(0, 120)
      : undefined;

  return {
    payload: {
      schemaVersion: 1,
      planName,
      savedAt: typeof rawObj.savedAt === 'string' ? rawObj.savedAt : new Date().toISOString(),
      activeConfig,
      activeScenarioId,
      savedScenarios,
      preferences: {
        dollarMode,
        activePreset,
      },
    },
    keyMaterial,
  };
}

export function planNameToVaultFileName(planName: string, isBackup = false): string {
  const safeBase =
    planName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'retirement-plan';
  if (isBackup) {
    const dateStamp = new Date().toISOString().slice(0, 10);
    return `${safeBase}-backup-${dateStamp}${VAULT_FILE_EXTENSION}`;
  }
  return `${safeBase}${VAULT_FILE_EXTENSION}`;
}

export function vaultFileNameToPlanName(fileName: string): string {
  const base = fileName.replace(/\.(rpvault|json)$/i, '').replace(/[-_]+/g, ' ').trim();
  if (!base) return 'Retirement Plan';
  return base.replace(/\b\w/g, c => c.toUpperCase());
}

export function suggestVaultFileName(
  config: PlannerConfig,
  isBackup = false,
  planName?: string | null
): string {
  const source = (planName && planName.trim()) || config.scenario?.userName || 'retirement-plan';
  return planNameToVaultFileName(source, isBackup);
}

export function canUseDirectFileSystem(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as WindowWithFileSystemAccess;
  if (typeof win.showSaveFilePicker !== 'function' || typeof win.showOpenFilePicker !== 'function') {
    return false;
  }
  // Cross-origin iframes disallow File System Access API pickers
  try {
    return window.self === window.top;
  } catch {
    return false;
  }
}

export async function pickSaveVaultFileHandle(
  suggestedName: string
): Promise<FileSystemFileHandleLike | null> {
  if (!canUseDirectFileSystem()) return null;
  const win = window as WindowWithFileSystemAccess;
  try {
    const handle = await win.showSaveFilePicker!({
      suggestedName,
      types: [
        {
          description: 'RetirePlan Encrypted Vault',
          accept: { 'application/octet-stream': [VAULT_FILE_EXTENSION] },
        },
      ],
    });
    return handle;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw err;
    }
    // Fallback cleanly if browser/context blocks File System Access API
    return null;
  }
}

export async function pickOpenVaultFileHandle(): Promise<{
  fileName: string;
  content: string;
  handle: FileSystemFileHandleLike;
} | null> {
  if (!canUseDirectFileSystem()) return null;
  const win = window as WindowWithFileSystemAccess;
  try {
    const [handle] = await win.showOpenFilePicker!({
      multiple: false,
      types: [
        {
          description: 'RetirePlan Encrypted Vault',
          accept: {
            'application/octet-stream': [VAULT_FILE_EXTENSION],
            'application/json': ['.json', VAULT_FILE_EXTENSION],
          },
        },
      ],
    });
    if (!handle) return null;
    const file = await handle.getFile();
    if (file.size > MAX_VAULT_FILE_BYTES) {
      throw new Error('Selected file is too large (maximum 5 MB).');
    }
    const content = await file.text();
    return {
      fileName: file.name,
      content,
      handle,
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw err;
    }
    return null;
  }
}

export async function writeToFileHandle(
  handle: FileSystemFileHandleLike,
  content: string
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

export function downloadEncryptedVaultFile(content: string, fileName: string): void {
  const safeFileName = fileName.endsWith(VAULT_FILE_EXTENSION)
    ? fileName
    : `${fileName}${VAULT_FILE_EXTENSION}`;
  const blob = new Blob([content], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Legacy browser localStorage detection & one-time migration helpers
const LEGACY_CONFIG_KEY = 'rp_config_v2';
const LEGACY_SCENARIOS_KEY = 'rp_saved_scenarios_v1';
const LEGACY_OLD_CONFIG_KEY = 'rp_config';

export function hasLegacyBrowserStorage(): boolean {
  try {
    return Boolean(
      localStorage.getItem(LEGACY_CONFIG_KEY) ||
      localStorage.getItem(LEGACY_SCENARIOS_KEY) ||
      localStorage.getItem(LEGACY_OLD_CONFIG_KEY)
    );
  } catch {
    return false;
  }
}

export function readAndClearLegacyBrowserStorage(): {
  config: PlannerConfig | null;
  scenarios: SavedScenario[];
} {
  let config: PlannerConfig | null = null;
  let scenarios: SavedScenario[] = [];
  try {
    const rawCfg = localStorage.getItem(LEGACY_CONFIG_KEY);
    if (rawCfg) {
      config = normalizeConfig(JSON.parse(rawCfg));
    }
    const rawScens = localStorage.getItem(LEGACY_SCENARIOS_KEY);
    if (rawScens) {
      scenarios = normalizeSavedScenarios(JSON.parse(rawScens));
    }
  } catch {
    // Ignore corrupted legacy entries
  }
  clearLegacyBrowserStorage();
  return { config, scenarios };
}

export function clearLegacyBrowserStorage(): void {
  try {
    localStorage.removeItem(LEGACY_CONFIG_KEY);
    localStorage.removeItem(LEGACY_SCENARIOS_KEY);
    localStorage.removeItem(LEGACY_OLD_CONFIG_KEY);
  } catch {
    // Ignore storage access errors
  }
}

export function evaluatePassphraseStrength(passphrase: string): {
  score: 0 | 1 | 2 | 3;
  label: string;
  colorClass: string;
} {
  if (!passphrase) return { score: 0, label: 'Enter a passphrase', colorClass: 'text-slate-400' };
  if (passphrase.length < 8) return { score: 0, label: 'Too short (min 8 chars)', colorClass: 'text-rose-600' };

  let points = 0;
  if (passphrase.length >= 12) points++;
  if (passphrase.length >= 16) points++;
  if (/[a-z]/.test(passphrase) && /[A-Z]/.test(passphrase)) points++;
  if (/\d/.test(passphrase)) points++;
  if (/[^a-zA-Z0-9]/.test(passphrase)) points++;

  if (points <= 1) return { score: 1, label: 'Fair — consider making it longer', colorClass: 'text-amber-600' };
  if (points <= 3) return { score: 2, label: 'Good', colorClass: 'text-emerald-600' };
  return { score: 3, label: 'Strong', colorClass: 'text-emerald-700' };
}
