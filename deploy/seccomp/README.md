# `chromium.json` — the seccomp profile that lets Chromium sandbox itself

**Why this file exists.** `M-18` finding M-4 recommended dropping
`--no-sandbox` from the PDF renderer once the application runs as a non-root
user. Running as non-root is necessary and **not sufficient**: Chromium's
namespace sandbox needs to create a user namespace, and Docker's default
seccomp profile forbids that.

## Provenance

| | |
|---|---|
| **Base** | Docker's default seccomp profile, `moby/profiles` → `seccomp/default.json` |
| **Retrieved** | 2026-09-08 |
| **Modification** | **One group appended.** Nothing removed, nothing else changed |

```json
{
  "names": ["clone", "clone3", "unshare"],
  "action": "SCMP_ACT_ALLOW",
  "args": [],
  "comment": "Chromium namespace sandbox: permit user-namespace creation."
}
```

## What the default profile does, and what the delta changes

The default profile blocks user-namespace creation in three places:

| Rule | Default behaviour |
|---|---|
| `clone` (group 18) | Allowed only when **no** `CLONE_NEW*` flag is set — a masked comparison against `0x7E020000` |
| `clone3` (group 20) | Refused outright without `CAP_SYS_ADMIN` |
| `unshare`, `setns`, `mount`, … (group 17) | Allowed only with `CAP_SYS_ADMIN` |

The appended group permits `clone`, `clone3` and `unshare` unconditionally, so
an unprivileged process can create a user namespace. **`mount`, `setns` and the
rest of group 17 remain restricted** — the delta is deliberately narrower than
"allow group 17".

## ⚠️ The trade, stated plainly

This is **not** a free improvement, and it should not be described as one.

- **Gained:** Chromium's renderer runs sandboxed. A renderer compromise is
  contained by the browser's own boundary — the primary defence for the one
  component in this system that parses a document.
- **Paid:** the container can create unprivileged user namespaces, which is a
  known local kernel-privilege-escalation surface. The default profile blocks
  it for that reason.

It is taken because the renderer is the component most likely to be attacked
through content, and because the container runs a single non-root process with
no other tenants. The alternatives were each worse:

| Alternative | Why rejected |
|---|---|
| `--cap-add=SYS_ADMIN` | Grants mount and far more; strictly broader than this delta |
| `--security-opt seccomp=unconfined` | Disables **all** syscall filtering — worse than keeping `--no-sandbox` |
| Keep `--no-sandbox` | Leaves the renderer unsandboxed, which is the finding M-4 asked to close |

**A future improvement, not built:** run Chromium in its own container so the
relaxation applies to a process that holds no database credentials. That adds a
component, which `TC-009` and [D-50](../../docs/25-D-50-Deployment-Topology.md)
argue against at v1.0.

## ⚠️ This file and the launch arguments are coupled

`backend/src/export/pdf.ts` no longer passes `--no-sandbox`. **If a deployment
runs the container without this profile, PDF export fails** — Chromium aborts
with `Failed to move to new namespace … Operation not permitted`. That is the
intended failure: loud, at render time, with Markdown export unaffected and the
existing `503` path naming it.

Do not "fix" that by re-adding `--no-sandbox`. Ship the profile.

## Verification

Both directions were checked in a container on 2026-09-08 — the differential is
what proves the sandbox is genuinely engaged rather than silently disabled:

```sh
# Fails: "Failed to move to new namespace ... Operation not permitted"
docker run --rm <image> chromium --headless --dump-dom "data:text/html,<h1>x</h1>"

# Succeeds
docker run --rm --security-opt seccomp=deploy/seccomp/chromium.json <image> \
  chromium --headless --dump-dom "data:text/html,<h1>x</h1>"
```

A build that succeeds in **both** cases has `--no-sandbox` back somewhere.
