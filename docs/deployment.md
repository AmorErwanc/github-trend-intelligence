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
