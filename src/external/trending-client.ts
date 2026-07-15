import * as cheerio from 'cheerio'
import { BizError } from '../lib/errors.js'
import type { CandidateRepository, RankingSignal } from '../domain/types.js'

export class TrendingClient {
  constructor(private readonly webBase: string) {}

  async fetch(window: string): Promise<CandidateRepository[]> {
    const url = `${this.webBase}/trending?since=${encodeURIComponent(window)}`
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 github-trend-intelligence/0.1',
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) {
      throw new BizError('UPSTREAM_ERROR', `GitHub Trending 抓取失败：${response.status}`)
    }
    const $ = cheerio.load(await response.text())
    const repositories: CandidateRepository[] = []
    $('article.Box-row').each((index, element) => {
      const anchor = $(element).find('h2 a').first()
      const href = anchor.attr('href')?.trim()
      const fullName = href?.replace(/^\//, '').split(/[?#]/)[0]
      if (!fullName || fullName.split('/').length !== 2) return
      const periodText = $(element).find('span.d-inline-block.float-sm-right').text().replace(/,/g, '')
      const periodStars = Number(periodText.match(/\d+/)?.[0] ?? 0)
      const signal: RankingSignal = {
        source: 'github-trending',
        window,
        rank: index + 1,
        ...(periodStars > 0 ? { periodStars } : {}),
      }
      repositories.push({
        fullName,
        description: $(element).find('p').first().text().trim() || undefined,
        language: $(element).find('[itemprop="programmingLanguage"]').text().trim() || undefined,
        sources: ['github-trending'],
        rankings: [signal],
      })
    })
    return repositories
  }
}
