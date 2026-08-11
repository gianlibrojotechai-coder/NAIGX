/**
 * Composition root.
 *
 * The only module that wires concrete dependencies together and owns the
 * process lifecycle: load configuration, construct the database, build the
 * application, listen, and shut down in the correct order.
 */

import "dotenv/config";

import { buildApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { createDatabase } from "./db/client.js";

const HOST = "0.0.0.0";

const main = async (): Promise<void> => {
  const config = loadConfig();
  const database = createDatabase(config);
  const app = await buildApp({ config, database });

  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    app.log.info({ signal }, "Shutting down");

    try {
      // Stop accepting requests before releasing the resources they depend on.
      await app.close();
      await database.disconnect();
      process.exit(0);
    } catch (error) {
      app.log.error(error, "Error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await app.listen({
    port: config.port,
    host: HOST,
  });

  app.log.info(`🚀 Backend running on http://localhost:${config.port}`);
};

main().catch((error: unknown) => {
  // Configuration and startup failures occur before a logger exists.
  console.error("Failed to start backend:", error);
  process.exit(1);
});
