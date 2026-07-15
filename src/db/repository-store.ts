import { createHash } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import type {
  CandidateRepository,
  GitHubRepository,
  RepositoryHistoryPoint,
  ScoreResult,
} from '../domain/types.js'
import { newId } from '../lib/ids.js'

export class RepositoryStore {
  constructor(private readonly db: PrismaClient) {}

  async saveObservation(input: {
    repository: GitHubRepository
    candidate: CandidateRepository
    readme: { content: string; ref: string | null } | null
    capturedAt: Date
  }): Promise<{ repositoryId: string; history: RepositoryHistoryPoint[] }> {
    const { repository, candidate, readme, capturedAt } = input
    const saved = await this.db.repository.upsert({
      where: { githubRepoId: BigInt(repository.githubRepoId) },
      create: {
        id: newId(),
        githubRepoId: BigInt(repository.githubRepoId),
        fullName: repository.fullName,
        owner: repository.owner,
        name: repository.name,
        htmlUrl: repository.htmlUrl,
        description: repository.description,
        primaryLanguage: repository.language,
        archetype: inferArchetype(repository, readme?.content ?? ''),
        createdAtGithub: repository.createdAt,
        pushedAtGithub: repository.pushedAt,
        archived: repository.archived,
        firstSeenAt: capturedAt,
        lastSeenAt: capturedAt,
      },
      update: {
        fullName: repository.fullName,
        owner: repository.owner,
        name: repository.name,
        htmlUrl: repository.htmlUrl,
        description: repository.description,
        primaryLanguage: repository.language,
        archetype: inferArchetype(repository, readme?.content ?? ''),
        pushedAtGithub: repository.pushedAt,
        archived: repository.archived,
        lastSeenAt: capturedAt,
      },
    })

    await this.db.$transaction(async (tx) => {
      await tx.repositorySnapshot.create({
        data: {
          id: newId(),
          repositoryId: saved.id,
          capturedAt,
          stars: repository.stars,
          forks: repository.forks,
          watchers: repository.watchers,
          subscribers: repository.subscribers,
          openIssues: repository.openIssues,
          networkCount: repository.networkCount,
          sizeKb: repository.sizeKb,
          defaultBranch: repository.defaultBranch,
          licenseSpdx: repository.licenseSpdx,
          topics: repository.topics,
          hasIssues: repository.hasIssues,
          hasDiscussions: repository.hasDiscussions,
          isFork: repository.isFork,
          sourcePayload: toJson({ discoverySources: candidate.sources }),
        },
      })
      for (const ranking of candidate.rankings) {
        await tx.rankingSnapshot.create({
          data: {
            id: newId(),
            repositoryId: saved.id,
            capturedAt,
            source: ranking.source,
            window: ranking.window,
            rank: ranking.rank,
            ...(ranking.periodStars !== undefined ? { periodStars: ranking.periodStars } : {}),
            ...(ranking.sourceScore !== undefined ? { sourceScore: ranking.sourceScore } : {}),
            ...(ranking.payload ? { sourcePayload: toJson(ranking.payload) } : {}),
          },
        })
      }
      if (readme) {
        const hash = createHash('sha256').update(readme.content).digest('hex')
        await tx.repositoryArtifact.upsert({
          where: { repositoryId_kind_contentHash: { repositoryId: saved.id, kind: 'readme', contentHash: hash } },
          create: {
            id: newId(), repositoryId: saved.id, kind: 'readme', ref: readme.ref,
            content: readme.content, contentHash: hash, fetchedAt: capturedAt,
          },
          update: { ref: readme.ref, fetchedAt: capturedAt },
        })
      }
    })

    return { repositoryId: saved.id, history: await this.getHistory(saved.id, 35) }
  }

  async saveScore(repositoryId: string, scoredAt: Date, result: ScoreResult, algorithmVersion: string): Promise<void> {
    await this.db.repositoryScore.create({
      data: {
        id: newId(), repositoryId, scoredAt,
        trendHeat: result.trendHeat,
        technicalSubstance: result.technicalSubstance,
        manipulationRisk: result.manipulationRisk,
        confidence: result.confidence,
        classification: result.classification,
        features: toJson(result.features),
        evidence: toJson(result.evidence),
        algorithmVersion,
      },
    })
  }

  async getHistory(repositoryId: string, limit: number): Promise<RepositoryHistoryPoint[]> {
    const rows = await this.db.repositorySnapshot.findMany({
      where: { repositoryId }, orderBy: { capturedAt: 'desc' }, take: limit,
      select: { capturedAt: true, stars: true, forks: true, openIssues: true, subscribers: true },
    })
    return rows
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function inferArchetype(repository: GitHubRepository, readme: string): string {
  const text = `${repository.name} ${repository.description ?? ''} ${repository.topics.join(' ')} ${readme.slice(0, 3_000)}`.toLowerCase()
  if (/awesome[- ]|curated list|resources list/.test(text)) return 'awesome-list'
  if (/tutorial|course|learn|handbook|guide/.test(text)) return 'tutorial'
  if (/template|starter|boilerplate/.test(text)) return 'template'
  if (/\bcli\b|command line/.test(text)) return 'cli'
  if (/model weights|checkpoint|hugging face|dataset/.test(text)) return 'model-or-dataset'
  if (/library|sdk|framework|package/.test(text)) return 'library'
  return 'application'
}
