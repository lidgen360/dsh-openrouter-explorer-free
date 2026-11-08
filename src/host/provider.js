/**
 * Enable one model on the harness's OpenRouter route through the sanctioned
 * config-editor seam. The route profile is narrowed by `models: [...]`; a model
 * absent from that list cannot be selected, so auto-routing adds it first.
 * The edit keeps YAML comments and applies through Loader/HMR immediately.
 */

/** Resolve the provider route entry and its effective (inherited + profile) config. */
function providerConfig(loader, editor, entryId) {
  const entry = [...loader.entries()].find((candidate) => candidate?.options?.id === entryId && candidate.fiber !== undefined)
  if (!entry) throw new Error(`не найден провайдерский плагин «${entryId}»`)
  const row = editor.configuration().find((item) => item?.entry?.options?.id === entryId)
  const base = { ...(row?.inherited ?? {}), ...(row?.override ?? {}) }
  return { entry, base, providers: { ...(base.providers ?? {}) } }
}

/**
 * Connect the OpenRouter route once, using the credential reference only —
 * the secret itself never enters the profile. Existing routes are preserved;
 * the currently selected model and session are never touched.
 * @returns {Promise<{created: boolean, exists?: boolean, reason?: string}>}
 */
export async function ensureProviderRoute(ctx, { provider, entryId, apiKeyRef, baseURL, displayName = 'OpenRouter' }) {
  const loader = ctx?.get?.('loader')
  const editor = ctx?.get?.('configEditor')
  if (!loader || !editor) return { created: false, reason: 'config-editor недоступен' }
  let entry
  let providers
  try {
    ;({ entry, providers } = providerConfig(loader, editor, entryId))
  } catch (error) {
    return { created: false, reason: String(error?.message || error) }
  }
  if (providers[provider]) return { created: false, exists: true }

  const profile = {
    displayName,
    apiKeyEnv: apiKeyRef,
    api: 'openai-completions',
    baseURL,
    models: [],
  }
  providers[provider] = profile
  await editor.edit(entry, (current, inherited) => ({
    ...inherited,
    ...current,
    providers: { ...(inherited?.providers ?? {}), ...(current?.providers ?? {}), [provider]: profile },
  }))
  return { created: true }
}

/**
 * Ensure `model.id` is part of the configured provider catalog.
 * @returns {Promise<{changed: boolean}>} whether the profile was edited.
 */
export async function ensureProviderModel(ctx, { provider, entryId, model, maxTokens = 32000 }) {
  const loader = ctx?.get?.('loader')
  const editor = ctx?.get?.('configEditor')
  if (!loader || !editor) throw new Error('нужны сервисы loader и config-editor')
  const { entry, providers } = providerConfig(loader, editor, entryId)
  const profile = { ...(providers[provider] ?? {}) }
  const models = Array.isArray(profile.models) ? profile.models.map((item) => (item && typeof item === 'object' ? { ...item } : item)) : []

  if (models.some((item) => item && item.id === model.id)) return { changed: false }

  const next = {
    id: model.id,
    name: model.name || model.id,
    ...(Number.isFinite(model.context_length) ? { contextWindow: Math.max(1024, Math.round(model.context_length)) } : {}),
    maxTokens,
  }
  models.push(next)
  profile.models = models
  providers[provider] = profile

  await editor.edit(entry, (current, inherited) => ({
    ...inherited,
    ...current,
    providers: { ...(inherited?.providers ?? {}), ...(current?.providers ?? {}), [provider]: profile },
  }))
  return { changed: true }
}
