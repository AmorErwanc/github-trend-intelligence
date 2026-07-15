import { describe, expect, it } from 'vitest'
import { mergeCandidates } from '../../src/discovery/discovery-service.js'

describe('mergeCandidates', () => {
  it('按 full_name 大小写无关去重并合并来源与排名', () => {
    const result = mergeCandidates([
      { fullName: 'Owner/Repo', sources: ['github-trending'], rankings: [{ source: 'github-trending', window: 'daily', rank: 2, periodStars: 300 }] },
      { fullName: 'owner/repo', githubRepoId: 123, sources: ['ossinsight'], rankings: [{ source: 'ossinsight', window: 'past_24_hours', rank: 4, periodStars: 280 }] },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]?.sources).toEqual(['github-trending', 'ossinsight'])
    expect(result[0]?.rankings).toHaveLength(2)
    expect(result[0]?.githubRepoId).toBe(123)
  })
})
