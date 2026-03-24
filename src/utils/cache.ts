import { Context } from "hono";

export const getCacheKey = (c: Context, type: string, url: string) => {
  return `cache:${type}:${encodeURIComponent(url)}`;
};

export const getCachedResponse = async (c: Context, cacheKey: string) => {
  const env = c.env as any;
  if (!env.KV) return null;
  const cached = await env.KV.get(cacheKey);
  return cached ? JSON.parse(cached) : null;
};

export const setCachedResponse = async (
  c: Context,
  cacheKey: string,
  data: any,
  ttlSeconds: number,
) => {
  const env = c.env as any;
  if (!env.KV) return;
  await env.KV.put(cacheKey, JSON.stringify(data), {
    expirationTtl: ttlSeconds,
  });
};
