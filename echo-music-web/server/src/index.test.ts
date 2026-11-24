import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app, buildArchiveQuery, buildEntityResults, normalizeSearchText, parseDuration, rankSearchResults } from "./index.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("licensed full-track catalog", () => {
  it("keeps unsupported providers disabled and requires a server key for YouTube search", async () => {
    vi.stubEnv("SPOTIFY_CLIENT_ID", "test-client-id");
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "test-client-secret");
    vi.stubEnv("SOUNDCLOUD_CLIENT_ID", "test-client-id");
    vi.stubEnv("SOUNDCLOUD_CLIENT_SECRET", "test-client-secret");
    vi.stubEnv("YOUTUBE_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const providers = await request(app).get("/api/providers");
    const youtubeMusic = providers.body.providers.find((provider: { id: string }) => provider.id === "youtube-music");
    expect(youtubeMusic).toMatchObject({ available: false, configured: false });
    expect(youtubeMusic.reason).toContain("YOUTUBE_API_KEY");
    expect(providers.body.providers.find((provider: { id: string }) => provider.id === "soundcloud")).toMatchObject({
      available: false,
      searchAvailable: false,
      playbackAvailable: false,
    });
    expect(providers.body.providers.find((provider: { id: string }) => provider.id === "spotify")).toMatchObject({
      available: false,
      searchAvailable: false,
      playbackAvailable: false,
    });
    expect(providers.body.providers.find((provider: { id: string }) => provider.id === "youtube-music")).toMatchObject({
      available: false,
      searchAvailable: false,
      playbackAvailable: false,
    });

    const response = await request(app).get(
      "/api/search?q=audio-only-check&providers=youtube-music,soundcloud,spotify",
    );
    expect(response.status).toBe(200);
    expect(response.body.results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps official YouTube Data API metadata without exposing an audio URL or server key", async () => {
    const apiKey = "server-youtube-test-key";
    vi.stubEnv("YOUTUBE_API_KEY", apiKey);
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      expect(url.searchParams.get("key")).toBe(apiKey);
      if (url.pathname.endsWith("/search")) {
        expect(url.origin).toBe("https://www.googleapis.com");
        expect(url.searchParams.get("part")).toBe("snippet");
        expect(url.searchParams.get("type")).toBe("video");
        expect(url.searchParams.get("videoCategoryId")).toBe("10");
        expect(url.searchParams.get("q")).toBe("Kesariya");
        return new Response(JSON.stringify({
          items: [{
            id: { videoId: "video-123" },
            snippet: {
              title: "Kesariya &amp; Arijit Singh",
              channelTitle: "Arijit Singh",
              thumbnails: { high: { url: "https://i.ytimg.com/vi/video-123/hqdefault.jpg" } },
            },
          }],
        }));
      }
      expect(url.pathname).toBe("/youtube/v3/videos");
      expect(url.searchParams.get("part")).toBe("contentDetails");
      return new Response(JSON.stringify({
        items: [{ id: "video-123", contentDetails: { duration: "PT4M28S" } }],
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app).get("/api/search?q=Kesariya&providers=youtube-music");
    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0]).toMatchObject({
      id: "youtube-music:video-123",
      videoId: "video-123",
      providerId: "youtube-music",
      providerName: "YouTube Music",
      title: "Kesariya & Arijit Singh",
      artist: "Arijit Singh",
      artwork: "https://i.ytimg.com/vi/video-123/hqdefault.jpg",
      durationSeconds: 268,
      playback: { status: "unavailable" },
    });
    expect(response.body.results[0].audioUrl).toBeUndefined();
    expect(response.body.results[0].externalUrl).toBeUndefined();
    expect(response.body.providers.find((provider: { id: string }) => provider.id === "youtube-music")).toMatchObject({
      configured: true,
      searchAvailable: true,
      playbackAvailable: false,
    });
    expect(JSON.stringify(response.body)).not.toContain(apiKey);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    {
      status: 403,
      body: { error: { message: "The request cannot be completed because you have exceeded your quota.", errors: [{ reason: "quotaExceeded" }] } },
      expected: "quota exceeded",
    },
    {
      status: 400,
      body: { error: { message: "API key not valid. Please pass a valid API key.", errors: [{ reason: "keyInvalid" }] } },
      expected: "key is invalid",
    },
  ])("reports YouTube API configuration failures safely ($status)", async ({ status, body, expected }) => {
    const apiKey = "server-youtube-private-key";
    vi.stubEnv("YOUTUBE_API_KEY", apiKey);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
    const loggedErrors: string[] = [];
    const logSpy = vi.spyOn(console, "error").mockImplementation((...args) => loggedErrors.push(args.join(" ")));
    try {
      const response = await request(app).get("/api/search?q=Aarzu&providers=youtube-music");
      expect(response.status).toBe(502);
      expect(response.body.errors[0].message).toContain(expected);
      expect(JSON.stringify(response.body)).not.toContain(apiKey);
      expect(loggedErrors.join(" ")).not.toContain(apiKey);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("returns an empty YouTube result set as a successful search", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "server-youtube-test-key");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [] })));
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app).get("/api/search?q=unmatched%20song&providers=youtube-music");
    expect(response.status).toBe(200);
    expect(response.body.results).toEqual([]);
    expect(response.body.errors).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("checks enabled provider health separately from disabled integrations", async () => {
    vi.stubEnv("JAMENDO_CLIENT_ID", "");
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => new Response(JSON.stringify(
      String(input).includes("api.audius.co")
        ? { data: [] }
        : { response: { numFound: 0, docs: [] } },
    ))));
    const response = await request(app).get("/api/providers/health");
    expect(response.status).toBe(200);
    expect(response.body.providers.find((provider: { id: string }) => provider.id === "internet-archive").status).toBe("healthy");
    const audius = response.body.providers.find((provider: { id: string }) => provider.id === "audius");
    expect(audius).toMatchObject({
      status: "healthy",
      searchAvailable: true,
      playbackAvailable: true,
      lastSuccessfulCheck: response.body.checkedAt,
    });
    expect(response.body.providers.find((provider: { id: string }) => provider.id === "jamendo")).toMatchObject({
      status: "disabled",
      credentialRequirement: "Required: set JAMENDO_CLIENT_ID on the API server.",
    });
  });

  it("does not spend YouTube quota during provider health checks", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "server-youtube-test-key");
    const fetchMock = vi.fn(async (input: string | URL | Request) => new Response(JSON.stringify(
      String(input).includes("api.audius.co")
        ? { data: [] }
        : { response: { numFound: 0, docs: [] } },
    )));
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app).get("/api/providers/health");
    expect(response.status).toBe(200);
    expect(response.body.providers.find((provider: { id: string }) => provider.id === "youtube-music")).toMatchObject({
      status: "healthy",
      configured: true,
      searchAvailable: true,
      playbackAvailable: false,
    });
    expect(fetchMock.mock.calls.map(([url]) => String(url)).some(url => url.includes("youtube/v3"))).toBe(false);
  });

  it("explains missing Jamendo credentials without making an upstream request", async () => {
    vi.stubEnv("JAMENDO_CLIENT_ID", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await request(app).get("/api/search?q=licensed%20music&providers=jamendo");

    expect(response.status).toBe(200);
    expect(response.body.results).toEqual([]);
    expect(response.body.providers.find((provider: { id: string }) => provider.id === "jamendo")).toMatchObject({
      available: false,
      searchAvailable: false,
      credentialRequirement: "Required: set JAMENDO_CLIENT_ID on the API server.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes punctuation and preserves Hindi text", () => {
    expect(normalizeSearchText(" Tum—Hi!Ho ")).toBe("tum hi ho");
    expect(normalizeSearchText("तुम ही हो")).toBe("तुम ही हो");
  });

  it("keeps music searches out of podcast collections and separates podcast searches", () => {
    expect(buildArchiveQuery("pal pal", "songs")).toContain("-collection:podcasts");
    expect(buildArchiveQuery("Alan Walker", "artists")).toContain("title:");
    expect(buildArchiveQuery("episode", "podcasts")).toContain("collection:podcasts");
  });

  it("ranks exact titles and artists above fuzzy and provider-ranked matches", () => {
    const results = rankSearchResults("Alan Walker", [
      { title: "Alan Walkar", artist: "Other", providerScore: 1000 },
      { title: "A Song", artist: "Alan Walker", providerScore: 0 },
      { title: "Alan Walker", artist: "Another Artist", providerScore: 0 },
    ]);
    expect(results.map(result => result.title)).toEqual(["Alan Walker", "A Song", "Alan Walkar"]);
  });

  it("supports misspelled Latin titles and exact Devanagari titles", () => {
    expect(rankSearchResults("Tumm Hi Ho", [
      { title: "Tum Hi Ho", artist: "Arijit Singh" },
      { title: "A Different Song", artist: "Other" },
    ]).map(result => result.title)).toEqual(["Tum Hi Ho"]);
    expect(rankSearchResults("तुम ही हो", [
      { title: "तुम ही हो", artist: "अरिजीत सिंह" },
    ])).toHaveLength(1);
  });

  it("does not treat one repeated query token as a full match", () => {
    const results = rankSearchResults("pal pal", [
      { title: "Pocket Pal", artist: "One token" },
      { title: "Pal Pal", artist: "Exact" },
    ]);
    expect(results.map(result => result.title)).toEqual(["Pal Pal"]);
  });

  it("does not split a compound creator field into invented artist identities", () => {
    const track = {
      id: "archive-item/track.mp3",
      providerId: "internet-archive" as const,
      providerName: "Internet Archive" as const,
      title: "Uploaded audio",
      artist: "Arijit Singh Shreya Ghosal Alan Walker",
      audioUrl: "https://archive.org/download/archive-item/track.mp3",
      durationSeconds: 180,
      sourceUrl: "https://archive.org/details/archive-item",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      attribution: "Creator attribution",
      playback: {
        status: "available" as const,
        providerId: "internet-archive" as const,
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      },
      kind: "song" as const,
    };
    expect(buildEntityResults("artists", [track], 16, "Arijit Singh")).toEqual([]);
  });

  it("parses catalog durations including minute:second values", () => {
    expect(parseDuration("03:25")).toBe(205);
    expect(parseDuration("140.95")).toBe(141);
    expect(parseDuration("invalid")).toBe(0);
  });

  it("maps Jamendo official stream metadata without exposing credentials to the client", async () => {
    vi.stubEnv("JAMENDO_CLIENT_ID", "server-test-client");
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      expect(url.searchParams.get("client_id")).toBe("server-test-client");
      expect([
        url.searchParams.get("namesearch"),
        url.searchParams.get("artist_name"),
        url.searchParams.get("album_name"),
      ]).toContain("independent song");
      return new Response(JSON.stringify({
        headers: { status: "success" },
        results: [{
          id: 123,
          name: "Independent Song",
          artist_name: "Test Artist",
          album_name: "Test Album",
          image: "https://img.jamendo.com/album/cover.jpg",
          duration: 215,
          audio: "https://prod-1.storage.jamendo.com/?trackid=123",
          license_ccurl: "https://creativecommons.org/licenses/by/4.0/",
        }],
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app).get("/api/search?q=independent%20song&providers=jamendo");
    expect(response.status).toBe(200);
    expect(response.body.results[0]).toMatchObject({
      id: "jamendo:123",
      providerId: "jamendo",
      providerName: "Jamendo",
      title: "Independent Song",
      artist: "Test Artist",
      album: "Test Album",
      durationSeconds: 215,
      playback: { status: "available", providerId: "jamendo" },
    });
    expect(response.body.results[0].audioUrl).toContain("storage.jamendo.com");
    expect(JSON.stringify(response.body)).not.toContain("server-test-client");
  });

  it("redacts Jamendo credentials echoed in provider errors and server logs", async () => {
    const clientId = "jamendo-private-client";
    vi.stubEnv("JAMENDO_CLIENT_ID", clientId);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      headers: {
        status: "failed",
        error_message: `Invalid client id: ${clientId}`,
      },
      results: [],
    }))));
    const loggedErrors: string[] = [];
    const logSpy = vi.spyOn(console, "error").mockImplementation((...args) => loggedErrors.push(args.join(" ")));
    try {
      const response = await request(app).get("/api/search?q=provider-error&providers=jamendo");
      expect(response.status).toBe(502);
      expect(JSON.stringify(response.body)).not.toContain(clientId);
      expect(loggedErrors.join(" ")).not.toContain(clientId);
      expect(response.body.errors[0].message).toContain("[redacted]");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("keeps successful Jamendo results when Internet Archive fails", async () => {
    vi.stubEnv("JAMENDO_CLIENT_ID", "server-test-client");
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.hostname === "api.jamendo.com") {
        return new Response(JSON.stringify({
          headers: { status: "success" },
          results: [{
            id: "jamendo-result",
            name: "Open Independent Song",
            artist_name: "Test Artist",
            duration: 200,
            audio: "https://audio.jamendo.com/track.mp3",
          }],
        }));
      }
      return new Response("Archive unavailable", { status: 503 });
    }));

    const response = await request(app).get(
      "/api/search?q=Open%20Independent%20Song&providers=jamendo,internet-archive",
    );
    expect(response.status).toBe(200);
    expect(response.body.results.map((track: { providerId: string }) => track.providerId)).toEqual(["jamendo"]);
    expect(response.body.errors).toEqual([
      { providerId: "internet-archive", message: "Upstream returned 503" },
    ]);
  });

  it("searches Audius and maps its official stream endpoint without exposing an API key", async () => {
    vi.stubEnv("AUDIUS_API_KEY", "server-audius-test-key");
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.origin).toBe("https://api.audius.co");
      expect(url.pathname).toBe("/v1/tracks/search");
      expect(url.searchParams.get("query")).toBe("Licensed Audius track");
      expect(url.searchParams.get("app_name")).toBe("echo-music-web");
      expect(new Headers(init?.headers).get("X-API-Key")).toBe("server-audius-test-key");
      return new Response(JSON.stringify({
        data: [
          {
            id: "track-123",
            title: "Licensed Audius Track",
            duration: 183,
            user: { name: "Test Uploader" },
            artwork: { "480x480": "https://creator.audius.co/cover.jpg" },
            permalink: "/test-uploader/licensed-audius-track",
            stream_conditions: null,
            is_streamable: true,
          },
          {
            id: "restricted-track",
            title: "Restricted Track",
            user: { name: "Test Uploader" },
            stream_conditions: { access: "collective" },
          },
        ],
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app).get(
      "/api/search?q=Licensed%20Audius%20track&providers=audius",
    );
    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0]).toMatchObject({
      id: "audius:track-123",
      providerId: "audius",
      providerName: "Audius",
      title: "Licensed Audius Track",
      artist: "Test Uploader",
      durationSeconds: 183,
      audioUrl: "https://api.audius.co/v1/tracks/track-123/stream?app_name=echo-music-web",
      sourceUrl: "https://audius.co/test-uploader/licensed-audius-track",
      playback: { status: "available", providerId: "audius" },
    });
    expect(response.body.results[0].audioUrl).not.toContain("creator.audius.co");
    expect(JSON.stringify(response.body)).not.toContain("server-audius-test-key");
  });

  it("preserves Internet Archive results when Audius fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("api.audius.co")) return new Response("Audius unavailable", { status: 503 });
      if (url.includes("advancedsearch.php")) {
        return new Response(JSON.stringify({
          response: { numFound: 1, docs: [{ identifier: "archive-survivor", score: 1 }] },
        }));
      }
      return new Response(JSON.stringify({
        metadata: {
          identifier: "archive-survivor",
          title: "Licensed Anthem",
          creator: "Test Artist",
          licenseurl: "https://creativecommons.org/licenses/by/4.0/",
        },
        files: [{ name: "anthem.mp3", length: "03:00", size: "3000000" }],
      }));
    }));

    const response = await request(app).get(
      "/api/search?q=Licensed%20Anthem&providers=audius,internet-archive",
    );
    expect(response.status).toBe(200);
    expect(response.body.results[0].providerId).toBe("internet-archive");
    expect(response.body.errors).toEqual([
      { providerId: "audius", message: "Audius returned HTTP 503" },
    ]);
  });

  it("deduplicates the same song while retaining its provider attribution", async () => {
    vi.stubEnv("JAMENDO_CLIENT_ID", "server-test-client");
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      if (String(input).includes("api.audius.co")) {
        return new Response(JSON.stringify({
          data: [{
            id: "shared-track",
            title: "Shared Song",
            duration: 180,
            user: { name: "Shared Artist" },
            stream_conditions: null,
          }],
        }));
      }
      return new Response(JSON.stringify({
        headers: { status: "success" },
        results: [{
          id: "shared-track",
          name: "Shared Song",
          artist_name: "Shared Artist",
          duration: 180,
          audio: "https://audio.jamendo.com/shared.mp3",
        }],
      }));
    }));

    const response = await request(app).get(
      "/api/search?q=Shared%20Song&providers=audius,jamendo",
    );
    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0].sources.map((source: { providerId: string }) => source.providerId).sort())
      .toEqual(["audius", "jamendo"]);
  });

  it("returns only sufficiently long media with an explicit CC BY 4.0 item license", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("advancedsearch.php")) {
        expect(url).toContain(encodeURIComponent("https://creativecommons.org/licenses/by/4.0/"));
        expect(url).toContain("-collection%3Apodcasts");
        return new Response(JSON.stringify({ response: { docs: [{ identifier: "licensed" }, { identifier: "unlicensed" }] } }));
      }
      if (url.includes("/metadata/licensed")) {
        return new Response(JSON.stringify({
          metadata: {
            identifier: "licensed",
            title: "Complete Recording",
            creator: "Test Artist",
            licenseurl: "https://creativecommons.org/licenses/by/4.0/",
          },
          files: [
            { name: "complete.mp3", format: "VBR MP3", length: "03:25", size: "3000000" },
            { name: "short-preview.mp3", format: "VBR MP3", length: "00:30", size: "500000" },
          ],
        }));
      }
      return new Response(JSON.stringify({
        metadata: { identifier: "unlicensed", licenseurl: "https://example.com/restricted" },
        files: [{ name: "restricted.mp3", format: "VBR MP3", length: "03:25", size: "3000000" }],
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app).get("/api/search?q=complete");
    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0]).toMatchObject({
      title: "Complete Recording",
      durationSeconds: 205,
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      audioUrl: "https://archive.org/download/licensed/complete.mp3",
      playback: {
        status: "available",
        providerId: "internet-archive",
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      },
      kind: "song",
    });
  });

  it("uses per-file track metadata instead of a compilation's unrelated creator and title", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("advancedsearch.php")) {
        return new Response(JSON.stringify({
          response: { numFound: 1, docs: [{ identifier: "compilation", score: 1, collection: ["community"] }] },
        }));
      }
      return new Response(JSON.stringify({
        metadata: {
          identifier: "compilation",
          title: "Unplugged Hindi Songs 2019",
          creator: "Arijit Singh Shreya Ghosal Alan Walker",
          licenseurl: "https://creativecommons.org/licenses/by/4.0/",
        },
        files: [
          { name: "unrelated.mp3", title: "An Unrelated Song", artist: "Other Artist", length: "03:25", size: "3000000" },
          { name: "song-two.mp3", title: "Song Two", artist: "Second Artist", album: "Second Album", length: "04:10", size: "3500000" },
        ],
      }));
    }));

    const unrelated = await request(app).get("/api/search?q=Alan%20Walker");
    expect(unrelated.status).toBe(200);
    expect(unrelated.body.results).toHaveLength(0);

    const matching = await request(app).get("/api/search?q=Song%20Two");
    expect(matching.status).toBe(200);
    expect(matching.body.results).toHaveLength(1);
    expect(matching.body.results[0]).toMatchObject({
      title: "Song Two",
      artist: "Second Artist",
      album: "Second Album",
      durationSeconds: 250,
      audioUrl: "https://archive.org/download/compilation/song-two.mp3",
      kind: "song",
    });
    expect(matching.body.results[0]).not.toHaveProperty("artwork");
  });

  it("keeps podcast episodes out of song results even when the collection is generic audio", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("advancedsearch.php")) {
        return new Response(JSON.stringify({
          response: { numFound: 1, docs: [{ identifier: "podcast-episode", collection: ["opensource_audio"] }] },
        }));
      }
      return new Response(JSON.stringify({
        metadata: {
          identifier: "podcast-episode",
          title: "Superman Fan Podcast: Pal Pal episode",
          creator: "Podcast Host",
          description: "An episode discussing the phrase Pal Pal.",
          licenseurl: "https://creativecommons.org/licenses/by/4.0/",
        },
        files: [{ name: "episode.mp3", length: "30:00", size: "30000000" }],
      }));
    }));

    const response = await request(app).get("/api/search?q=pal%20pal");
    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(0);
  });

  it("returns provider errors instead of disguising them as empty results", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
    const response = await request(app).get("/api/search?q=provider-outage-test&providers=internet-archive");
    expect(response.status).toBe(502);
    expect(response.body.error).toContain("Upstream returned 503");
  });

  it("rejects empty search without calling the upstream provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await request(app).get("/api/search?q=");
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unknown provider filters", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await request(app).get("/api/search?q=valid-query&providers=untrusted-provider");
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
