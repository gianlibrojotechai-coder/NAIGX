/**
 * Provider selection — the one place that decides where the root key comes from.
 *
 * ⚠️ THE SELECTION RULE IS THE SECURITY CONTROL, so it lives in exactly one
 * function rather than at each call site.
 *
 *   · Key file configured   → the host-held key file. Every environment.
 *   · Not configured, dev   → the offline test double.
 *   · Not configured, prod  → **refuse**. `loadConfig` has already failed by
 *                             then; this is the second gate, because a single
 *                             gate on a rule this consequential is one edit
 *                             away from being removed.
 *
 * [D-61](../../../docs/36-D-61-Host-Held-Key-File.md) replaced the managed key
 * service [D-52](../../../docs/27-D-52-Managed-Key-Service.md) had selected.
 * The envelope architecture is untouched — only the origin of the root key
 * changed. D-52's §4 argument against host-held keys is preserved there and
 * answered in D-61 §3: once [D-59](34-D-59-AWS-Credential-Injection-On-A-Non-EC2-Host.md)
 * put long-lived AWS credentials on the same host, KMS and a key file became
 * equivalent against the threats `DB §13.1` actually names, and differ only on
 * revocation and audit — which D-61 §4 records as a real, accepted loss.
 *
 * ⚠️ There is still no "just this once" path, and the test double still refuses
 * to run in production.
 */

import type { AppConfig } from "../config/env.js";
import {
  loadDataKeyRing,
  type DataKeyRing,
  type EncryptionKeyStore,
} from "./data-key.js";
import type { KeyProvider } from "./key-provider.js";
import { createKeyFileProvider } from "./providers/key-file.js";
import { createTestKeyProvider } from "./providers/test-double.js";

export function resolveKeyProvider(
  config: AppConfig,
  env: NodeJS.ProcessEnv = process.env,
): KeyProvider {
  const { keyFile } = config;

  if (keyFile !== undefined) {
    return createKeyFileProvider({ path: keyFile });
  }

  if (env["NODE_ENV"]?.trim() === "production") {
    throw new Error(
      "No key file is configured and NODE_ENV=production. DB §13.1 requires " +
        "application-level encryption for raw_content, structured_input and " +
        "structured_output. Set NAIGX_KEY_FILE to a file containing 32 random " +
        "bytes, readable only by the account this process runs as. The " +
        "in-memory test double is never used in production (D-61 §5).",
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
