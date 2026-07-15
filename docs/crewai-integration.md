# CrewAI 接入

CrewAI 只消费证据，不参与候选抓取和结构化评分。

请求：`GET /github-trend-intelligence/repositories/{owner}/{repo}/evidence`

- `repository`：当前仓库事实。
- `discovery`：召回入口、榜单窗口和排名。
- `scores`：三类分数、置信度、特征与正反证据。
- `history`：用于解释“什么时候开始火”的时间序列。
- `readme`：项目自述，只用于理解定位和技术路径。数据库保存完整版本，接口最多返回前 4 万字符，并通过 `truncated` 标记是否截断。
- `instructions`：下游 Agent 允许和禁止的结论边界。

推荐让 CrewAI 输出：一句话定位、目标用户、技术亮点、走红时间线、走红原因、风险与证据缺口。
