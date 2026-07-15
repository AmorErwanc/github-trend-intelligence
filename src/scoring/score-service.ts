import type {
  CandidateRepository,
  GitHubRepository,
  RepositoryHistoryPoint,
  ScoreResult,
} from '../domain/types.js'

export const ALGORITHM_VERSION = 'mvp-1.0'

export function scoreRepository(
  repository: GitHubRepository,
  candidate: CandidateRepository,
  history: RepositoryHistoryPoint[],
  now = new Date(),
): ScoreResult {
  const positive: string[] = []
  const caution: string[] = []
  const missing: string[] = []
  const ageDays = daysBetween(repository.createdAt, now)
  const pushedDaysAgo = daysBetween(repository.pushedAt, now)
  const delta24h = starDeltaNear(history, now, 24)
  const delta7d = starDeltaNear(history, now, 24 * 7)
  const periodStars24h = maxPeriodStars(candidate, ['daily', 'past_24_hours'])
  const bestRank = Math.min(100, ...candidate.rankings.map((ranking) => ranking.rank))
  const sourceDiversity = candidate.sources.length
  const starVelocity = Math.max(delta24h ?? 0, periodStars24h)

  let trendHeat = 0
  trendHeat += scaleLog(starVelocity, 1_000) * 38
  trendHeat += Math.max(0, (51 - bestRank) / 50) * 22
  trendHeat += Math.min(1, sourceDiversity / 3) * 18
  trendHeat += scaleLog(delta7d ?? 0, 10_000) * 12
  trendHeat += pushedDaysAgo <= 3 ? 10 : pushedDaysAgo <= 14 ? 5 : 0
  trendHeat = roundScore(trendHeat)

  if (starVelocity > 0) positive.push(`近 24 小时可观测 Star 增量约 ${starVelocity}`)
  if (sourceDiversity >= 2) positive.push(`被 ${sourceDiversity} 个独立候选入口同时召回`)
  if (bestRank <= 10) positive.push(`候选榜单最佳排名第 ${bestRank}`)
  if (delta24h === null) missing.push('历史快照不足 24 小时，暂以榜单周期增量替代')

  const forkRate = repository.stars > 0 ? repository.forks / repository.stars : 0
  let technicalSubstance = 0
  technicalSubstance += pushedDaysAgo <= 7 ? 20 : pushedDaysAgo <= 30 ? 12 : 2
  technicalSubstance += Math.min(1, forkRate / 0.12) * 18
  technicalSubstance += scaleLog(repository.subscribers, 1_000) * 10
  technicalSubstance += scaleLog(repository.openIssues, 1_000) * 8
  technicalSubstance += repository.licenseSpdx ? 10 : 2
  technicalSubstance += Math.min(1, repository.topics.length / 5) * 7
  technicalSubstance += repository.sizeKb >= 500 ? 7 : 2
  technicalSubstance += repository.hasIssues ? 5 : 0
  technicalSubstance += repository.hasDiscussions ? 5 : 0
  technicalSubstance += repository.isFork ? 0 : 5
  technicalSubstance += ageDays >= 30 ? 5 : Math.max(1, ageDays / 6)
  technicalSubstance = roundScore(technicalSubstance)

  if (pushedDaysAgo <= 7) positive.push('最近一周仍有代码推送')
  if (forkRate >= 0.03) positive.push(`Fork/Star 比例为 ${(forkRate * 100).toFixed(1)}%，存在实际复用信号`)
  if (repository.licenseSpdx) positive.push(`声明了 ${repository.licenseSpdx} 开源许可证`)

  let manipulationRisk = 0
  const hardEngagement = repository.forks + repository.openIssues + repository.subscribers
  if (ageDays < 14 && repository.stars >= 1_000) {
    manipulationRisk += 18
    caution.push('仓库创建时间很短但累计 Star 已很高')
  }
  if (repository.stars >= 500 && forkRate < 0.005) {
    manipulationRisk += 18
    caution.push('Star 很高但 Fork 比例异常低')
  }
  if (repository.stars >= 1_000 && repository.openIssues === 0 && repository.subscribers < 3) {
    manipulationRisk += 14
    caution.push('高 Star 与 Issue/订阅等深层互动脱节')
  }
  if (starVelocity >= 500 && hardEngagement < Math.max(10, starVelocity * 0.02)) {
    manipulationRisk += 22
    caution.push('短期 Star 增长与工程互动信号不匹配')
  }
  if (starVelocity >= 100 && starVelocity % 100 === 0) {
    manipulationRisk += 6
    caution.push('周期增量呈整百数，仅作为弱异常信号')
  }
  if (repository.isFork) {
    manipulationRisk += 8
    caution.push('该仓库是 Fork，需要与上游项目拆分归因')
  }
  if (sourceDiversity >= 2) manipulationRisk -= 8
  if (forkRate >= 0.03) manipulationRisk -= 8
  manipulationRisk = roundScore(manipulationRisk)

  const confidence: ScoreResult['confidence'] = history.length >= 7 ? 'high' : history.length >= 2 ? 'medium' : 'low'
  if (confidence === 'low') missing.push('尚未形成连续快照，异常风险只能视为早期提示')

  return {
    trendHeat,
    technicalSubstance,
    manipulationRisk,
    confidence,
    classification: classify(trendHeat, technicalSubstance, manipulationRisk, confidence),
    features: {
      ageDays: round(ageDays),
      pushedDaysAgo: round(pushedDaysAgo),
      delta24h,
      delta7d,
      periodStars24h,
      starVelocity,
      bestRank,
      sourceDiversity,
      forkRate: round(forkRate, 4),
      hardEngagement,
      stars: repository.stars,
      forks: repository.forks,
      openIssues: repository.openIssues,
      subscribers: repository.subscribers,
    },
    evidence: { positive, caution, missing },
  }
}

function classify(heat: number, substance: number, risk: number, confidence: ScoreResult['confidence']): ScoreResult['classification'] {
  if (risk >= 70 && confidence !== 'low') return 'suspected-anomaly'
  if (heat >= 65 && substance >= 65 && risk < 50) return 'real-technical-hotspot'
  if (heat >= 65 && substance >= 45 && risk < 50) return 'early-technical-hotspot'
  if (heat >= 65 && substance < 45 && risk < 50) return 'content-hotspot'
  if (heat < 45 && substance >= 70) return 'hidden-technical-hotspot'
  return 'insufficient-evidence'
}

function starDeltaNear(history: RepositoryHistoryPoint[], now: Date, hours: number): number | null {
  if (history.length < 2) return null
  const sorted = [...history].sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())
  const latest = sorted[0]
  if (!latest) return null
  const target = now.getTime() - hours * 3_600_000
  const tolerance = hours <= 24 ? 8 * 3_600_000 : 36 * 3_600_000
  const baseline = sorted
    .slice(1)
    .map((point) => ({ point, distance: Math.abs(point.capturedAt.getTime() - target) }))
    .filter(({ distance }) => distance <= tolerance)
    .sort((a, b) => a.distance - b.distance)[0]?.point
  return baseline ? Math.max(0, latest.stars - baseline.stars) : null
}

function maxPeriodStars(candidate: CandidateRepository, windows: string[]): number {
  return Math.max(0, ...candidate.rankings.filter((item) => windows.includes(item.window)).map((item) => item.periodStars ?? 0))
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / 86_400_000)
}

function scaleLog(value: number, reference: number): number {
  return Math.min(1, Math.log1p(Math.max(0, value)) / Math.log1p(reference))
}

function roundScore(value: number): number {
  return Math.max(0, Math.min(100, round(value)))
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
