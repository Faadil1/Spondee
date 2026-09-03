import { createApp } from "./app.js";
import { createStore } from "./store.js";

const port = Number(process.env.PORT ?? 8787);
const store = await createStore();
const app = createApp(store);
const server = app.listen(port, () => {
  console.log(`[spondee-backend] listening on :${port}`);
  console.log(`[spondee-backend] persistence=${process.env.DATABASE_URL ? "postgres" : "memory"}`);
  console.log("[spondee-backend] live BSC writes remain env-gated and disabled by default");
});

async function shutdown(signal: string) {
  console.log(`[spondee-backend] ${signal} received; shutting down`);
  server.close(async () => {
    await store.close();
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
