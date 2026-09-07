# D-57 — Rollback across a data-format change, and why a schema check cannot catch it

**Date:** 2026-09-08
**Status:** Accepted
**Sprint:** 5 (Persistence, identity, instrumentation)
**Resolves:** the incompatibility the `M-19` Phase 4 rollback rehearsal found
**Affects:** `SA §9.3`, `TM-17`, `DB §13.1`, `M-18`, `M-19`, `M-20`
**Blocks** the production rollback drill ([D-50](25-D-50-Deployment-Topology.md) §4) until implemented — it now is.
**Follows** [D-53](28-D-53-Encryption-Layers.md), [D-55](30-D-55-Envelope-Format-And-Purge-Outbox.md), [D-56](31-D-56-Monitoring-Alerting-And-The-Drills.md).

---

## 1. What was found

The Phase 4 rehearsal deployed the pre-encryption build against the current
database, expecting to confirm that the Phase 3 migration was additive. It was.
The build started, connected, and read 22 analyses without an error.

It also returned this as a user's submitted document:

```
naigx.v1.1.ZsDNud9imNioT7wY.ow78xee1ZYWjL7mnql8uyw.QHzx…
```

⚠️ **It did not fail.** The old build has no cipher — it reads the column and
returns what is there. So the rollback produced a service that starts cleanly,
passes its health check, serves history listings, and hands every user a base64
envelope where their document should be. Search matches nothing. Exports
contain envelopes. Nothing in any log says why.

## 2. Why `SA §9.3` did not catch it, and could not

`SA §9.3` requires *"migrations backward-compatible within one version"*, and
**that requirement was met**. The Phase 3 migration is purely additive: two new
tables, no column altered, no row rewritten. The schema rolls back perfectly.

⚠️ **The schema was never the thing that changed.** The bytes in
`raw_content` stopped meaning "the user's text" and started meaning "an
envelope containing the user's text", and no schema-compatibility check is
structurally capable of noticing that. This is a **data-format** compatibility
problem, and the project had no concept for it.

That gap is the real finding. The rehearsal was looking for a migration
problem and found a category of problem the process did not model.

## 3. The decision

**Two mechanisms, because they solve different halves and neither is
sufficient alone.**

### 3.1 Rename the sealed columns — for builds that already exist

| Was | Is |
|---|---|
| `analysis_input.raw_content` | `analysis_input.raw_content_sealed` |
| `stage_trace.structured_input` | `stage_trace.structured_input_sealed` |
| `stage_trace.structured_output` | `stage_trace.structured_output_sealed` |

An already-built artefact cannot be changed. The only way to stop one
misreading this data is to make the data **unreachable under the name it asks
for**. An old build issues `SELECT … raw_content …`, Postgres answers
`42703 undefined_column`, and the request fails loudly.

**Verified** by running the Phase 2 image against the migrated databases:

```
✅ REFUSED: The column `analysis_input.raw_content` does not exist in the current database.
✅ REFUSED: The column `stage_trace.structured_input` does not exist in the current database.
```

Application code was untouched: only Prisma's `@map` changed, so the field is
still `rawContent` everywhere it is used.

⚠️ **This is deliberately a hard break, and that is the point.** A rollback past
this migration now fails visibly instead of succeeding wrongly.

### 3.2 A data-format version — for builds that do not exist yet

`data_format` holds one row with an integer. The application declares the
highest format it can read (`SUPPORTED_DATA_FORMAT`) and **refuses to start**
when the stored value is higher — before serving a single request.

```
Failed to start backend: DataFormatTooNewError: This database is written in
data format 3; this build understands at most 2. Refusing to start.

⚠️ THIS IS A ROLLBACK PAST A DATA-FORMAT CHANGE. Starting anyway would not
fail — it would serve stored content as though it were still in the older
format …
```

**Verified** by setting the stored version to 3 and starting the current build.

A missing row means format 1 (plaintext) — older, never newer — so a database
predating the guard still starts, including a restored backup.

### 3.3 Why both

The rename cannot protect against a build that does not exist yet; the guard
cannot protect against a build that predates it. Together they cover the
rollback before and the rollback after.

Failing at **startup** is also strictly better than failing at read: the same
reasoning as [D-52](27-D-52-Managed-Key-Service.md) §5's refuse-to-start on an
unreachable key service. A service that starts and returns wrong content is
worse than one that does not start.

## 4. The deployable floor

> ⚠️ **The deployable floor is now the first build that reads the `*_sealed`
> columns.** Rolling back past it is not supported and fails visibly. The two
> ways out of a bad release below that floor are: deploy forward to a build
> that understands the current format, or restore a pre-format-change backup —
> and backups are retained **7 days** (`DBQ-7`), so the second has a deadline.

Raising `SUPPORTED_DATA_FORMAT` again raises that floor permanently. It must
move together with a migration writing the same number, and a test asserts the
two agree.

## 5. What this does not settle

- **The production rollback drill has still not happened.** D-50 §4 requires it
  on the deployed environment, and there is none. This record removes the
  *blocker* the owner named; it does not perform the drill, and `M-19` remains
  not passed.
- **A rollback still costs the encryption boundary.** Nothing here makes
  rolling back past Phase 3 *possible* — it makes it fail instead of lie. That
  is the correct trade and it is a real constraint on release planning.
- **Restoring a pre-rename dump needs migrations applied after the restore.**
  The normal order, and the restore drill exercises the current schema.
