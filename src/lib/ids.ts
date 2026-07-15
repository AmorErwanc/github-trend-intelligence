import { ulid } from 'ulid'

/**
 * 当前项目是独立情报服务，不接造梦雪花 ID 服务。使用 ULID 前 24 位（120 bit）作为本地有序主键。
 * 这是项目特例，GitHub 自身 repo.id 仍作为跨数据源稳定业务键。
 */
export function newId(): string {
  return ulid().slice(0, 24)
}
