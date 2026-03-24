import { describe, it, expect, vi } from "vitest";
import app from "../src/index";

// We mock KV since we cannot use a real KV namespace easily in simple Hono tests
const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
};

const mockEnv = {
  KV: mockKV as any,
};

describe("API Routes", () => {
  const getValidAuthHeaders = () => {
    // Return a mock auth header. Since the real auth uses SHA-256 of the token to lookup in KV,
    // we need to mock KV to return a valid token data.
    // Hash of 'test-token' is something, but we just need KV to return valid ApiKeyData.
    const token = "test-token";
    const hashHex =
      "b3a8e0e1f9ab1bfe3a36f231f676f78bb30a519d2b21e6c530c0eee8ebb4a5d0"; // random hash representation
    return { Authorization: `Bearer ${token}` };
  };

  it("GET /openapi.json should return the API spec", async () => {
    const res = await app.request("/openapi.json");
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.openapi).toBe("3.0.0");
    expect(json.info.title).toBe("Robots.txt and Sitemap Validator API");
  });

  // Since we require SSRF validation to fetch real URLs, testing the actual fetch flow requires mocking `fetch`
  // We will leave the fetch logic integration tests simple and rely on unit tests for utils.

  it("GET /v1/robots/validate requires auth", async () => {
    const res = await app.request(
      "http://localhost/v1/robots/validate?url=http://example.com",
      {
        method: "GET",
      },
    );
    // Missing auth header
    expect(res.status).toBe(401);
  });
});
