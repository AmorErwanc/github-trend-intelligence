import type { CollectionService } from '../collection/collection-service.js'
import type { Logger } from '../lib/logger.js'

export class CollectorScheduler {
  private timer: NodeJS.Timeout | undefined

  constructor(
    private readonly collection: CollectionService,
    private readonly intervalMinutes: number,
    private readonly logger: Logger,
  ) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.collection.collect('scheduler').then((summary) => {
        this.logger.info({ summary }, '定时采集完成')
      }).catch((error: unknown) => {
        this.logger.error({ error }, '定时采集失败')
      })
    }, this.intervalMinutes * 60_000)
    this.timer.unref()
    this.logger.info({ intervalMinutes: this.intervalMinutes }, '定时采集器已启动')
  }

  stop(): void {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = undefined
  }
}
