import pLimit from 'p-limit'
import type { PrismaClient } from '@prisma/client'
import type { Config } from '../config/index.js'
import { RepositoryStore } from '../db/repository-store.js'
import { DiscoveryService } from '../discovery/discovery-service.js'
import { GitHubClient } from '../external/github-client.js'
import { BizError } from '../lib/errors.js'
import { newId } from '../lib/ids.js'
import type { Logger } from '../lib/logger.js'
import { ALGORITHM_VERSION, scoreRepository } from '../scoring/score-service.js'

export interface CollectionSummary {
  runId: string
  candidates: number
  enriched: number
  failed: number
  sourceStats: Record<string, { count: number; error?: string }>
  top: Array<{ fullName: string; trendHeat: number; technicalSubstance: number; manipulationRisk: number; classification: string }>
}

export class CollectionService {
  private running = false

  constructor(
    private readonly db: PrismaClient,
    private readonly discovery: DiscoveryService,
    private readonly github: GitHubClient,
    private readonly store: RepositoryStore,
    private readonly config: Config,
    private readonly logger: Logger,
  ) {}

  async collect(trigger: 'cli' | 'api' | 'scheduler'): Promise<CollectionSummary> {
    if (this.running) throw new BizError('COLLECTION_RUNNING', '已有采集任务正在运行')
    this.running = true
    const runId = newId()
    const startedAt = new Date()
    await this.db.collectionRun.create({ data: { id: runId, status: 'running', trigger, startedAt } })
    try {
      const discoveryResult = await this.discovery.discover()
      const enrichLimit = this.config.githubToken
        ? this.config.maxCandidates
        : Math.min(this.config.maxCandidates, 20)
      const candidates = discoveryResult.candidates.slice(0, enrichLimit)
      const limit = pLimit(this.config.enrichConcurrency)
      const top: CollectionSummary['top'] = []
      let enriched = 0
      let failed = 0
      const capturedAt = new Date()

      await Promise.all(candidates.map((candidate) => limit(async () => {
        try {
          const repository = await this.github.getRepository(candidate.fullName)
          const readme = await this.github.getReadme(candidate.fullName)
          const saved = await this.store.saveObservation({ repository, candidate, readme, capturedAt })
          const score = scoreRepository(repository, candidate, saved.history, capturedAt)
          await this.store.saveScore(saved.repositoryId, capturedAt, score, ALGORITHM_VERSION)
          top.push({
            fullName: repository.fullName,
            trendHeat: score.trendHeat,
            technicalSubstance: score.technicalSubstance,
            manipulationRisk: score.manipulationRisk,
            classification: score.classification,
          })
          enriched += 1
        } catch (error) {
          failed += 1
          this.logger.warn({ repo: candidate.fullName, error }, '仓库补全失败')
        }
      })))

      top.sort((a, b) => b.trendHeat - a.trendHeat)
      await this.db.collectionRun.update({
        where: { id: runId },
        data: {
          status: failed === candidates.length ? 'failed' : failed > 0 ? 'partial' : 'success',
          finishedAt: new Date(), candidateCount: discoveryResult.candidates.length,
          enrichedCount: enriched, failedCount: failed, sourceStats: discoveryResult.sourceStats,
        },
      })
      return {
        runId,
        candidates: discoveryResult.candidates.length,
        enriched,
        failed,
        sourceStats: discoveryResult.sourceStats,
        top: top.slice(0, 20),
      }
    } catch (error) {
      await this.db.collectionRun.update({
        where: { id: runId },
        data: { status: 'failed', finishedAt: new Date(), errorMessage: error instanceof Error ? error.message : String(error) },
      })
      throw error
    } finally {
      this.running = false
    }
  }
}
