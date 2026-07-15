import { getConfig } from './config/index.js'
import { buildApp } from './http/app.js'
import { createRuntime } from './runtime.js'
import { CollectorScheduler } from './scheduler/collector-scheduler.js'
import { registerGracefulShutdown } from './shutdown.js'

const config = getConfig()
const runtime = createRuntime(config)
const app = await buildApp(runtime)
const scheduler = new CollectorScheduler(runtime.collection, config.collectDailyAt, config.timeZone, runtime.logger)

await app.listen({ port: config.port, host: config.host })
runtime.logger.info({ port: config.port, host: config.host }, 'GitHub 趋势情报服务已启动')
if (config.autoCollect) scheduler.start()
registerGracefulShutdown({ app, prisma: runtime.prisma, scheduler, logger: runtime.logger })
