# 项目概览

## 定位

本服务不负责生成“GitHub 日报”，而是提供可回放的趋势证据：发现近期候选、连续采样、拆分三类评分，再让 CrewAI 基于证据解释项目为什么火。

## 服务信息

- 服务标识：`github-trend-intelligence`
- 路由前缀：`/github-trend-intelligence/`
- 默认端口：`3310`
- 开发数据库：Docker MySQL 8.4，宿主机端口 `33306`
- 生产形态：推荐云端常驻；部署机器和域名尚未绑定

## 外部依赖

- GitHub Trending HTML：免登录、非正式 API，仅作为候选入口。
- GitHub REST API：匿名可运行，建议配置只读 Token 提高限额。
- OSSInsight Trends API：免登录，用于 24 小时与 28 天增量候选。

## 明确不做

- 第一版不接 Reddit、Hacker News、Product Hunt 等可能涉及登录、授权或额外配额管理的渠道。
- 不让 LLM 根据 README 猜热度或刷星。
- 不自动定性欺诈；异常风险达到阈值后仍需人工或离线深查。
