import "dotenv/config";
import cors from "cors";
import express from "express";
import { checkDatabase, pool } from "./db.js";
import { gtfsRouter } from "./routes/gtfs.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "aptransp-api",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/v1/gtfs", gtfsRouter);

app.get("/health/database", async (_req, res) => {
  try {
    const db = await checkDatabase();
    res.json({
      status: "ok",
      database: "connected",
      databaseName: db.database,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[health/database]", error);
    res.status(503).json({
      status: "error",
      database: "disconnected",
    });
  }
});

app.use((_req, res) => {
  res.status(404).json({ status: "error", message: "Not found" });
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`[aptransp-api] listening on :${port}`);
});

async function shutdown(signal: string) {
  console.log(`[aptransp-api] ${signal}: shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
