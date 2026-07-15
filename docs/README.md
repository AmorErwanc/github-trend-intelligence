# github-trend-intelligence · docs 事实源

GitHub 趋势候选采集、时间序列评分和 CrewAI 证据服务。

## 文档地图

- [project-info.md](project-info.md) — 项目定位、依赖和运行边界
- [workflow.md](workflow.md) — 采集、评分和证据输出流程
- [data-model.md](data-model.md) — 数据模型
- [decisions.md](decisions.md) — 架构决策记录
- [crewai-integration.md](crewai-integration.md) — CrewAI 接入契约
- [api/README.md](api/README.md) — HTTP 接口
- [commit-convention.md](commit-convention.md) — 提交规范

## docs 同步矩阵

- 数据表变化 → `prisma/schema.prisma` + `docs/data-model.md`
- 采集源或评分逻辑变化 → `docs/workflow.md` + 新 ADR
- HTTP 路由变化 → `docs/api/README.md`
- CrewAI 证据结构变化 → `docs/crewai-integration.md`
- 环境变量变化 → `.env.example` + `docs/project-info.md`
