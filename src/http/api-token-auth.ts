import { createHash, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { BizError } from '../lib/errors.js'

const HEALTH_PATH = '/github-trend-intelligence/health'

export function registerApiTokenAuth(app: FastifyInstance, expectedToken: string): void {
  app.addHook('onRequest', async (request) => {
    const pathname = request.url.split('?', 1)[0]
    if (request.method === 'GET' && pathname === HEALTH_PATH) return
    const supplied = request.headers['x-api-token']
    if (typeof supplied !== 'string' || !secureTokenEqual(supplied, expectedToken)) {
      throw new BizError('UNAUTHORIZED', 'API Token 缺失或无效')
    }
  })
}

export function secureTokenEqual(supplied: string, expected: string): boolean {
  const suppliedDigest = createHash('sha256').update(supplied, 'utf8').digest()
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest()
  return timingSafeEqual(suppliedDigest, expectedDigest)
}
