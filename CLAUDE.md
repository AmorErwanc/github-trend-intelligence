# github-trend-intelligence

GitHub 趋势候选采集、时间序列评分与 CrewAI 证据服务。

## 遵循的规范

本项目遵循 `~/backend/conventions/` 后端规范。以下仅记录与基线不同的特例。

## 项目特例

- 代码路径：用户指定在 `~/program/github-trend-intelligence`，不在 `~/backend/`。
- 主键：内部记录使用 24 位 ULID；GitHub `repo.id` 是跨来源稳定业务键。
- 时间：全球 GitHub 事件统一存 UTC 绝对时刻，展示时再做时区转换。
- 数据库：独立 `github_trend` MySQL，不接公司共享表。
- 部署：开发态已跑通；生产推荐云端常驻，但目标尚未绑定，Deploy workflow 禁止自动发布。

## Git 提交规范（必读）

见 `docs/commit-convention.md`。

## docs 更新规范（必读）

改代码时必须同步 `docs/README.md` 中的同步矩阵。

## 业务上下文（context-agent 接线）

- **开工先读**：`~/program/context-agent/knowledge/projects/github-trend-intelligence/dev-brief.md`。简报未生成、过期或不够时，读同目录 `README.md`。
- **只读**：简报与档案由 context-agent 后台维护，本仓库不直接改。
- **回流**：开发中的新需求、完成或偏差投递到 `~/program/context-agent/inbox/`。
