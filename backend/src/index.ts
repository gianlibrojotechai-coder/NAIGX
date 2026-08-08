import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({
  logger: true,
});

app.get("/health", async () => {
  return {
    status: "ok",
    app: "NAIGX",
    version: "0.1.0",
  };
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

start();