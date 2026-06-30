import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — process continues");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection — process continues");
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

const DB_KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000;

setInterval(async () => {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
  } catch (err) {
    logger.warn({ err }, "DB keepalive ping failed — will retry next interval");
  }
}, DB_KEEPALIVE_INTERVAL_MS);
