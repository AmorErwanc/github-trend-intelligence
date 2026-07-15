export type DiscoverySource = 'github-trending' | 'github-search' | 'ossinsight'

export interface RankingSignal {
  source: DiscoverySource
  window: string
  rank: number
  periodStars?: number | undefined
  sourceScore?: number | undefined
  payload?: Record<string, unknown> | undefined
}

export interface CandidateRepository {
  fullName: string
  githubRepoId?: number | undefined
  description?: string | undefined
  language?: string | undefined
  sources: DiscoverySource[]
  rankings: RankingSignal[]
}

export interface GitHubRepository {
  githubRepoId: number
  fullName: string
  owner: string
  name: string
  htmlUrl: string
  description: string | null
  language: string | null
  createdAt: Date
  pushedAt: Date
  updatedAt: Date
  stars: number
  forks: number
  watchers: number
  subscribers: number
  openIssues: number
  networkCount: number
  sizeKb: number
  defaultBranch: string
  licenseSpdx: string | null
  topics: string[]
  hasIssues: boolean
  hasDiscussions: boolean
  isFork: boolean
  archived: boolean
}

export interface RepositoryHistoryPoint {
  capturedAt: Date
  stars: number
  forks: number
  openIssues: number
  subscribers: number
}

export interface ScoreResult {
  trendHeat: number
  technicalSubstance: number
  manipulationRisk: number
  confidence: 'low' | 'medium' | 'high'
  classification: 'real-technical-hotspot' | 'early-technical-hotspot' | 'content-hotspot' | 'suspected-anomaly' | 'hidden-technical-hotspot' | 'insufficient-evidence'
  features: Record<string, number | string | boolean | null>
  evidence: { positive: string[]; caution: string[]; missing: string[] }
}

export interface EvidenceBundle {
  schemaVersion: '1.0'
  generatedAt: string
  repository: GitHubRepository
  discovery: { sources: DiscoverySource[]; rankings: RankingSignal[] }
  scores: ScoreResult
  history: RepositoryHistoryPoint[]
  readme: { content: string | null; fetchedAt: string | null; contentChars: number; truncated: boolean }
  instructions: {
    allowedConclusions: string[]
    forbiddenConclusions: string[]
  }
}
