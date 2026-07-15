# github-trend-intelligence

GitHub 趋势候选采集、时间序列评分与 CrewAI 证据服务。

## 遵循的规范

本项目遵循 `~/backend/conventions/` 后端规范。以下仅记录与基线不同的特例。

## 项目特例

- 代码路径：用户指定在 `~/program/github-trend-intelligence`，不在 `~/backend/`。
- 主键：内部记录使用 24 位 ULID；GitHub `repo.id` 是跨来源稳定业务键。
- 时间：全球 GitHub 事件统一存 UTC 绝对时刻，展示时再做时区转换。
- 数据库：独立 PostgreSQL 18.1，不接公司共享表；全球 GitHub 事件使用 `timestamptz` 保存绝对时刻。
- 部署：ideaflow-tools Docker 常驻服务，加入 `app-net`，容器内监听 3310；Caddy 保留 `/github-trend-intelligence` 前缀。
- 调度：ideaflow-tools 生产环境关闭内置自动采集；本地 Codex 每日 08:00 调用采集接口，成功后生成飞书日报。服务仍保留按 `TZ` + `COLLECT_DAILY_AT` 调度的可选能力，启动不立即补跑。
- 鉴权：除健康检查外，所有 HTTP 路由与文档统一校验 `X-API-Token`。

## Git 提交规范（必读）

见 `docs/commit-convention.md`。

## docs 更新规范（必读）

改代码时必须同步 `docs/README.md` 中的同步矩阵。

## 业务上下文（context-agent 接线）

- **开工先读**：`~/program/context-agent/knowledge/projects/github-trend-intelligence/dev-brief.md`。简报未生成、过期或不够时，读同目录 `README.md`。
- **只读**：简报与档案由 context-agent 后台维护，本仓库不直接改。
- **回流**：开发中的新需求、完成或偏差投递到 `~/program/context-agent/inbox/`。
