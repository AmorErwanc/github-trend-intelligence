import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify'
import { z } from 'zod'
import { EvidenceService } from '../evidence/evidence-service.js'
import { ApiErrorCode } from '../lib/errors.js'
import { newId } from '../lib/ids.js'
import type { Runtime } from '../runtime.js'
import { registerApiTokenAuth } from './api-token-auth.js'
import {
  collectionDataSchema,
  errorEnvelopeSchema,
  evidenceDataSchema,
  healthDataSchema,
  protectedResponses,
  repositoryListDataSchema,
  successEnvelopeSchema,
} from './contracts.js'
import { registerErrorHandler } from './error-handler.js'
import { registerResponseWrapper } from './response-wrapper.js'

const SERVICE_PREFIX = '/github-trend-intelligence'
const apiTokenSecurity = [{ apiToken: [] }]

export async function buildApp(runtime: Runtime): Promise<FastifyInstance> {
  const app = Fastify({
    loggerInstance: runtime.logger as FastifyBaseLogger,
    genReqId: () => `req_${newId()}`,
    bodyLimit: 1_048_576,
  })
  registerErrorHandler(app)
  registerResponseWrapper(app)
  registerApiTokenAuth(app, runtime.config.apiToken)
  app.setNotFoundHandler((request, reply) => {
    void reply.status(404).send({
      code: ApiErrorCode.RESOURCE_NOT_FOUND,
      message: '接口不存在',
      details: { errorCode: 'RESOURCE_NOT_FOUND' },
      retryable: false,
      requestId: request.id,
      serverTime: Date.now(),
    })
  })

  await app.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
  await app.register(cors, { methods: ['GET', 'HEAD', 'POST'] })
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: { title: 'GitHub Trend Intelligence API', version: '0.2.0' },
      servers: [{ url: '/' }],
      components: {
        securitySchemes: {
          apiToken: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Token',
            description: '内部 API Token；健康检查除外。',
          },
        },
      },
      security: apiTokenSecurity,
    },
  })
  await app.register(swaggerUi, { routePrefix: `${SERVICE_PREFIX}/docs` })

  const evidence = new EvidenceService(runtime.prisma)
  app.get(`${SERVICE_PREFIX}/health`, {
    schema: {
      tags: ['system'],
      summary: '进程健康检查',
      security: [],
      response: { 200: successEnvelopeSchema(healthDataSchema), 500: errorEnvelopeSchema },
    },
  }, async () => ({
    status: 'ok',
    service: runtime.config.serviceName,
    autoCollect: runtime.config.autoCollect,
    githubAuthenticated: Boolean(runtime.config.githubToken),
  }))

  app.get(`${SERVICE_PREFIX}/repositories`, {
    schema: {
      tags: ['intelligence'],
      summary: '查询最新趋势仓库',
      security: apiTokenSecurity,
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          minHeat: { type: 'number', minimum: 0, maximum: 100, default: 0 },
        },
      },
      response: { 200: successEnvelopeSchema(repositoryListDataSchema), ...protectedResponses },
    },
  }, async (request) => {
    const query = z.object({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      minHeat: z.coerce.number().min(0).max(100).default(0),
    }).parse(request.query)
    return evidence.listLatest(query.limit, query.minHeat)
  })

  app.get(`${SERVICE_PREFIX}/repositories/:owner/:repo/evidence`, {
    schema: {
      tags: ['intelligence'],
      summary: '获取供 CrewAI 使用的仓库证据包',
      security: apiTokenSecurity,
      params: {
        type: 'object',
        additionalProperties: false,
        required: ['owner', 'repo'],
        properties: {
          owner: { type: 'string', minLength: 1, maxLength: 128 },
          repo: { type: 'string', minLength: 1, maxLength: 128 },
        },
      },
      response: { 200: successEnvelopeSchema(evidenceDataSchema), ...protectedResponses },
    },
  }, async (request) => {
    const params = z.object({ owner: z.string().min(1), repo: z.string().min(1) }).parse(request.params)
    return evidence.getBundle(params.owner, params.repo)
  })

  app.post(`${SERVICE_PREFIX}/collect`, {
    schema: {
      tags: ['collection'],
      summary: '人工触发一次采集（无请求体）',
      security: apiTokenSecurity,
      response: { 200: successEnvelopeSchema(collectionDataSchema), ...protectedResponses },
    },
  }, async () => runtime.collection.collect('api'))

  return app
}
