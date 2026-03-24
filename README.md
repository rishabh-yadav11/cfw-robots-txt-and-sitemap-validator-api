# Robots.txt and Sitemap Validator API

## Product Summary
Validate robots.txt and sitemap.xml, find crawl conflicts, bad directives, broken sitemap URLs, and canonical mismatches.

## Route List
- GET /v1/robots/validate?url=
- GET /v1/sitemap/validate?url=
- GET /v1/indexing/check?url=
- scopes: crawl:read
- ssrf_guard: strict
- fetch_caps: robots 512KB, sitemap 5MB compressed limit
- cache_ttl: 6h
- happy_path: valid robots and sitemap return status=ok
- conflict_case: disallow plus sitemap URL conflict returns warning
- xml_error: broken sitemap XML returns 422

## Auth Model
- **Type**: API Key (Bearer Token)
- **Header**: `Authorization: Bearer <api_key>`
- **Storage**: Hashed storage in Cloudflare KV
- **Advanced**: HMAC Signature required for write routes (X-Timestamp, X-Nonce, X-Signature)

## Rate Limit Model
- **Model**: Token Bucket (per API Key and per IP)
- **Free Plan**: 60 req/min, 5000/day
- **Pro Plan**: 300 req/min, 100,000/day
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Required Cloudflare Bindings
- **KV**: Used for API key metadata, rate limiting, and asset storage.

## Local Setup
```bash
npm install
cp .env.example .env
npm run dev
```

## Test Commands
```bash
npm test        # Run Vitest
npm run lint    # Run ESLint
npm run typecheck # Run TSC
```

## Deploy Steps
```bash
# 1. Create KV/R2 namespaces in Cloudflare
# 2. Update wrangler.jsonc with namespace IDs
# 3. Add secrets
wrangler secret put API_KEY_SECRET
# 4. Deploy
npm run deploy
```

## Security Notes
- **SSRF Guard**: Strict blocking of private/local IP ranges on all URL-fetching routes.
- **Request IDs**: `X-Request-Id` included in every response for tracing.
- **Strict Validation**: Zod-based input validation for all queries and bodies.
- **Redaction**: Automatic redaction of PII and secrets in logs.

## Example Request
```bash
curl -X GET "http://localhost:8787/v1/robots/validate?url=" \
     -H "Authorization: Bearer YOUR_API_KEY"
```

## Response Shape
- **Success**: `{ ok: true, data: {...}, meta: {...}, request_id: "..." }`
- **Error**: `{ ok: false, error: { code: "...", message: "..." }, request_id: "..." }`

## Infrastructure Setup

Run these commands to initialize the required Cloudflare resources:

```bash
# 1. Create KV Namespace (Note the ID from the output)
wrangler kv:namespace create "KV"

# 3. Set Secrets
wrangler secret put API_KEY_SECRET

```

> **Note:** After creating KV/R2, update the `id` fields in `wrangler.jsonc` with the IDs provided by the command output.

