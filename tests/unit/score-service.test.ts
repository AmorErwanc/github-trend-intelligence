import { describe, expect, it } from 'vitest'
import { scoreRepository } from '../../src/scoring/score-service.js'
import type { CandidateRepository, GitHubRepository } from '../../src/domain/types.js'

const now = new Date('2026-07-15T08:00:00Z')
const repo: GitHubRepository = {
  githubRepoId: 1, fullName: 'owner/repo', owner: 'owner', name: 'repo', htmlUrl: 'https://github.com/owner/repo',
  description: 'useful framework', language: 'TypeScript', createdAt: new Date('2025-01-01T00:00:00Z'),
  pushedAt: new Date('2026-07-15T06:00:00Z'), updatedAt: now, stars: 10_000, forks: 1_200,
  watchers: 10_000, subscribers: 300, openIssues: 120, networkCount: 1_200, sizeKb: 8_000,
  defaultBranch: 'main', licenseSpdx: 'MIT', topics: ['framework', 'typescript', 'developer-tools'],
  hasIssues: true, hasDiscussions: true, isFork: false, archived: false,
}
const candidate: CandidateRepository = {
  fullName: repo.fullName, sources: ['github-trending', 'ossinsight'],
  rankings: [
    { source: 'github-trending', window: 'daily', rank: 2, periodStars: 900 },
    { source: 'ossinsight', window: 'past_24_hours', rank: 3, periodStars: 850 },
  ],
}

describe('scoreRepository', () => {
  it('把跨源、高工程互动的快速增长仓库识别为技术热点', () => {
    const result = scoreRepository(repo, candidate, [
      { capturedAt: now, stars: 10_000, forks: 1_200, openIssues: 120, subscribers: 300 },
      { capturedAt: new Date('2026-07-14T08:00:00Z'), stars: 9_100, forks: 1_100, openIssues: 110, subscribers: 285 },
      { capturedAt: new Date('2026-07-08T08:00:00Z'), stars: 7_500, forks: 900, openIssues: 90, subscribers: 250 },
    ], now)
    expect(result.trendHeat).toBeGreaterThan(65)
    expect(result.technicalSubstance).toBeGreaterThan(65)
    expect(result.manipulationRisk).toBeLessThan(50)
    expect(result.classification).toBe('real-technical-hotspot')
  })
  it('历史不足时不把弱异常信号直接定性为刷星', () => {
    const suspicious = { ...repo, stars: 5_000, forks: 2, openIssues: 0, subscribers: 0, createdAt: new Date('2026-07-10T00:00:00Z') }
    const result = scoreRepository(suspicious, { ...candidate, sources: ['github-trending'] }, [], now)
    expect(result.confidence).toBe('low')
    expect(result.classification).not.toBe('suspected-anomaly')
    expect(result.evidence.missing.length).toBeGreaterThan(0)
  })
})
