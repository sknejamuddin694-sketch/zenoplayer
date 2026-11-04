import { describe, expect, it } from "vitest";

import { isProxyRequestAllowed } from "@/lib/proxy-guard";

const BROWSER = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

const req = (headers: Record<string, string>) => ({ headers: new Headers(headers) });
const from = (origin: string) => req({ "user-agent": BROWSER, origin, "sec-fetch-site": "same-origin" });

describe("MovieBox proxy guard", () => {
  it("serves the user's own domains", () => {
    expect(isProxyRequestAllowed(from("https://co08.art"))).toBe(true);
    expect(isProxyRequestAllowed(from("https://www.co08.art"))).toBe(true);
    expect(isProxyRequestAllowed(from("https://movie-box-psi.vercel.app"))).toBe(true);
    expect(isProxyRequestAllowed(from("http://localhost:8080"))).toBe(true);
  });

  it("refuses every other website", () => {
    expect(isProxyRequestAllowed(from("https://evil.com"))).toBe(false);
    expect(isProxyRequestAllowed(from("https://co08.art.attacker.net"))).toBe(false);
    expect(isProxyRequestAllowed(from("https://notvercel.app"))).toBe(false);
    expect(isProxyRequestAllowed(req({ "user-agent": BROWSER }))).toBe(false);
  });

  it("refuses scripts, bots and cross-site page loads", () => {
    const ua = (agent: string) => req({ "user-agent": agent, origin: "https://co08.art", "sec-fetch-site": "same-origin" });
    expect(isProxyRequestAllowed(ua("curl/8.5.0"))).toBe(false);
    expect(isProxyRequestAllowed(ua("python-requests/2.31.0"))).toBe(false);
    expect(isProxyRequestAllowed(ua(""))).toBe(false);
    expect(
      isProxyRequestAllowed(req({ "user-agent": BROWSER, origin: "https://co08.art", "sec-fetch-site": "cross-site" })),
    ).toBe(false);
  });
});
