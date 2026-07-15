import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import type { Logger } from './lib/logger.js'
import type { CollectorScheduler } from './scheduler/collector-scheduler.js'

export function registerGracefulShutdown(input: {
  app: FastifyInstance
  prisma: PrismaClient
  scheduler: CollectorScheduler
  logger: Logger
}): void {
  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    input.logger.info({ signal }, '开始优雅关停')
    input.scheduler.stop()
    await input.app.close()
    await input.prisma.$disconnect()
  }
  process.once('SIGTERM', () => void shutdown('SIGTERM'))
  process.once('SIGINT', () => void shutdown('SIGINT'))
}
