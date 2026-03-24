import { Hono } from "hono";
import { Env } from "../types/env";
import { z } from "zod";
import { formatSuccess, formatError } from "../utils/response";
import { safeFetch, SafeFetchError } from "../utils/safeFetch";
import { authMiddleware } from "../middleware/auth";
import { parseRobotsTxt } from "../utils/robotsParser";

const robotsRoutes = new Hono<Env>();

const querySchema = z.object({
  url: z.string().url(),
});

robotsRoutes.get("/validate", authMiddleware("crawl:read"), async (c) => {
  const reqId = c.get("requestId");
  const query = c.req.query();

  const parseResult = querySchema.safeParse(query);
  if (!parseResult.success) {
    return c.json(
      formatError("validation_error", "Invalid URL parameter", reqId),
      400,
    );
  }

  const targetUrl = new URL(parseResult.data.url);
  // Normalize to robots.txt URL
  const robotsUrl = `${targetUrl.protocol}//${targetUrl.host}/robots.txt`;

  // Check cache
  const env = c.env as any;
  const cacheKey = `robots:${robotsUrl}`;
  if (env.KV) {
    const cached = await env.KV.get(cacheKey);
    if (cached) {
      return c.json(
        formatSuccess(JSON.parse(cached), { source: "cache" }, reqId),
      );
    }
  }

  try {
    const fetchOptions = { maxSizeBytes: 512 * 1024 }; // 512KB limit
    const { text, status } = await safeFetch(robotsUrl, fetchOptions);

    if (status !== 200) {
      return c.json(
        formatError(
          "fetch_failed",
          `Failed to fetch robots.txt, status: ${status}`,
          reqId,
        ),
        404,
      );
    }

    const directives = parseRobotsTxt(text);

    const result = {
      url: robotsUrl,
      exists: true,
      directives: directives,
      status: "ok",
    };

    if (env.KV) {
      await env.KV.put(cacheKey, JSON.stringify(result), {
        expirationTtl: 6 * 60 * 60,
      }); // 6h TTL
    }

    return c.json(formatSuccess(result, { source: "fetch" }, reqId));
  } catch (err: any) {
    if (err instanceof SafeFetchError) {
      return c.json(formatError(err.code, err.message, reqId), 400);
    }
    return c.json(
      formatError("internal_error", "An unexpected error occurred", reqId),
      500,
    );
  }
});

export default robotsRoutes;
