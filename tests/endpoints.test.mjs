/** Provider endpoints and generated-file deletion (host-side, offline). */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createCatalogService } from '../src/host/service.js'

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-openrouter-media-'))
}

test('modelEndpoints normalizes per-token pricing into $/1M', async () => {
  const dir = tempDir()
  const service = createCatalogService({}, { stateFile: path.join(dir, 'state.json'), generationDir: dir }, {
    resolveApiKey: () => 'test-key',
    now: () => new Date('2026-11-10T10:00:00.000Z'),
    fetchImpl: async (url) => {
      assert.match(String(url), /\/models\/vendor%2Fmodel\/endpoints|\/models\/vendor\/model\/endpoints/)
      return new Response(JSON.stringify({
        data: {
          endpoints: [{
            provider_name: 'Provider A',
            context_length: 128000,
            pricing: { prompt: '0.0000005', completion: '0.0000015' },
            quantization: 'fp8',
            uptime_last_30m: 99.5,
            latency_last_30m: 420,
          }],
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  const result = await service.modelEndpoints({ id: 'vendor/model' })
  assert.equal(result.ok, true)
  assert.equal(result.models.length, 1)
  assert.equal(result.models[0].provider, 'Provider A')
  assert.equal(result.models[0].prompt_usd_per_1m, 0.5)
  assert.equal(result.models[0].completion_usd_per_1m, 1.5)
  assert.equal(result.models[0].latency_last_30m, 420)
  assert.equal(result.models[0].uptime_last_30m, 99.5)
})

test('deleteGenerated removes the file and keeps traversal inside the dir', async () => {
  const dir = tempDir()
  fs.writeFileSync(path.join(dir, 'image-1.png'), Buffer.from('png'))
  const service = createCatalogService({}, { stateFile: path.join(dir, 'state.json'), generationDir: dir }, {
    resolveApiKey: () => 'test-key',
  })
  const result = await service.deleteGenerated({ name: 'image-1.png' })
  assert.equal(result.ok, true)
  assert.equal(fs.existsSync(path.join(dir, 'image-1.png')), false)
  const escape = await service.deleteGenerated({ name: '../state.json' })
  assert.equal(escape.ok, true)
  assert.equal(fs.existsSync(path.join(dir, 'state.json')), false)
})
