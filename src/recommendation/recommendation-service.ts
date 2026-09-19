import { Prisma, type PrismaClient } from '@prisma/client'
import { BizError } from '../lib/errors.js'
import { newId } from '../lib/ids.js'

const DAILY_RECOMMENDATION_COUNT = 10
const MINIMUM_RECOMMENDATION_HEAT = 20
const BEIJING_TIME_ZONE = 'Asia/Shanghai'

type DbClient = PrismaClient | Prisma.TransactionClient

export class RecommendationService {
  constructor(private readonly db: PrismaClient) {}

  async getOrCreateDaily(now = new Date()) {
    const reportDate = toBeijingDate(now)
    const existing = await this.db.recommendationBatch.findUnique({ where: { reportDate } })
    if (existing) return this.getBatch(this.db, existing.id)

    try {
      const batchId = await this.db.$transaction(async (tx) => {
        const concurrent = await tx.recommendationBatch.findUnique({ where: { reportDate } })
        if (concurrent) return concurrent.id

        const latestScore = await tx.repositoryScore.findFirst({ orderBy: { scoredAt: 'desc' } })
        if (!latestScore) throw new BizError('RESOURCE_NOT_FOUND', '尚无可推荐的仓库评分')

        const recommended = await tx.recommendationItem.findMany({ select: { repositoryId: true } })
        const candidates = await tx.repositoryScore.findMany({
          where: {
            scoredAt: latestScore.scoredAt,
            trendHeat: { gte: MINIMUM_RECOMMENDATION_HEAT },
            ...(recommended.length > 0
              ? { repositoryId: { notIn: recommended.map((item) => item.repositoryId) } }
              : {}),
          },
          orderBy: [
            { trendHeat: 'desc' },
            { technicalSubstance: 'desc' },
            { manipulationRisk: 'asc' },
          ],
          take: DAILY_RECOMMENDATION_COUNT,
        })

        const id = newId()
        await tx.recommendationBatch.create({
          data: {
            id,
            reportDate,
            sourceScoredAt: latestScore.scoredAt,
            requestedCount: DAILY_RECOMMENDATION_COUNT,
            selectedCount: candidates.length,
          },
        })
        if (candidates.length > 0) {
          await tx.recommendationItem.createMany({
            data: candidates.map((score, index) => ({
              id: newId(),
              batchId: id,
              repositoryId: score.repositoryId,
              position: index + 1,
              scoredAt: score.scoredAt,
              trendHeat: score.trendHeat,
              technicalSubstance: score.technicalSubstance,
              manipulationRisk: score.manipulationRisk,
              confidence: score.confidence,
              classification: score.classification,
            })),
          })
        }
        return id
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      return this.getBatch(this.db, batchId)
    } catch (error) {
      if (isRetryableSelectionConflict(error)) {
        const batch = await this.db.recommendationBatch.findUnique({ where: { reportDate } })
        if (batch) return this.getBatch(this.db, batch.id)
      }
      throw error
    }
  }

  private async getBatch(db: DbClient, batchId: string) {
    const batch = await db.recommendationBatch.findUnique({ where: { id: batchId } })
    if (!batch) throw new BizError('RESOURCE_NOT_FOUND', '推荐批次不存在')
    const items = await db.recommendationItem.findMany({ where: { batchId }, orderBy: { position: 'asc' } })
    const repositories = await db.repository.findMany({
      where: { id: { in: items.map((item) => item.repositoryId) } },
    })
    const repositoriesById = new Map(repositories.map((repository) => [repository.id, repository]))
    const details = await this.loadDetails(db, items.map((item) => item.repositoryId), batch.sourceScoredAt)

    return {
      batchId: batch.id,
      reportDate: formatDate(batch.reportDate),
      sourceScoredAt: batch.sourceScoredAt.toISOString(),
      requestedCount: batch.requestedCount,
      minimumHeat: MINIMUM_RECOMMENDATION_HEAT,
      selectedCount: batch.selectedCount,
      exhausted: batch.selectedCount < batch.requestedCount,
      repositories: items.flatMap((item) => {
        const repository = repositoriesById.get(item.repositoryId)
        if (!repository) return []
        return [{
          position: item.position,
          fullName: repository.fullName,
          htmlUrl: repository.htmlUrl,
          description: repository.description,
          language: repository.primaryLanguage,
          archetype: repository.archetype,
          scoredAt: item.scoredAt.toISOString(),
          trendHeat: item.trendHeat,
          technicalSubstance: item.technicalSubstance,
          manipulationRisk: item.manipulationRisk,
          confidence: item.confidence,
          classification: item.classification,
          createdAt: repository.createdAtGithub?.toISOString() ?? null,
          pushedAt: repository.pushedAtGithub?.toISOString() ?? null,
          ...(details.get(item.repositoryId) ?? EMPTY_DETAIL),
        }]
      }),
    }
  }

  /**
   * 写日报要用、但仓库里查不到的信息：采集当时的仓库数据、增长、榜单表现和近期走势。
   * 全部取评分时刻及之前的数据，同一批次重复调用结果不变。三次批量查询，不按仓库逐个查。
   */
  private async loadDetails(db: DbClient, repositoryIds: string[], scoredAt: Date): Promise<Map<string, RecommendationDetail>> {
    const result = new Map<string, RecommendationDetail>()
    if (repositoryIds.length === 0) return result
    const historyFrom = new Date(scoredAt.getTime() - HISTORY_DAYS * 86_400_000)
    const [scores, snapshots, rankings] = await Promise.all([
      db.repositoryScore.findMany({
        where: { repositoryId: { in: repositoryIds }, scoredAt },
        select: { repositoryId: true, features: true },
      }),
      db.repositorySnapshot.findMany({
        where: { repositoryId: { in: repositoryIds }, capturedAt: { gte: historyFrom, lte: scoredAt } },
        orderBy: { capturedAt: 'desc' },
        select: { repositoryId: true, capturedAt: true, stars: true, forks: true, openIssues: true, subscribers: true, licenseSpdx: true, topics: true },
      }),
      db.rankingSnapshot.findMany({
        where: { repositoryId: { in: repositoryIds }, capturedAt: { lte: scoredAt } },
        distinct: ['repositoryId', 'source'],
        select: { repositoryId: true, source: true },
      }),
    ])

    for (const repositoryId of repositoryIds) {
      const features = asRecord(scores.find((score) => score.repositoryId === repositoryId)?.features)
      const own = snapshots.filter((snapshot) => snapshot.repositoryId === repositoryId)
      const latest = own[0]
      result.set(repositoryId, {
        facts: {
          stars: latest?.stars ?? asNumber(features.stars),
          forks: latest?.forks ?? asNumber(features.forks),
          openIssues: latest?.openIssues ?? asNumber(features.openIssues),
          subscribers: latest?.subscribers ?? asNumber(features.subscribers),
          license: latest?.licenseSpdx ?? null,
          topics: Array.isArray(latest?.topics) ? latest.topics.filter((topic): topic is string => typeof topic === 'string') : [],
          ageDays: asNumber(features.ageDays),
          pushedDaysAgo: asNumber(features.pushedDaysAgo),
        },
        growth: {
          stars24h: asNumber(features.delta24h),
          stars7d: asNumber(features.delta7d),
          forkRate: asNumber(features.forkRate),
        },
        ranking: {
          bestRank: asNumber(features.bestRank),
          sources: [...new Set(rankings.filter((ranking) => ranking.repositoryId === repositoryId).map((ranking) => ranking.source))],
        },
        history: own.map((snapshot) => ({ date: snapshot.capturedAt.toISOString().slice(0, 10), stars: snapshot.stars, forks: snapshot.forks })),
      })
    }
    return result
  }
}

const HISTORY_DAYS = 14

interface RecommendationDetail {
  facts: {
    stars: number | null; forks: number | null; openIssues: number | null; subscribers: number | null
    license: string | null; topics: string[]; ageDays: number | null; pushedDaysAgo: number | null
  }
  growth: { stars24h: number | null; stars7d: number | null; forkRate: number | null }
  ranking: { bestRank: number | null; sources: string[] }
  history: Array<{ date: string; stars: number; forks: number }>
}

const EMPTY_DETAIL: RecommendationDetail = {
  facts: { stars: null, forks: null, openIssues: null, subscribers: null, license: null, topics: [], ageDays: null, pushedDaysAgo: null },
  growth: { stars24h: null, stars7d: null, forkRate: null },
  ranking: { bestRank: null, sources: [] },
  history: [],
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toBeijingDate(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BEIJING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00.000Z`)
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function isRetryableSelectionConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && (error.code === 'P2002' || error.code === 'P2034')
}
