#!/usr/bin/env bash
#
# NAIGX backups — scheduled dumps of BOTH databases ([D-51](../docs/26-D-51-Self-Hosted-PostgreSQL.md) §4).
#
# Usage:
#   naigx-backup once     one dump of each database, then exit
#   naigx-backup loop     dump every BACKUP_INTERVAL_HOURS, forever (the service)
#   naigx-backup prune    apply retention and exit
#
# D-51 §4 lists six obligations. This script covers three of them — the
# schedule, both databases, and automatic 7-day rotation. It CANNOT cover the
# other three by itself, and pretending otherwise is how a backup story fails:
#
#   · **Off-host storage** is a property of where `/backups` is mounted, not of
#     this script. See the `backup` service in `docker-compose.prod.yml`.
#   · **The restore drill** is `deploy/restore-drill.sh`. ⚠️ A completed dump is
#     not evidence of a restorable backup — see that script's header.
#   · **The published window** is the data policy page (`NFR-031`).
#
# ⚠️ THE DUMPS CONTAIN CIPHERTEXT FOR THE ENCRYPTED FIELDS, SO THEY DEPEND ON
# THE ROOT KEY FILE. `raw_content`, `structured_input` and `structured_output`
# are sealed ([D-53](../docs/28-D-53-Encryption-Layers.md), D-55,
# [D-61](../docs/36-D-61-Host-Held-Key-File.md)). Losing that file destroys
# these backups as surely as deleting them — restoring a dump into a database
# whose key is gone yields rows nobody can read. The key's existence is part of
# the backup story, not a separate concern.
#
# ⚠️ AND THE KEY MUST NOT TRAVEL WITH THE DUMPS. An archive holding both the
# ciphertext and the key that opens it protects neither (D-61 §4).
#
# ⚠️ BACKUP CONTENT IS NEVER LOGGED (D-51 §4). This script prints file names,
# sizes and row counts — never a row, never a dump excerpt. `pg_dump` writes to
# a file, not to stdout, for that reason.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
PRIMARY_DB="${POSTGRES_DB:-naigx}"
TRACE_DB="${TRACE_DB:-naigx_trace}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"

log() {
  printf '%s naigx-backup: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

dump_one() {
  local db="$1" stamp="$2"
  local target="${BACKUP_DIR}/${db}-${stamp}.dump"

  # `--format=custom` rather than plain SQL: it compresses, and `pg_restore`
  # can then restore selectively and in parallel. A plain dump can only be
  # replayed whole, which is the wrong shape for the drill.
  #
  # Written to a `.partial` name first and renamed on success, so an interrupted
  # dump can never be mistaken for a complete one by the retention pass or by a
  # restore. A truncated dump that looks finished is the worst artefact here.
  pg_dump --format=custom --no-owner --no-privileges \
    --dbname="$db" --file="${target}.partial"
  mv "${target}.partial" "$target"

  log "wrote $(basename "$target") ($(du -h "$target" | cut -f1))"
}

dump_all() {
  local stamp
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$BACKUP_DIR"

  # ⚠️ BOTH DATABASES. `DB §1.4` makes the trace store a separate database, so
  # a backup of the primary alone silently omits every stage trace — and the
  # omission is invisible until a restore is attempted.
  dump_one "$PRIMARY_DB" "$stamp"
  dump_one "$TRACE_DB" "$stamp"
}

prune() {
  # `DBQ-7`, resolved at 7 days (D-51). Enforced without operator action,
  # because a retention policy that needs remembering is not a policy.
  local removed=0
  while IFS= read -r -d '' old; do
    rm -f "$old"
    removed=$((removed + 1))
    log "pruned $(basename "$old")"
  done < <(find "$BACKUP_DIR" -maxdepth 1 -name '*.dump' -type f \
    -mtime "+${RETENTION_DAYS}" -print0 2>/dev/null || true)

  # Partial dumps from an interrupted run are not backups and are not kept.
  find "$BACKUP_DIR" -maxdepth 1 -name '*.dump.partial' -type f \
    -mmin +120 -delete 2>/dev/null || true

  log "retention: ${RETENTION_DAYS} days, ${removed} file(s) removed"
}

case "${1:-once}" in
  once)
    dump_all
    prune
    ;;
  prune)
    prune
    ;;
  loop)
    log "starting; every ${INTERVAL_HOURS}h, retaining ${RETENTION_DAYS} days"
    while true; do
      # A failed dump must not kill the service — the next cycle should still
      # run. It is logged, and `naigx_` metrics do not cover backups, so the
      # log is the signal.
      if dump_all && prune; then
        log "cycle complete"
      else
        log "⚠️ cycle FAILED — see the error above; retrying next cycle"
      fi
      sleep "$((INTERVAL_HOURS * 3600))"
    done
    ;;
  *)
    echo "Usage: naigx-backup <once|loop|prune>" >&2
    exit 64
    ;;
esac
