import 'dotenv/config'
import { z } from 'zod'

const booleanFromString = z.string().transform((value) => value.toLowerCase() === 'true')
const dailyAt = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '必须使用 HH:mm 格式')
const timeZone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}, '必须是有效的 IANA 时区')

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DEPLOY_ENV: z.string().default('local'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3310),
  HOST: z.string().default('0.0.0.0'),
  SERVICE_NAME: z.string().default('github-trend-intelligence'),
  TZ: timeZone.default('Asia/Shanghai'),
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_API_BASE: z.url().default('https://api.github.com'),
  GITHUB_WEB_BASE: z.url().default('https://github.com'),
  OSSINSIGHT_API_BASE: z.url().default('https://api.ossinsight.io'),
  MAX_CANDIDATES: z.coerce.number().int().min(5).max(500).default(60),
  ENRICH_CONCURRENCY: z.coerce.number().int().min(1).max(12).default(4),
  SEARCH_LOOKBACK_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  TRENDING_WINDOWS: z.string().default('daily,weekly'),
  OSSINSIGHT_ENABLED: booleanFromString.default(true),
  AUTO_COLLECT: booleanFromString.default(false),
  COLLECT_DAILY_AT: dailyAt.default('09:00'),
  DATABASE_URL: z.string().min(1),
  API_TOKEN: z.string().trim().min(16, 'API_TOKEN 至少需要 16 个字符'),
})

export type Config = ReturnType<typeof parseConfig>

let cachedConfig: Config | undefined

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function parseConfig() {
  const parsed = configSchema.parse(process.env)
  return {
    nodeEnv: parsed.NODE_ENV,
    deployEnv: parsed.DEPLOY_ENV,
    port: parsed.PORT,
    host: parsed.HOST,
    serviceName: parsed.SERVICE_NAME,
    timeZone: parsed.TZ,
    githubToken: nonEmpty(parsed.GITHUB_TOKEN),
    githubApiBase: parsed.GITHUB_API_BASE.replace(/\/$/, ''),
    githubWebBase: parsed.GITHUB_WEB_BASE.replace(/\/$/, ''),
    ossInsightApiBase: parsed.OSSINSIGHT_API_BASE.replace(/\/$/, ''),
    maxCandidates: parsed.MAX_CANDIDATES,
    enrichConcurrency: parsed.ENRICH_CONCURRENCY,
    searchLookbackDays: parsed.SEARCH_LOOKBACK_DAYS,
    trendingWindows: parsed.TRENDING_WINDOWS.split(',').map((value) => value.trim()).filter(Boolean),
    ossInsightEnabled: parsed.OSSINSIGHT_ENABLED,
    autoCollect: parsed.AUTO_COLLECT,
    collectDailyAt: parsed.COLLECT_DAILY_AT,
    apiToken: parsed.API_TOKEN,
  }
}

export function getConfig(): Config {
  cachedConfig ??= parseConfig()
  return cachedConfig
}
