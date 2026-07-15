import { pino, type LoggerOptions } from 'pino'

const MILLISECONDS_TO_NANOSECONDS = 1_000_000n

function nonEmpty(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function lokiTimestamp(): string {
  return `,"time":"${BigInt(Date.now()) * MILLISECONDS_TO_NANOSECONDS}"`
}

export function buildLoggerOptions(serviceName: string, env: NodeJS.ProcessEnv = process.env): LoggerOptions {
  const nodeEnv = nonEmpty(env.NODE_ENV) ?? 'development'
  const deployEnv = nonEmpty(env.DEPLOY_ENV)
  const lokiUrl = nonEmpty(env.LOKI_URL)
  const base: LoggerOptions = {
    level: nonEmpty(env.LOG_LEVEL) ?? 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.x-api-token', '*.token', '*.password', '*.apiKey'],
      censor: '[REDACTED]',
    },
  }

  if (lokiUrl) {
    return {
      ...base,
      timestamp: lokiTimestamp,
      transport: {
        target: 'pino-loki',
        options: {
          host: lokiUrl,
          batching: false,
          replaceTimestamp: false,
          ...(env.LOKI_TOKEN ? { headers: { Authorization: `Bearer ${env.LOKI_TOKEN}` } } : {}),
          labels: { app: serviceName, env: deployEnv ?? nodeEnv },
        },
      },
    }
  }

  if (nodeEnv === 'development') {
    return {
      ...base,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss.l'Z'", ignore: 'pid,hostname' },
      },
    }
  }
  return base
}

export const logger = pino(buildLoggerOptions(process.env.SERVICE_NAME ?? 'github-trend-intelligence'))
export type Logger = typeof logger
