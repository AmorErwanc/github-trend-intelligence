# 核心流程

```mermaid
flowchart LR
  T[每日固定时刻 / CLI / HTTP] --> A[启动一轮采集]
  A --> B[GitHub Trending]
  A --> C[GitHub Search]
  A --> D[OSSInsight]
  B --> E[候选合并去重]
  C --> E
  D --> E
  E --> F[GitHub 仓库详情与 README]
  F --> G[PostgreSQL 仓库与榜单快照]
  G --> H[趋势热度]
  G --> I[技术含金量]
  G --> J[异常风险]
  H --> K[CrewAI 证据包]
  I --> K
  J --> K
```

候选发现不等于排名结论。前 24 小时历史不足时，榜单周期增量只作为临时信号，置信度必须为低。形成连续序列后，逐步替换为自身计算的真实净增和持续性。

自动采集不是“进程启动后每隔 24 小时”：服务按 `TZ` 与 `COLLECT_DAILY_AT` 计算下一次墙上时刻，只设置一次定时器；执行完成后重新计算下一次。进程在当天时刻之后启动时直接排到次日，不在启动时补跑，从而避免重启导致重复采集。CLI 与带 Token 的 HTTP 手工采集不受自动调度开关影响；同一进程内已有采集运行时会拒绝第二轮。
