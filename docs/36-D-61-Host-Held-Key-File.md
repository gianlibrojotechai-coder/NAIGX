# D-61 — A host-held key file replaces the managed key service at v1.0

**Date:** 2026-09-08
**Status:** Accepted
**Sprint:** 5 (Persistence, identity, instrumentation)
**Resolves:** the AWS dependency blocking `M-19`, and the cost it carried
**Affects:** `DB §13.1`, `M-18` H-2, `M-19`, `AC-026`, `docker-compose.prod.yml`, `deploy/README.md`
**Supersedes** the *key-service selection* in [D-52](27-D-52-Managed-Key-Service.md) and **retires** [D-59](34-D-59-AWS-Credential-Injection-On-A-Non-EC2-Host.md) in full. **Leaves [D-53](28-D-53-Encryption-Layers.md) and [D-55](30-D-55-Envelope-Format-And-Purge-Outbox.md) intact** — only the origin of the root key changes.

---

## 1. The question

`M-19` stalled on an AWS account: a KMS key to create, IAM principals to scope,
a credential file to place, $1/month to pay, and a console to navigate. The
owner asked the question that had not been asked: **what actually requires
this?**

The answer turned out to be short.

## 2. What the requirements actually say

| `DB §13.1` row | Cited requirement |
|---|---|
| In transit | `NFR-020` |
| At rest — full-volume | **`NFR-021`** |
| **Application-level** — `raw_content`, `structured_input`, `structured_output` | ⚠️ **none** |
| **Keys — managed key service** | ⚠️ **none** |

**`NFR-021` in full: *"Stored analysis content encrypted at rest."*** That is
the entire requirement, and `DB §13.1` maps it to **full-volume encryption** —
a host setting, unrelated to KMS.

**No requirement number and no acceptance criterion mandates a managed key
service.** The mandate came from [D-52](27-D-52-Managed-Key-Service.md), a
hardening decision implementing a design-document row that carries neither.

The one acceptance criterion in play is **`AC-026`** — *"security review
completed with no unresolved high-severity findings"*. H-2 is such a finding,
in a review `STATUS.md` records as **AI-authored and explicitly not
independent**. The blocker was real, and it was self-imposed.

## 3. ⚠️ Why the security argument changed — and it is D-59's doing

[D-52](27-D-52-Managed-Key-Service.md) §4 rejected host-held keys in one
sentence worth keeping: *"every free option stores the key on the machine that
holds the storage, so it buys none of the property the layer exists for."*

**That was true when written. [D-59](34-D-59-AWS-Credential-Injection-On-A-Non-EC2-Host.md)
made it untrue** by placing long-lived AWS credentials at
`/etc/naigx/aws/credentials` on the same host — because the sanctioned host is
not EC2 and has no instance role. Measured against the property `DB §13.1`
actually names:

| Attacker obtains | KMS + host credentials (D-59) | Host-held key file |
|---|---|---|
| **Database dump / stolen backup** | ✅ ciphertext only | ✅ ciphertext only — the key is not in the dump |
| **Disk snapshot** | ❌ credentials are on that disk | ❌ key is on that disk |
| **Full host compromise (root)** | ❌ uses the credentials | ❌ reads the key |
| **Central revocation** | ✅ disable the key remotely | ❌ replace the key and re-encrypt |
| **Decrypt audit trail** | ✅ CloudTrail | ❌ none |

**On the three rows `DB §13.1` names, the two are equivalent.** They diverge on
revocation and audit — and those are what §4 records as lost.

⚠️ **This is not a claim that KMS is worthless.** It is a claim that *on this
topology*, once D-59 put credentials on the host, KMS stopped buying the
confidentiality property and continued to buy operational ones. D-52's argument
was sound; the deployment it assumed is not the deployment that exists.

## 4. ⚠️ The decision, and what it costs

**The root key is a file on the host.** `NAIGX_KEY_FILE` names its path;
`providers/key-file.ts` wraps and unwraps data keys with AES-256-GCM under it.

**`DB §13.1`'s "managed key service" row is an EXPLICIT v1.0 DEVIATION.** It is
not met, it is not reinterpreted as met, and `STATUS.md` records it among the
non-claims. Anyone reading this project should be able to see that in one place
without inferring it.

**What is genuinely lost, stated so it cannot be softened later:**

1. **No central revocation.** A compromise cannot be answered by disabling a key
   from elsewhere. The only remedy is replacing the root key and re-encrypting,
   which requires access to the host that was compromised.
2. **No decrypt audit.** Nothing records that an unwrap occurred. There is no
   equivalent of CloudTrail and no way to reconstruct access after the fact.
3. **A full host compromise reaches the key.** True of D-59's arrangement too
   (§3), but it must not be omitted on that account.

**What is kept:** the envelope format, the sealed columns, the multi-version key
ring, the backfill, `FR-062` decrypt-and-filter search, and the purge outbox.
None of them knew where the root key came from, and none of them changed.

## 5. Design

| Element | Decision |
|---|---|
| Key material | 32 bytes, base64 or hex, in a file outside the repo and the build context |
| Wrapping | AES-256-GCM, `iv \|\| tag \|\| ciphertext` — the same layout discipline as `envelope.ts` |
| Data keys | **Generated randomly per ring, not derived from the root key.** Derivation would make every data key recoverable from the root key alone and quietly remove the point of storing a wrapped key |
| Ownership | **uid 1000**, the account the container runs as. ⚠️ Root-owned `0600` would be unreadable by a non-root container and fail closed forever |
| Permissions | **No group or other bits.** Enforced in code on **every load**, not once at startup — a file can be `chmod`'d after boot |
| Platform | The permission check is **POSIX-only**. Windows reports `0444` for a file just created `chmod 0400`; enforcing there would refuse every developer key file while proving nothing. Production is Linux in a container |
| Failure mode | **Fail closed**, always — missing, mis-permissioned, wrong length, foreign wrapped key, tampered wrapped key |
| Test double | Unchanged, and still refuses to construct under `NODE_ENV=production` |

## 6. What was rejected

**Keeping AWS KMS.** Rejected for v1.0. It costs an account, IAM scoping, D-59's
credential plumbing, $1/month and a deploy blocker, to buy revocation and audit
that a single-operator deployment with no compliance obligation does not
currently need. ⚠️ Its **portfolio** value is real and is not a security
argument.

**Removing application-level encryption entirely.** Rejected outright. The
envelope is what makes a stolen dump useless, and that property survives this
change intact.

**A key in `deploy/.env`.** Rejected. Configuration is read, logged and echoed
in ways a file is not; `DB §13.1`'s "never in application configuration" clause
is the one part of that row this record still honours exactly.

**Self-hosted Vault / OpenBao.** Rejected for the reason D-52 §4 already gave:
the unseal material ends up on the same host, one layer further down.

## 7. Consequences

| Consequence | Handling |
|---|---|
| `M-19` no longer needs an AWS account | The prerequisite disappears; deployment proceeds |
| `M-18` H-2 changes shape | From *"implemented, unverified"* to *"resolved with a recorded deviation"*. ⚠️ M-18 remains **not passed** on its own terms and this record does not close it |
| The 4 KMS-live tests | **Deleted**, not skipped. A permanent skip would misrepresent the suite as having coverage it cannot obtain |
| `@aws-sdk/client-kms` | Removed from dependencies |
| `NFR-021` | **Unaffected.** Full-volume encryption remains a separate, still-unmet requirement needing a host setting |
| Backup coupling | ⚠️ The key must be backed up **separately from the dumps**. One archive holding both protects neither |
| Revisit trigger | A second operator, a compliance obligation, handling third-party data, or any requirement for audited or revocable key access |
