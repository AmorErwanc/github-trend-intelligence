import { Prisma, type PrismaClient } from '@prisma/client'
import type { EvidenceBundle, GitHubRepository, ScoreResult } from '../domain/types.js'
import { BizError } from '../lib/errors.js'

export class EvidenceService {
  constructor(private readonly db: PrismaClient) {}

  async listLatest(limit: number, minimumHeat: number) {
    const scores = await this.db.repositoryScore.findMany({
      where: { trendHeat: { gte: minimumHeat } },
      orderBy: [{ scoredAt: 'desc' }, { trendHeat: 'desc' }],
      take: Math.min(500, limit * 8),
    })
    const seen = new Set<string>()
    const latest = []
    for (const score of scores) {
      if (seen.has(score.repositoryId)) continue
      seen.add(score.repositoryId)
      const repository = await this.db.repository.findUnique({ where: { id: score.repositoryId } })
      if (!repository) continue
      latest.push({
        fullName: repository.fullName,
        htmlUrl: repository.htmlUrl,
        description: repository.description,
        language: repository.primaryLanguage,
        archetype: repository.archetype,
        scoredAt: score.scoredAt.toISOString(),
        trendHeat: score.trendHeat,
        technicalSubstance: score.technicalSubstance,
        manipulationRisk: score.manipulationRisk,
        confidence: score.confidence,
        classification: score.classification,
      })
      if (latest.length >= limit) break
    }
    return latest.sort((a, b) => b.trendHeat - a.trendHeat)
  }

  async getBundle(owner: string, name: string): Promise<EvidenceBundle> {
    const record = await this.db.repository.findUnique({ where: { fullName: `${owner}/${name}` } })
    if (!record) throw new BizError('RESOURCE_NOT_FOUND', '仓库尚未进入情报库')
    const [snapshot, score, rankings, artifact, history] = await Promise.all([
      this.db.repositorySnapshot.findFirst({ where: { repositoryId: record.id }, orderBy: { capturedAt: 'desc' } }),
      this.db.repositoryScore.findFirst({ where: { repositoryId: record.id }, orderBy: { scoredAt: 'desc' } }),
      this.db.rankingSnapshot.findMany({ where: { repositoryId: record.id }, orderBy: { capturedAt: 'desc' }, take: 20 }),
      this.db.repositoryArtifact.findFirst({ where: { repositoryId: record.id, kind: 'readme' }, orderBy: { fetchedAt: 'desc' } }),
      this.db.repositorySnapshot.findMany({
        where: { repositoryId: record.id }, orderBy: { capturedAt: 'desc' }, take: 35,
        select: { capturedAt: true, stars: true, forks: true, openIssues: true, subscribers: true },
      }),
    ])
    if (!snapshot || !score) throw new BizError('RESOURCE_NOT_FOUND', '仓库证据尚未完成采集')

    const repository: GitHubRepository = {
      githubRepoId: Number(record.githubRepoId), fullName: record.fullName, owner: record.owner, name: record.name,
      htmlUrl: record.htmlUrl, description: record.description, language: record.primaryLanguage,
      createdAt: record.createdAtGithub, pushedAt: record.pushedAtGithub, updatedAt: record.updatedAt,
      stars: snapshot.stars, forks: snapshot.forks, watchers: snapshot.watchers,
      subscribers: snapshot.subscribers, openIssues: snapshot.openIssues, networkCount: snapshot.networkCount,
      sizeKb: snapshot.sizeKb, defaultBranch: snapshot.defaultBranch, licenseSpdx: snapshot.licenseSpdx,
      topics: asStringArray(snapshot.topics), hasIssues: snapshot.hasIssues,
      hasDiscussions: snapshot.hasDiscussions, isFork: snapshot.isFork, archived: record.archived,
    }
    const parsedScore: ScoreResult = {
      trendHeat: score.trendHeat, technicalSubstance: score.technicalSubstance,
      manipulationRisk: score.manipulationRisk,
      confidence: score.confidence as ScoreResult['confidence'],
      classification: score.classification as ScoreResult['classification'],
      features: asRecord(score.features) as ScoreResult['features'],
      evidence: asRecord(score.evidence) as unknown as ScoreResult['evidence'],
    }
    const sources = [...new Set(rankings.map((item) => item.source))] as EvidenceBundle['discovery']['sources']
    return {
      schemaVersion: '1.0',
      generatedAt: new Date().toISOString(),
      repository,
      discovery: {
        sources,
        rankings: rankings.map((item) => ({
          source: item.source as EvidenceBundle['discovery']['sources'][number],
          window: item.window,
          rank: item.rank,
          ...(item.periodStars !== null ? { periodStars: item.periodStars } : {}),
          ...(item.sourceScore !== null ? { sourceScore: item.sourceScore } : {}),
          ...(item.sourcePayload ? { payload: asRecord(item.sourcePayload) } : {}),
        })),
      },
      scores: parsedScore,
      history,
      readme: toReadmeEvidence(artifact?.content ?? null, artifact?.fetchedAt ?? null),
      instructions: {
        allowedConclusions: [
          '解释仓库解决的问题、技术路径、目标用户和近期走红的可验证原因',
          '引用 scores.evidence 和 history 说明热度与工程活跃度',
          '把风险信号表述为异常提示，并说明证据缺口',
        ],
        forbiddenConclusions: [
          '仅凭 README 或单次 Star 增量断言刷星',
          '把累计 Star 当作近期增长',
          '忽略仓库类型差异直接比较教程、框架、模型与应用',
        ],
      },
    }
  }
}

const README_EVIDENCE_LIMIT = 40_000

function toReadmeEvidence(content: string | null, fetchedAt: Date | null) {
  const contentChars = content?.length ?? 0
  return {
    content: content ? content.slice(0, README_EVIDENCE_LIMIT) : null,
    fetchedAt: fetchedAt?.toISOString() ?? null,
    contentChars,
    truncated: contentChars > README_EVIDENCE_LIMIT,
  }
}

function asStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function asRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
