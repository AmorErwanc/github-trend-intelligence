import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { ApiErrorCode, BizError } from '../lib/errors.js'

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof BizError) {
      void reply.status(error.httpStatus).send({
        code: error.apiCode, message: error.message, data: null, requestId: request.id,
        details: { errorCode: error.code, ...error.details }, retryable: error.retryable, serverTime: Date.now(),
      })
      return
    }
    if (error instanceof ZodError) {
      void reply.status(400).send({
        code: ApiErrorCode.PARAM_INVALID, message: '请求参数无效', data: null, requestId: request.id,
        details: { errorCode: 'BAD_REQUEST', issues: error.issues }, retryable: false, serverTime: Date.now(),
      })
      return
    }
    request.log.error({ error, requestId: request.id }, '未处理异常')
    void reply.status(500).send({
      code: ApiErrorCode.INTERNAL_ERROR, message: '服务内部错误', data: null, requestId: request.id,
      details: { errorCode: 'INTERNAL_SERVER_ERROR' }, retryable: true, serverTime: Date.now(),
    })
  })
}
