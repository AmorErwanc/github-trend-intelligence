# 数据模型

所有表以 `github_trend_` 为前缀，schema 事实源为 `prisma/schema.prisma`，初始 DDL 事实源为 `prisma/migrations/20260715090000_init/migration.sql`。

- `repository`：仓库稳定身份和当前元数据；GitHub 仓库 ID 使用 PostgreSQL `bigint`。
- `repository_snapshot`：每次采集时的 Star、Fork、Issue、订阅、许可证、Topics 等快照。
- `ranking_snapshot`：来源、时间窗口、排名、周期 Star 增量与来源原始信号。
- `repository_artifact`：README 等内容制品，按 SHA-256 去重并保留版本。
- `repository_score`：趋势热度、技术含金量、异常风险、置信度、分类与完整特征证据。
- `collection_run`：每轮采集的状态、候选数、成功数、失败数和来源情况。
- `recommendation_batch`：按北京时间自然日保存每日推荐批次、来源评分时刻和目标/实际数量；日期唯一保证同日幂等。
- `recommendation_item`：保存批次内顺序与推荐时评分快照；仓库 ID 全局唯一，保证跨日永久去重。

数据库使用 PostgreSQL 18.1。所有绝对时间使用 `timestamptz(3)`，JSON 数据使用 `jsonb`，长文本使用 `text`。GitHub 全球事件与采集时刻按绝对时间保存，接口统一输出 ISO 8601；业务展示需要时再转换时区。
