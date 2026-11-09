/**
 * Unit tests for the media-generation adapters: request validation, response
 * normalization, model listings and the cost estimate. Network and files are
 * covered by the service test.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  estimateVideoCost,
  extensionFor,
  imageRequestBody,
  mediaTypeFor,
  normalizeImageModels,
  normalizeSpeechModels,
  normalizeVideoModels,
  parseImageResponse,
  parseVideoResponse,
  safeFileName,
  speechRequestBody,
  videoRequestBody,
} from '../src/host/generation.js'

test('imageRequestBody keeps known fields and rejects bad enums', () => {
  const body = imageRequestBody({
    model: 'openai/gpt-image-2',
    prompt: 'a cat',
    aspectRatio: '16:9',
    resolution: '2K',
    quality: 'high',
    format: 'png',
    seed: 7,
    extra: 'dropped',
  })
  assert.deepEqual(body, {
    model: 'openai/gpt-image-2',
    prompt: 'a cat',
    aspect_ratio: '16:9',
    resolution: '2K',
    quality: 'high',
    output_format: 'png',
    seed: 7,
  })
  assert.throws(() => imageRequestBody({ prompt: 'x' }), /model/)
  assert.throws(() => imageRequestBody({ model: 'm' }), /prompt/)
  assert.throws(() => imageRequestBody({ model: 'm', prompt: 'p', resolution: '8K' }), /resolution/)
  assert.throws(() => imageRequestBody({ model: 'm', prompt: 'p', quality: 'ultra' }), /quality/)
})

test('videoRequestBody fills defaults and only sends generate_audio when asked', () => {
  assert.deepEqual(videoRequestBody({ model: 'google/veo-3.1', prompt: 'sea' }), {
    model: 'google/veo-3.1',
    prompt: 'sea',
    duration: 8,
    resolution: '720p',
  })
  const body = videoRequestBody({
    model: 'google/veo-3.1',
    prompt: 'sea',
    duration: 4,
    resolution: '1080p',
    aspectRatio: '9:16',
    generateAudio: true,
    seed: 3,
  })
  assert.equal(body.duration, 4)
  assert.equal(body.resolution, '1080p')
  assert.equal(body.aspect_ratio, '9:16')
  assert.equal(body.generate_audio, true)
  assert.equal(body.seed, 3)
  assert.throws(() => videoRequestBody({ model: 'm', prompt: 'p', duration: 0 }), /duration/)
  assert.throws(() => videoRequestBody({ model: 'm', prompt: 'p', resolution: '8K' }), /resolution/)
})

test('speechRequestBody defaults to mp3 and bounds speed', () => {
  assert.deepEqual(speechRequestBody({ model: 'tts/a', input: 'hello', voice: 'v1' }), {
    model: 'tts/a',
    input: 'hello',
    voice: 'v1',
    response_format: 'mp3',
  })
  const body = speechRequestBody({ model: 'tts/a', text: 'hi', voice: 'v', format: 'wav', speed: 1.5, instructions: 'warm' })
  assert.equal(body.input, 'hi')
  assert.equal(body.response_format, 'wav')
  assert.equal(body.speed, 1.5)
  assert.equal(body.instructions, 'warm')
  assert.throws(() => speechRequestBody({ model: 'tts/a', input: 'x' }), /voice/)
  assert.throws(() => speechRequestBody({ model: 'tts/a', input: 'x', voice: 'v', format: 'exe' }), /format/)
})

test('parseImageResponse reads base64 images and the cost', () => {
  const parsed = parseImageResponse({
    created: 1748372400,
    data: [{ b64_json: 'AAA', media_type: 'image/webp' }, { b64_json: '' }, {}],
    usage: { cost: 0.04 },
  })
  assert.equal(parsed.created, 1748372400)
  assert.deepEqual(parsed.images, [{ base64: 'AAA', mediaType: 'image/webp' }])
  assert.equal(parsed.cost, 0.04)
  assert.deepEqual(parseImageResponse({}), { created: null, images: [], cost: null })
})

test('parseVideoResponse normalizes submit and poll payloads', () => {
  const job = parseVideoResponse({
    id: 'gen-vid-1',
    status: 'completed',
    urls: ['https://x/v.mp4', 42],
    unsigned_urls: ['https://x/v.mp4'],
    expires_at: 1748372400,
    usage: { cost: 0.56 },
  })
  assert.equal(job.id, 'gen-vid-1')
  assert.equal(job.status, 'completed')
  assert.deepEqual(job.urls, ['https://x/v.mp4'])
  assert.deepEqual(job.unsigned_urls, ['https://x/v.mp4'])
  assert.equal(job.expires_at, 1748372400)
  assert.equal(job.cost, 0.56)
  assert.equal(parseVideoResponse(null).status, 'unknown')
})

test('model listings are compact and drop junk', () => {
  assert.deepEqual(normalizeImageModels({ data: [{ id: 'a', name: 'A' }, null, {}] }), [
    { id: 'a', name: 'A', description: '', is_free: null, free_known: false },
  ])
  const video = normalizeVideoModels({
    data: [{
      id: 'v', name: 'V',
      pricing_skus: { duration_seconds_720p: '0.5' },
      supported_resolutions: ['720p', '1080p'],
      supported_durations: [4, 8],
      supported_aspect_ratios: ['16:9'],
      generate_audio: true,
    }],
  })
  assert.equal(video[0].pricing_skus.duration_seconds_720p, '0.5')
  assert.deepEqual(video[0].resolutions, ['720p', '1080p'])
  assert.deepEqual(video[0].durations, [4, 8])
  assert.equal(video[0].generate_audio, true)
  assert.deepEqual(normalizeSpeechModels({ data: [{ id: 'tts/a', name: 'TTS A' }] }), [
    { id: 'tts/a', name: 'TTS A', description: '', pricing: {}, is_free: false, free_known: true },
  ])
})

test('estimateVideoCost prefers the requested resolution and multiplies by seconds', () => {
  assert.equal(estimateVideoCost({ duration_seconds_720p: '0.5', duration_seconds_1080p: '0.9' }, { resolution: '720p', duration: 8 }), 4)
  assert.equal(estimateVideoCost({ duration_seconds_720p: '0.5' }, { resolution: '1080p', duration: 4 }), 2)
  assert.equal(estimateVideoCost({ cents_per_video_output_second_720p: '0.5' }, { resolution: '720p', duration: 6 }), 3)
  assert.equal(estimateVideoCost({}, { resolution: '720p' }), null)
  assert.equal(estimateVideoCost(null), null)
})

test('media types, extensions and file names stay inside the generated dir', () => {
  assert.equal(mediaTypeFor('png'), 'image/png')
  assert.equal(mediaTypeFor('mp4'), 'video/mp4')
  assert.equal(mediaTypeFor('unknown'), 'application/octet-stream')
  assert.equal(extensionFor('image/webp'), 'webp')
  assert.equal(extensionFor('video/mp4; charset=binary'), 'mp4')
  assert.equal(extensionFor('text/plain', 'bin'), 'bin')
  assert.equal(safeFileName('../../etc/passwd'), 'passwd')
  assert.equal(safeFileName('..\\..\\secret.txt'), 'secret.txt')
  assert.equal(safeFileName('a b/c?.png'), 'c_.png')
  assert.equal(safeFileName(''), 'file.bin')
})


test('free models are detected from pricing; image lists stay unknown', () => {
  const speech = normalizeSpeechModels({
    data: [
      { id: 'tts/free', pricing: { prompt: '0', completion: '0' } },
      { id: 'tts/paid', pricing: { prompt: '0.000015', completion: '0' } },
    ],
  })
  assert.equal(speech[0].is_free, true)
  assert.equal(speech[0].free_known, true)
  assert.equal(speech[1].is_free, false)

  const video = normalizeVideoModels({ data: [{ id: 'v', pricing_skus: { duration_seconds_720p: '0' } }] })
  assert.equal(video[0].is_free, true)
  assert.equal(video[0].free_known, true)

  const image = normalizeImageModels({ data: [{ id: 'i', name: 'I' }] })
  assert.equal(image[0].is_free, null)
  assert.equal(image[0].free_known, false)
})
