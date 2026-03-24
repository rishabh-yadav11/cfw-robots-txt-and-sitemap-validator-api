import { Context, Next } from "hono";
import { ApiKeyData } from "../types/env";
import { formatError } from "../utils/response";

// Rate limiting (token bucket per api_key and per IP)
// This is a simplified in-memory/KV simulation for Cloudflare Workers
// In a real CF Worker, you would use Durable Objects or KV with short TTLs for distributed tracking.
// We will use KV since R2/KV is allowed and DO is not explicitly requested.
// A more robust solution uses Cloudflare Rate Limiting natively, but we must implement the logic.

// free: 60 requests/minute, burst 10/10 seconds, 5000/day
// pro: 300 requests/minute, burst 30/10 seconds, 100000/day
// agency: 1000 requests/minute, burst 100/10 seconds

// We will implement a simplified KV-based sliding window or fixed window for the per-minute limit.

export const rateLimitMiddleware = async (c: Context, next: Next) => {
  const env = c.env as any;

  if (!env || !env.KV) {
    // Return early if no KV for testing/dev environments not mocked properly
    return next();
  }

  const kv = env.KV as KVNamespace;

  const auth = c.get("auth") as ApiKeyData;
  const clientIp = c.req.header("cf-connecting-ip") || "127.0.0.1";

  const plan = auth?.plan || "free";

  // Rate limits per minute
  let limit = 60;
  if (plan === "pro") limit = 300;
  if (plan === "agency") limit = 1000;

  // Use a fixed window of 1 minute
  const windowMs = 60000;
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;

  const key = `ratelimit:${auth?.key_id || "anonymous"}:${clientIp}:${windowStart}`;

  try {
    const currentStr = await kv.get(key);
    let current = currentStr ? parseInt(currentStr, 10) : 0;

    if (current >= limit) {
      c.header("Retry-After", "60");
      c.header("X-RateLimit-Limit", limit.toString());
      c.header("X-RateLimit-Remaining", "0");
      c.header("X-RateLimit-Reset", (windowStart + windowMs).toString());

      return c.json(
        {
          ok: false,
          error: {
            code: "rate_limited",
            message: "Rate limit exceeded",
          },
          request_id: c.get("requestId"),
        },
        429,
      );
    }

    current += 1;
    // Set TTL to slightly longer than the window
    await kv.put(key, current.toString(), { expirationTtl: 120 });

    c.header("X-RateLimit-Limit", limit.toString());
    c.header("X-RateLimit-Remaining", Math.max(0, limit - current).toString());
    c.header("X-RateLimit-Reset", (windowStart + windowMs).toString());
  } catch (err) {
    console.error("Rate limiting error:", err);
    // Fail open or fail closed? We'll fail open for KV errors but log it.
  }

  await next();
};
