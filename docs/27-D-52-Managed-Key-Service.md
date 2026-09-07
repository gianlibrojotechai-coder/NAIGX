# D-52 — A managed key service, because every free option puts the key on the host

**Date:** 2026-09-08
**Status:** Accepted
**Sprint:** 5 (Persistence, identity, instrumentation)
**Resolves:** the key-custody question `DB §13.1` leaves open
**Affects:** `DB §13.1`, `SA §10.4`, `NFR-023`, `NFR-081`, `M-18` H-2, `M-19`
**Required by** [D-53](28-D-53-Encryption-Layers.md). Depends on [D-51](26-D-51-Self-Hosted-PostgreSQL.md).

---

## 1. The requirement, quoted exactly

`DB §13.1`, keys row:

> **Managed key service; never in application configuration**

`SA §10.4` adds: "Secrets injected at runtime from a managed store; never in
source, images, or configuration files", and "rotation possible without code
change".

## 2. The decision

1. **AWS KMS**, one customer-managed key, used for **envelope encryption**.
2. **A cached data key**, not a KMS call per row. The data key is generated
   once, stored wrapped, unwrapped at process start, and held in memory.
3. **The wrapped data key is stored in the database; the key that unwraps it
   never touches the host.** That asymmetry is the entire point of this record.
4. **Credentials for KMS are runtime configuration, never committed**, and are
   never logged (`NFR-081`).

## 3. Verified cost

Checked against the provider's official pricing page on **2026-09-08**:

| Item | Price | Source |
|---|---|---|
| Customer-managed key | **$1.00 / month**, prorated hourly | [aws.amazon.com/kms/pricing](https://aws.amazon.com/kms/pricing/) |
| Free requests | **20,000 / month** across all regions | same |
| Symmetric requests beyond free tier | $0.03 / 10,000 | same |
| Key rotation | 1st and 2nd rotation add $1/month each, **capped at the second** | same |

**Expected monthly cost: $1.00.** The cached-data-key design in §2 makes one
KMS call per process start, so request volume is on the order of tens per
month against a 20,000 free allowance — the request line is effectively zero,
and it stays zero as analysis volume grows.

⚠️ **Google Cloud KMS was not committed to because its pricing could not be
verified from the official source.** `cloud.google.com/kms/pricing` renders its
table in JavaScript and returns truncated content to a fetch. Third-party
figures near $0.59/month for a SOFTWARE-protection key version exist and are
**not quoted here as verified**. If saving ~$5/year matters later, read the
official page in a browser first; the code in §5 is provider-shaped so the
swap is one adapter.

## 4. The free alternatives, and why each fails

The user constraint is to show the free option before taking the paid one.
There are three, and **they share one flaw**:

| Free option | Cost | Why it fails |
|---|---|---|
| Key in `.env` | $0 | `DB §13.1` names this as the thing not to do, in the same sentence that requires the key service |
| `age` / `sops` with a key file on disk | $0 | Same defect, one file further away |
| Self-hosted OpenBao / HashiCorp Vault | $0 licence | See below |

**OpenBao deserves the longer answer**, because it is the one that looks
compliant. It is a genuine key service and it is free. It fails here for two
reasons:

1. **The unseal key recreates the problem one layer up.** A sealed Vault must
   be unsealed on every restart. Unattended restart means the unseal material
   sits on the host — which is where the encryption key would have been
   anyway. Auto-unseal solves this by delegating to a cloud KMS, at which
   point the cloud KMS is the dependency and Vault is an extra component.
2. **On a single host it defends nothing.** [D-50](25-D-50-Deployment-Topology.md)
   puts one machine in production. Vault running beside the application means
   an attacker with the host has the application, the database, and the vault.

**This is the crux of the whole record.** The application-level layer exists
for exactly one property, stated in `DB §13.1`: *"so that a storage-layer
compromise does not yield plaintext business content"*. **Every free option
stores the key on the machine that holds the storage**, so every free option
buys none of that property while appearing to. The $1/month is not buying
encryption — encryption is free, in `node:crypto`. It is buying the fact that
the unwrapping key is somewhere the compromised host cannot read.

That is also why this must not be "temporarily" implemented with a local key:
a local key is not a cheaper version of this decision, it is the absence of it.

## 5. Design

```
CMK (AWS KMS, never leaves the service)
  └─ wraps → DEK (AES-256)
               └─ encrypts → raw_content, structured_input, structured_output
```

| Property | Choice | Reason |
|---|---|---|
| Cipher | AES-256-GCM, from `node:crypto` | Authenticated; a tampered ciphertext fails rather than decrypting to garbage |
| IV | Random, per value, stored with the ciphertext | Reusing an IV under one key breaks GCM catastrophically |
| Envelope format | Versioned prefix carrying the DEK version | Rotation must not require rewriting existing rows |
| DEK lifetime | Cached in process; re-read on restart | Keeps KMS requests inside the free allowance |
| Provider surface | One narrow interface (`wrap` / `unwrap`) | Swapping to GCP or Azure is one adapter, not a migration |
| Failure to reach KMS at startup | **Refuse to start** | An instance that cannot decrypt must not serve reads that silently return ciphertext |

## 6. Consequences

⚠️ **Losing the CMK destroys the data**, including every backup
([D-51](26-D-51-Self-Hosted-PostgreSQL.md) §4). Backups hold ciphertext for
these three fields, so key loss and backup deletion have identical outcomes.
The key's existence is therefore part of the backup story and must appear in
the runbook — with deletion protection enabled on the key, and the AWS account's
own recovery treated as a dependency.

| Consequence | Handling |
|---|---|
| A new external dependency (an AWS account) | Accepted; it is the smallest surface that satisfies `DB §13.1` |
| KMS unreachable → the service will not start | Deliberate, per §5 |
| A recurring cost, however small | $1/month, verified, disclosed here |
| Rotation | Supported by the versioned envelope; no code change (`SA §10.4`) |
| Encrypted fields are no longer searchable in SQL | Real. `FR-062` search already matches submitted text only — see D-53 §4 |
