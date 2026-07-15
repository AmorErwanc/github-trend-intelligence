# 数据模型

所有表以 `github_trend_` 为前缀，schema 事实源为 `prisma/schema.prisma`。

- `repository`：仓库稳定身份和当前元数据。
- `repository_snapshot`：每次采集时的 Star、Fork、Issue、订阅、许可证、Topics 等快照。
- `ranking_snapshot`：来源、时间窗口、排名、周期 Star 增量与来源原始信号。
- `repository_artifact`：README 等内容制品，按 SHA-256 去重并保留版本。
- `repository_score`：趋势热度、技术含金量、异常风险、置信度、分类与完整特征证据。
- `collection_run`：每轮采集的状态、候选数、成功数、失败数和来源情况。

项目使用 UTC 保存 GitHub 全球事件时刻，这是相对公司业务库“北京时间字面量”的特例；展示层需要时再转换时区。
