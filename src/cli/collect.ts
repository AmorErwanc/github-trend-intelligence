process.env.LOG_LEVEL ??= 'silent'
const [{ getConfig }, { createRuntime }] = await Promise.all([
  import('../config/index.js'),
  import('../runtime.js'),
])
const runtime = createRuntime(getConfig())
try {
  const result = await runtime.collection.collect('cli')
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} finally {
  await runtime.prisma.$disconnect()
}
