// Prisma CLI configuration for the TRACE STORE.
//
// The trace store is a separate PostgreSQL database (`DB §1.4`, `docs/12` D-2),
// so it carries its own schema, its own migration history, and its own
// connection string. Nothing here may point at `DATABASE_URL`.
//
// Usage: prisma <command> --config prisma.trace.config.ts
// The npm scripts in package.json wrap this; prefer those.

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/trace/schema.prisma",
  migrations: {
    path: "prisma/trace/migrations",
  },
  datasource: {
    url: process.env["TRACE_DATABASE_URL"],
  },
});
