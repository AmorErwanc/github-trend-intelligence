# HTTP API

- `GET /github-trend-intelligence/health`：进程状态。
- `POST /github-trend-intelligence/collect`：触发采集；配置 Token 后需带 `X-Internal-Token`。
- `GET /github-trend-intelligence/repositories`：最新趋势结果，支持 `limit` 与 `minHeat`。
- `GET /github-trend-intelligence/repositories/{owner}/{name}/evidence`：CrewAI 证据包。
- `GET /github-trend-intelligence/docs`：Swagger UI。
