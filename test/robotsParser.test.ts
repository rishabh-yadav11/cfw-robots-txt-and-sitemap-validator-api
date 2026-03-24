import { describe, it, expect, vi } from "vitest";
import { parseRobotsTxt, isUrlAllowed } from "../src/utils/robotsParser";

describe("Robots Parser", () => {
  it("should parse allow and disallow directives", () => {
    const txt = `
      User-agent: *
      Disallow: /private/
      Allow: /public/
      Sitemap: https://example.com/sitemap.xml
    `;
    const directives = parseRobotsTxt(txt);
    expect(directives.disallow).toContain("/private/");
    expect(directives.allow).toContain("/public/");
    expect(directives.sitemaps).toContain("https://example.com/sitemap.xml");
  });

  it("should evaluate url access correctly", () => {
    const directives = {
      allow: ["/public/", "/private/safe/"],
      disallow: ["/private/"],
      sitemaps: [],
    };

    expect(isUrlAllowed("/public/test", directives)).toBe(true);
    expect(isUrlAllowed("/private/test", directives)).toBe(false);
    expect(isUrlAllowed("/private/safe/test", directives)).toBe(true);
    expect(isUrlAllowed("/other", directives)).toBe(true);
  });
});
