import type { Logger } from '../lib/logger.js'

interface Collector {
  collect(trigger: 'scheduler'): Promise<unknown>
}

export function calculateNextDailyRun(now: Date, dailyAt: string, timeZone: string): Date {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(dailyAt)
  if (!match) throw new RangeError('dailyAt 必须使用 HH:mm 格式')
  const targetHour = Number(match[1])
  const targetMinute = Number(match[2])
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

  const firstMinuteAfterNow = Math.floor(now.getTime() / 60_000) * 60_000 + 60_000
  for (let offsetMinutes = 0; offsetMinutes < 3 * 24 * 60; offsetMinutes += 1) {
    const candidate = new Date(firstMinuteAfterNow + offsetMinutes * 60_000)
    const parts = formatter.formatToParts(candidate)
    const hour = Number(parts.find((part) => part.type === 'hour')?.value)
    const minute = Number(parts.find((part) => part.type === 'minute')?.value)
    if (hour === targetHour && minute === targetMinute) return candidate
  }
  throw new RangeError(`无法在时区 ${timeZone} 中计算下一次运行时间`)
}

export class CollectorScheduler {
  private timer: NodeJS.Timeout | undefined
  private active = false

  constructor(
    private readonly collection: Collector,
    private readonly dailyAt: string,
    private readonly timeZone: string,
    private readonly logger: Logger,
  ) {}

  start(): void {
    if (this.active) return
    this.active = true
    this.scheduleNext()
  }

  stop(): void {
    this.active = false
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
  }

  private scheduleNext(): void {
    if (!this.active) return
    const nextRun = calculateNextDailyRun(new Date(), this.dailyAt, this.timeZone)
    const delayMs = Math.max(0, nextRun.getTime() - Date.now())
    this.timer = setTimeout(() => {
      this.timer = undefined
      void this.runAndReschedule()
    }, delayMs)
    this.timer.unref()
    this.logger.info({ dailyAt: this.dailyAt, timeZone: this.timeZone, nextRun: nextRun.toISOString() }, '每日采集器已排期')
  }

  private async runAndReschedule(): Promise<void> {
    try {
      const summary = await this.collection.collect('scheduler')
      this.logger.info({ summary }, '定时采集完成')
    } catch (error) {
      this.logger.error({ error }, '定时采集失败')
    } finally {
      this.scheduleNext()
    }
  }
}
