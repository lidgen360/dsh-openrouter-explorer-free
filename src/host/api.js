import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const BASE = '/openrouter-explorer-free'
const MAX_BODY_BYTES = 1_000_000
/** Brand asset shipped with the package, served for the in-product mark. */
const BRAND_LOGO_FILE = fileURLToPath(new URL('../../assets/logo.svg', import.meta.url))

async function sendBinaryFile(res, file) {
  const data = await fs.readFile(file.path)
  res.writeHead(200, {
    'content-type': file.mediaType,
    'content-length': data.length,
    'cache-control': 'private, max-age=86400',
    'content-disposition': `inline; filename="${String(file.name).replace(/"/g, '')}"`,
  })
  res.end(data)
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('тело запроса слишком большое'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8').trim()
      if (!text) return resolve({})
      try {
        resolve(JSON.parse(text))
      } catch {
        reject(new Error('тело запроса не является JSON'))
      }
    })
    req.on('error', reject)
  })
}

/** Last-resort session hint from the request: query token or the browser auth cookie. */
function requestSessionHint(req) {
  const url = new URL(req.url || '/', 'http://x')
  const queryToken = url.searchParams.get('token')
  if (queryToken) return queryToken
  const cookie = req.headers?.cookie || ''
  const match = cookie.match(/dsh-auth-[^=]+=([^;]+)/)
  return match ? match[1] || null : null
}

async function handle(service, req, res) {
  let path = '/'
  let query = new URLSearchParams()
  try {
    const target = new URL(req.url || '/', 'http://openrouter-explorer-free.invalid')
    path = target.pathname.slice(BASE.length) || '/'
    query = target.searchParams
    const method = req.method || 'GET'

    if (method === 'GET' && path === '/status') return sendJson(res, 200, { status: await service.status() })
    if (method === 'GET' && path === '/settings') return sendJson(res, 200, { settings: await service.settings() })
    if (method === 'GET' && path === '/models') {
      return sendJson(res, 200, {
        status: await service.status(),
        models: await service.models({
          q: query.get('q') || '',
          free: query.get('free'),
          discount: query.get('discount'),
          modality: query.get('modality') || '',
          sort: query.get('sort') || '',
          include_removed: query.get('include_removed'),
          limit: query.get('limit'),
        }),
      })
    }
    if (method === 'GET' && path === '/events') {
      return sendJson(res, 200, await service.events({
        limit: query.get('limit'),
        unread: query.get('unread'),
        type: query.get('type') || '',
      }))
    }
    if (method === 'GET' && path === '/rankings') {
      return sendJson(res, 200, await service.rankings({ refresh: query.get('refresh') }))
    }
    if (method === 'GET' && path === '/balance') {
      return sendJson(res, 200, await service.balance({ refresh: query.get('refresh') }))
    }
    if (method === 'GET' && path === '/generation/models') {
      return sendJson(res, 200, await service.generationModels({
        kind: query.get('kind') || 'image',
        refresh: query.get('refresh'),
      }))
    }
    if (method === 'POST' && path === '/generate/image') {
      return sendJson(res, 200, await service.generateImage(await readBody(req)))
    }
    if (method === 'POST' && path === '/generate/video') {
      return sendJson(res, 200, await service.generateVideo(await readBody(req)))
    }
    if (method === 'GET' && path === '/generate/video/status') {
      return sendJson(res, 200, await service.videoJob({ id: query.get('id') }))
    }
    if (method === 'GET' && path === '/generate/video/content') {
      return sendJson(res, 200, await service.videoContent({ id: query.get('id'), index: query.get('index') }))
    }
    if (method === 'POST' && path === '/generate/speech') {
      return sendJson(res, 200, await service.synthesizeSpeech(await readBody(req)))
    }
    if (method === 'GET' && path === '/generated') {
      return sendJson(res, 200, { files: await service.generatedFiles() })
    }
    if (method === 'GET' && path.startsWith('/generated/')) {
      let name = ''
      try {
        name = decodeURIComponent(path.slice('/generated/'.length))
      } catch {
        return sendJson(res, 400, { error: 'некорректное имя файла' })
      }
      const file = await service.generatedFile(name)
      if (!file) return sendJson(res, 404, { error: 'файл не найден' })
      return sendBinaryFile(res, file)
    }
    if (method === 'POST' && path === '/events/read') {
      return sendJson(res, 200, await service.readEvents(await readBody(req)))
    }
    if (method === 'POST' && path === '/sync') {
      try {
        const summary = await service.syncNow()
        return sendJson(res, 200, { ok: true, summary, status: await service.status() })
      } catch (error) {
        return sendJson(res, 502, { ok: false, error: error?.message || String(error), status: await service.status() })
      }
    }
    if (method === 'POST' && path === '/auto-route') {
      // The browser tab knows the session it renders; the request hint is only a fallback.
      const body = await readBody(req)
      const requested = String(body?.sessionId || '').trim()
      const sessionId = requested || requestSessionHint(req)
      if (!sessionId) {
        return sendJson(res, 400, { ok: false, error: 'не передан id сессии' })
      }
      const result = await service.autoRoute({ sessionId })
      return sendJson(res, result?.ok ? 200 : 400, result)
    }
    if (method === 'POST' && path === '/use-model') {
      const body = await readBody(req)
      const sessionId = String(body?.sessionId || '').trim() || requestSessionHint(req)
      if (!sessionId) return sendJson(res, 400, { ok: false, error: 'не передан id сессии' })
      const result = await service.useModel({ sessionId, modelId: body?.model || body?.modelId })
      return sendJson(res, result?.ok ? 200 : 400, result)
    }
    if (method === 'GET' && path === '/brand/logo.svg') {
      try {
        const svg = await fs.readFile(BRAND_LOGO_FILE)
        res.writeHead(200, {
          'content-type': 'image/svg+xml; charset=utf-8',
          'content-length': svg.length,
          'cache-control': 'public, max-age=86400',
        })
        return res.end(svg)
      } catch {
        return sendJson(res, 404, { error: 'brand asset not found' })
      }
    }
    return sendJson(res, 404, { error: `Не найдено: ${method} ${path}` })
  } catch (error) {
    console.error('[openrouter-models] request failed', req?.method, req?.url, error)
    return sendJson(res, 500, { error: error?.message || String(error) })
  }
}

/** Register the API on the Web server; returns the disposer. */
export function registerRoutes(ctx, service) {
  return ctx.webServer.register({
    kind: 'prefix',
    path: BASE,
    handler: (req, res) => handle(service, req, res),
  })
}
