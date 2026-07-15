CREATE TABLE "github_trend_repository" (
  "id" CHAR(24) NOT NULL,
  "github_repo_id" BIGINT NOT NULL,
  "full_name" VARCHAR(255) NOT NULL,
  "owner" VARCHAR(128) NOT NULL,
  "name" VARCHAR(128) NOT NULL,
  "html_url" VARCHAR(512) NOT NULL,
  "description" TEXT,
  "primary_language" VARCHAR(64),
  "archetype" VARCHAR(32) NOT NULL DEFAULT 'unknown',
  "created_at_github" TIMESTAMPTZ(3) NOT NULL,
  "pushed_at_github" TIMESTAMPTZ(3) NOT NULL,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "first_seen_at" TIMESTAMPTZ(3) NOT NULL,
  "last_seen_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "gtr_repo_pk" PRIMARY KEY ("id")
);

CREATE TABLE "github_trend_repository_snapshot" (
  "id" CHAR(24) NOT NULL,
  "repository_id" CHAR(24) NOT NULL,
  "captured_at" TIMESTAMPTZ(3) NOT NULL,
  "stars" INTEGER NOT NULL,
  "forks" INTEGER NOT NULL,
  "watchers" INTEGER NOT NULL,
  "subscribers" INTEGER NOT NULL,
  "open_issues" INTEGER NOT NULL,
  "network_count" INTEGER NOT NULL,
  "size_kb" INTEGER NOT NULL,
  "default_branch" VARCHAR(128) NOT NULL,
  "license_spdx" VARCHAR(64),
  "topics" JSONB NOT NULL,
  "has_issues" BOOLEAN NOT NULL,
  "has_discussions" BOOLEAN NOT NULL,
  "is_fork" BOOLEAN NOT NULL,
  "source_payload" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gtr_snap_pk" PRIMARY KEY ("id")
);

CREATE TABLE "github_trend_ranking_snapshot" (
  "id" CHAR(24) NOT NULL,
  "repository_id" CHAR(24) NOT NULL,
  "captured_at" TIMESTAMPTZ(3) NOT NULL,
  "source" VARCHAR(32) NOT NULL,
  "window" VARCHAR(32) NOT NULL,
  "rank" INTEGER NOT NULL,
  "period_stars" INTEGER,
  "source_score" DOUBLE PRECISION,
  "source_payload" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gtr_rank_pk" PRIMARY KEY ("id")
);

CREATE TABLE "github_trend_repository_artifact" (
  "id" CHAR(24) NOT NULL,
  "repository_id" CHAR(24) NOT NULL,
  "kind" VARCHAR(32) NOT NULL,
  "ref" VARCHAR(128),
  "content" TEXT NOT NULL,
  "content_hash" CHAR(64) NOT NULL,
  "fetched_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gtr_artifact_pk" PRIMARY KEY ("id")
);

CREATE TABLE "github_trend_repository_score" (
  "id" CHAR(24) NOT NULL,
  "repository_id" CHAR(24) NOT NULL,
  "scored_at" TIMESTAMPTZ(3) NOT NULL,
  "trend_heat" DOUBLE PRECISION NOT NULL,
  "technical_substance" DOUBLE PRECISION NOT NULL,
  "manipulation_risk" DOUBLE PRECISION NOT NULL,
  "confidence" VARCHAR(16) NOT NULL,
  "classification" VARCHAR(48) NOT NULL,
  "features" JSONB NOT NULL,
  "evidence" JSONB NOT NULL,
  "algorithm_version" VARCHAR(32) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gtr_score_pk" PRIMARY KEY ("id")
);

CREATE TABLE "github_trend_collection_run" (
  "id" CHAR(24) NOT NULL,
  "status" VARCHAR(24) NOT NULL,
  "trigger" VARCHAR(24) NOT NULL,
  "started_at" TIMESTAMPTZ(3) NOT NULL,
  "finished_at" TIMESTAMPTZ(3),
  "candidate_count" INTEGER NOT NULL DEFAULT 0,
  "enriched_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "source_stats" JSONB,
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "gtr_run_pk" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gtr_repo_github_uq" ON "github_trend_repository"("github_repo_id");
CREATE UNIQUE INDEX "gtr_repo_full_name_uq" ON "github_trend_repository"("full_name");
CREATE INDEX "gtr_repo_last_seen_idx" ON "github_trend_repository"("last_seen_at");
CREATE INDEX "gtr_repo_lang_seen_idx" ON "github_trend_repository"("primary_language", "last_seen_at");
CREATE UNIQUE INDEX "gtr_snap_repo_time_uq" ON "github_trend_repository_snapshot"("repository_id", "captured_at");
CREATE INDEX "gtr_snap_repo_time_idx" ON "github_trend_repository_snapshot"("repository_id", "captured_at");
CREATE INDEX "gtr_snap_time_idx" ON "github_trend_repository_snapshot"("captured_at");
CREATE UNIQUE INDEX "gtr_rank_repo_time_src_win_uq" ON "github_trend_ranking_snapshot"("repository_id", "captured_at", "source", "window");
CREATE INDEX "gtr_rank_src_win_time_idx" ON "github_trend_ranking_snapshot"("source", "window", "captured_at", "rank");
CREATE INDEX "gtr_rank_repo_time_idx" ON "github_trend_ranking_snapshot"("repository_id", "captured_at");
CREATE UNIQUE INDEX "gtr_artifact_repo_kind_hash_uq" ON "github_trend_repository_artifact"("repository_id", "kind", "content_hash");
CREATE INDEX "gtr_artifact_repo_kind_time_idx" ON "github_trend_repository_artifact"("repository_id", "kind", "fetched_at");
CREATE UNIQUE INDEX "gtr_score_repo_time_algo_uq" ON "github_trend_repository_score"("repository_id", "scored_at", "algorithm_version");
CREATE INDEX "gtr_score_time_heat_idx" ON "github_trend_repository_score"("scored_at", "trend_heat");
CREATE INDEX "gtr_score_time_risk_idx" ON "github_trend_repository_score"("scored_at", "manipulation_risk");
CREATE INDEX "gtr_score_repo_time_idx" ON "github_trend_repository_score"("repository_id", "scored_at");
CREATE INDEX "gtr_run_started_idx" ON "github_trend_collection_run"("started_at");
