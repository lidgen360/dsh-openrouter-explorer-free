/**
 * Media generation adapters for OpenRouter's dedicated APIs.
 *
 * Generation is deliberately kept apart from the chat catalog: the harness
 * talks `chat/completions` (text only), while images, video and speech live on
 * their own endpoints:
 *   - `POST /images`                → base64 images, billed per generation
 *   - `POST /videos` + polling      → async job, MP4 content on completion
 *   - `POST /audio/speech`          → raw audio bytes
 *
 * This module is pure: it validates inputs and normalizes payloads. Network,
 * file storage and caching live in service.js.
 */

export const IMAGE_MODELS_PATH = '/images/models'
export const IMAGE_GENERATE_PATH = '/images'
export const VIDEO_MODELS_PATH = '/videos/models'
export const VIDEO_SUBMIT_PATH = '/videos'
export const SPEECH_MODELS_PATH = '/models?output_modalities=speech'
export const SPEECH_GENERATE_PATH = '/audio/speech'

export const IMAGE_RESOLUTIONS = ['1K', '2K', '4K']
export const IMAGE_QUALITIES = ['auto', 'low', 'medium', 'high']
export const IMAGE_FORMATS = ['png', 'jpeg', 'webp']
export const VIDEO_RESOLUTIONS = ['360p', '480p', '720p', '1080p', '2K', '4K']
export const AUDIO_FORMATS = ['mp3', 'pcm', 'wav', 'opus', 'flac', 'aac']

const MEDIA_TYPES = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  pcm: 'audio/pcm',
  wav: 'audio/wav',
  opus: 'audio/ogg',
  flac: 'audio/flac',
  aac: 'audio/aac',
}

/** Content type for a stored file extension. */
export function mediaTypeFor(extension) {
  return MEDIA_TYPES[String(extension || '').toLowerCase().replace(/^\./, '')] || 'application/octet-stream'
}

/** File extension for a content type (or a fallback). */
export function extensionFor(contentType, fallback = 'bin') {
  const type = String(contentType || '').toLowerCase().split(';')[0].trim()
  const hit = Object.entries(MEDIA_TYPES).find(([, value]) => value === type)
  return hit ? hit[0] : fallback
}

function text(value, field, { required = true, max = 8_000 } = {}) {
  const out = String(value ?? '').trim()
  if (!out) {
    if (!required) return undefined
    throw new Error(`поле «${field}» обязательно`)
  }
  if (out.length > max) throw new Error(`поле «${field}» длиннее ${max} символов`)
  return out
}

function oneOf(value, allowed, field, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  const out = String(value).trim()
  if (!allowed.includes(out)) throw new Error(`поле «${field}»: допустимо ${allowed.join(', ')}`)
  return out
}

function integer(value, field, { min = 1, max = 600, fallback } = {}) {
  if (value === undefined || value === null || value === '') return fallback
  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`поле «${field}»: нужно число от ${min} до ${max}`)
  }
  return Math.round(number)
}

/** Request body for `POST /images`. */
export function imageRequestBody(input = {}) {
  const body = {
    model: text(input.model, 'model'),
    prompt: text(input.prompt, 'prompt'),
  }
  const aspect = input.aspectRatio ?? input.aspect_ratio
  if (aspect !== undefined && aspect !== null && String(aspect).trim()) body.aspect_ratio = String(aspect).trim()
  const resolution = oneOf(input.resolution, IMAGE_RESOLUTIONS, 'resolution', undefined)
  if (resolution) body.resolution = resolution
  const quality = oneOf(input.quality, IMAGE_QUALITIES, 'quality', undefined)
  if (quality) body.quality = quality
  const format = oneOf(input.format ?? input.output_format, IMAGE_FORMATS, 'format', undefined)
  if (format) body.output_format = format
  const seed = integer(input.seed, 'seed', { min: 0, max: 2 ** 31 - 1, fallback: undefined })
  if (seed !== undefined) body.seed = seed
  return body
}

/** Request body for `POST /videos`. */
export function videoRequestBody(input = {}) {
  const body = {
    model: text(input.model, 'model'),
    prompt: text(input.prompt, 'prompt'),
  }
  const duration = integer(input.duration, 'duration', { min: 1, max: 60, fallback: 8 })
  body.duration = duration
  const resolution = oneOf(input.resolution, VIDEO_RESOLUTIONS, 'resolution', '720p')
  body.resolution = resolution
  const aspect = input.aspectRatio ?? input.aspect_ratio
  if (aspect !== undefined && aspect !== null && String(aspect).trim()) body.aspect_ratio = String(aspect).trim()
  if (input.generateAudio === true || input.generate_audio === true) body.generate_audio = true
  const seed = integer(input.seed, 'seed', { min: 0, max: 2 ** 31 - 1, fallback: undefined })
  if (seed !== undefined) body.seed = seed
  return body
}

/** Request body for `POST /audio/speech`. */
export function speechRequestBody(input = {}) {
  const body = {
    model: text(input.model, 'model'),
    input: text(input.input ?? input.text, 'input', { max: 20_000 }),
    voice: text(input.voice, 'voice', { max: 256 }),
    response_format: oneOf(input.format ?? input.response_format, AUDIO_FORMATS, 'format', 'mp3'),
  }
  const speed = Number(input.speed)
  if (Number.isFinite(speed) && speed >= 0.25 && speed <= 4) body.speed = speed
  const instructions = text(input.instructions, 'instructions', { required: false, max: 2_000 })
  if (instructions) body.instructions = instructions
  return body
}

/** Image-generation response → images plus cost. */
export function parseImageResponse(raw) {
  const data = Array.isArray(raw?.data) ? raw.data : []
  const images = data
    .map((item) => ({
      base64: typeof item?.b64_json === 'string' ? item.b64_json : '',
      mediaType: typeof item?.media_type === 'string' ? item.media_type : 'image/png',
    }))
    .filter((item) => item.base64)
  const cost = Number(raw?.usage?.cost)
  return {
    created: Number(raw?.created) || null,
    images,
    cost: Number.isFinite(cost) ? cost : null,
  }
}

/** Video generation response (submit and poll share the same shape). */
export function parseVideoResponse(raw) {
  const payload = raw && typeof raw === 'object' ? raw : {}
  const cost = Number(payload?.usage?.cost)
  const strings = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [])
  return {
    id: String(payload.generation_id || payload.id || ''),
    status: String(payload.status || 'unknown'),
    polling_url: typeof payload.polling_url === 'string' ? payload.polling_url : null,
    urls: strings(payload.urls),
    unsigned_urls: strings(payload.unsigned_urls),
    expires_at: Number(payload.expires_at) || null,
    error: typeof payload.error === 'string' ? payload.error : null,
    cost: Number.isFinite(cost) ? cost : null,
  }
}

/** A pricing object is free when it exists and every component is zero. */
function priceIsFree(pricing) {
  if (!pricing || typeof pricing !== 'object') return false
  const values = Object.values(pricing).map(Number).filter(Number.isFinite)
  return values.length > 0 && values.every((value) => value === 0)
}

/** `GET /images/models` → compact listing. */
export function normalizeImageModels(raw) {
  return (Array.isArray(raw?.data) ? raw.data : [])
    .filter((model) => model && model.id)
    .map((model) => ({
      id: String(model.id),
      name: String(model.name || model.id),
      description: String(model.description || ''),
      // Image pricing lives on /images/models/{id}/endpoints, not in this list.
      is_free: null,
      free_known: false,
    }))
}

/** `GET /videos/models` → compact listing with pricing/durations/resolutions. */
export function normalizeVideoModels(raw) {
  return (Array.isArray(raw?.data) ? raw.data : [])
    .filter((model) => model && model.id)
    .map((model) => ({
      id: String(model.id),
      name: String(model.name || model.id),
      description: String(model.description || ''),
      pricing_skus: model.pricing_skus && typeof model.pricing_skus === 'object' ? model.pricing_skus : {},
      resolutions: Array.isArray(model.supported_resolutions) ? model.supported_resolutions.map(String) : [],
      durations: Array.isArray(model.supported_durations) ? model.supported_durations.map(Number) : [],
      aspect_ratios: Array.isArray(model.supported_aspect_ratios) ? model.supported_aspect_ratios.map(String) : [],
      generate_audio: model.generate_audio === true,
      is_free: priceIsFree(model.pricing_skus),
      free_known: true,
    }))
}

/** `GET /models?output_modalities=speech` → compact listing. */
export function normalizeSpeechModels(raw) {
  return (Array.isArray(raw?.data) ? raw.data : [])
    .filter((model) => model && model.id)
    .map((model) => ({
      id: String(model.id),
      name: String(model.name || model.id),
      description: String(model.description || ''),
      pricing: model.pricing && typeof model.pricing === 'object' ? model.pricing : {},
      is_free: priceIsFree(model.pricing),
      free_known: true,
    }))
}

/**
 * Rough cost of one video generation from a model's `pricing_skus`
 * (`duration_seconds_with_audio_720p` style keys). Returns null when unknown.
 */
export function estimateVideoCost(pricingSkus, { resolution = '720p', duration = 8 } = {}) {
  const skus = pricingSkus && typeof pricingSkus === 'object' ? pricingSkus : {}
  const seconds = Number(duration) || 0
  const perSecond = Object.keys(skus)
    .filter((key) => /duration_seconds|per_video_output_second|per_second/i.test(key))
    .map((key) => ({ key, price: Number(skus[key]) }))
    .filter((item) => Number.isFinite(item.price) && item.price > 0)
  if (!perSecond.length) return null
  // Prefer a SKU for the requested resolution; otherwise fall back to the
  // cheapest per-second SKU the model publishes.
  const matching = resolution ? perSecond.filter((item) => item.key.includes(resolution)) : []
  const pool = matching.length ? matching : perSecond
  pool.sort((a, b) => a.price - b.price)
  return Number((pool[0].price * seconds).toFixed(4))
}

/** Safe generated-file name: no traversal, a single path segment. */
export function safeFileName(name) {
  const last = String(name || '').split(/[\\/]/).pop() || ''
  const base = last.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '')
  return base || 'file.bin'
}
