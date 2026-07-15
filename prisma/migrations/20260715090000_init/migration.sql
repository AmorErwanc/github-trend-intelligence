CREATE TABLE `github_trend_repository` (
  `id` CHAR(24) NOT NULL,
  `github_repo_id` BIGINT UNSIGNED NOT NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `owner` VARCHAR(128) NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `html_url` VARCHAR(512) NOT NULL,
  `description` TEXT NULL,
  `primary_language` VARCHAR(64) NULL,
  `archetype` VARCHAR(32) NOT NULL DEFAULT 'unknown',
  `created_at_github` DATETIME(3) NOT NULL,
  `pushed_at_github` DATETIME(3) NOT NULL,
  `archived` BOOLEAN NOT NULL DEFAULT false,
  `first_seen_at` DATETIME(3) NOT NULL,
  `last_seen_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `gtr_repo_github_id_uq`(`github_repo_id`),
  UNIQUE INDEX `gtr_repo_full_name_uq`(`full_name`),
  INDEX `gtr_repo_last_seen_idx`(`last_seen_at`),
  INDEX `gtr_repo_lang_seen_idx`(`primary_language`, `last_seen_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `github_trend_repository_snapshot` (
  `id` CHAR(24) NOT NULL, `repository_id` CHAR(24) NOT NULL, `captured_at` DATETIME(3) NOT NULL,
  `stars` INTEGER NOT NULL, `forks` INTEGER NOT NULL, `watchers` INTEGER NOT NULL,
  `subscribers` INTEGER NOT NULL, `open_issues` INTEGER NOT NULL, `network_count` INTEGER NOT NULL,
  `size_kb` INTEGER NOT NULL, `default_branch` VARCHAR(128) NOT NULL, `license_spdx` VARCHAR(64) NULL,
  `topics` JSON NOT NULL, `has_issues` BOOLEAN NOT NULL, `has_discussions` BOOLEAN NOT NULL,
  `is_fork` BOOLEAN NOT NULL, `source_payload` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `gtr_snap_repo_time_uq`(`repository_id`, `captured_at`),
  INDEX `gtr_snap_repo_time_idx`(`repository_id`, `captured_at`),
  INDEX `gtr_snap_time_idx`(`captured_at`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `github_trend_ranking_snapshot` (
  `id` CHAR(24) NOT NULL, `repository_id` CHAR(24) NOT NULL, `captured_at` DATETIME(3) NOT NULL,
  `source` VARCHAR(32) NOT NULL, `window` VARCHAR(32) NOT NULL, `rank` INTEGER NOT NULL,
  `period_stars` INTEGER NULL, `source_score` DOUBLE NULL, `source_payload` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `gtr_rank_repo_time_src_win_uq`(`repository_id`, `captured_at`, `source`, `window`),
  INDEX `gtr_rank_src_win_time_idx`(`source`, `window`, `captured_at`, `rank`),
  INDEX `gtr_rank_repo_time_idx`(`repository_id`, `captured_at`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `github_trend_repository_artifact` (
  `id` CHAR(24) NOT NULL, `repository_id` CHAR(24) NOT NULL, `kind` VARCHAR(32) NOT NULL,
  `ref` VARCHAR(128) NULL, `content` LONGTEXT NOT NULL, `content_hash` CHAR(64) NOT NULL,
  `fetched_at` DATETIME(3) NOT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `gtr_artifact_repo_kind_hash_uq`(`repository_id`, `kind`, `content_hash`),
  INDEX `gtr_artifact_repo_kind_time_idx`(`repository_id`, `kind`, `fetched_at`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `github_trend_repository_score` (
  `id` CHAR(24) NOT NULL, `repository_id` CHAR(24) NOT NULL, `scored_at` DATETIME(3) NOT NULL,
  `trend_heat` DOUBLE NOT NULL, `technical_substance` DOUBLE NOT NULL, `manipulation_risk` DOUBLE NOT NULL,
  `confidence` VARCHAR(16) NOT NULL, `classification` VARCHAR(48) NOT NULL,
  `features` JSON NOT NULL, `evidence` JSON NOT NULL, `algorithm_version` VARCHAR(32) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `gtr_score_repo_time_algo_uq`(`repository_id`, `scored_at`, `algorithm_version`),
  INDEX `gtr_score_time_heat_idx`(`scored_at`, `trend_heat`),
  INDEX `gtr_score_time_risk_idx`(`scored_at`, `manipulation_risk`),
  INDEX `gtr_score_repo_time_idx`(`repository_id`, `scored_at`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `github_trend_collection_run` (
  `id` CHAR(24) NOT NULL, `status` VARCHAR(24) NOT NULL, `trigger` VARCHAR(24) NOT NULL,
  `started_at` DATETIME(3) NOT NULL, `finished_at` DATETIME(3) NULL,
  `candidate_count` INTEGER NOT NULL DEFAULT 0, `enriched_count` INTEGER NOT NULL DEFAULT 0,
  `failed_count` INTEGER NOT NULL DEFAULT 0, `source_stats` JSON NULL, `error_message` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NOT NULL,
  INDEX `gtr_run_started_idx`(`started_at`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
