# D-59 — AWS credential injection on a non-EC2 host

**Date:** 2026-09-08
**Status:** ⚠️ **RETIRED** by [D-61](36-D-61-Host-Held-Key-File.md), 2026-09-08. **Never deployed.** NAIGX no longer uses AWS, so there are no credentials to inject.
**Sprint:** 5 (Persistence, identity, instrumentation)
**Resolves:** the gap that made the production stack unbootable on the sanctioned host

> ⚠️ **THIS RECORD IS HISTORY, AND IT IS THE REASON D-61 EXISTS.** It is kept in
> full rather than deleted, because its central observation is what overturned
> [D-52](27-D-52-Managed-Key-Service.md).
>
> §4 accepted that placing long-lived AWS credentials on the deployment host
> widened the blast radius of a full host compromise. Following that through —
> which this record did not do — shows that it also **erased the confidentiality
> advantage KMS was chosen for**: an attacker who can read the credentials can
> call `Decrypt`, exactly as an attacker who can read a key file can unwrap it.
> [D-61](36-D-61-Host-Held-Key-File.md) §3 completes the argument.
>
> **Nothing here was ever deployed.** No AWS account was created, no IAM
> principal existed, no credential file was written, and no KMS call was ever
> made by this project.
**Affects:** `M-19`, `SA §10.4`, `DB §13.1` row 3, `docker-compose.prod.yml`, `deploy/README.md`
**Implements** [D-52](27-D-52-Managed-Key-Service.md) and [D-53](28-D-53-Encryption-Layers.md) on the host [D-50](25-D-50-Deployment-Topology.md) deploys. **Changes neither.** Supersedes nothing.

---

## 1. The question

The production stack refuses to start without a managed key service — deliberate,
[D-52](27-D-52-Managed-Key-Service.md) §4, no local-key fallback
([`config/env.ts`](../backend/src/config/env.ts), [`crypto/index.ts`](../backend/src/crypto/index.ts)).
The KMS adapter constructs `new KMSClient({ region })`, which reads AWS's
**ambient credential chain**.

`docker-compose.prod.yml` passed **only `AWS_REGION`**. No `env_file`, no
credentials, no mount.

On EC2 that is correct and invisible: the container reaches the instance
metadata service and the chain resolves. **The sanctioned host is a Hostinger
VPS**, where no such chain exists — so the container would find no credentials,
`loadCipher` would refuse, and the application would not boot at all.

⚠️ **This was a real blocker on the deployment path, not a theoretical one**, and
nothing in the repository recorded it. The decision it forces — how the
credential guarding `DB §13.1` row 3 is held — is a security and
deployment-policy decision, which is why it is a record rather than a commit
message.

## 2. The decision

1. **Hostinger VPS is the sanctioned deployment topology**, consistent with
   D-50's single instance. Not EC2, and therefore no instance role.
2. **A dedicated IAM runtime user** holding **`kms:Decrypt` and nothing else**,
   on the specific CMK by ARN.
3. **A separate, temporary provisioning principal** holding
   **`kms:GenerateDataKey` and `kms:Decrypt`**, on that same CMK, **deactivated
   once the first deploy completes**.
4. **The CMK key policy must delegate to IAM.** Both policies must allow, or
   the call is denied.
5. **Credentials are mounted read-only** from `/etc/naigx/aws/credentials` —
   `root:root`, `0600`, **outside the repository and outside the Docker build
   context**.
6. **Only `backend` and `encrypt` receive them.** Never `postgres`, `edge`,
   `prometheus`, `alertmanager` or `backup`.
7. **No local-key fallback is introduced, and the application crypto design is
   unchanged.** This record decides how a credential reaches a container. It
   does not touch what that credential is used for.

## 3. Why two principals, and why the split is real rather than ceremonial

The two KMS operations happen at different times, and one of them happens **once
ever**. Verified in code rather than assumed:

| Principal | Operation | When | Why not more |
|---|---|---|---|
| **Runtime** (`backend`) | `kms:Decrypt` | Every process start, to unwrap the stored data key | `loadCipher` passes `createIfMissing: !isProduction`, which is **false** in production — the runtime **cannot** generate a key even if asked |
| **Provisioning** (`encrypt`) | `kms:GenerateDataKey` + `kms:Decrypt` | `encrypt init` once; `backfill`/`status` unwrap | `init` calls **only** `generateDataKey` and never unwraps; `backfill` and `status` need the reverse |

Those are the **only two KMS calls the adapter makes** — `GenerateDataKeyCommand`
and `DecryptCommand`. There is no `DescribeKey`, no `Encrypt`, and the policy
grants neither. `Resource` is the CMK ARN, never `*`.

⚠️ **`kms:GenerateDataKey` is the dangerous one and it is the one that expires.**
A principal that can mint data keys is a principal that can start a second ring,
and a second ring has no relationship to rows sealed under the first. It is
issued for one command and deactivated.

## 4. ⚠️ The limitation this record accepts, stated rather than glossed

[D-52](27-D-52-Managed-Key-Service.md) §4's crux is that the application-level
layer buys exactly one property: *"the unwrapping key is somewhere the
compromised host cannot read."* Host-resident credentials are the obvious place
to lose it, so:

| Threat | This design | EC2 instance role |
|---|---|---|
| **Storage-layer compromise** — stolen dump, backup, or disk snapshot | ✅ Yields nothing. Unwrapping needs a live KMS call; the credential is in neither the database nor the backup | ✅ Same |
| **Full host compromise** (root on the VPS) | ❌ The attacker can call `Decrypt` | ❌ The attacker mints credentials from IMDS and calls `Decrypt` |

**`DB §13.1`'s stated property is preserved** — it is a property about the
*storage layer*, and that is exactly the boundary the KMS call sits outside of.

**Against full host compromise this is worse than EC2 in degree, not in kind.**
Neither survives root on the box. The real difference is that a long-lived
access key can be **exfiltrated and reused off-host indefinitely**, where
instance-role credentials expire in hours. That is a genuine widening of blast
radius, it is accepted here, and it is the reason §6 exists.

⚠️ **This must never be described as equivalent to an instance role.**

## 5. What was rejected

**`env_file:` for the credentials.** Rejected in favour of a mounted file.
Environment variables are visible in `docker inspect` and in the container's
`/proc/<pid>/environ`; a read-only mount is one extra line and keeps the secret
out of both. `env_file:` is weaker, not wrong, and is not what this deploys.

**IAM Roles Anywhere.** Strictly stronger — X.509 attestation, short-lived
credentials, no long-lived secret at rest. Rejected **for v1.0 only**, because
it costs a private CA to operate, certificates to rotate, and a credential-helper
process on the host, and `TC-009` names single-operator burden as binding. See
§6 for the trigger that reverses this.

**AWS root credentials.** Never. Not a trade-off.

**Broadening to `kms:*` or `Resource: *` for convenience.** Rejected. The
adapter makes two calls; the policy grants two actions.

**Putting credentials on every service so the compose file is uniform.**
Rejected. `edge` terminates TLS and faces the internet; it has no reason to hold
a key-service credential.

## 6. Rotation — three different things, and conflating them destroys data

| Rotating | Procedure | Risk |
|---|---|---|
| **The AWS access key** (this record) | Create a second key → write the file → restart `backend` → verify a read decrypts → **then** delete the first | None. Overlapping validity means no downtime |
| **The CMK** | Enable **automatic** KMS key rotation. Old key material is retained, so old ciphertext still unwraps | None when automatic |
| **The data-key ring** | **Not part of rotation.** `encrypt init` refuses when a key exists and explains why | ⚠️ A second ring has **no relationship** to rows sealed under the first |

⚠️ **Creating a new CMK is not a rotation.** Neither is running `encrypt init`
again. Both read like the safe thing to do and both orphan every sealed row.

**Upgrade trigger to IAM Roles Anywhere:** the first of — a second operator
needing access, the first invited beta user (which is also
[D-50](25-D-50-Deployment-Topology.md) §4's staging trigger), or any requirement
for credentials that expire without human action.

## 7. Consequences

| Consequence | Handling |
|---|---|
| The stack can boot on the sanctioned host | The blocker in §1 is closed by configuration, not by weakening D-52 |
| A long-lived secret exists on the host | Accepted and recorded in §4. Rotation procedure in §6; upgrade trigger named |
| `DB §13.1` row 3 remains **implemented, NOT verified** | ⚠️ Unchanged by this record. Only the 4 skipped tests in `tests/integration/kms-live.test.ts` discharge it, and no key or credential exists yet |
| The provisioning principal outlives its purpose if forgotten | Deactivating it is a step in `deploy/README.md`'s first-deploy sequence, not a footnote |
| Losing the CMK still destroys the encrypted fields and every backup | [D-52](27-D-52-Managed-Key-Service.md) §6. Deletion protection on the CMK is required, and unaffected by anything here |
