import type { Logger } from '../lib/logger.js'
import type { CandidateRepository, GitHubRepository, RankingSignal } from '../domain/types.js'
import { GitHubClient } from '../external/github-client.js'
import { OSSInsightClient } from '../external/ossinsight-client.js'
import { TrendingClient } from '../external/trending-client.js'

export interface DiscoveryResult {
  candidates: CandidateRepository[]
  sourceStats: Record<string, { count: number; error?: string }>
}

export class DiscoveryService {
  constructor(
    private readonly github: GitHubClient,
    private readonly trending: TrendingClient,
    private readonly ossInsight: OSSInsightClient,
    private readonly logger: Logger,
    private readonly options: {
      lookbackDays: number
      trendingWindows: string[]
      ossInsightEnabled: boolean
      maxCandidates: number
    },
  ) {}

  async discover(): Promise<DiscoveryResult> {
    const collected: CandidateRepository[][] = []
    const sourceStats: DiscoveryResult['sourceStats'] = {}
    const tasks: Array<Promise<void>> = []

    for (const window of this.options.trendingWindows) {
      tasks.push(this.capture(`github-trending:${window}`, () => this.trending.fetch(window), collected, sourceStats))
    }

    const createdSince = isoDateDaysAgo(this.options.lookbackDays)
    const pushedSince = isoDateDaysAgo(Math.min(this.options.lookbackDays, 7))
    tasks.push(this.capture(
      'github-search:new',
      () => this.searchAsCandidates(`created:>${createdSince} stars:>20 archived:false fork:false`, 'new'),
      collected,
      sourceStats,
    ))
    tasks.push(this.capture(
      'github-search:active',
      () => this.searchAsCandidates(`pushed:>${pushedSince} stars:>500 archived:false fork:false`, 'active'),
      collected,
      sourceStats,
    ))

    if (this.options.ossInsightEnabled) {
      tasks.push(this.capture('ossinsight:24h', () => this.ossInsight.fetch('past_24_hours'), collected, sourceStats))
      tasks.push(this.capture('ossinsight:28d', () => this.ossInsight.fetch('past_28_days'), collected, sourceStats))
    }

    await Promise.all(tasks)
    const merged = mergeCandidates(collected.flat())
      .sort((left, right) => candidatePriority(right) - candidatePriority(left))
      .slice(0, this.options.maxCandidates)
    return { candidates: merged, sourceStats }
  }

  private async searchAsCandidates(query: string, window: string): Promise<CandidateRepository[]> {
    const repositories = await this.github.searchRepositories(query, 30)
    return repositories.map((repo, index) => repositoryToCandidate(repo, index + 1, window))
  }

  private async capture(
    key: string,
    fetcher: () => Promise<CandidateRepository[]>,
    collected: CandidateRepository[][],
    stats: DiscoveryResult['sourceStats'],
  ): Promise<void> {
    try {
      const result = await fetcher()
      collected.push(result)
      stats[key] = { count: result.length }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      stats[key] = { count: 0, error: message }
      this.logger.warn({ source: key, error: message }, '候选源抓取失败，继续使用其他来源')
    }
  }
}

function repositoryToCandidate(repo: GitHubRepository, rank: number, window: string): CandidateRepository {
  return {
    fullName: repo.fullName,
    githubRepoId: repo.githubRepoId,
    description: repo.description ?? undefined,
    language: repo.language ?? undefined,
    sources: ['github-search'],
    rankings: [{ source: 'github-search', window, rank, payload: { stars: repo.stars, forks: repo.forks } }],
  }
}

export function mergeCandidates(candidates: CandidateRepository[]): CandidateRepository[] {
  const byName = new Map<string, CandidateRepository>()
  for (const candidate of candidates) {
    const key = candidate.fullName.toLowerCase()
    const existing = byName.get(key)
    if (!existing) {
      byName.set(key, { ...candidate, sources: [...candidate.sources], rankings: [...candidate.rankings] })
      continue
    }
    existing.sources = [...new Set([...existing.sources, ...candidate.sources])]
    existing.rankings.push(...candidate.rankings)
    existing.githubRepoId ??= candidate.githubRepoId
    existing.description ??= candidate.description
    existing.language ??= candidate.language
  }
  return [...byName.values()]
}

function candidatePriority(candidate: CandidateRepository): number {
  const sourceDiversity = candidate.sources.length * 30
  const bestRank = Math.min(...candidate.rankings.map((signal) => signal.rank))
  const periodStars = Math.max(0, ...candidate.rankings.map((signal) => signal.periodStars ?? 0))
  const sourceScore = Math.max(0, ...candidate.rankings.map((signal) => signal.sourceScore ?? 0))
  return sourceDiversity + Math.max(0, 30 - bestRank) + Math.log1p(periodStars) * 8 + Math.log1p(sourceScore)
}

function isoDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
}
