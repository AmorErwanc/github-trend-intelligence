import { pino } from 'pino'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/http/app.js'
import type { Runtime } from '../../src/runtime.js'

const API_TOKEN = 'test-api-token-at-least-16-chars'
const apps: Awaited<ReturnType<typeof buildApp>>[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

async function createApp() {
  const runtime = {
    config: {
      apiToken: API_TOKEN,
      port: 3310,
      serviceName: 'github-trend-intelligence',
      autoCollect: true,
      githubToken: undefined,
    },
    prisma: {
      repositoryScore: { findMany: async () => [] },
    },
    collection: {
      collect: async () => ({ runId: 'run_1', candidates: 1, enriched: 1, failed: 0, sourceStats: {}, top: [] }),
    },
    recommendations: {
      getOrCreateDaily: async () => ({
        batchId: '01KX00000000000000000000',
        reportDate: '2026-07-15',
        sourceScoredAt: '2026-07-15T00:00:00.000Z',
        requestedCount: 10,
        selectedCount: 1,
        exhausted: true,
        repositories: [{
          position: 1,
          fullName: 'owner/repo',
          htmlUrl: 'https://github.com/owner/repo',
          description: 'demo',
          language: 'TypeScript',
          archetype: 'application',
          scoredAt: '2026-07-15T00:00:00.000Z',
          trendHeat: 80,
          technicalSubstance: 70,
          manipulationRisk: 10,
          confidence: 'medium',
          classification: 'sustained-trend',
        }],
      }),
    },
    logger: pino({ level: 'silent' }),
  } as unknown as Runtime
  const app = await buildApp(runtime)
  apps.push(app)
  return app
}

describe('HTTP API 鉴权与响应契约', () => {
  it('健康检查匿名可用并返回统一成功结构', async () => {
    const app = await createApp()
    const response = await app.inject({ method: 'GET', url: '/github-trend-intelligence/health' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      code: 0,
      message: 'ok',
      data: { status: 'ok', service: 'github-trend-intelligence' },
    })
    expect(response.json().requestId).toMatch(/^req_/)
    expect(response.json().serverTime).toEqual(expect.any(Number))
  })

  it.each([
    ['GET', '/github-trend-intelligence/repositories'],
    ['GET', '/github-trend-intelligence/repositories/openai/openai/evidence'],
    ['POST', '/github-trend-intelligence/collect'],
    ['POST', '/github-trend-intelligence/recommendations/daily'],
    ['GET', '/github-trend-intelligence/docs/json'],
  ] as const)('%s %s 缺少 Token 时统一返回 401', async (method, url) => {
    const app = await createApp()
    const response = await app.inject({ method, url })
    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({
      code: 4011,
      message: 'API Token 缺失或无效',
      details: { errorCode: 'UNAUTHORIZED' },
      retryable: false,
    })
    expect(response.json()).not.toHaveProperty('data')
  })

  it('错误 Token 返回 401，正确 Token 可访问受保护接口', async () => {
    const app = await createApp()
    const denied = await app.inject({
      method: 'GET', url: '/github-trend-intelligence/repositories', headers: { 'x-api-token': 'wrong-token' },
    })
    expect(denied.statusCode).toBe(401)

    const allowed = await app.inject({
      method: 'GET', url: '/github-trend-intelligence/repositories', headers: { 'x-api-token': API_TOKEN },
    })
    expect(allowed.statusCode).toBe(200)
    expect(allowed.json()).toMatchObject({ code: 0, data: [] })
  })

  it.each([
    'limit=0', 'limit=101', 'limit=1.5', 'limit=abc',
    'minHeat=-1', 'minHeat=101', 'minHeat=abc',
  ])('拒绝非法查询参数：%s', async (query) => {
    const app = await createApp()
    const response = await app.inject({
      method: 'GET',
      url: `/github-trend-intelligence/repositories?${query}`,
      headers: { 'x-api-token': API_TOKEN },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code: 4002, message: '请求参数无效', retryable: false })
  })

  it('OpenAPI 声明 header 鉴权、参数与统一响应', async () => {
    const app = await createApp()
    const response = await app.inject({
      method: 'GET', url: '/github-trend-intelligence/docs/json', headers: { 'x-api-token': API_TOKEN },
    })
    expect(response.statusCode).toBe(200)
    const document = response.json()
    expect(document.components.securitySchemes.apiToken).toMatchObject({ type: 'apiKey', in: 'header', name: 'X-API-Token' })
    expect(document.paths['/github-trend-intelligence/health'].get.security).toEqual([])
    expect(document.paths['/github-trend-intelligence/repositories'].get.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'limit', in: 'query' }),
      expect.objectContaining({ name: 'minHeat', in: 'query' }),
    ]))
    expect(document.paths['/github-trend-intelligence/repositories'].get.responses['200'].content['application/json'].schema.properties)
      .toEqual(expect.objectContaining({ code: expect.any(Object), data: expect.any(Object), requestId: expect.any(Object), serverTime: expect.any(Object) }))
    expect(document.paths['/github-trend-intelligence/recommendations/daily'].post.responses['200'])
      .toBeDefined()
  })

  it('每日推荐接口固定返回最多 10 个仓库并公开耗尽状态', async () => {
    const app = await createApp()
    const response = await app.inject({
      method: 'POST',
      url: '/github-trend-intelligence/recommendations/daily',
      headers: { 'x-api-token': API_TOKEN },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      code: 0,
      data: {
        requestedCount: 10,
        selectedCount: 1,
        exhausted: true,
        repositories: [{ position: 1, fullName: 'owner/repo' }],
      },
    })
  })
})
