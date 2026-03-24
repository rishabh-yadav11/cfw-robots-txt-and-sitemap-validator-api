export interface RobotsDirectives {
  allow: string[];
  disallow: string[];
  sitemaps: string[];
}

export const parseRobotsTxt = (
  content: string,
  userAgent: string = "*",
): RobotsDirectives => {
  const lines = content.split(/\r?\n/);
  const directives: RobotsDirectives = {
    allow: [],
    disallow: [],
    sitemaps: [],
  };

  let isTargetUserAgent = false;
  let hasGlobalUserAgent = false;
  let currentUserAgent = "";

  // Track directives for '*' globally, and track directives for specific user-agent
  const globalDirectives: { allow: string[]; disallow: string[] } = {
    allow: [],
    disallow: [],
  };

  for (const line of lines) {
    const cleanLine = line.split("#")[0].trim();
    if (!cleanLine) continue;

    const parts = cleanLine.split(":");
    if (parts.length < 2) continue;

    const key = parts[0].trim().toLowerCase();
    const value = parts.slice(1).join(":").trim();

    if (key === "user-agent") {
      currentUserAgent = value.toLowerCase();
      if (currentUserAgent === "*") {
        hasGlobalUserAgent = true;
      }
      isTargetUserAgent =
        currentUserAgent === userAgent.toLowerCase() ||
        currentUserAgent === "*";
    } else if (key === "allow") {
      if (currentUserAgent === "*") globalDirectives.allow.push(value);
      if (isTargetUserAgent) directives.allow.push(value);
    } else if (key === "disallow") {
      if (currentUserAgent === "*") globalDirectives.disallow.push(value);
      if (isTargetUserAgent) directives.disallow.push(value);
    } else if (key === "sitemap") {
      // Sitemaps are independent of user-agents
      directives.sitemaps.push(value);
    }
  }

  // If specific UA wasn't found, fallback to global '*'
  if (directives.allow.length === 0 && directives.disallow.length === 0) {
    directives.allow = globalDirectives.allow;
    directives.disallow = globalDirectives.disallow;
  }

  return directives;
};

// Simple pattern matching for robots.txt rules
export const isUrlAllowed = (
  urlPath: string,
  directives: RobotsDirectives,
): boolean => {
  // Disallow takes precedence unless Allow is longer (more specific),
  // but a simplified version checks Disallow first, then Allow overrides.

  let allowed = true;
  let matchedDisallowLen = 0;
  const matchedAllowLen = 0;

  for (const rule of directives.disallow) {
    if (rule === "") continue; // Empty disallow means allow all
    if (urlPath.startsWith(rule)) {
      allowed = false;
      matchedDisallowLen = rule.length;
    }
  }

  for (const rule of directives.allow) {
    if (rule === "") continue;
    if (urlPath.startsWith(rule)) {
      if (!allowed && rule.length > matchedDisallowLen) {
        allowed = true;
      } else if (allowed) {
        allowed = true;
      }
    }
  }

  return allowed;
};
