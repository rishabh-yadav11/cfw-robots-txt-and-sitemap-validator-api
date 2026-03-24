import ipaddr from "ipaddr.js";

export const isPrivateIP = (ipStr: string): boolean => {
  try {
    const addr = ipaddr.parse(ipStr);
    const range = addr.range();

    // Check for common private/local ranges
    const privateRanges = [
      "unspecified",
      "multicast",
      "linkLocal",
      "loopback",
      "private",
      "reserved",
      "uniqueLocal",
      "ipv4Mapped",
      "rfc6145",
      "rfc6052",
      "6to4",
      "teredo",
    ];

    if (privateRanges.includes(range)) {
      return true;
    }

    return false;
  } catch (err) {
    // If not a valid IP, assume safe (could be a domain name), DNS resolution will be checked during fetch if needed.
    // However, SSRF protection usually requires resolving the domain and checking its IP *before* fetching.
    // In Cloudflare Workers, resolving DNS natively before fetch isn't straightforward without a DNS over HTTPS request.
    // Cloudflare blocks access to localhost/127.0.0.1 and internal CF networks by default in Workers fetch().
    // We will still implement URL parsing to block obvious bad hosts and schemes.
    return false;
  }
};

export const validateTargetUrl = (targetUrl: string): URL => {
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch (e) {
    throw new Error("Invalid URL format");
  }

  const allowedSchemes = ["http:", "https:"];
  if (!allowedSchemes.includes(url.protocol)) {
    throw new Error("Disallowed scheme. Only http and https are allowed.");
  }

  const blockedHosts = ["localhost", "127.0.0.1", "::1", "0.0.0.0"];

  if (blockedHosts.includes(url.hostname)) {
    throw new Error("Host is disallowed");
  }

  if (isPrivateIP(url.hostname)) {
    throw new Error("Host resolves to a private IP");
  }

  return url;
};
