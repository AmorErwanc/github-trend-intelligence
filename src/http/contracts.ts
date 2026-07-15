export const errorEnvelopeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['code', 'message', 'details', 'retryable', 'requestId', 'serverTime'],
  properties: {
    code: { type: 'integer' },
    message: { type: 'string' },
    details: { type: 'object', additionalProperties: true },
    retryable: { type: 'boolean' },
    requestId: { type: 'string' },
    serverTime: { type: 'integer', description: 'Unix 毫秒时间戳' },
  },
} as const

export function successEnvelopeSchema(data: Record<string, unknown>) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['code', 'message', 'data', 'requestId', 'serverTime'],
    properties: {
      code: { type: 'integer', enum: [0] },
      message: { type: 'string' },
      data,
      requestId: { type: 'string' },
      serverTime: { type: 'integer', description: 'Unix 毫秒时间戳' },
    },
  } as const
}

export const healthDataSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'service', 'autoCollect', 'githubAuthenticated'],
  properties: {
    status: { type: 'string', enum: ['ok'] },
    service: { type: 'string' },
    autoCollect: { type: 'boolean' },
    githubAuthenticated: { type: 'boolean' },
  },
} as const

export const repositoryListDataSchema = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['fullName', 'htmlUrl', 'description', 'language', 'archetype', 'scoredAt', 'trendHeat', 'technicalSubstance', 'manipulationRisk', 'confidence', 'classification'],
    properties: {
      fullName: { type: 'string' }, htmlUrl: { type: 'string', format: 'uri' },
      description: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      language: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      archetype: { type: 'string' }, scoredAt: { type: 'string', format: 'date-time' },
      trendHeat: { type: 'number' }, technicalSubstance: { type: 'number' },
      manipulationRisk: { type: 'number' }, confidence: { type: 'string' }, classification: { type: 'string' },
    },
  },
} as const

export const collectionDataSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['runId', 'candidates', 'enriched', 'failed', 'sourceStats', 'top'],
  properties: {
    runId: { type: 'string' }, candidates: { type: 'integer' }, enriched: { type: 'integer' }, failed: { type: 'integer' },
    sourceStats: { type: 'object', additionalProperties: true }, top: { type: 'array', items: { type: 'object', additionalProperties: true } },
  },
} as const

export const dailyRecommendationDataSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['batchId', 'reportDate', 'sourceScoredAt', 'requestedCount', 'selectedCount', 'exhausted', 'repositories'],
  properties: {
    batchId: { type: 'string' },
    reportDate: { type: 'string', format: 'date' },
    sourceScoredAt: { type: 'string', format: 'date-time' },
    requestedCount: { type: 'integer', enum: [10] },
    selectedCount: { type: 'integer', minimum: 0, maximum: 10 },
    exhausted: { type: 'boolean' },
    repositories: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['position', 'fullName', 'htmlUrl', 'description', 'language', 'archetype', 'scoredAt', 'trendHeat', 'technicalSubstance', 'manipulationRisk', 'confidence', 'classification'],
        properties: {
          position: { type: 'integer', minimum: 1, maximum: 10 },
          fullName: { type: 'string' },
          htmlUrl: { type: 'string', format: 'uri' },
          description: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          language: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          archetype: { type: 'string' },
          scoredAt: { type: 'string', format: 'date-time' },
          trendHeat: { type: 'number' },
          technicalSubstance: { type: 'number' },
          manipulationRisk: { type: 'number' },
          confidence: { type: 'string' },
          classification: { type: 'string' },
        },
      },
    },
  },
} as const

export const evidenceDataSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['schemaVersion', 'generatedAt', 'repository', 'discovery', 'scores', 'history', 'readme', 'instructions'],
  properties: {
    schemaVersion: { type: 'string' }, generatedAt: { type: 'string', format: 'date-time' },
    repository: { type: 'object', additionalProperties: true }, discovery: { type: 'object', additionalProperties: true },
    scores: { type: 'object', additionalProperties: true }, history: { type: 'array', items: { type: 'object', additionalProperties: true } },
    readme: { type: 'object', additionalProperties: true }, instructions: { type: 'object', additionalProperties: true },
  },
} as const

export const protectedResponses = {
  400: errorEnvelopeSchema,
  401: errorEnvelopeSchema,
  404: errorEnvelopeSchema,
  409: errorEnvelopeSchema,
  429: errorEnvelopeSchema,
  500: errorEnvelopeSchema,
  502: errorEnvelopeSchema,
} as const
