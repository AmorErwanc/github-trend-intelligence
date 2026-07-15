import { BizError } from '../lib/errors.js'
import type { GitHubRepository } from '../domain/types.js'

interface GitHubSearchResponse {
  items: GitHubRepositoryResponse[]
}

interface GitHubReadmeResponse {
  content?: string
  encoding?: string
  sha?: string
}

interface GitHubRepositoryResponse {
  id: number
  full_name: string
  owner: { login: string }
  name: string
  html_url: string
  description: string | null
  language: string | null
  created_at: string
  pushed_at: string
  updated_at: string
  stargazers_count: number
  forks_count: number
  watchers_count: number
  subscribers_count?: number
  open_issues_count: number
  network_count?: number
  size: number
  default_branch: string
  license: { spdx_id: string | null } | null
  topics?: string[]
  has_issues: boolean
  has_discussions?: boolean
  fork: boolean
  archived: boolean
}

export class GitHubClient {
  constructor(
    private readonly apiBase: string,
    private readonly token?: string,
  ) {}

  async searchRepositories(query: string, perPage = 30): Promise<GitHubRepository[]> {
    const params = new URLSearchParams({ q: query, sort: 'stars', order: 'desc', per_page: String(perPage) })
    const response = await this.request<GitHubSearchResponse>(`/search/repositories?${params}`)
    return response.items.map(mapRepository)
  }

  async getRepository(fullName: string): Promise<GitHubRepository> {
    const response = await this.request<GitHubRepositoryResponse>(`/repos/${fullName}`)
    return mapRepository(response)
  }

  async getReadme(fullName: string): Promise<{ content: string; ref: string | null } | null> {
    try {
      const response = await this.request<GitHubReadmeResponse>(`/repos/${fullName}/readme`)
      if (!response.content || response.encoding !== 'base64') return null
      return {
        content: Buffer.from(response.content.replace(/\n/g, ''), 'base64').toString('utf8'),
        ref: response.sha ?? null,
      }
    } catch (error) {
      if (error instanceof BizError && error.details?.status === 404) return null
      throw error
    }
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.apiBase}${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'github-trend-intelligence/0.1',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) {
      const remaining = response.headers.get('x-ratelimit-remaining')
      const details = { status: response.status, remaining, reset: response.headers.get('x-ratelimit-reset') }
      if (response.status === 403 || response.status === 429) {
        throw new BizError('RATE_LIMITED', 'GitHub API 限流', details)
      }
      throw new BizError('UPSTREAM_ERROR', `GitHub API 请求失败：${response.status}`, details)
    }
    return (await response.json()) as T
  }
}

function mapRepository(input: GitHubRepositoryResponse): GitHubRepository {
  return {
    githubRepoId: input.id,
    fullName: input.full_name,
    owner: input.owner.login,
    name: input.name,
    htmlUrl: input.html_url,
    description: input.description,
    language: input.language,
    createdAt: new Date(input.created_at),
    pushedAt: new Date(input.pushed_at),
    updatedAt: new Date(input.updated_at),
    stars: input.stargazers_count,
    forks: input.forks_count,
    watchers: input.watchers_count,
    subscribers: input.subscribers_count ?? 0,
    openIssues: input.open_issues_count,
    networkCount: input.network_count ?? input.forks_count,
    sizeKb: input.size,
    defaultBranch: input.default_branch,
    licenseSpdx: input.license?.spdx_id === 'NOASSERTION' ? null : (input.license?.spdx_id ?? null),
    topics: input.topics ?? [],
    hasIssues: input.has_issues,
    hasDiscussions: input.has_discussions ?? false,
    isFork: input.fork,
    archived: input.archived,
  }
}
