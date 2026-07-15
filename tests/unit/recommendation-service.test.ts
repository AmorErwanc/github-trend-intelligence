import type { PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { RecommendationService } from '../../src/recommendation/recommendation-service.js'

describe('每日推荐去重', () => {
  it('同日幂等，并从最近一轮评分中排除历史已推荐仓库后取前 10', async () => {
    const scoredAt = new Date('2026-07-15T00:00:00.000Z')
    const repositories = Array.from({ length: 12 }, (_, index) => ({
      id: `repo_${index + 1}`,
      fullName: `owner/repo-${index + 1}`,
      htmlUrl: `https://github.com/owner/repo-${index + 1}`,
      description: null,
      primaryLanguage: 'TypeScript',
      archetype: 'application',
    }))
    const scores = repositories.map((repository, index) => ({
      repositoryId: repository.id,
      scoredAt,
      trendHeat: 100 - index,
      technicalSubstance: 80 - index,
      manipulationRisk: index,
      confidence: 'medium',
      classification: 'sustained-trend',
    }))
    const batches: Array<Record<string, unknown>> = []
    const items: Array<Record<string, unknown>> = [{ repositoryId: 'repo_1', batchId: 'old', position: 1 }]

    const db = {
      recommendationBatch: {
        findUnique: async ({ where }: { where: { reportDate?: Date; id?: string } }) => batches.find((batch) => (
          where.id ? batch.id === where.id : (batch.reportDate as Date).getTime() === where.reportDate?.getTime()
        )) ?? null,
        create: async ({ data }: { data: Record<string, unknown> }) => { batches.push(data); return data },
      },
      recommendationItem: {
        findMany: async ({ where, select }: { where?: { batchId: string }; select?: unknown }) => {
          const filtered = where ? items.filter((item) => item.batchId === where.batchId) : items
          return select ? filtered.map((item) => ({ repositoryId: item.repositoryId })) : filtered
        },
        createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => { items.push(...data) },
      },
      repositoryScore: {
        findFirst: async () => scores[0],
        findMany: async ({ where, take }: { where: { repositoryId?: { notIn: string[] }; trendHeat: { gte: number } }; take: number }) => scores
          .filter((score) => score.trendHeat >= where.trendHeat.gte && !where.repositoryId?.notIn.includes(score.repositoryId))
          .slice(0, take),
      },
      repository: {
        findMany: async ({ where }: { where: { id: { in: string[] } } }) => repositories
          .filter((repository) => where.id.in.includes(repository.id)),
      },
      $transaction: async (callback: (tx: unknown) => unknown) => callback(db),
    }

    const service = new RecommendationService(db as unknown as PrismaClient)
    const first = await service.getOrCreateDaily(new Date('2026-07-15T08:00:00+08:00'))
    const second = await service.getOrCreateDaily(new Date('2026-07-15T23:00:00+08:00'))

    expect(first.selectedCount).toBe(10)
    expect(first.minimumHeat).toBe(20)
    expect(first.repositories).toHaveLength(10)
    expect(first.repositories.map((item) => item.fullName)).not.toContain('owner/repo-1')
    expect(first.repositories[0]?.fullName).toBe('owner/repo-2')
    expect(second.batchId).toBe(first.batchId)
    expect(batches).toHaveLength(1)
  })
})
