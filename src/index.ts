import { Hono } from "hono";
import {
  generateRequestId,
  formatSuccess,
  errorHandler,
} from "./utils/response";
import { authMiddleware } from "./middleware/auth";
import { httpsOnlyMiddleware } from "./middleware/https";
import { rateLimitMiddleware } from "./middleware/rateLimit";

import robotsRoutes from "./routes/robots";
import sitemapRoutes from "./routes/sitemap";
import indexingRoutes from "./routes/indexing";

import { Env } from "./types/env";

const app = new Hono<Env>();

// Global middleware
app.use("*", async (c, next) => {
  const requestId = generateRequestId();
  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);
  await next();
});

// Enforce HTTPS
app.use("*", httpsOnlyMiddleware);
app.use("*", rateLimitMiddleware);

// Example CORS (Server-to-Server default, dashboard on allowlist)
app.use("*", async (c, next) => {
  const origin = c.req.header("Origin");
  const allowedDashboardOrigins = ["https://dashboard.example.com"];

  if (origin && allowedDashboardOrigins.includes(origin)) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
  } else if (!origin) {
    // Server-to-server request (no origin header), allowed by default, no CORS headers needed
  }

  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  await next();
});

// Register Routes
app.route("/v1/robots", robotsRoutes);
app.route("/v1/sitemap", sitemapRoutes);
app.route("/v1/indexing", indexingRoutes);

// Default root route
app.get("/", (c) =>
  c.json(
    formatSuccess(
      { message: "Robots.txt and Sitemap Validator API" },
      {},
      c.get("requestId") as string,
    ),
  ),
);

// OpenAPI Output Route
app.get("/openapi.json", (c) => {
  return c.json({
    openapi: "3.0.0",
    info: {
      title: "Robots.txt and Sitemap Validator API",
      version: "1.0.0",
      description:
        "Validate robots.txt and sitemap.xml, find crawl conflicts, bad directives, broken sitemap URLs, and canonical mismatches.",
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API Key",
        },
      },
    },
    security: [{ BearerAuth: [] }],
    paths: {
      "/v1/robots/validate": {
        get: {
          summary: "Validate robots.txt",
          parameters: [
            {
              name: "url",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Success" },
            "404": { description: "Not Found" },
            "400": { description: "Bad Request" },
          },
        },
      },
      "/v1/sitemap/validate": {
        get: {
          summary: "Validate sitemap.xml",
          parameters: [
            {
              name: "url",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Success" },
            "422": { description: "Unprocessable Entity (XML Error)" },
          },
        },
      },
      "/v1/indexing/check": {
        get: {
          summary: "Cross-check robots.txt rules against sitemap.xml URLs",
          parameters: [
            {
              name: "url",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Success" },
          },
        },
      },
    },
  });
});

app.onError(errorHandler);

export default app;
