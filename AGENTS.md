# github-trend-intelligence

GitHub 趋势候选采集、时间序列评分与 CrewAI 证据服务。完整项目规则见 `CLAUDE.md`。

## 开工顺序

先读 `docs/README.md`，再按任务进入代码；排查趋势结论时必须核对原始快照和评分证据，不能只看 README 或当前 Star。

## 业务上下文（context-agent 接线）

- 开工先读 `~/program/context-agent/knowledge/projects/github-trend-intelligence/dev-brief.md`；找不到则读同目录 `README.md`。
- context-agent 档案只读；新需求、完成或偏差投递到 `~/program/context-agent/inbox/`。
