import express from 'express'
import type { ErrorRequestHandler } from 'express'
import { fileURLToPath } from 'node:url'
import { OcrAuth } from './auth.js'
import type { AuthConfiguration } from './auth.js'
import { OcrStore } from './store.js'
import { cropPng, decodePng, parseUpload } from './images.js'
import { OcrError, httpFailure } from './errors.js'
import { parseLabel, parseSplit, parseInputRecord } from './input.js'
import { downloadDataset } from './export.js'

export function createOcrApp(
  config: AuthConfiguration,
  store: OcrStore,
  auth: OcrAuth = new OcrAuth(config)
) {
  const app = express()
  app.disable('x-powered-by')

  app.use((_request, response, next) => {
    response.set({
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    })
    next()
  })

  app.use((request, _response, next) => {
    if (!['GET', 'HEAD'].includes(request.method) && request.headers.origin !== config.origin) {
      next(new OcrError('ORIGIN_REQUIRED'))
      return
    }
    next()
  })

  app.post('/auth/login', (request, response) => auth.begin(request, response))

  app.get('/auth/callback', (request, response) => {
    if (request.method !== 'GET') {
      throw new OcrError('METHOD_NOT_ALLOWED')
    }
    return auth.callback(request, response)
  })

  app.post('/auth/logout', (request, response) => auth.logout(request, response))

  app.use('/api', async (request, _response, next) => {
    await auth.require(request)
    next()
  })

  app.get('/api/session', (_request, response) => response.json({ authenticated: true }))

  app.get('/api/stats', (_request, response) => response.json(store.stats()))

  let activeUploads = 0

  app.post(
    '/api/captures',
    (request, response, next) => {
      if (activeUploads >= 2) {
        next(new OcrError('UPLOAD_BUSY'))
        return
      }
      activeUploads++
      response.once('close', () => {
        activeUploads--
      })
      next()
    },
    express.json({ limit: '23mb', strict: true, inflate: false }),
    (request, response) => {
      const { capture, png } = parseUpload(request.body)
      const result = store.add(capture, png)
      response.status(result.duplicate ? 200 : 201).json(result)
    }
  )

  app.get('/api/samples', (request, response) => {
    const query = new URL(request.originalUrl, config.origin).searchParams
    for (const key of query.keys()) {
      if (
        !['offset', 'state', 'split', 'kind', 'text'].includes(key) ||
        query.getAll(key).length !== 1
      ) {
        throw new OcrError('INVALID_INPUT')
      }
    }
    const offset = Number(query.get('offset') ?? '0')
    const state = query.get('state') ?? undefined
    const split = query.get('split') ?? undefined
    const kind = query.get('kind') ?? undefined
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      (state !== undefined &&
        state.length > 0 &&
        !['pending', 'labeled', 'excluded'].includes(state)) ||
      (kind !== undefined && kind.length > 0 && !['hud', 'participants'].includes(kind))
    ) {
      throw new OcrError('INVALID_INPUT')
    }
    if (split !== undefined && split.length > 0) {
      parseSplit(split)
    }
    response.json(store.list({ offset, state, split, kind, text: query.get('text') ?? undefined }))
  })

  app.get('/api/captures/:id', (request, response) =>
    response.json(store.capture(request.params.id).capture)
  )

  app.get('/api/captures/:id/image', (request, response) =>
    response.type('png').send(store.capture(request.params.id).png)
  )

  app.get('/api/samples/:id/image', (request, response) => {
    const sample = store.sample(request.params.id)
    response.type('png').send(cropPng(decodePng(store.capture(sample.captureId).png), sample))
  })

  app.use('/api', express.json({ limit: '16kb', strict: true, inflate: false }))

  app.patch('/api/samples/:id', (request, response) => {
    const body = parseInputRecord(request.body)
    const text = parseLabel(body.text)
    if (
      typeof body.excluded !== 'boolean' ||
      (body.confirmSplitChange !== undefined && typeof body.confirmSplitChange !== 'boolean')
    ) {
      throw new OcrError('INVALID_INPUT')
    }
    response.json(
      store.updateSample(request.params.id, {
        text,
        excluded: body.excluded,
        confirmSplitChange: body.confirmSplitChange === true
      })
    )
  })

  app.put('/api/splits', (request, response) => {
    const body = parseInputRecord(request.body)
    const text = parseLabel(body.text)
    if (text === null) {
      throw new OcrError('INVALID_INPUT')
    }
    response.json(store.assign(text, parseSplit(body.split)))
  })

  app.get('/api/export/manifest', (_request, response) => response.json(store.exportManifest()))

  app.get('/api/export', (_request, response) => downloadDataset(store, response))

  app.get('/health', (_request, response) => response.json({ ok: true }))

  app.use(
    express.static(fileURLToPath(new URL('../browser/', import.meta.url)), {
      index: 'index.html',
      etag: false,
      maxAge: 0
    })
  )

  app.use((_request, response) => response.status(404).json({ error: 'NOT_FOUND' }))

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    void _next
    if (response.headersSent) {
      response.destroy()
      return
    }
    const failure = httpFailure(error)
    response.status(failure.status).json({ error: failure.code })
  }

  app.use(errorHandler)
  return { app, close: () => auth.close() }
}
