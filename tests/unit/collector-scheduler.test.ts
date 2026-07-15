import { describe, expect, it } from 'vitest'
import { calculateNextDailyRun } from '../../src/scheduler/collector-scheduler.js'

describe('calculateNextDailyRun', () => {
  it('按 Asia/Shanghai 的固定墙上时刻计算下一次运行', () => {
    const next = calculateNextDailyRun(new Date('2026-07-15T00:30:00.000Z'), '09:00', 'Asia/Shanghai')
    expect(next.toISOString()).toBe('2026-07-15T01:00:00.000Z')
  })

  it('启动时已到或错过今日时刻时不会立刻运行，而是排到次日', () => {
    const atScheduledTime = calculateNextDailyRun(new Date('2026-07-15T01:00:00.000Z'), '09:00', 'Asia/Shanghai')
    const afterScheduledTime = calculateNextDailyRun(new Date('2026-07-15T01:01:00.000Z'), '09:00', 'Asia/Shanghai')
    expect(atScheduledTime.toISOString()).toBe('2026-07-16T01:00:00.000Z')
    expect(afterScheduledTime.toISOString()).toBe('2026-07-16T01:00:00.000Z')
  })

  it('使用 IANA 时区规则处理夏令时跳时', () => {
    const next = calculateNextDailyRun(new Date('2026-03-08T06:00:00.000Z'), '02:30', 'America/New_York')
    expect(next.toISOString()).toBe('2026-03-09T06:30:00.000Z')
  })

  it('拒绝非法固定时刻', () => {
    expect(() => calculateNextDailyRun(new Date(), '9:00', 'Asia/Shanghai')).toThrow('HH:mm')
  })
})
