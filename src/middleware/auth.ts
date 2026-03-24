import { Context, Next } from "hono";
import { ApiKeyData } from "../types/env";
import { formatError } from "../utils/response";

export const authMiddleware =
  (requiredScope: string) => async (c: Context, next: Next) => {
    const requestId = c.get("requestId") as string;
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json(
        formatError(
          "unauthorized",
          "Missing or invalid Authorization header",
          requestId,
        ),
        401,
      );
    }

    const apiKey = authHeader.split(" ")[1];

    if (!apiKey) {
      return c.json(
        formatError("unauthorized", "Invalid API key format", requestId),
        401,
      );
    }

    // Hash the API key to look it up in KV
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const env = c.env as any;
    const kv = env.KV as KVNamespace;

    if (!kv) {
      // If KV is not bound (e.g. testing without it properly mocked), we might need a fallback or fail
      console.error("KV namespace not bound");
      return c.json(
        formatError("internal_error", "Internal server error", requestId),
        500,
      );
    }

    const keyDataStr = await kv.get(`apikey:${hashHex}`);

    if (!keyDataStr) {
      return c.json(
        formatError("unauthorized", "Invalid API key", requestId),
        401,
      );
    }

    try {
      const keyData: ApiKeyData = JSON.parse(keyDataStr);

      if (keyData.status !== "active") {
        return c.json(
          formatError(
            "unauthorized",
            `API key is ${keyData.status}`,
            requestId,
          ),
          401,
        );
      }

      if (
        !keyData.scopes.includes(requiredScope) &&
        !keyData.scopes.includes("*")
      ) {
        return c.json(
          formatError("forbidden", "Insufficient scopes", requestId),
          403,
        );
      }

      // Set auth context
      c.set("auth", keyData);

      await next();
    } catch (err) {
      console.error(`Failed to parse API key data:`, err);
      return c.json(
        formatError("unauthorized", "Invalid API key data", requestId),
        401,
      );
    }
  };
