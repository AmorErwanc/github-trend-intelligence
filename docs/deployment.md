# 部署说明

## 本地 PostgreSQL

```bash
docker compose -f deploy/docker-compose.yml up -d
pnpm exec prisma migrate deploy
```

本地使用 PostgreSQL 18.1，容器名 `github-trend-intelligence-postgres`，宿主机端口 `35432`，避免与通用 PostgreSQL 容器冲突。

## ideaflow-tools

生产编排文件为 `deploy/ideaflow-tools/docker-compose.yml`：

- Docker 服务与容器名均为 `github-trend-intelligence`。
- 仅在容器和 `app-net` 内暴露 `3310`，由同网络的 Caddy 反向代理。
- Caddy 必须原样转发 `/github-trend-intelligence/*`，不能剥离前缀。
- 重启策略为 `unless-stopped`，健康检查访问匿名健康接口。
- 容器启动不自动执行 migration；发布前由运维执行 `prisma migrate deploy`。
- 生产环境关闭服务内置定时采集。唯一调度入口是本地 Codex：每天 08:00 先调用采集接口，完成后生成飞书日报，避免云端与本地重复采集。

部署准备：

```bash
cd deploy/ideaflow-tools
cp .env.example .env
# 在服务器上填写 DATABASE_URL、API_TOKEN、GITHUB_TOKEN
docker compose build
docker compose up -d
```

生产的 `DATABASE_URL`、`API_TOKEN`、`GITHUB_TOKEN` 只能存在服务器 `.env`。镜像构建只复制依赖、Prisma schema、源码和入口脚本，`.dockerignore` 同时排除所有实际 `.env`，不会把密钥打入镜像。

## 上线验收

```bash
curl https://tools.ideaflow.pro/github-trend-intelligence/health
curl -H 'X-API-Token: <API_TOKEN>' \
  'https://tools.ideaflow.pro/github-trend-intelligence/repositories?limit=1&minHeat=0'
```

## GitHub 自动部署

公开仓库 `AmorErwanc/github-trend-intelligence` 的 `main` 分支 push 后运行 `.github/workflows/ci-deploy.yml`：先完成类型检查、单元测试和构建，再通过 SSH/rsync 同步到 `/home/ubuntu/docker-services/github-trend-intelligence/`，保留服务器上的生产 `.env`，重建 Docker 容器并校验容器健康与公网健康接口。

数据库 migration 不在 CI 中自动执行。包含新 migration 的版本在合入 `main` 前先由运维执行 `pnpm exec prisma migrate deploy`，避免自动发布持有生产 DDL 权限。
