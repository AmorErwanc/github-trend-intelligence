# GitHub Trend Intelligence

持续抓取 GitHub 热门候选，保存时间序列证据，区分“热度、技术含金量、异常风险”，并输出可直接交给 CrewAI 的结构化证据包。

## 第一版能力

- 多入口候选发现：GitHub Trending、GitHub Repository Search、OSSInsight 24h/28d 趋势。
- 低门槛运行：三个入口都可以免费调用；`GITHUB_TOKEN` 可选，只用于提高 GitHub API 限额。
- 连续证据：保存仓库指标快照、榜单排名轨迹、README 版本和每次算法评分。
- 三分制：`trendHeat`、`technicalSubstance`、`manipulationRisk` 独立输出。
- 风险不定罪：历史不足时只给低置信度异常提示，禁止自动输出“刷星”结论。
- CrewAI 契约：证据接口返回 README、指标、历史、榜单来源和推理边界。

## 本地启动

```bash
cp .env.example .env
pnpm install
docker compose -f deploy/docker-compose.yml up -d
pnpm exec prisma migrate deploy
pnpm discover
pnpm collect
pnpm dev
```

不启动数据库也可以先运行 `pnpm discover`，验证候选发现链路。

## 主要接口

- `GET /github-trend-intelligence/health`
- `POST /github-trend-intelligence/collect`
- `GET /github-trend-intelligence/repositories?limit=20&minHeat=50`
- `GET /github-trend-intelligence/repositories/{owner}/{repo}/evidence`
- Swagger：`/github-trend-intelligence/docs`

生产常驻时设置 `AUTO_COLLECT=true`，默认每 60 分钟采集一次。未配置 GitHub Token 时，一次最多补全 20 个仓库，避免超过匿名 REST 限额。

项目文档入口见 [docs/README.md](docs/README.md)。
