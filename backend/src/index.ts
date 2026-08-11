import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

const app = Fastify({
  logger: true,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

app.get("/health", async (_request, reply) => {
  try {
    await prisma.healthCheck.findFirst();

    return {
      status: "ok",
      app: "NAIGX",
      version: "0.1.0",
      database: "connected",
    };
  } catch (error) {
    app.log.error(error);

    return reply.status(503).send({
      status: "error",
      app: "NAIGX",
      version: "0.1.0",
      database: "disconnected",
    });
  }
});

const start = async () => {
  try {
    await app.register(cors, {
      origin: "http://localhost:5173",
    });

    await app.listen({
      port: 3000,
      host: "0.0.0.0",
    });

    console.log("🚀 Backend running on http://localhost:3000");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

const shutdown = async () => {
  await prisma.$disconnect();
  await pool.end();
  await app.close();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start();