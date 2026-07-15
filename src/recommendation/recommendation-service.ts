import { Prisma, type PrismaClient } from '@prisma/client'
import { BizError } from '../lib/errors.js'
import { newId } from '../lib/ids.js'

const DAILY_RECOMMENDATION_COUNT = 10
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

    return {
      batchId: batch.id,
      reportDate: formatDate(batch.reportDate),
      sourceScoredAt: batch.sourceScoredAt.toISOString(),
      requestedCount: batch.requestedCount,
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
        }]
      }),
    }
  }
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
