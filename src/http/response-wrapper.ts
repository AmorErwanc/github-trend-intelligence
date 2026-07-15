import type { FastifyInstance } from 'fastify'

export function registerResponseWrapper(app: FastifyInstance): void {
  app.addHook('preSerialization', async (request, reply, payload) => {
    if (reply.statusCode >= 400 || request.url.includes('/docs')) return payload
    if (isEnvelope(payload)) return payload
    return { code: 0, message: 'ok', data: payload ?? null, requestId: request.id, serverTime: Date.now() }
  })
}

function isEnvelope(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && 'code' in value && 'data' in value)
}
