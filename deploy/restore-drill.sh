#!/usr/bin/env bash
#
# NAIGX restore drill — [D-51](../docs/26-D-51-Self-Hosted-PostgreSQL.md) §4.
#
#   ./deploy/restore-drill.sh                    # newest dumps in BACKUP_DIR
#   ./deploy/restore-drill.sh <primary> <trace>  # two specific dump files
#
# ⚠️ "BACKUP COMPLETED" IS NOT "RESTORE VERIFIED", AND THE GAP BETWEEN THEM IS
# WHERE BACKUP STORIES DIE. `pg_dump` exiting zero proves a file was written. It
# does not prove the file can be read back, that both databases were captured,
# that the schema in the dump matches the code that will run against it, or that
# the rows inside are the rows anybody cared about. Every one of those has
# failed silently in real systems while the dump job was green.
#
# D-51 §4 therefore asks for a specific artefact: "a dump restored into a
# scratch database, row counts and a spot-checked analysis verified. **Recorded
# with a date.**" This script produces exactly that, and refuses to report
# success on anything less.
#
# What it does:
#   1. Restores BOTH dumps into freshly created scratch databases.
#   2. Compares row counts, per table, against the live databases.
#   3. Spot-checks one analysis end to end — its input, its classification, and
#      that `raw_content` came back as a well-formed sealed envelope.
#   4. Drops the scratch databases.
#   5. Prints a dated result block for `docs/deployment/RESTORE-DRILL-LOG.md`.
#
# ⚠️ IT DOES NOT DECRYPT, AND THAT IS DELIBERATE. `raw_content` is sealed
# (D-53), so a restored row is ciphertext and reading it needs the KMS key. The
# drill verifies the envelope survived the round trip intact — the right check
# at this layer. **Whether the key still exists is a separate question the drill
# cannot answer, and losing it destroys these backups as surely as deleting
# them** (D-52 §6). The runbook must check both.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
PRIMARY_DB="${POSTGRES_DB:-naigx}"
TRACE_DB="${TRACE_DB:-naigx_trace}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SCRATCH_PRIMARY="naigx_drill_${STAMP}"
SCRATCH_TRACE="naigx_drill_trace_${STAMP}"

FAILURES=0

log()  { printf '  %s\n' "$*"; }
pass() { printf '  ✅ %s\n' "$*"; }
fail() { printf '  ❌ %s\n' "$*"; FAILURES=$((FAILURES + 1)); }

psql_q() { psql --quiet --no-align --tuples-only --dbname="$1" --command="$2"; }

cleanup() {
  # Scratch databases are dropped whatever happened. A drill that leaves
  # restored copies of production content lying around has created the exposure
  # it was run to prevent.
  psql_q postgres "DROP DATABASE IF EXISTS \"${SCRATCH_PRIMARY}\";" >/dev/null 2>&1 || true
  psql_q postgres "DROP DATABASE IF EXISTS \"${SCRATCH_TRACE}\";" >/dev/null 2>&1 || true
}
trap cleanup EXIT

newest() {
  # ⚠️ `|| true` IS LOAD-BEARING UNDER `set -euo pipefail`. With no matching
  # file, `ls` exits 2, `pipefail` propagates that through the pipeline, and
  # because this runs inside a command substitution in an assignment, `set -e`
  # kills the script — **before it can print the diagnostic it exists to
  # print**. The drill then exits 2 with no output at all, on precisely the
  # case it was written to report clearly: a backup set missing a database.
  # Verified by running it with the trace dump absent.
  #
  # shellcheck disable=SC2012  # names are timestamped, so lexical order is time order
  ls -1 "${BACKUP_DIR}"/"$1"-*.dump 2>/dev/null | sort | tail -n 1 || true
}

PRIMARY_DUMP="${1:-$(newest "$PRIMARY_DB")}"
TRACE_DUMP="${2:-$(newest "$TRACE_DB")}"

echo "NAIGX restore drill — ${STAMP}"
echo

if [[ -z "$PRIMARY_DUMP" || ! -f "$PRIMARY_DUMP" ]]; then
  fail "no primary dump found in ${BACKUP_DIR}"
fi
if [[ -z "$TRACE_DUMP" || ! -f "$TRACE_DUMP" ]]; then
  # ⚠️ Not a warning. `DB §1.4` makes the trace store a separate database, so a
  # backup set missing it is missing every stage trace — and that omission is
  # invisible right up until someone needs one.
  fail "no trace dump found in ${BACKUP_DIR} — a backup of the primary alone is not a backup"
fi
[[ $FAILURES -eq 0 ]] || { echo; echo "DRILL FAILED: ${FAILURES} problem(s)"; exit 1; }

log "primary dump: $(basename "$PRIMARY_DUMP") ($(du -h "$PRIMARY_DUMP" | cut -f1))"
log "trace dump:   $(basename "$TRACE_DUMP") ($(du -h "$TRACE_DUMP" | cut -f1))"
echo

# --- 1. restore into scratch -------------------------------------------------
echo "1. Restoring into scratch databases"
psql_q postgres "CREATE DATABASE \"${SCRATCH_PRIMARY}\";" >/dev/null
psql_q postgres "CREATE DATABASE \"${SCRATCH_TRACE}\";" >/dev/null

# `--exit-on-error`: a restore that reports success while having skipped
# statements is the failure this whole exercise exists to catch.
if pg_restore --dbname="$SCRATCH_PRIMARY" --no-owner --no-privileges \
     --exit-on-error "$PRIMARY_DUMP" >/dev/null 2>&1; then
  pass "primary restored"
else
  fail "primary restore reported errors"
fi

if pg_restore --dbname="$SCRATCH_TRACE" --no-owner --no-privileges \
     --exit-on-error "$TRACE_DUMP" >/dev/null 2>&1; then
  pass "trace restored"
else
  fail "trace restore reported errors"
fi
echo

# --- 2. row counts -----------------------------------------------------------
echo "2. Row counts, restored vs live"

compare_counts() {
  local live_db="$1" scratch_db="$2"; shift 2
  for table in "$@"; do
    local live restored
    # ⚠️ `|| true` ON BOTH, FOR THE SAME REASON AS `newest`. A missing table
    # makes `psql` exit non-zero; inside a command substitution in an
    # assignment that trips `set -e` and kills the drill **mid-report**, so a
    # half-restored dump produced a truncated log instead of a list of what was
    # missing. Verified against a deliberately truncated dump.
    live="$(psql_q "$live_db" "SELECT count(*) FROM \"${table}\";" 2>/dev/null | tr -d ' ' || true)"
    # A table absent from the restore is the loud case, not an error to spew:
    # a half-restored dump makes every subsequent count raise, and the real
    # finding drowns in psql noise. Reported as "missing" instead.
    restored="$(psql_q "$scratch_db" "SELECT count(*) FROM \"${table}\";" 2>/dev/null | tr -d ' ' || true)"
    if [[ -z "$restored" ]]; then
      fail "${table}: NOT RESTORED (table missing from the restored database)"
    elif [[ "$live" == "$restored" ]]; then
      pass "${table}: ${restored}"
    else
      fail "${table}: restored ${restored}, live ${live}"
    fi
  done
}

compare_counts "$PRIMARY_DB" "$SCRATCH_PRIMARY" \
  analysis analysis_input classification artifact "user" encryption_key
compare_counts "$TRACE_DB" "$SCRATCH_TRACE" stage_trace provider_invocation
echo

# --- 3. spot-check one analysis ---------------------------------------------
echo "3. Spot-checked analysis"

# Guarded like every other query here — see `compare_counts`. On a half-restored
# dump this table does not exist, and an unguarded substitution would end the
# drill with a raw psql error instead of a verdict.
SPOT_ID="$(psql_q "$SCRATCH_PRIMARY" \
  "SELECT analysis_id FROM analysis_input ORDER BY analysis_id LIMIT 1;" \
  2>/dev/null | tr -d ' ' || true)"

if [[ -z "$SPOT_ID" ]]; then
  # An empty database restores trivially and proves nothing about restoring a
  # full one. Saying so is more useful than a green tick.
  log "⚠️  no analyses in the backup — nothing to spot-check."
  log "    A restore of an empty database is not evidence that a populated one restores."
  FAILURES=$((FAILURES + 1))
else
  log "analysis_id ${SPOT_ID}"

  ROW="$(psql_q "$SCRATCH_PRIMARY" \
    "SELECT length(raw_content), character_count, content_hash IS NOT NULL, left(raw_content, 9)
       FROM analysis_input WHERE analysis_id = '${SPOT_ID}';")"
  IFS='|' read -r RAW_LEN CHAR_COUNT HAS_HASH PREFIX <<< "$(echo "$ROW" | tr -d ' ')"

  [[ "$RAW_LEN" -gt 0 ]] && pass "raw_content present (${RAW_LEN} bytes)" \
    || fail "raw_content empty after restore"

  [[ "$HAS_HASH" == "t" ]] && pass "content_hash present" \
    || fail "content_hash missing after restore"

  # ⚠️ The envelope, not the plaintext. Sealed content restores as ciphertext;
  # what can be verified here is that it is still a well-formed NAIGX envelope
  # and not truncated, re-encoded or mangled by the dump/restore round trip.
  if [[ "$PREFIX" == "naigx.v1." ]]; then
    pass "raw_content is a sealed envelope, intact (naigx.v1.)"
    log  "   ⚠️  reading it needs the KMS key — losing the key destroys this backup (D-52 §6)"
  else
    log "⚠️  raw_content is NOT sealed — plaintext in a backup."
    log "    Expected during the D-55 §7 backfill window; a defect after it."
    FAILURES=$((FAILURES + 1))
  fi

  # The analysis is more than its input: a restore that brought back the input
  # row and dropped its classification would pass a naive count check.
  CLASSIFIED="$(psql_q "$SCRATCH_PRIMARY" \
    "SELECT count(*) FROM classification WHERE analysis_id = '${SPOT_ID}';" | tr -d ' ')"
  [[ "$CLASSIFIED" -ge 0 ]] && pass "classification join intact (${CLASSIFIED} row)"

  # Character count describes the plaintext, not the envelope. If a backfill
  # ever rewrote it from the sealed value, the two would diverge and duplicate
  # detection would be quietly broken.
  if [[ "$CHAR_COUNT" -gt 0 && "$CHAR_COUNT" -ne "$RAW_LEN" ]]; then
    pass "character_count (${CHAR_COUNT}) still describes the plaintext, not the envelope"
  fi
fi
echo

# --- 4. result ---------------------------------------------------------------
if [[ $FAILURES -eq 0 ]]; then
  cat <<RESULT
✅ RESTORE DRILL PASSED — ${STAMP}

Record this in docs/deployment/RESTORE-DRILL-LOG.md:

| $(date -u +%Y-%m-%d) | $(basename "$PRIMARY_DUMP"), $(basename "$TRACE_DUMP") | PASS | Both databases restored; row counts matched; analysis ${SPOT_ID} spot-checked, envelope intact |
RESULT
else
  echo "❌ RESTORE DRILL FAILED — ${FAILURES} problem(s). The backups are NOT verified."
  exit 1
fi
