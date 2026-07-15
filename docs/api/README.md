# HTTP API

基础路径始终为 `/github-trend-intelligence`；Caddy 反向代理不得剥离该前缀。除健康检查外，所有 API、Swagger UI 和 OpenAPI JSON 都必须携带：

```http
X-API-Token: <API_TOKEN>
```

缺失或错误时返回 HTTP 401。Token 与服务器环境变量 `API_TOKEN` 通过固定长度摘要做安全比较。

## 统一响应

成功：

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "requestId": "req_01K...",
  "serverTime": 1784112000000
}
```

错误：

```json
{
  "code": 4002,
  "message": "请求参数无效",
  "details": { "errorCode": "BAD_REQUEST", "issues": [] },
  "retryable": false,
  "requestId": "req_01K...",
  "serverTime": 1784112000000
}
```

## 接口

### 健康检查

`GET /github-trend-intelligence/health`，唯一匿名接口。

```bash
curl http://127.0.0.1:3310/github-trend-intelligence/health
```

### 手工采集

`POST /github-trend-intelligence/collect`，无请求体。已有采集运行时返回 HTTP 409。

```bash
curl -X POST \
  -H 'X-API-Token: <API_TOKEN>' \
  http://127.0.0.1:3310/github-trend-intelligence/collect
```

### 趋势仓库列表

`GET /github-trend-intelligence/repositories`

- `limit`：整数，范围 `1..100`，默认 `20`。
- `minHeat`：数字，范围 `0..100`，默认 `0`。

```bash
curl -H 'X-API-Token: <API_TOKEN>' \
  'http://127.0.0.1:3310/github-trend-intelligence/repositories?limit=20&minHeat=50'
```

### 每日去重推荐

`POST /github-trend-intelligence/recommendations/daily`，无请求体。

- 固定目标为 10 个仓库，不接受调用方覆盖数量。
- 只从最近一轮采集的候选中按热度、技术含金量和风险排序。
- 热度必须不低于 20；低于门槛的项目不用于凑数。
- 已进入任何历史推荐批次的仓库永久排除。
- 同一北京时间自然日重复调用返回同一批，避免任务重跑造成重复推荐。
- 当最近一轮采集剩余的未推荐仓库不足 10 个时，`exhausted=true`，不从陈旧历史库存补冷门项目。

```bash
curl -X POST \
  -H 'X-API-Token: <API_TOKEN>' \
  http://127.0.0.1:3310/github-trend-intelligence/recommendations/daily
```

### 仓库证据包

`GET /github-trend-intelligence/repositories/{owner}/{repo}/evidence`

```bash
curl -H 'X-API-Token: <API_TOKEN>' \
  http://127.0.0.1:3310/github-trend-intelligence/repositories/openai/openai/evidence
```

### OpenAPI

- Swagger UI：`GET /github-trend-intelligence/docs`
- OpenAPI JSON：`GET /github-trend-intelligence/docs/json`

两者都受 `X-API-Token` 保护；OpenAPI 文档声明了 header 鉴权、查询参数、路径参数及成功/错误响应 schema。
