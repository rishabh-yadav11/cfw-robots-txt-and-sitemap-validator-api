import { describe, it, expect } from "vitest";
import { parseSitemap } from "../src/utils/sitemapParser";

describe("Sitemap Parser", () => {
  it("should parse standard sitemap urlset", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
       <url>
          <loc>http://www.example.com/</loc>
          <lastmod>2005-01-01</lastmod>
          <changefreq>monthly</changefreq>
          <priority>0.8</priority>
       </url>
    </urlset>`;

    const { urls, sitemaps, error } = parseSitemap(xml);
    expect(error).toBeUndefined();
    expect(sitemaps).toHaveLength(0);
    expect(urls).toHaveLength(1);
    expect(urls[0].loc).toBe("http://www.example.com/");
    expect(urls[0].priority).toBe(0.8);
  });

  it("should return error for invalid xml", () => {
    const xml = `<urlset>unclosed tag`;
    const { urls, sitemaps, error } = parseSitemap(xml);
    expect(error).toBeDefined();
  });
});
