import { describe, expect, it } from "vitest";
import { getProviderDisplayStatus } from "./providerStatus";
import type { ProviderHealth } from "./types";

function provider(overrides: Partial<ProviderHealth>): ProviderHealth {
  return {
    id: "spotify",
    name: "Spotify",
    configured: false,
    available: false,
    searchAvailable: false,
    playbackAvailable: false,
    credentialRequirement: "Not available.",
    capabilities: [],
    status: "disabled",
    checkedAt: "2026-11-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("provider display status", () => {
  it("reports healthy search-only and playback integrations accurately", () => {
    expect(getProviderDisplayStatus(provider({
      status: "healthy",
      available: true,
      searchAvailable: true,
    }))).toBe("Connected · Search Only");
    expect(getProviderDisplayStatus(provider({
      status: "healthy",
      available: true,
      searchAvailable: true,
      playbackAvailable: true,
    }))).toBe("Connected · Playback Supported");
    expect(getProviderDisplayStatus(provider({
      id: "youtube-music",
      status: "healthy",
      available: true,
      searchAvailable: true,
      playbackAvailable: false,
    }))).toBe("Search Only · authorized audio matching");
    expect(getProviderDisplayStatus(provider({
      id: "youtube-music",
      status: "disabled",
      credentialRequirement: "Required: set YOUTUBE_API_KEY on the server.",
    }))).toBe("Credentials Missing");
  });

  it("distinguishes missing credentials from unsupported and unavailable providers", () => {
    expect(getProviderDisplayStatus(provider({
      credentialRequirement: "Required: set a server credential.",
    }))).toBe("Credentials Missing");
    expect(getProviderDisplayStatus(provider({}))).toBe("Unsupported");
    expect(getProviderDisplayStatus(provider({ status: "unavailable" }))).toBe("Connection Unavailable");
  });
});
