/**
 * Unit tests for the model-facing generation tools: registration, argument
 * shapes, auto model resolution and the video poll/download flow.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { generationToolDefinitions, registerGenerationTools } from '../src/host/tools.js'

function fakeService(overrides = {}) {
  const calls = []
  const service = {
    toolsEnabled: true,
    generationModels: async (input) => ({ ok: true, kind: input.kind, models: [{ id: `${input.kind}-auto` }] }),
    generateImage: async (input) => {
      calls.push({ method: 'generateImage', input })
      return { ok: true, model: input.model, cost: 0.04, files: [{ name: 'a.png', path: '/tmp/gen/a.png', url: '/generated/a.png', mediaType: 'image/png', bytes: 12 }] }
    },
    generateVideo: async (input) => {
      calls.push({ method: 'generateVideo', input })
      return { ok: true, model: input.model, estimate: 0.56, job: { id: 'gen-vid-1', status: 'pending' } }
    },
    videoJob: async (input) => {
      calls.push({ method: 'videoJob', input })
      return { ok: true, job: { id: input.id, status: 'completed', cost: 0.56 } }
    },
    videoContent: async (input) => {
      calls.push({ method: 'videoContent', input })
      return { ok: true, file: { name: 'v.mp4', path: '/tmp/gen/v.mp4', url: '/generated/v.mp4', mediaType: 'video/mp4', bytes: 1024 } }
    },
    synthesizeSpeech: async (input) => {
      calls.push({ method: 'synthesizeSpeech', input })
      return { ok: true, model: input.model, file: { name: 's.mp3', path: '/tmp/gen/s.mp3', url: '/generated/s.mp3', mediaType: 'audio/mpeg', bytes: 64 } }
    },
    ...overrides,
  }
  return { service, calls }
}

test('definitions expose four tools with JSON Schema parameters', () => {
  const { service } = fakeService()
  const defs = generationToolDefinitions(service)
  assert.deepEqual(defs.map((definition) => definition.name), [
    'openrouter_generate_image',
    'openrouter_generate_video',
    'openrouter_video_status',
    'openrouter_generate_speech',
  ])
  for (const definition of defs) {
    assert.equal(definition.parameters.type, 'object')
    assert.equal(typeof definition.output.render, 'function')
    assert.deepEqual(definition.output.render({}, 'ok'), [{ type: 'text', text: 'ok' }])
  }
  assert.deepEqual(defs[0].parameters.required, ['prompt'])
  assert.deepEqual(defs[2].parameters.required, ['id'])
  assert.equal(defs[0].parameters.additionalProperties, false)
})

test('image tool resolves the first model when omitted and returns the saved path', async () => {
  const { service, calls } = fakeService()
  const image = generationToolDefinitions(service)[0]
  const text = await image.execute({ prompt: 'a cat' })
  assert.equal(calls[0].method, 'generateImage')
  assert.equal(calls[0].input.model, 'image-auto')
  assert.match(text, /Изображение готово/)
  assert.match(text, /\/tmp\/gen\/a\.png/)
  assert.match(text, /\$0\.04/)
})

test('video submit returns the job id and the status tool downloads the MP4', async () => {
  const { service, calls } = fakeService()
  const definitions = generationToolDefinitions(service)
  const submit = await definitions[1].execute({ prompt: 'sea', model: 'vid/model', duration: 4 })
  assert.match(submit, /gen-vid-1/)
  assert.match(submit, /openrouter_video_status/)
  assert.equal(calls.find((call) => call.method === 'generateVideo').input.model, 'vid/model')

  const status = await definitions[2].execute({ id: 'gen-vid-1' })
  assert.match(status, /Видео готово/)
  assert.match(status, /\/tmp\/gen\/v\.mp4/)
  assert.equal(calls.filter((call) => call.method === 'videoJob').length, 1)
  assert.equal(calls.filter((call) => call.method === 'videoContent').length, 1)
})

test('pending video reports the status without downloading', async () => {
  const { service, calls } = fakeService({
    videoJob: async () => ({ ok: true, job: { id: 'gen-vid-2', status: 'pending' } }),
  })
  const status = await generationToolDefinitions(service)[2].execute({ id: 'gen-vid-2' })
  assert.match(status, /статус pending/)
  assert.equal(calls.filter((call) => call.method === 'videoContent').length, 0)
})

test('speech tool returns the audio path', async () => {
  const { service, calls } = fakeService()
  const speech = generationToolDefinitions(service)[3]
  const text = await speech.execute({ input: 'hello', voice: 'v1' })
  assert.equal(calls[0].method, 'synthesizeSpeech')
  assert.equal(calls[0].input.model, 'speech-auto')
  assert.match(text, /\/tmp\/gen\/s\.mp3/)
  assert.match(text, /audio\/mpeg/)
})

test('service failures become tool errors with a readable message', async () => {
  const { service } = fakeService({
    generateImage: async () => ({ ok: false, error: 'нет ключа OpenRouter' }),
  })
  await assert.rejects(() => generationToolDefinitions(service)[0].execute({ prompt: 'x' }), /нет ключа OpenRouter/)
})

test('registerGenerationTools registers four tools and disposes them', () => {
  const { service } = fakeService()
  const registered = []
  const disposed = []
  const disposers = []
  const ctx = {
    tools: {
      register(definition) {
        registered.push(definition)
        const dispose = () => disposed.push(definition.name)
        disposers.push(dispose)
        return dispose
      },
    },
  }
  const disposeAll = registerGenerationTools(ctx, service)
  assert.equal(registered.length, 4)
  disposeAll()
  assert.equal(disposed.length, 4)
})

test('registration is a silent no-op without tools or with tools disabled', () => {
  const { service } = fakeService()
  assert.doesNotThrow(() => registerGenerationTools({}, service)())
  const disabled = { tools: { register() { throw new Error('must not register') } } }
  assert.doesNotThrow(() => registerGenerationTools(disabled, { ...service, toolsEnabled: false })())
})
