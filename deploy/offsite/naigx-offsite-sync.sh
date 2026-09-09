#!/usr/bin/env bash
#
# Off-site backup sync — D-51 §4.
#
# ⚠️ THE OFF-HOST COPY IS WHAT SATISFIES D-51 §4, NOT `NAIGX_BACKUP_DIR`.
# `deploy/backup.sh` writes dumps to local staging; this script is what takes
# them off the machine. A green backup job with a broken sync leaves the
# requirement unmet while everything looks fine, which is why every failure
# path here ends in an alert rather than a log line.
#
# ⚠️ DUMPS ARE ENCRYPTED BEFORE THEY LEAVE. `pg_dump` output is NOT encrypted:
# only `raw_content`, `structured_input` and `structured_output` are sealed at
# the application level. Everything else — user emails, derived business
# content, audit events — is plaintext in a dump, and this uploads to consumer
# cloud storage.
set -uo pipefail

STAGING="${NAIGX_BACKUP_DIR:-/var/backups/naigx}"
REMOTE="gdrive:naigx-backups"
PASSPHRASE_FILE="/etc/naigx/keys/backup.key"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
NTFY_URL_FILE="/etc/naigx/ntfy-url"

alert() {
  local msg="$1"
  echo "ALERT: $msg" >&2
  if [ -r "$NTFY_URL_FILE" ]; then
    curl -sS --max-time 15 \
      -H "Title: NAIGX backup sync FAILED" \
      -H "Priority: high" \
      -H "Tags: warning" \
      -d "$msg" \
      "$(cat "$NTFY_URL_FILE")" >/dev/null 2>&1 || true
  fi
}

fail() {
  alert "$1"
  exit 1
}

[ -d "$STAGING" ] || fail "staging directory $STAGING does not exist"
[ -r "$PASSPHRASE_FILE" ] || fail "backup passphrase file $PASSPHRASE_FILE is missing or unreadable"

# ⚠️ AN EMPTY STAGING DIRECTORY IS A FAILURE, NOT A NO-OP. If pg_dump stopped
# running, syncing nothing would succeed quietly forever — the exact shape of
# outage this alerting exists to catch.
DUMPS=$(find "$STAGING" -maxdepth 1 -name '*.dump' -mtime -2 2>/dev/null | wc -l)
if [ "$DUMPS" -eq 0 ]; then
  fail "no dump newer than 2 days found in $STAGING — the backup job may have stopped"
fi

ENCRYPTED=0
for dump in "$STAGING"/*.dump; do
  [ -e "$dump" ] || continue
  enc="${dump}.enc"
  if [ -f "$enc" ] && [ "$enc" -nt "$dump" ]; then
    continue
  fi
  if ! openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
       -in "$dump" -out "$enc" -pass "file:$PASSPHRASE_FILE" 2>/dev/null; then
    rm -f "$enc"
    fail "encryption failed for $(basename "$dump")"
  fi
  chmod 600 "$enc"
  ENCRYPTED=$((ENCRYPTED + 1))
done

# Only the encrypted form is ever uploaded. The `--include` is the guard: a
# glob change that started shipping raw dumps would otherwise be silent.
if ! rclone copy "$STAGING" "$REMOTE" \
     --include '*.dump.enc' \
     --transfers 2 --retries 3 --timeout 5m \
     --log-level ERROR 2>/tmp/naigx-sync.err; then
  fail "rclone copy to $REMOTE failed: $(head -c 300 /tmp/naigx-sync.err)"
fi

# ⚠️ VERIFY BY READING BACK, NOT BY TRUSTING THE EXIT CODE. rclone exits 0 when
# it had nothing to do, which is indistinguishable from success on an empty
# upload set.
REMOTE_COUNT=$(rclone ls "$REMOTE" 2>/dev/null | grep -c '\.dump\.enc$')
if [ "$REMOTE_COUNT" -eq 0 ]; then
  fail "sync reported success but $REMOTE contains no encrypted dumps"
fi

# Local staging is pruned; the remote is pruned separately so a local mistake
# cannot delete the off-site copy in the same breath.
find "$STAGING" -maxdepth 1 -name '*.dump' -mtime "+$RETENTION_DAYS" -delete 2>/dev/null || true
find "$STAGING" -maxdepth 1 -name '*.dump.enc' -mtime "+$RETENTION_DAYS" -delete 2>/dev/null || true
rclone delete "$REMOTE" --min-age "${RETENTION_DAYS}d" --include '*.dump.enc' 2>/dev/null || true

echo "sync OK: $ENCRYPTED newly encrypted, $REMOTE_COUNT encrypted dumps off-site"
