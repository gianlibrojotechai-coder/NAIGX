/**
 * Provider selection — the one place that decides which key service is used.
 *
 * ⚠️ THE SELECTION RULE IS THE SECURITY CONTROL, so it lives in exactly one
 * function rather than at each call site.
 *
 *   · KMS configured        → AWS KMS. Always, in every environment.
 *   · Not configured, dev   → the offline test double.
 *   · Not configured, prod  → **refuse**. `loadConfig` has already failed by
 *                             then; this is the second gate, because a single
 *                             gate on a rule this consequential is one edit
 *                             away from being removed.
 *
 * There is deliberately no "use a local key just this once" path.
 * [D-52](../../../docs/27-D-52-Managed-Key-Service.md) §4 is unusually blunt
 * about why: every free option stores the key on the machine that holds the
 * storage, so it buys none of the property the layer exists for while looking
 * exactly like compliance.
 */

import type { AppConfig } from "../config/env.js";
import {
  loadDataKeyRing,
  type DataKeyRing,
  type EncryptionKeyStore,
} from "./data-key.js";
import type { KeyProvider } from "./key-provider.js";
import { createAwsKmsProvider } from "./providers/aws-kms.js";
import { createTestKeyProvider } from "./providers/test-double.js";

export function resolveKeyProvider(
  config: AppConfig,
  env: NodeJS.ProcessEnv = process.env,
): KeyProvider {
  const { keyId, region } = config.kms;

  if (keyId !== undefined && region !== undefined) {
    return createAwsKmsProvider({ keyId, region });
  }

  if (env["NODE_ENV"]?.trim() === "production") {
    throw new Error(
      "No managed key service is configured and NODE_ENV=production. " +
        "DB §13.1 requires one for raw_content, structured_input and " +
        "structured_output. Set NAIGX_KMS_KEY_ID and NAIGX_KMS_REGION. " +
        "There is no local-key fallback by design (D-52 §4).",
    );
  }

  return createTestKeyProvider();
}

/**
 * The startup path: pick a provider, load the key ring, refuse if it cannot.
 *
 * `createIfMissing` is true only outside production, so a fresh developer
 * checkout works with no ceremony. In production the key is provisioned
 * deliberately by `npm run encrypt:init`, because a process that silently
 * creates its own key on first boot would create a *second* one the day
 * somebody points a new instance at an empty database — and rows sealed under
 * the first key would then be unreadable.
 */
export async function loadCipher(
  config: AppConfig,
  store: EncryptionKeyStore,
  env: NodeJS.ProcessEnv = process.env,
): Promise<DataKeyRing> {
  const provider = resolveKeyProvider(config, env);
  const isProduction = env["NODE_ENV"]?.trim() === "production";

  return loadDataKeyRing(store, provider, {
    createIfMissing: !isProduction,
  });
}

export { createPassThroughCipher, type FieldCipher } from "./data-key.js";
