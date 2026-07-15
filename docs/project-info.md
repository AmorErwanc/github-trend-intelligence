# 项目概览

## 定位

本服务不负责生成“GitHub 日报”，而是提供可回放的趋势证据：发现近期候选、连续采样、拆分三类评分，再让 CrewAI 基于证据解释项目为什么火。

## 服务信息

- 服务标识与生产容器名：`github-trend-intelligence`
- 路由前缀：`/github-trend-intelligence/`，Caddy 转发时保留该前缀
- 容器监听：`0.0.0.0:3310`
- 数据库：PostgreSQL 18.1；本地开发容器为 `github-trend-intelligence-postgres`，宿主机端口 `35432`
- 生产形态：ideaflow-tools Docker 服务，加入 external network `app-net`

## 环境变量

- 基础：`NODE_ENV`、`DEPLOY_ENV`、`TZ`、`PORT`、`HOST`、`SERVICE_NAME`、`LOG_LEVEL`
- 数据源：`GITHUB_TOKEN`、`GITHUB_API_BASE`、`GITHUB_WEB_BASE`、`OSSINSIGHT_API_BASE`
- 采集：`MAX_CANDIDATES`、`ENRICH_CONCURRENCY`、`SEARCH_LOOKBACK_DAYS`、`TRENDING_WINDOWS`、`OSSINSIGHT_ENABLED`
- 调度：`AUTO_COLLECT`、`COLLECT_DAILY_AT`；默认 `false`、`09:00`，时区由 `TZ` 决定
- 存储与鉴权：`DATABASE_URL`、`API_TOKEN`

`API_TOKEN` 至少 16 字符。生产的 `GITHUB_TOKEN`、`API_TOKEN`、`DATABASE_URL` 只放服务器 `.env`，不进入 Git 或镜像。

## 外部依赖

- GitHub Trending HTML：免登录、非正式 API，仅作为候选入口。
- GitHub REST API：匿名可运行，建议配置只读 Token 提高限额。
- OSSInsight Trends API：免登录，用于 24 小时与 28 天增量候选。

## 明确不做

- 第一版不接 Reddit、Hacker News、Product Hunt 等可能涉及登录、授权或额外配额管理的渠道。
- 不让 LLM 根据 README 猜热度或刷星。
- 不自动定性欺诈；异常风险达到阈值后仍需人工或离线深查。
