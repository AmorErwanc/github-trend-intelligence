import { BizError } from '../lib/errors.js'
import type { CandidateRepository } from '../domain/types.js'

interface OSSInsightResponse {
  data?: {
    rows?: Array<{
      repo_id?: string
      repo_name?: string
      primary_language?: string
      description?: string
      stars?: string
      forks?: string
      pull_requests?: string
      pushes?: string
      total_score?: string
    }>
  }
}

export class OSSInsightClient {
  constructor(private readonly apiBase: string) {}

  async fetch(period: 'past_24_hours' | 'past_28_days'): Promise<CandidateRepository[]> {
    const response = await fetch(`${this.apiBase}/v1/trends/repos/?period=${period}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'github-trend-intelligence/0.1' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) {
      throw new BizError('UPSTREAM_ERROR', `OSSInsight 请求失败：${response.status}`)
    }
    const body = (await response.json()) as OSSInsightResponse
    return (body.data?.rows ?? []).flatMap((row, index) => {
      if (!row.repo_name || row.repo_name.split('/').length !== 2) return []
      const periodStars = toNumber(row.stars)
      const sourceScore = toNumber(row.total_score)
      return [{
        fullName: row.repo_name,
        ...(row.repo_id ? { githubRepoId: Number(row.repo_id) } : {}),
        ...(row.description ? { description: row.description } : {}),
        ...(row.primary_language ? { language: row.primary_language } : {}),
        sources: ['ossinsight' as const],
        rankings: [{
          source: 'ossinsight' as const,
          window: period,
          rank: index + 1,
          ...(periodStars > 0 ? { periodStars } : {}),
          ...(sourceScore > 0 ? { sourceScore } : {}),
          payload: {
            forks: toNumber(row.forks),
            pullRequests: toNumber(row.pull_requests),
            pushes: toNumber(row.pushes),
          },
        }],
      }]
    })
  }
}

function toNumber(value: string | undefined): number {
  const result = Number(value ?? 0)
  return Number.isFinite(result) ? result : 0
}
