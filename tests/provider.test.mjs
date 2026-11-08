/**
 * Provider wiring tests: the plugin may connect or extend the OpenRouter route,
 * but must never drop other providers, copy the secret, or touch selection.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { ensureProviderModel, ensureProviderRoute } from '../src/host/provider.js'

function fakeCtx({ providers = {}, hasEditor = true } = {}) {
  const edits = []
  const entry = { options: { id: 'llm-pi-ai' }, fiber: {} }
  const ctx = {
    get: (name) => ({
      loader: { entries: () => [entry] },
      configEditor: hasEditor ? {
        configuration: () => [{ entry, inherited: {}, override: { providers } }],
        edit: async (_entry, change) => {
          edits.push(change({ providers: structuredClone(providers) }, {}))
        },
      } : undefined,
    })[name],
  }
  return { ctx, edits }
}

const ROUTE = {
  provider: 'openrouter',
  entryId: 'llm-pi-ai',
  apiKeyRef: 'OPENROUTER_API_KEY',
  baseURL: 'https://openrouter.ai/api/v1',
}

test('connects the OpenRouter route once, preserving existing providers', async () => {
  const { ctx, edits } = fakeCtx({ providers: { deepseek: { displayName: 'DeepSeek', models: [{ id: 'deepseek-flash' }] } } })
  const result = await ensureProviderRoute(ctx, ROUTE)

  assert.equal(result.created, true)
  assert.equal(edits.length, 1)
  const providers = edits[0].providers
  assert.deepEqual(providers.deepseek.models, [{ id: 'deepseek-flash' }])
  assert.equal(providers.openrouter.apiKeyEnv, 'OPENROUTER_API_KEY')
  assert.equal(providers.openrouter.api, 'openai-completions')
  assert.equal(providers.openrouter.baseURL, 'https://openrouter.ai/api/v1')
  assert.deepEqual(providers.openrouter.models, [])
  // The secret never enters the profile: only the credential reference does.
  assert.equal('apiKey' in providers.openrouter, false)
  assert.equal(JSON.stringify(edits[0]).includes('sk-or-'), false)
})

test('leaves an existing OpenRouter route untouched', async () => {
  const existing = { displayName: 'OpenRouter (резерв)', apiKeyEnv: 'OPENROUTER_API_KEY', models: [{ id: 'a/b' }] }
  const { ctx, edits } = fakeCtx({ providers: { openrouter: existing } })
  const result = await ensureProviderRoute(ctx, ROUTE)

  assert.equal(result.created, false)
  assert.equal(result.exists, true)
  assert.equal(edits.length, 0)
})

test('reports a missing config-editor instead of throwing', async () => {
  const { ctx } = fakeCtx({ hasEditor: false })
  const result = await ensureProviderRoute(ctx, ROUTE)

  assert.equal(result.created, false)
  assert.match(result.reason, /config-editor/)
})

test('adds a model to an existing route without dropping other providers', async () => {
  const { ctx, edits } = fakeCtx({
    providers: {
      deepseek: { displayName: 'DeepSeek' },
      openrouter: { displayName: 'OpenRouter', apiKeyEnv: 'OPENROUTER_API_KEY', models: [{ id: 'existing/model' }] },
    },
  })
  const result = await ensureProviderModel(ctx, {
    provider: 'openrouter',
    entryId: 'llm-pi-ai',
    model: { id: 'vendor/free', name: 'Vendor Free', context_length: 1_000_000 },
  })

  assert.equal(result.changed, true)
  assert.equal(edits.length, 1)
  const providers = edits[0].providers
  assert.deepEqual(providers.deepseek, { displayName: 'DeepSeek' })
  assert.equal(providers.openrouter.models.length, 2)
  assert.deepEqual(providers.openrouter.models[1], {
    id: 'vendor/free',
    name: 'Vendor Free',
    contextWindow: 1_000_000,
    maxTokens: 32000,
  })
})

test('does not edit the route when the model is already configured', async () => {
  const { ctx, edits } = fakeCtx({
    providers: { openrouter: { models: [{ id: 'vendor/free' }] } },
  })
  const result = await ensureProviderModel(ctx, {
    provider: 'openrouter',
    entryId: 'llm-pi-ai',
    model: { id: 'vendor/free' },
  })

  assert.equal(result.changed, false)
  assert.equal(edits.length, 0)
})
