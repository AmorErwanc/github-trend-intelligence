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
      createdAtGithub: new Date('2026-07-01T00:00:00.000Z'),
      pushedAtGithub: new Date('2026-07-14T12:00:00.000Z'),
    }))
    const scores = repositories.map((repository, index) => ({
      repositoryId: repository.id,
      scoredAt,
      trendHeat: 100 - index,
      technicalSubstance: 80 - index,
      manipulationRisk: index,
      confidence: 'medium',
      classification: 'sustained-trend',
      features: { stars: 1000 + index, forks: 50, ageDays: 14, pushedDaysAgo: 0.5, delta24h: 120, delta7d: 640, forkRate: 0.05, bestRank: 3, openIssues: 7, subscribers: 9 },
    }))
    const snapshots = repositories.flatMap((repository) => [
      { repositoryId: repository.id, capturedAt: new Date('2026-07-15T00:00:00.000Z'), stars: 1200, forks: 60, openIssues: 8, subscribers: 10, licenseSpdx: 'MIT', topics: ['agent', 42] },
      { repositoryId: repository.id, capturedAt: new Date('2026-07-14T00:00:00.000Z'), stars: 1080, forks: 55, openIssues: 7, subscribers: 9, licenseSpdx: 'MIT', topics: ['agent'] },
      { repositoryId: repository.id, capturedAt: new Date('2026-07-16T00:00:00.000Z'), stars: 9999, forks: 99, openIssues: 9, subscribers: 9, licenseSpdx: 'MIT', topics: [] },
    ])
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
        findMany: async ({ where, take }: { where: { repositoryId?: { notIn?: string[]; in?: string[] }; trendHeat?: { gte: number } }; take?: number }) => (
          where.trendHeat
            ? scores.filter((score) => score.trendHeat >= where.trendHeat!.gte && !where.repositoryId?.notIn?.includes(score.repositoryId)).slice(0, take)
            : scores.filter((score) => where.repositoryId?.in?.includes(score.repositoryId))
        ),
      },
      repositorySnapshot: {
        findMany: async ({ where }: { where: { repositoryId: { in: string[] }; capturedAt: { gte: Date; lte: Date } } }) => snapshots
          .filter((snapshot) => where.repositoryId.in.includes(snapshot.repositoryId)
            && snapshot.capturedAt >= where.capturedAt.gte && snapshot.capturedAt <= where.capturedAt.lte)
          .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime()),
      },
      rankingSnapshot: {
        findMany: async ({ where }: { where: { repositoryId: { in: string[] } } }) => where.repositoryId.in.flatMap((repositoryId) => [
          { repositoryId, source: 'github-search' }, { repositoryId, source: 'ossinsight' },
        ]),
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

    // 写日报用的附加信息：只取评分时刻及之前的数据，晚于评分时刻的快照不计入
    expect(first.repositories[0]).toMatchObject({
      createdAt: '2026-07-01T00:00:00.000Z',
      facts: { stars: 1200, forks: 60, license: 'MIT', topics: ['agent'], ageDays: 14 },
      growth: { stars24h: 120, stars7d: 640, forkRate: 0.05 },
      ranking: { bestRank: 3, sources: ['github-search', 'ossinsight'] },
      history: [{ date: '2026-07-15', stars: 1200, forks: 60 }, { date: '2026-07-14', stars: 1080, forks: 55 }],
    })
    expect(second.repositories[0]).toEqual(first.repositories[0])
  })
})
