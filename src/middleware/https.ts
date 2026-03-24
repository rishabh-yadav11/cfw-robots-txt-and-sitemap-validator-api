import { Context, Next } from "hono";

export const httpsOnlyMiddleware = async (c: Context, next: Next) => {
  const url = new URL(c.req.url);

  // In local dev/testing it might be http, but in production we want https
  // For Cloudflare Workers, requests are generally terminated at CF edge over HTTPS.
  // But we can check x-forwarded-proto or the URL protocol if strictly necessary.

  if (
    url.protocol !== "https:" &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1"
  ) {
    return c.json(
      {
        ok: false,
        error: { code: "https_required", message: "HTTPS required" },
        request_id: c.get("requestId"),
      },
      403,
    );
  }

  await next();
};
