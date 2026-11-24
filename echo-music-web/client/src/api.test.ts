import { afterEach, describe, expect, it, vi } from "vitest";
import { searchMusic } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("search API errors", () => {
  it("shows a provider error returned by the API", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ error: "Search provider unavailable: Jamendo returned 503" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    )));

    await expect(searchMusic("Tum Hi Ho", "songs")).rejects.toThrow("Jamendo returned 503");
  });

  it("shows the HTTP status when an API error is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Bad Gateway", { status: 502 })));

    await expect(searchMusic("Tum Hi Ho", "songs")).rejects.toThrow("Search failed (HTTP 502)");
  });
});
