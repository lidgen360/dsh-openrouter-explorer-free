/**
 * dsh-openrouter-models — host half.
 *
 * Mounts the OpenRouter catalog service and its HTTP API for the Web client.
 * The browser half (`exports["./client"]` → lib/client.js) contributes the
 * right-sidebar tab. Everything else — 24h refresh, price history, discounts,
 * free-model auto-routing — lives in src/host/.
 */
import { createCatalogService } from './src/host/service.js'
import { registerRoutes } from './src/host/api.js'

export const name = 'openrouter-models'

/** The host half only needs the Web server to publish its API. */
export const inject = ['webServer']

/**
 * @param {object} ctx Cordis plugin context
 * @param {object} [config] row config from the composed patch layers
 */
export function apply(ctx, config = {}) {
  const service = createCatalogService(ctx, config && typeof config === 'object' ? config : {})

  ctx.effect(() => service.start(), 'openrouter-models: catalog lifecycle')
  ctx.effect(() => registerRoutes(ctx, service), 'openrouter-models: http api')
}
