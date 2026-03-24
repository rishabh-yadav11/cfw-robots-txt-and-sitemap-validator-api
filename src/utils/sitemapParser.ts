import { XMLParser } from "fast-xml-parser";

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

export const parseSitemap = (
  xmlContent: string,
): { urls: SitemapEntry[]; sitemaps: string[]; error?: string } => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    allowBooleanAttributes: true,
  });

  try {
    // Basic structural check before parsing
    if (
      !xmlContent.includes("<urlset") &&
      !xmlContent.includes("<sitemapindex")
    ) {
      return {
        urls: [],
        sitemaps: [],
        error: "Invalid XML format: Missing urlset or sitemapindex",
      };
    }

    // Check if it has a closing tag for urlset or sitemapindex
    if (
      !xmlContent.includes("</urlset>") &&
      !xmlContent.includes("</sitemapindex>")
    ) {
      return {
        urls: [],
        sitemaps: [],
        error: "Invalid XML format: Unclosed root tag",
      };
    }

    const result = parser.parse(xmlContent);
    const urls: SitemapEntry[] = [];
    const sitemaps: string[] = [];

    // Check if it's a sitemap index
    if (result.sitemapindex && result.sitemapindex.sitemap) {
      let entries = result.sitemapindex.sitemap;
      if (!Array.isArray(entries)) entries = [entries];
      for (const entry of entries) {
        if (entry.loc) sitemaps.push(entry.loc);
      }
    }

    // Check if it's a regular urlset
    if (result.urlset && result.urlset.url) {
      let entries = result.urlset.url;
      if (!Array.isArray(entries)) entries = [entries];
      for (const entry of entries) {
        if (entry.loc) {
          urls.push({
            loc: entry.loc,
            lastmod: entry.lastmod,
            changefreq: entry.changefreq,
            priority: entry.priority ? parseFloat(entry.priority) : undefined,
          });
        }
      }
    }

    // Check if both are empty, might mean it's neither or just invalid structurally
    if (urls.length === 0 && sitemaps.length === 0) {
      // Very basic validation - if fast-xml-parser parses an empty object or random keys
      const keys = Object.keys(result);
      if (
        keys.length > 0 &&
        keys[0] !== "urlset" &&
        keys[0] !== "sitemapindex"
      ) {
        return { urls: [], sitemaps: [], error: "Invalid root element" };
      }
    }

    return { urls, sitemaps };
  } catch (err: any) {
    return { urls: [], sitemaps: [], error: err.message || "Invalid XML" };
  }
};
