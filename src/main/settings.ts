import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { coerceSettings, type PersistedSettings } from '../shared/settings'

function settingsPath(): string {
  return join(app.getPath('userData'), 'juxta-settings.json')
}

/** Load persisted settings, tolerating a missing or corrupt file. */
export async function loadSettings(): Promise<PersistedSettings> {
  try {
    const raw = await readFile(settingsPath(), 'utf8')
    return coerceSettings(JSON.parse(raw))
  } catch {
    return coerceSettings(undefined)
  }
}

export async function saveSettings(settings: PersistedSettings): Promise<void> {
  try {
    await writeFile(settingsPath(), JSON.stringify(settings, null, 2), 'utf8')
  } catch {
    // Non-fatal: settings are a convenience, not critical state.
  }
}
