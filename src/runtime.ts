import type { Config } from './config/index.js'
import { CollectionService } from './collection/collection-service.js'
import { prisma } from './db/client.js'
import { RepositoryStore } from './db/repository-store.js'
import { DiscoveryService } from './discovery/discovery-service.js'
import { GitHubClient } from './external/github-client.js'
import { OSSInsightClient } from './external/ossinsight-client.js'
import { TrendingClient } from './external/trending-client.js'
import { logger } from './lib/logger.js'

export function createRuntime(config: Config) {
  const github = new GitHubClient(config.githubApiBase, config.githubToken)
  const trending = new TrendingClient(config.githubWebBase)
  const ossInsight = new OSSInsightClient(config.ossInsightApiBase)
  const discovery = new DiscoveryService(github, trending, ossInsight, logger, {
    lookbackDays: config.searchLookbackDays,
    trendingWindows: config.trendingWindows,
    ossInsightEnabled: config.ossInsightEnabled,
    maxCandidates: config.maxCandidates,
  })
  const store = new RepositoryStore(prisma)
  const collection = new CollectionService(prisma, discovery, github, store, config, logger)
  return { config, prisma, github, discovery, store, collection, logger }
}

export type Runtime = ReturnType<typeof createRuntime>
