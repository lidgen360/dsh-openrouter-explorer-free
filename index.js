/**
 * dsh-openrouter-explorer-free — host half.
 *
 * Works in every DSH profile: the catalog service (24h refresh, price history,
 * discounts, free-model auto-routing) needs no server at all, and the HTTP API
 * for the Web client is mounted only when the profile has a web server. The
 * browser half (`exports["./client"]` → lib/client.js) is served by the Web GUI
 * and ignored by headless, SDK and ACP profiles.
 */
import { createCatalogService } from './src/host/service.js'
import { registerRoutes } from './src/host/api.js'
import { registerGenerationTools } from './src/host/tools.js'

export const name = 'openrouter-explorer-free'

/**
 * `webServer` is optional on purpose: headless, SDK and ACP profiles have no
 * browser and must still load this plugin (the catalog and its scheduler keep
 * working there, so a later Web session reuses the same persisted history).
 */
export const inject = []

/**
 * @param {object} ctx Cordis plugin context
 * @param {object} [config] row config from the composed patch layers
 */
export function apply(ctx, config) {
  const service = createCatalogService(ctx, config && typeof config === 'object' ? config : {})

  ctx.effect(() => service.start(), 'openrouter-explorer-free: catalog lifecycle')

  // The API exists only beside a Web server; other profiles skip it silently.
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => registerRoutes(webCtx, service), 'openrouter-explorer-free: http api')
  })

  // Model-facing generation tools exist only where the agent has a tools
  // registry; `tools: false` in the row config disables them explicitly.
  ctx.inject(['tools'], (toolsCtx) => {
    toolsCtx.effect(() => registerGenerationTools(toolsCtx, service), 'openrouter-explorer-free: generation tools')
  })
}
