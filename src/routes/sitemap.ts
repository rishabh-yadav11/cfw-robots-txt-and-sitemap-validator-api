import { Hono } from "hono";
import { Env } from "../types/env";
import { z } from "zod";
import { formatSuccess, formatError } from "../utils/response";
import { safeFetch, SafeFetchError } from "../utils/safeFetch";
import { authMiddleware } from "../middleware/auth";
import { parseSitemap } from "../utils/sitemapParser";

const sitemapRoutes = new Hono<Env>();

const querySchema = z.object({
  url: z.string().url(),
});

sitemapRoutes.get("/validate", authMiddleware("crawl:read"), async (c) => {
  const reqId = c.get("requestId");
  const query = c.req.query();

  const parseResult = querySchema.safeParse(query);
  if (!parseResult.success) {
    return c.json(
      formatError("validation_error", "Invalid URL parameter", reqId),
      400,
    );
  }

  const sitemapUrl = parseResult.data.url;

  // Check cache
  const env = c.env as any;
  const cacheKey = `sitemap:${sitemapUrl}`;
  if (env.KV) {
    const cached = await env.KV.get(cacheKey);
    if (cached) {
      return c.json(
        formatSuccess(JSON.parse(cached), { source: "cache" }, reqId),
      );
    }
  }

  try {
    // 5MB limit
    const { text, status } = await safeFetch(sitemapUrl, {
      maxSizeBytes: 5 * 1024 * 1024,
    });

    if (status !== 200) {
      return c.json(
        formatError(
          "fetch_failed",
          `Failed to fetch sitemap, status: ${status}`,
          reqId,
        ),
        404,
      );
    }

    // Attempt to parse XML
    const { urls, sitemaps, error } = parseSitemap(text);

    if (error || (urls.length === 0 && sitemaps.length === 0)) {
      // Requirements say "xml_error: broken sitemap XML returns 422"
      return c.json(
        formatError("xml_error", error || "No URLs or Sitemaps found", reqId),
        422,
      );
    }

    const result = {
      url: sitemapUrl,
      isIndex: sitemaps.length > 0,
      urlCount: urls.length,
      sitemapCount: sitemaps.length,
      urls: urls.slice(0, 50), // Return sample of up to 50 URLs
      sitemaps: sitemaps.slice(0, 50),
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

export default sitemapRoutes;
