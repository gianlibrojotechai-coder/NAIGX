# Off-site backup sync — the host-only mechanism, preserved

[D-51](../../docs/26-D-51-Self-Hosted-PostgreSQL.md) §4 requires backups
stored **off the deployment host**. `deploy/backup.sh` writes dumps to local
staging; the three files here are what take them off the machine. They ran
only on the VPS until 2026-09-09, when they were copied into the repository
**byte for byte** so that losing the host does not lose the knowledge of how
the off-site copies were encrypted.

| File | Installed as | Host sha256 (2026-09-09) |
|---|---|---|
| `naigx-offsite-sync.sh` | `/usr/local/bin/naigx-offsite-sync` (mode `0755`) | `4d723c80…3f077` |
| `naigx-offsite-sync.service` | `/etc/systemd/system/naigx-offsite-sync.service` | `4eef4b5e…3caea` |
| `naigx-offsite-sync.timer` | `/etc/systemd/system/naigx-offsite-sync.timer` | `562de41d…bf424` |

⚠️ **These files carry no secrets, and the two things they depend on are
deliberately NOT in this repository:**

| Private file on the host | What it is | Mode |
|---|---|---|
| `/etc/naigx/keys/backup.key` | The passphrase every dump is encrypted with before upload. **Separate from `root.key`** (D-61), which seals fields *inside* the database. Losing it makes every off-site copy unreadable | `root:root 0400`, 65 bytes |
| `/etc/naigx/ntfy-url` | The private receiver URL the script alerts to on failure | `root:root 0600` |
| `~root/.config/rclone/rclone.conf` | The `gdrive:` remote (type `drive`) and its OAuth token | rclone's default |

The owner holds `backup.key` in a password manager alongside `root.key`.
**Never commit, print, or log any of the three.**

## What the script does, each hour

1. Refuses if the staging directory is missing, the passphrase file is
   unreadable, or **no dump newer than 2 days exists** — an empty staging
   directory is a stopped backup job, not a no-op.
2. Encrypts every `*.dump` in staging that has no newer `.enc` beside it:
   ```
   openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
     -in X.dump -out X.dump.enc -pass file:/etc/naigx/keys/backup.key
   ```
   and `chmod 600`s the result.
3. `rclone copy` of **`*.dump.enc` only** to `gdrive:naigx-backups`. The
   `--include` is the guard against ever shipping a raw dump.
4. Verifies by reading the remote back — rclone exits 0 on an empty upload
   set, so the exit code alone proves nothing.
5. Prunes local `.dump`/`.dump.enc` and remote `.dump.enc` older than
   `BACKUP_RETENTION_DAYS` (7, `DBQ-7`) — separately, so a local mistake
   cannot delete the off-site copy in the same breath.
6. Every failure path posts to the ntfy URL with `Priority: high` and exits 1.

Environment comes from `/opt/naigx/deploy/.env` via the unit's
`EnvironmentFile=` (`NAIGX_BACKUP_DIR`, `BACKUP_RETENTION_DAYS`). The timer is
`OnCalendar=hourly`, `Persistent=true`, `RandomizedDelaySec=300`.

## Installing on a fresh host

Prerequisites: `rclone` with a configured `gdrive:` remote (`rclone config`),
`openssl`, the stack from `docker-compose.prod.yml` writing dumps to
`NAIGX_BACKUP_DIR`, and the two private files above.

```bash
# 1. The passphrase — once, ever, and back it up separately from the dumps.
sudo install -d -m 0755 /etc/naigx/keys
sudo sh -c "openssl rand -base64 48 > /etc/naigx/keys/backup.key"
sudo chmod 0400 /etc/naigx/keys/backup.key

# 2. The private receiver URL for failure alerts.
sudo sh -c 'printf "%s" "https://ntfy.sh/<your-private-topic>" > /etc/naigx/ntfy-url'
sudo chmod 0600 /etc/naigx/ntfy-url

# 3. The script and units, from this directory.
sudo install -m 0755 deploy/offsite/naigx-offsite-sync.sh /usr/local/bin/naigx-offsite-sync
sudo install -m 0644 deploy/offsite/naigx-offsite-sync.service /etc/systemd/system/
sudo install -m 0644 deploy/offsite/naigx-offsite-sync.timer   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now naigx-offsite-sync.timer

# 4. Run it once by hand and read the result — "sync OK: N newly encrypted,
#    M encrypted dumps off-site" — then check the remote yourself.
sudo systemctl start naigx-offsite-sync.service
journalctl -u naigx-offsite-sync.service -n 3 --no-pager
rclone ls gdrive:naigx-backups
```

⚠️ **Re-verify after installing**: the restore drill below, from the off-site
copies. A configured sync is not a verified one.

## Recovering from the off-site copies

You need **both** keys: `backup.key` to open the file, and `root.key` (D-61)
for the database to read the sealed fields once restored. Either missing
makes the copy useless — that is the design, not an accident.

```bash
STAMP=20260909T081138Z                          # the set you want
D=/tmp/naigx-restore && mkdir -m 700 "$D"

# 1. Pull the encrypted pair back.
rclone copy gdrive:naigx-backups "$D" --include "*${STAMP}.dump.enc"

# 2. Decrypt — the exact inverse of the parameters above.
for f in "$D"/*.dump.enc; do
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
    -in "$f" -out "${f%.enc}" -pass file:/etc/naigx/keys/backup.key
done

# 3. PROVE IT before restoring anything: the drill restores into scratch
#    databases and compares counts. Run it in a throwaway container on the
#    compose network; PGUSER/PGPASSWORD come from deploy/.env.
docker run --rm -i --network naigx_naigx \
  -e PGHOST=postgres -e PGUSER="$POSTGRES_USER" -e PGPASSWORD="$POSTGRES_PASSWORD" \
  -e BACKUP_DIR=/drill -v "$D:/drill:ro" postgres:17 \
  bash -s < deploy/restore-drill.sh

# 4. Only then restore for real — into the live databases, with the stack's
#    backend STOPPED first, and only after `git log` confirms the code you
#    will start reads this data format (D-57 §4):
#      docker compose ... stop backend
#      pg_restore --dbname=naigx       --clean --if-exists --no-owner --no-privileges "$D/naigx-${STAMP}.dump"
#      pg_restore --dbname=naigx_trace --clean --if-exists --no-owner --no-privileges "$D/naigx_trace-${STAMP}.dump"
#      docker compose ... up -d backend

# 5. Remove the decrypted copies. They are plaintext for everything except
#    the three sealed fields.
rm -rf "$D"
```

This recovery path was exercised on 2026-09-09 through step 3 against real
production copies pulled back from the remote —
[RESTORE-DRILL-LOG](../../docs/deployment/RESTORE-DRILL-LOG.md). Step 4 has
never been run against production and should not be until it is needed.

## Keeping the copy here honest

The host is authoritative for what *runs*; this directory is authoritative
for what *should* run. After any change on the host, copy the files back and
update the checksums above; after any change here, install them. A `diff`
between the two is the check:

```bash
diff <(ssh root@HOST cat /usr/local/bin/naigx-offsite-sync) deploy/offsite/naigx-offsite-sync.sh
```
