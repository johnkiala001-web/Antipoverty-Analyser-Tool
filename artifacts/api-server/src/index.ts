import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    return await new Promise<void>((resolve) => {
      res.on("close", resolve);
      res.on("finish", resolve);
      app(req, res);
    });
  } catch (err) {
    console.error("[handler] uncaught:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          error: "internal_error",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    } else {
      res.end();
    }
  }
}
