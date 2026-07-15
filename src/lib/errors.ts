export const ApiErrorCode = {
  UNAUTHORIZED: 4011,
  PARAM_INVALID: 4002,
  RESOURCE_NOT_FOUND: 4041,
  STATE_CONFLICT: 4091,
  RATE_LIMITED: 4291,
  INTERNAL_ERROR: 5001,
  UPSTREAM_FAILED: 5021,
} as const

export type PublicErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'RESOURCE_NOT_FOUND'
  | 'COLLECTION_RUNNING'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_SERVER_ERROR'

const meta = {
  BAD_REQUEST: { apiCode: ApiErrorCode.PARAM_INVALID, httpStatus: 400, retryable: false },
  UNAUTHORIZED: { apiCode: ApiErrorCode.UNAUTHORIZED, httpStatus: 401, retryable: false },
  RESOURCE_NOT_FOUND: { apiCode: ApiErrorCode.RESOURCE_NOT_FOUND, httpStatus: 404, retryable: false },
  COLLECTION_RUNNING: { apiCode: ApiErrorCode.STATE_CONFLICT, httpStatus: 409, retryable: false },
  RATE_LIMITED: { apiCode: ApiErrorCode.RATE_LIMITED, httpStatus: 429, retryable: true },
  UPSTREAM_ERROR: { apiCode: ApiErrorCode.UPSTREAM_FAILED, httpStatus: 502, retryable: true },
  INTERNAL_SERVER_ERROR: { apiCode: ApiErrorCode.INTERNAL_ERROR, httpStatus: 500, retryable: true },
} as const

export class BizError extends Error {
  readonly apiCode: number
  readonly httpStatus: number
  readonly retryable: boolean

  constructor(readonly code: PublicErrorCode, message: string, readonly details?: Record<string, unknown>) {
    super(message)
    this.name = 'BizError'
    this.apiCode = meta[code].apiCode
    this.httpStatus = meta[code].httpStatus
    this.retryable = meta[code].retryable
  }
}
