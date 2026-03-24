# Robots.txt and Sitemap Validator API

A Cloudflare Worker API to validate `robots.txt` and `sitemap.xml`, find crawl conflicts, bad directives, broken sitemap URLs, and canonical mismatches.

## Features

- **Strict Validation**: Validates `robots.txt` directives and `sitemap.xml` structure.
- **Conflict Checking**: Checks for sitemap URLs disallowed by robots.txt rules.
- **SSRF Guard**: Strict protection against malicious URLs (blocks localhost, private IPs).
- **Security**: Requires API Key authentication (`Authorization: Bearer <key>`) with per-key and IP rate-limiting.
- **Performance**: Cached fetches with size limits and robust timeout limits.
- **OpenAPI**: Exposed `/openapi.json` standard output.

## Environment Variables

This project uses Cloudflare Workers KV to store API Keys and Cache responses. You will need a binding named `KV`.

You must populate the KV namespace with API keys hashed in SHA-256 for the API to authenticate correctly.

Format for API Keys in KV:

- **Key**: `apikey:<sha256_hash_of_token>`
- **Value**: JSON Object representing `ApiKeyData`:

```json
{
  "key_id": "key_123",
  "prefix": "sk_live",
  "plan": "pro",
  "scopes": ["crawl:read"],
  "status": "active",
  "created_at": 1698244190000
}
```

## Setup & Local Dev

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

## Testing & Checks

Run unit tests (Vitest):

```bash
npm run test
```

Linting and Formatting:

```bash
npm run lint
npm run format
```

TypeScript validation:

```bash
npm run typecheck
```

## Example Requests

**Validate robots.txt**

```bash
curl "http://localhost:8787/v1/robots/validate?url=https://example.com" \
  -H "Authorization: Bearer <your_api_key>"
```

**Validate sitemap.xml**

```bash
curl "http://localhost:8787/v1/sitemap/validate?url=https://example.com/sitemap.xml" \
  -H "Authorization: Bearer <your_api_key>"
```

**Cross-check Indexing Conflicts**

```bash
curl "http://localhost:8787/v1/indexing/check?url=https://example.com/sitemap.xml" \
  -H "Authorization: Bearer <your_api_key>"
```

## Deployment

To deploy to your Cloudflare account, run:

```bash
npm run deploy
```

Make sure your `wrangler.jsonc` file points to your correct KV namespace ID if applying directly to production.
