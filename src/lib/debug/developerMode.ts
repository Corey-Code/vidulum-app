import browser from 'webextension-polyfill';
import { FEATURES } from '@/lib/config/features';

const SETTINGS_KEY = 'vidulum_settings';
const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;
const ORIGINAL_CONSOLE_KEY = '__vidulumOriginalConsoleMethods';

type ConsoleMethod = (typeof CONSOLE_METHODS)[number];
type ConsoleMethodMap = Record<ConsoleMethod, (...args: unknown[]) => void>;

function getOriginalConsoleMethods(): ConsoleMethodMap {
  const globalObj = globalThis as typeof globalThis & {
    [ORIGINAL_CONSOLE_KEY]?: ConsoleMethodMap;
  };

  if (!globalObj[ORIGINAL_CONSOLE_KEY]) {
    const originals = {} as ConsoleMethodMap;
    for (const method of CONSOLE_METHODS) {
      originals[method] = console[method].bind(console);
    }
    globalObj[ORIGINAL_CONSOLE_KEY] = originals;
  }

  return globalObj[ORIGINAL_CONSOLE_KEY] as ConsoleMethodMap;
}

/**
 * Enable/disable runtime console output for developer mode.
 * When disabled, all console methods become no-ops.
 */
export function setDeveloperModeLogging(enabled: boolean): void {
  const originals = getOriginalConsoleMethods();
  const noop = () => {};

  for (const method of CONSOLE_METHODS) {
    console[method] = enabled ? originals[method] : noop;
  }
}

/**
 * Initialize console logging gate from persisted settings.
 * Defaults to FEATURES.DEVELOPER_MODE when storage is unavailable.
 */
export async function initDeveloperModeLogging(): Promise<void> {
  // Apply default immediately to avoid startup log noise.
  setDeveloperModeLogging(!!FEATURES.DEVELOPER_MODE);

  try {
    const result = await browser.storage.local.get(SETTINGS_KEY);
    const settings = result[SETTINGS_KEY] || {};
    const enabled = settings.features?.DEVELOPER_MODE ?? FEATURES.DEVELOPER_MODE;
    setDeveloperModeLogging(!!enabled);
  } catch {
    // Keep default if storage is unavailable.
  }
}
