import { z } from "zod";

export type ProviderId = "youtube-music" | "soundcloud" | "spotify" | "jamendo" | "audius" | "internet-archive";
export type ProviderStatus = {
  id: ProviderId;
  name: string;
  configured: boolean;
  available: boolean;
  searchAvailable: boolean;
  playbackAvailable: boolean;
  credentialRequirement: string;
  reason?: string;
  capabilities: string[];
};
export type ProviderHealth = ProviderStatus & {
  status: "healthy" | "disabled" | "unavailable";
  checkedAt: string;
  lastSuccessfulCheck?: string;
  error?: string;
};
export type ProviderTrack = {
  id: string;
  videoId?: string;
  providerId: ProviderId;
  providerName: string;
  sources?: Array<{ providerId: ProviderId; providerName: string }>;
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  audioUrl?: string;
  sourceUrl?: string;
  externalUrl?: string;
  licenseUrl?: string;
  attribution?: string;
  durationSeconds?: number;
  playback:
    | { status: "available"; providerId: "jamendo" | "audius" | "internet-archive"; licenseUrl?: string }
    | { status: "unavailable"; reason: string };
  kind: "song" | "album" | "artist" | "playlist" | "podcast";
  providerScore?: number;
};

const jamendoTrackSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().min(1),
  artist_name: z.string().optional(),
  album_name: z.string().optional(),
  image: z.string().url().optional(),
  duration: z.number().nonnegative().optional(),
  audio: z.string().url().optional(),
  license_ccurl: z.string().url().optional(),
});

const jamendoResponseSchema = z.object({
  headers: z.object({ status: z.string().optional(), code: z.number().optional(), error_message: z.string().optional() }).optional(),
  results: z.array(jamendoTrackSchema).default([]),
});

const audiusArtworkSchema = z.union([
  z.string().url(),
  z.object({
    "480x480": z.string().url().optional(),
    "1000x1000": z.string().url().optional(),
  }).passthrough(),
]);
const audiusTrackSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string().min(1),
  duration: z.number().nonnegative().nullable().optional(),
  user: z.object({ name: z.string().optional() }).nullable().optional(),
  artwork: audiusArtworkSchema.nullable().optional(),
  permalink: z.string().nullable().optional(),
  stream_conditions: z.unknown().nullable().optional(),
  is_streamable: z.boolean().nullable().optional(),
});
const audiusResponseSchema = z.object({ data: z.array(audiusTrackSchema).default([]) });

const youtubeSearchResponseSchema = z.object({
  items: z.array(z.object({
    id: z.object({ videoId: z.string().min(1) }),
    snippet: z.object({
      title: z.string().min(1),
      channelTitle: z.string().optional(),
      thumbnails: z.object({
        default: z.object({ url: z.string().url() }).optional(),
        medium: z.object({ url: z.string().url() }).optional(),
        high: z.object({ url: z.string().url() }).optional(),
      }).optional(),
    }),
  })).default([]),
});
const youtubeVideosResponseSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    contentDetails: z.object({ duration: z.string() }),
  })).default([]),
});
const youtubeErrorSchema = z.object({
  error: z.object({
    message: z.string().optional(),
    errors: z.array(z.object({ reason: z.string().optional() }).passthrough()).optional(),
  }).passthrough(),
}).passthrough();

function youtubeApiError(status: number, body: unknown) {
  const parsed = youtubeErrorSchema.safeParse(body);
  const reasons = parsed.success ? parsed.data.error.errors?.map(error => error.reason?.toLowerCase() || "") ?? [] : [];
  const message = parsed.success ? parsed.data.error.message?.toLowerCase() || "" : "";
  if (
    status === 429
    || reasons.some(reason => reason.includes("quota") || reason.includes("ratelimit"))
    || message.includes("quota")
  ) {
    return new Error("YouTube Data API quota exceeded. Try again after quota resets.");
  }
  if (
    status === 400
    || reasons.includes("keyinvalid")
    || message.includes("api key not valid")
    || message.includes("invalid api key")
  ) {
    return new Error("YouTube Data API key is invalid. Check YOUTUBE_API_KEY on the server.");
  }
  if (status === 403) {
    return new Error("YouTube Data API access denied. Verify the key and enable YouTube Data API v3 in its Google Cloud project.");
  }
  return new Error(`YouTube Data API returned HTTP ${status}.`);
}

async function getYouTubeJson(url: URL, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
        : AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("YouTube Data API request failed.");
  }
  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    throw youtubeApiError(response.status, body);
  }
  return response.json() as Promise<unknown>;
}

function parseYouTubeDuration(value: string) {
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!match) return undefined;
  const [, days, hours, minutes, seconds] = match;
  return Number(days || 0) * 86_400
    + Number(hours || 0) * 3_600
    + Number(minutes || 0) * 60
    + Number(seconds || 0);
}

function decodeYouTubeText(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: "\"",
  };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|quot);/gi, (entity, code: string) => {
    if (!code.startsWith("#")) return namedEntities[code.toLowerCase()] ?? entity;
    const codePoint = code[1]?.toLowerCase() === "x"
      ? Number.parseInt(code.slice(2), 16)
      : Number.parseInt(code.slice(1), 10);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : entity;
  });
}

export async function searchYouTubeTracks(
  query: string,
  limit: number,
  signal?: AbortSignal,
): Promise<{ tracks: ProviderTrack[]; warning?: string }> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) throw new Error("YouTube Data API is not configured. Set YOUTUBE_API_KEY on the server.");

  const search = new URL("https://www.googleapis.com/youtube/v3/search");
  search.searchParams.set("part", "snippet");
  search.searchParams.set("type", "video");
  search.searchParams.set("videoCategoryId", "10");
  search.searchParams.set("order", "relevance");
  search.searchParams.set("maxResults", String(Math.min(limit, 25)));
  search.searchParams.set("q", query);
  search.searchParams.set("key", apiKey);
  const parsed = youtubeSearchResponseSchema.safeParse(await getYouTubeJson(search, signal));
  if (!parsed.success) throw new Error("YouTube Data API returned an invalid search response.");

  const items = parsed.data.items;
  if (!items.length) return { tracks: [] };

  const durations = new Map<string, number>();
  let warning: string | undefined;
  const details = new URL("https://www.googleapis.com/youtube/v3/videos");
  details.searchParams.set("part", "contentDetails");
  details.searchParams.set("id", items.map(item => item.id.videoId).join(","));
  details.searchParams.set("key", apiKey);
  try {
    const videoResponse = youtubeVideosResponseSchema.safeParse(await getYouTubeJson(details, signal));
    if (!videoResponse.success) throw new Error("YouTube Data API returned invalid duration metadata.");
    for (const item of videoResponse.data.items) {
      const duration = parseYouTubeDuration(item.contentDetails.duration);
      if (duration !== undefined) durations.set(item.id, duration);
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    warning = error instanceof Error ? error.message : "YouTube duration metadata could not be loaded.";
  }

  return {
    tracks: items.map(item => {
      const videoId = item.id.videoId;
      const artwork = item.snippet.thumbnails?.high?.url
        || item.snippet.thumbnails?.medium?.url
        || item.snippet.thumbnails?.default?.url;
      return {
        id: `youtube-music:${videoId}`,
        videoId,
        providerId: "youtube-music" as const,
        providerName: "YouTube Music",
        title: decodeYouTubeText(item.snippet.title),
        artist: decodeYouTubeText(item.snippet.channelTitle || "Unknown channel"),
        artwork,
        durationSeconds: durations.get(videoId),
        playback: { status: "unavailable" as const, reason: "YouTube provides video metadata, not audio for Echo's shared player. Searching authorized audio providers for a title and artist match is required." },
        kind: "song" as const,
      };
    }),
    ...(warning ? { warning } : {}),
  };
}

async function getAudiusJson(url: URL, signal?: AbortSignal): Promise<unknown> {
  const headers: Record<string, string> = { "User-Agent": "Echo-Music-Web/1.0" };
  const apiKey = process.env.AUDIUS_API_KEY?.trim();
  if (apiKey) headers["X-API-Key"] = apiKey;
  let response: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    response = await fetch(url, {
      headers,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
        : AbortSignal.timeout(10_000),
    });
    if (response.ok) return response.json() as Promise<unknown>;
    if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await new Promise(resolve => setTimeout(resolve, Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 1500)
        : 250));
      continue;
    }
    throw new Error(`Audius returned HTTP ${response.status}`);
  }
  throw new Error(`Audius returned HTTP ${response?.status ?? "unknown"}`);
}

export async function searchJamendoTracks(query: string, limit: number, offset: number, signal?: AbortSignal): Promise<ProviderTrack[]> {
  const clientId = process.env.JAMENDO_CLIENT_ID?.trim();
  if (!clientId) throw new Error("Jamendo is not configured. Set JAMENDO_CLIENT_ID on the server.");

  const search = async (field: "namesearch" | "artist_name" | "album_name") => {
    const url = new URL("https://api.jamendo.com/v3.0/tracks/");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(Math.min(limit, 50)));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set(field, query);
    url.searchParams.set("include", "licenses");
    url.searchParams.set("audioformat", "mp31");
    url.searchParams.set("imagesize", "300");
    url.searchParams.set("order", "relevance");

    let response: Response | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      response = await fetch(url, {
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
          : AbortSignal.timeout(10_000),
      });
      if (response.ok) break;
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
        const retryAfter = Number(response.headers.get("retry-after"));
        await new Promise(resolve => setTimeout(resolve, Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 1500)
          : 250));
        continue;
      }
      throw new Error(`Jamendo returned HTTP ${response.status}`);
    }
    if (!response?.ok) throw new Error(`Jamendo returned HTTP ${response?.status ?? "unknown"}`);
    const parsed = jamendoResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Jamendo returned an invalid track response.");
    if (parsed.data.headers?.status && parsed.data.headers.status !== "success") {
      const errorMessage = parsed.data.headers.error_message?.split(clientId).join("[redacted]");
      throw new Error(errorMessage || "Jamendo rejected the search request.");
    }
    return parsed.data.results;
  };

  const results = await Promise.all([
    search("namesearch"),
    search("artist_name"),
    search("album_name"),
  ]);
  const unique = new Map<string, z.infer<typeof jamendoTrackSchema>>();
  for (const track of results.flat()) unique.set(String(track.id), track);

  return [...unique.values()].map(item => {
    const audioUrl = item.audio;
    const audioHost = audioUrl ? new URL(audioUrl).hostname : "";
    const playable = Boolean(audioUrl && (audioHost === "jamendo.com" || audioHost.endsWith(".jamendo.com")));
    return {
      id: `jamendo:${item.id}`,
      providerId: "jamendo" as const,
      providerName: "Jamendo",
      title: item.name,
      artist: item.artist_name || "Unknown artist",
      album: item.album_name || undefined,
      artwork: item.image,
      audioUrl: playable ? audioUrl : undefined,
      sourceUrl: `https://www.jamendo.com/track/${encodeURIComponent(String(item.id))}`,
      licenseUrl: item.license_ccurl,
      attribution: `“${item.name}” by ${item.artist_name || "Unknown artist"} — Jamendo`,
      durationSeconds: item.duration ?? undefined,
      playback: playable
        ? { status: "available" as const, providerId: "jamendo" as const, licenseUrl: item.license_ccurl }
        : { status: "unavailable" as const, reason: "Jamendo did not provide an authorized streaming URL for this track." },
      kind: "song" as const,
    };
  });
}

export async function searchAudiusTracks(query: string, limit: number, offset: number, signal?: AbortSignal): Promise<ProviderTrack[]> {
  const url = new URL("https://api.audius.co/v1/tracks/search");
  url.searchParams.set("query", query);
  url.searchParams.set("app_name", "echo-music-web");
  url.searchParams.set("limit", String(Math.min(limit, 50)));
  url.searchParams.set("offset", String(offset));
  const parsed = audiusResponseSchema.safeParse(await getAudiusJson(url, signal));
  if (!parsed.success) throw new Error("Audius returned an invalid track response.");

  return parsed.data.data.flatMap(item => {
    if (item.stream_conditions != null || item.is_streamable === false) return [];
    const id = String(item.id);
    const stream = new URL(`/v1/tracks/${encodeURIComponent(id)}/stream`, "https://api.audius.co");
    stream.searchParams.set("app_name", "echo-music-web");
    const artwork = typeof item.artwork === "string"
      ? item.artwork
      : item.artwork?.["480x480"] || item.artwork?.["1000x1000"];
    const sourceUrl = item.permalink?.startsWith("/")
      ? `https://audius.co${item.permalink}`
      : undefined;
    return [{
      id: `audius:${id}`,
      providerId: "audius" as const,
      providerName: "Audius",
      title: item.title,
      artist: item.user?.name || "Unknown artist",
      artwork,
      audioUrl: stream.toString(),
      sourceUrl,
      attribution: `“${item.title}” by ${item.user?.name || "Unknown artist"} — Audius`,
      durationSeconds: item.duration ?? undefined,
      playback: { status: "available" as const, providerId: "audius" as const },
      kind: "song" as const,
    }];
  });
}

export function getProviderStatuses(): ProviderStatus[] {
  const jamendoConfigured = Boolean(process.env.JAMENDO_CLIENT_ID?.trim());
  const youtubeConfigured = Boolean(process.env.YOUTUBE_API_KEY?.trim());
  return [
    {
      id: "youtube-music",
      name: "YouTube Music",
      configured: youtubeConfigured,
      available: youtubeConfigured,
      searchAvailable: youtubeConfigured,
      playbackAvailable: false,
      credentialRequirement: "Required: set YOUTUBE_API_KEY on the API server. Never use a VITE_ variable.",
      ...(youtubeConfigured ? {
        reason: "Provider health checks do not make billable API calls; a search verifies API access.",
        capabilities: ["official YouTube Data API v3 music-category search", "video ID/title/channel/thumbnail/duration metadata"],
      } : {
        reason: "Set YOUTUBE_API_KEY on the API server to enable official YouTube Data API v3 search.",
        capabilities: [],
      }),
    },
    {
      id: "soundcloud",
      name: "SoundCloud",
      configured: false,
      available: false,
      searchAvailable: false,
      playbackAvailable: false,
      credentialRequirement: "Disabled for this product under SoundCloud API terms; do not configure credentials.",
      reason: "SoundCloud API terms prohibit an on-demand service that combines SoundCloud user content with content from other services.",
      capabilities: [],
    },
    {
      id: "spotify",
      name: "Spotify",
      configured: false,
      available: false,
      searchAvailable: false,
      playbackAvailable: false,
      credentialRequirement: "Disabled for this product under Spotify Developer Policy; credentials are not used.",
      reason: "Spotify Developer Policy prohibits a product or service integrated with streams or content from another service. Metadata is not playable audio.",
      capabilities: [],
    },
    {
      id: "jamendo",
      name: "Jamendo",
      configured: jamendoConfigured,
      available: jamendoConfigured,
      searchAvailable: jamendoConfigured,
      playbackAvailable: jamendoConfigured,
      credentialRequirement: "Required: set JAMENDO_CLIENT_ID on the API server.",
      ...(jamendoConfigured ? {} : { reason: "Set JAMENDO_CLIENT_ID on the API server to enable Jamendo's official read API." }),
      capabilities: jamendoConfigured ? ["title/artist/album track search", "metadata", "authorized stream URLs"] : [],
    },
    {
      id: "audius",
      name: "Audius",
      configured: true,
      available: true,
      searchAvailable: true,
      playbackAvailable: true,
      credentialRequirement: "Optional: AUDIUS_API_KEY; the public search and stream API is currently accessible without it.",
      capabilities: ["public track search", "metadata", "official track stream endpoint"],
    },
    {
      id: "internet-archive",
      name: "Internet Archive",
      configured: true,
      available: true,
      searchAvailable: true,
      playbackAvailable: true,
      credentialRequirement: "No credentials required.",
      capabilities: ["licensed track search", "metadata", "CC BY 4.0 full-track playback"],
    },
  ];
}
