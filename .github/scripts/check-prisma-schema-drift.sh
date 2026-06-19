#!/usr/bin/env bash
# Fail when schema.prisma changes are not reflected in committed migrations.
#
# Applies all migrations to the configured database, then diffs the live database
# against schema.prisma. Any remaining SQL means a migration file is missing.
#
# Mediapulse: partial unique indexes on data_source are authored in migration SQL
# (Prisma cannot model them in schema.prisma) and are excluded from the check.
#
# Required env:
#   MEDIAPULSE_DATABASE_URL
#   ORCHESTRATION_DATABASE_URL

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

MEDIAPULSE_BENIGN_DROPS=(
  'DROP INDEX "data_source_global_canonical_url_key";'
  'DROP INDEX "data_source_ticker_canonical_url_key";'
)

# filter_benign_drift package_label script [benign_lines...]
# Returns 0 when the SQL script is empty or only contains allowed drift lines.
filter_benign_drift() {
  local package_label="$1"
  local script="$2"
  shift 2
  local benign_lines=("$@")
  local filtered=""
  local line

  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      "" | "-- This is an empty migration.")
        continue
        ;;
      --*)
        continue
        ;;
    esac

    local skip=false
    if [ "${#benign_lines[@]}" -gt 0 ]; then
      for benign in "${benign_lines[@]}"; do
        if [ "$line" = "$benign" ]; then
          skip=true
          break
        fi
      done
    fi
    if [ "$skip" = true ]; then
      continue
    fi

    filtered+="${line}"$'\n'
  done <<<"$script"

  if [ -n "$(printf '%s' "$filtered" | tr -d '[:space:]')" ]; then
    echo "::error::Prisma schema drift in ${package_label}. Run db:migrate:dev and commit the migration."
    printf '%s\n' "$script"
    return 1
  fi

  return 0
}

check_package_drift() {
  local filter="$1"
  local package_dir="$2"
  local package_label="$3"
  shift 3

  echo "Applying migrations for ${package_label}…"
  pnpm --filter "$filter" run db:migrate:deploy

  local script
  script="$(
    cd "$package_dir"
    pnpm exec prisma migrate diff \
      --from-config-datasource \
      --to-schema prisma/schema.prisma \
      --script
  )"

  if [ "$#" -gt 0 ]; then
    filter_benign_drift "$package_label" "$script" "$@"
  else
    filter_benign_drift "$package_label" "$script"
  fi
}

check_package_drift \
  "@mediapulse/database" \
  "packages/mediapulse/database" \
  "@mediapulse/database" \
  "${MEDIAPULSE_BENIGN_DROPS[@]}"

check_package_drift \
  "@hermes/orchestration-database" \
  "packages/hermes/orchestration-database" \
  "@hermes/orchestration-database"

echo "Prisma schema drift check passed."
