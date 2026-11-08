/** Where the plugin keeps its state: `$DSH_HOME` (default `~/.dsh`). */
import os from 'node:os'
import path from 'node:path'

/** Resolved DSH home directory. */
export function dshHome() {
  const configured = String(process.env.DSH_HOME || '').trim()
  return configured ? path.resolve(configured) : path.join(os.homedir(), '.dsh')
}

/** Path used before the 0.4.0 rename; read once for a seamless migration. */
export function legacyStateFilePath() {
  return path.join(dshHome(), 'openrouter-models', 'state.json')
}

/** Absolute path of the persisted catalog state. */
export function stateFilePath() {
  const override = String(process.env.DSH_OPENROUTER_MODELS_FILE || '').trim()
  if (override) return path.resolve(override)
  return path.join(dshHome(), 'openrouter-explorer-free', 'state.json')
}
