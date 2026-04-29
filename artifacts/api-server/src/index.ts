import type { IncomingMessage, ServerResponse } from "node:http";

type ExpressLike = (req: IncomingMessage, res: ServerResponse) => void;

let cachedApp: ExpressLike | undefined;
let cachedInitError: unknown;

async function getApp(): Promise<ExpressLike> {
  if (cachedApp) return cachedApp;
  if (cachedInitError) throw cachedInitError;
  try {
    const mod = await import("./app");
    cachedApp = mod.default as unknown as ExpressLike;
    return cachedApp;
  } catch (err) {
    cachedInitError = err;
    throw err;
  }
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const app = await getApp();
    return await new Promise<void>((resolve) => {
      res.on("close", resolve);
      res.on("finish", resolve);
      app(req, res);
    });
  } catch (err) {
    const e = err as { message?: string; stack?: string; code?: string };
    console.error("[handler] uncaught:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          error: "internal_error",
          message: e?.message ?? String(err),
          code: e?.code,
          stack: e?.stack,
        }),
      );
    } else {
      res.end();
    }
  }
}
