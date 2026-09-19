# GitHub Trend Intelligence

> ⚠️ **状态（2026-09-19）：已被取代，保留运行、不再维护。**
> 采集、打分、每日推荐这套逻辑已重写并进本机的个人工作台（`~/program/my-workbench` 的 `server/modules/github-trend/`，决策记录见该项目 `docs/decisions/ADR-011.md`）。原因：这台服务器访问不了 GitHub 趋势页（国内网络），最对口的发现渠道一直失败，候选里全是老仓库；另一个渠道 OSSInsight 的趋势排名自 2026-03-01 起已停止提供；而这个服务只有一个使用者，采集本来也是由本机触发的。
> 云端服务仍在运行，但**已没有任何调用方**：没有人再触发采集，数据停在 2026-09-19。历史推荐名单（370 个）已导入工作台。是否下线由用户决定，暂不下线。
> 要改 GitHub 热点的逻辑，请去工作台那边改，不要改这里。

持续抓取 GitHub 热门候选，使用 PostgreSQL 保存时间序列证据，区分“热度、技术含金量、异常风险”，并通过稳定的内部 HTTP API 输出可直接交给 CrewAI 的结构化证据包。

## 主要能力

- 多入口候选发现：GitHub Trending、GitHub Repository Search、OSSInsight 24h/28d 趋势。
- 连续证据：保存仓库指标快照、榜单排名轨迹、README 版本和每次算法评分。
- 三分制：趋势热度、技术含金量、异常风险独立输出；历史不足时不自动定性“刷星”。
- 内部 API：除健康检查外统一使用 `X-API-Token` 鉴权，并返回统一响应结构。
- 每日推荐：本地 Codex 每天 08:00 触发采集，从最近一轮候选中选择 10 个从未推荐过的仓库；同日重跑保持幂等。
- 云端部署：提供 ideaflow-tools Docker Compose，Caddy 转发时保留 `/github-trend-intelligence` 前缀。

## 本地启动

```bash
cp .env.example .env
# 编辑 .env，至少把 API_TOKEN 替换成 16 字符以上的随机值
pnpm install --frozen-lockfile
docker compose -f deploy/docker-compose.yml up -d
pnpm exec prisma migrate deploy
pnpm dev
```

CLI 手工采集仍可使用：

```bash
pnpm discover
pnpm collect
```

## HTTP API

```bash
curl http://127.0.0.1:3310/github-trend-intelligence/health

curl -X POST \
  -H 'X-API-Token: <API_TOKEN>' \
  http://127.0.0.1:3310/github-trend-intelligence/collect

curl -X POST \
  -H 'X-API-Token: <API_TOKEN>' \
  http://127.0.0.1:3310/github-trend-intelligence/recommendations/daily

curl -H 'X-API-Token: <API_TOKEN>' \
  'http://127.0.0.1:3310/github-trend-intelligence/repositories?limit=20&minHeat=50'

curl -H 'X-API-Token: <API_TOKEN>' \
  http://127.0.0.1:3310/github-trend-intelligence/repositories/openai/openai/evidence

curl -H 'X-API-Token: <API_TOKEN>' \
  http://127.0.0.1:3310/github-trend-intelligence/docs/json
```

成功响应样例：

```json
{
  "code": 0,
  "message": "ok",
  "data": [],
  "requestId": "req_01K...",
  "serverTime": 1784112000000
}
```

错误响应样例：

```json
{
  "code": 4011,
  "message": "API Token 缺失或无效",
  "details": { "errorCode": "UNAUTHORIZED" },
  "retryable": false,
  "requestId": "req_01K...",
  "serverTime": 1784112000000
}
```

Swagger UI 位于 `/github-trend-intelligence/docs`，其页面和 OpenAPI JSON 同样要求 `X-API-Token`。完整契约见 [docs/api/README.md](docs/api/README.md)。

## 配置与密钥

- `AUTO_COLLECT=true`：可选地开启服务内置每日采集；生产环境为 `false`，由本地 Codex 统一调度。
- `COLLECT_DAILY_AT=09:00`：目标时区内的每日固定时刻，格式为 `HH:mm`。
- `TZ=Asia/Shanghai`：IANA 时区。
- `DATABASE_URL`：PostgreSQL 连接串。
- `API_TOKEN`：内部 HTTP API Token，至少 16 字符。
- `GITHUB_TOKEN`：可选的 GitHub 只读 Token；不配置时一次最多补全 20 个仓库以控制匿名限额。

生产的 `GITHUB_TOKEN`、`API_TOKEN`、`DATABASE_URL` 只允许写入服务器 `deploy/ideaflow-tools/.env`，不得写入 Git、Dockerfile、Compose 文件或镜像。部署说明见 [docs/deployment.md](docs/deployment.md)，其余项目文档入口见 [docs/README.md](docs/README.md)。
