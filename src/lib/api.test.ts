import { afterEach, describe, expect, it, vi } from "vitest";

import { get, RateLimitError } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API rate-limit handling", () => {
  it("stops on 429 and preserves the Retry-After duration", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Too Many Requests", {
        status: 429,
        headers: { "retry-after": "60" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(get("/home")).rejects.toMatchObject({
      name: "RateLimitError",
      retryAfterSeconds: 60,
      message: "Too many requests. Please wait 60 seconds before trying again.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses a safe one-minute retry delay when the upstream omits Retry-After", () => {
    const error = new RateLimitError(null);

    expect(error.retryAfterSeconds).toBe(60);
  });
});
