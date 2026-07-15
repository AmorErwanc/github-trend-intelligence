import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Runtime } from '../runtime.js'
import { EvidenceService } from '../evidence/evidence-service.js'
import { BizError } from '../lib/errors.js'
import { newId } from '../lib/ids.js'
import { registerErrorHandler } from './error-handler.js'
import { registerResponseWrapper } from './response-wrapper.js'

const SERVICE_PREFIX = '/github-trend-intelligence'

export async function buildApp(runtime: Runtime): Promise<FastifyInstance> {
  const app = Fastify({
    loggerInstance: runtime.logger as FastifyBaseLogger,
    genReqId: () => `req_${newId()}`,
    bodyLimit: 1_048_576,
  })
  registerErrorHandler(app)
  registerResponseWrapper(app)
  await app.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
  await app.register(cors, { methods: ['GET', 'HEAD', 'POST'] })
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: { title: 'GitHub Trend Intelligence API', version: '0.1.0' },
      servers: [{ url: `http://localhost:${runtime.config.port}${SERVICE_PREFIX}` }],
    },
  })
  await app.register(swaggerUi, { routePrefix: `${SERVICE_PREFIX}/docs` })

  const evidence = new EvidenceService(runtime.prisma)
  app.get(`${SERVICE_PREFIX}/health`, { schema: { tags: ['system'], summary: '进程健康检查' } }, async () => ({
    status: 'ok', service: runtime.config.serviceName, autoCollect: runtime.config.autoCollect,
    githubAuthenticated: Boolean(runtime.config.githubToken),
  }))

  app.get(`${SERVICE_PREFIX}/repositories`, { schema: { tags: ['intelligence'], summary: '查询最新趋势仓库' } }, async (request) => {
    const query = z.object({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      minHeat: z.coerce.number().min(0).max(100).default(0),
    }).parse(request.query)
    return evidence.listLatest(query.limit, query.minHeat)
  })

  app.get(`${SERVICE_PREFIX}/repositories/:owner/:name/evidence`, {
    schema: { tags: ['intelligence'], summary: '获取供 CrewAI 使用的仓库证据包' },
  }, async (request) => {
    const params = z.object({ owner: z.string().min(1), name: z.string().min(1) }).parse(request.params)
    return evidence.getBundle(params.owner, params.name)
  })

  app.post(`${SERVICE_PREFIX}/collect`, { schema: { tags: ['collection'], summary: '人工触发一次采集' } }, async (request) => {
    if (runtime.config.internalToken) {
      const supplied = request.headers['x-internal-token']
      if (supplied !== runtime.config.internalToken) throw new BizError('BAD_REQUEST', '内部调用凭据无效')
    }
    return runtime.collection.collect('api')
  })
  return app
}
