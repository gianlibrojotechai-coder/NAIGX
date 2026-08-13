/**
 * Trace store client construction.
 *
 * A second, independent database (`DB §1.4`, `docs/12` D-2) with its own
 * generated Prisma client, its own pool, and its own connection string. It
 * deliberately mirrors `db/client.ts`: a factory rather than a module-level
 * singleton, so importing this module has no side effects and opens no
 * connections.
 *
 * The two clients are never merged behind one interface. Their separation is
 * the point — `DB §5.4` requires that analysis deletion commit in the primary
 * store without waiting on the trace store, which is only expressible if the
 * caller can see that these are two stores.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "../generated/prisma-trace/client.js";
import type { AppConfig } from "../config/env.js";

const { Pool } = pg;

export interface TraceDatabase {
  readonly prisma: PrismaClient;
  /** Releases the Prisma client and the underlying connection pool. */
  readonly disconnect: () => Promise<void>;
}

export function createTraceDatabase(config: AppConfig): TraceDatabase {
  const pool = new Pool({
    connectionString: config.traceDatabaseUrl,
  });

  const adapter = new PrismaPg(pool);

  const prisma = new PrismaClient({
    adapter,
  });

  const disconnect = async (): Promise<void> => {
    await prisma.$disconnect();
    await pool.end();
  };

  return { prisma, disconnect };
}
