/**
 * Database client construction.
 *
 * Exposes a factory rather than a module-level singleton, so that importing
 * this module has no side effects and opens no connections. The composition
 * root decides when a pool is created and when it is released.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.js";
import type { AppConfig } from "../config/env.js";

const { Pool } = pg;

export interface Database {
  readonly prisma: PrismaClient;
  /** Releases the Prisma client and the underlying connection pool. */
  readonly disconnect: () => Promise<void>;
}

export function createDatabase(config: AppConfig): Database {
  const pool = new Pool({
    connectionString: config.databaseUrl,
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
