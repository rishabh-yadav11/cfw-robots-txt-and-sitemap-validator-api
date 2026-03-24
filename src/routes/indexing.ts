import { Hono } from "hono";
import { Env } from "../types/env";
import { z } from "zod";
import { formatSuccess, formatError } from "../utils/response";
import { safeFetch, SafeFetchError } from "../utils/safeFetch";
import { authMiddleware } from "../middleware/auth";
import { parseRobotsTxt, isUrlAllowed } from "../utils/robotsParser";
import { parseSitemap } from "../utils/sitemapParser";

const indexingRoutes = new Hono<Env>();

const querySchema = z.object({
  url: z.string().url(), // URL to the sitemap
});

indexingRoutes.get("/check", authMiddleware("crawl:read"), async (c) => {
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
  const targetUrl = new URL(sitemapUrl);
  const robotsUrl = `${targetUrl.protocol}//${targetUrl.host}/robots.txt`;

  try {
    // 1. Fetch robots.txt
    const robotsRes = await safeFetch(robotsUrl, { maxSizeBytes: 512 * 1024 });
    const directives = parseRobotsTxt(robotsRes.text);

    // 2. Fetch sitemap.xml
    const sitemapRes = await safeFetch(sitemapUrl, {
      maxSizeBytes: 5 * 1024 * 1024,
    });
    const { urls, sitemaps, error } = parseSitemap(sitemapRes.text);

    if (error || (urls.length === 0 && sitemaps.length === 0)) {
      return c.json(
        formatError("xml_error", error || "No URLs found in sitemap", reqId),
        422,
      );
    }

    // 3. Check for conflicts
    const conflicts: string[] = [];

    // Check URLs in the sitemap against robots.txt
    for (const urlEntry of urls) {
      try {
        const parsedSitemapUrl = new URL(urlEntry.loc);
        if (parsedSitemapUrl.host !== targetUrl.host) continue; // Skip cross-domain for now

        const path = parsedSitemapUrl.pathname + parsedSitemapUrl.search;
        if (!isUrlAllowed(path, directives)) {
          conflicts.push(urlEntry.loc);
        }
      } catch (e) {
        // Ignore invalid URLs in sitemap
      }
    }

    const result = {
      sitemapUrl,
      robotsUrl,
      totalUrlsChecked: urls.length,
      conflictsCount: conflicts.length,
      conflicts: conflicts.slice(0, 50), // Return max 50 conflicts
      status: conflicts.length > 0 ? "warning" : "ok",
      message:
        conflicts.length > 0
          ? "Found URLs in sitemap that are disallowed by robots.txt"
          : "No indexing conflicts found",
    };

    return c.json(formatSuccess(result, {}, reqId));
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

export default indexingRoutes;
