/**
 * Integration — AWS KMS, against the real service
 * ([D-52](../../../docs/27-D-52-Managed-Key-Service.md)).
 *
 * ⚠️ **THIS IS THE ONLY THING THAT DISCHARGES "KMS IS UNVERIFIED".** Everything
 * else in Phase 3 — the envelope, the backfill, the search path, the refuse-to-
 * start behaviour — is proved against the offline double, which is a faithful
 * stand-in for the *interface* and no evidence at all about the *service*.
 * `src/crypto/providers/aws-kms.ts` has never made a real call; its shape
 * follows the documented API and it type-checks, and this project has been
 * bitten more than once by code that compiled, ran, and did nothing.
 *
 * ⚠️ A SKIP IS "NOT CHECKED", NEVER "PASSED". While this file skips,
 * `DB §13.1` row 3 is **implemented but unverified** and must be reported that
 * way. `M-18` H-2 does not close on a skip.
 *
 * ## Running it
 *
 * It is opt-in twice over — the flag *and* the credentials — because it is the
 * one test in this suite that talks to a paid external service:
 *
 *     NAIGX_KMS_LIVE_TEST=1 \
 *     NAIGX_KMS_KEY_ID=alias/naigx \
 *     NAIGX_KMS_REGION=<region> \
 *     npm test
 *
 * Credentials come from the ambient AWS provider chain (`SA §10.4` — injected
 * at runtime, never in source or images).
 *
 * ## What it costs
 *
 * Three KMS requests per run: two `GenerateDataKey` and one `Decrypt`. D-52 §3
 * recorded 20,000 free requests a month on 2026-09-08 — ⚠️ verify current
 * pricing before provisioning the key; that figure is a decision-record
 * estimate on its date, not a standing guarantee. Running this test does not
 * create or delete a key, so it cannot change the monthly key charge.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { createAwsKmsProvider } from "../../src/crypto/providers/aws-kms.js";
import { DATA_KEY_BYTES, open, seal } from "../../src/crypto/envelope.js";
import { KeyProviderRejectedError } from "../../src/crypto/key-provider.js";

const keyId = process.env["NAIGX_KMS_KEY_ID"];
const region = process.env["NAIGX_KMS_REGION"];
const enabled =
  process.env["NAIGX_KMS_LIVE_TEST"] === "1" &&
  keyId !== undefined &&
  keyId !== "" &&
  region !== undefined &&
  region !== "";

const skip = enabled
  ? false
  : "set NAIGX_KMS_LIVE_TEST=1 with NAIGX_KMS_KEY_ID and NAIGX_KMS_REGION to run";

const provider = () =>
  createAwsKmsProvider({ keyId: keyId as string, region: region as string });

test(
  "KMS issues a 256-bit data key, wrapped and in the clear",
  { skip },
  async () => {
    const { plaintext, wrapped } = await provider().generateDataKey();

    assert.equal(
      plaintext.length,
      DATA_KEY_BYTES,
      "KMS returned a key of the wrong size for AES-256",
    );

    // ⚠️ THE WRAPPED HALF MUST NOT BE THE PLAINTEXT HALF. This is a two-character
    // mistake in the adapter with no visible symptom — everything would still
    // round-trip, and the data key would be sitting in the database in the clear.
    // The migration's `octet_length > 32` CHECK guards the same mistake at the
    // other end.
    assert.ok(
      wrapped.length > DATA_KEY_BYTES,
      "the wrapped key is no longer than a raw AES-256 key — it may be plaintext",
    );
    assert.notDeepEqual(Buffer.from(wrapped), Buffer.from(plaintext));
  },
);

test("a wrapped key unwraps back to the same bytes", { skip }, async () => {
  const p = provider();
  const { plaintext, wrapped } = await p.generateDataKey();
  const unwrapped = await p.unwrap(wrapped);

  assert.deepEqual(Buffer.from(unwrapped), Buffer.from(plaintext));
});

test(
  "a full envelope round trip works under a real KMS key",
  { skip },
  async () => {
    // The property the whole layer exists for, end to end: content sealed with a
    // KMS-issued key, and opened again after the key came back from KMS — which
    // is exactly what a process restart does.
    const p = provider();
    const { plaintext: dataKey, wrapped } = await p.generateDataKey();

    const content =
      "A job description containing confidential business detail.";
    const sealed = seal(content, dataKey, 1);

    assert.ok(!sealed.includes("confidential"));

    const afterRestart = await p.unwrap(wrapped);
    assert.equal(open(sealed, afterRestart), content);
  },
);

test(
  "a corrupt wrapped key is rejected, not silently accepted",
  { skip },
  async () => {
    const p = provider();
    const { wrapped } = await p.generateDataKey();

    const tampered = Buffer.from(wrapped);
    tampered[tampered.length - 1] =
      (tampered[tampered.length - 1] as number) ^ 0xff;

    // Distinguishing "rejected" from "unavailable" matters operationally:
    // rejected means the deployment is pointed at the wrong key, and ⚠️ a key
    // that is genuinely gone means this data and every backup of it are
    // unrecoverable (D-52 §6). The two must not read the same in a log.
    await assert.rejects(
      () => p.unwrap(tampered),
      (error: Error) =>
        error instanceof KeyProviderRejectedError ||
        error.name === "KeyProviderRejectedError",
    );
  },
);
