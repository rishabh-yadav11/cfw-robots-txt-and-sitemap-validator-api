import { isPrivateIP, validateTargetUrl } from "./ssrfGuard";

export interface SafeFetchOptions {
  maxRedirects?: number;
  maxSizeBytes?: number;
  timeoutMs?: number;
}

export class SafeFetchError extends Error {
  public code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
  }
}

export const safeFetch = async (
  targetUrl: string,
  options: SafeFetchOptions = {},
): Promise<{ text: string; response: Response; status: number }> => {
  const {
    maxRedirects = 5,
    maxSizeBytes = 5 * 1024 * 1024, // default 5MB
    timeoutMs = 8000, // default 8s
  } = options;

  let currentUrl = targetUrl;
  let redirects = 0;
  let response: Response | null = null;
  let fetchStatus = 200;

  while (redirects <= maxRedirects) {
    validateTargetUrl(currentUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual", // Intercept redirects for SSRF check
        signal: controller.signal,
        headers: {
          "User-Agent": "CFW-Validator-API/1.0",
          Accept: "*/*",
        },
      });
      clearTimeout(timeoutId);
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new SafeFetchError(
          `Request timed out after ${timeoutMs}ms`,
          "timeout",
        );
      }
      throw new SafeFetchError(`Fetch failed: ${err.message}`, "fetch_failed");
    }

    fetchStatus = response.status;

    if ([301, 302, 303, 307, 308].includes(fetchStatus)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new SafeFetchError(
          "Redirected without location header",
          "invalid_redirect",
        );
      }
      // Resolve relative redirects
      currentUrl = new URL(location, currentUrl).href;
      redirects++;
    } else {
      break;
    }
  }

  if (redirects > maxRedirects) {
    throw new SafeFetchError(
      `Exceeded maximum redirects (${maxRedirects})`,
      "too_many_redirects",
    );
  }

  if (!response) {
    throw new SafeFetchError("No response received", "no_response");
  }

  // Check content length header first
  const contentLengthStr = response.headers.get("content-length");
  if (contentLengthStr) {
    const contentLength = parseInt(contentLengthStr, 10);
    if (contentLength > maxSizeBytes) {
      throw new SafeFetchError(
        `Response exceeded max size limit of ${maxSizeBytes} bytes`,
        "response_too_large",
      );
    }
  }

  let receivedLength = 0;
  let bodyText = "";

  // Read array buffer to handle binary/text data
  try {
    const arrayBuffer = await response.arrayBuffer();
    receivedLength = arrayBuffer.byteLength;
    if (receivedLength > maxSizeBytes) {
      throw new SafeFetchError(
        `Response exceeded max size limit of ${maxSizeBytes} bytes during read`,
        "response_too_large",
      );
    }
    bodyText = new TextDecoder("utf-8").decode(arrayBuffer);
  } catch (e: any) {
    if (e instanceof SafeFetchError) throw e;
    throw new SafeFetchError(
      `Failed to read response body: ${e.message}`,
      "read_failed",
    );
  }

  return {
    text: bodyText,
    response,
    status: fetchStatus,
  };
};
