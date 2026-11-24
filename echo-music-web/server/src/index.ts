import express from "express";
import { z } from "zod";
import {
  getProviderStatuses,
  searchAudiusTracks,
  searchJamendoTracks,
  searchYouTubeTracks,
  type ProviderHealth,
  type ProviderId,
  type ProviderTrack,
} from "./providers.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));

const CC_BY_4 = "https://creativecommons.org/licenses/by/4.0/";
const SEARCH_ROWS = 24;
const providerIdSchema = z.enum(["youtube-music", "soundcloud", "spotify", "jamendo", "audius", "internet-archive"]);
const searchCache = new Map<string, { expiresAt: number; response: SearchApiResponse }>();
const requestWindows = new Map<string, { startedAt: number; count: number }>();
const lastSuccessfulProviderChecks = new Map<ProviderId, string>();
type SearchApiResponse = {
  providers: ReturnType<typeof getProviderStatuses>;
  errors: Array<{ providerId: ProviderId; message: string }>;
  category: SearchCategory;
  results: ProviderTrack[];
  total: number;
  nextOffset: number | null;
};

app.use("/api/search", (req, res, next) => {
  const now = Date.now();
  const key = req.ip || "unknown";
  const window = requestWindows.get(key);
  const current = !window || now - window.startedAt >= 60_000
    ? { startedAt: now, count: 0 }
    : window;
  current.count++;
  requestWindows.set(key, current);
  if (current.count > 60) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Search rate limit exceeded. Try again shortly." });
  }
  next();
});
const searchSchema = z.object({
  q: z.string().trim().min(1).max(100),
  category: z.enum(["all", "songs", "artists", "albums", "playlists", "podcasts"]).default("songs"),
  limit: z.coerce.number().int().min(1).max(24).default(16),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  providers: z.string().max(200).optional().refine(
    value => value === undefined || value.split(",").every(id => providerIdSchema.safeParse(id).success),
    "Unsupported provider filter",
  ),
});

type SearchCategory = "all" | "songs" | "artists" | "albums" | "playlists" | "podcasts";
type ArchiveFile = {
  name: string;
  format?: string;
  length?: string;
  size?: string | number;
  title?: string;
  artist?: string;
  creator?: string;
  album?: string;
};
type ArchiveMetadata = {
  metadata?: {
    identifier?: string;
    title?: string;
    creator?: string | string[];
    artist?: string | string[];
    album?: string;
    licenseurl?: string;
    preferred_attribution?: string;
    attribution?: string;
    rights?: string;
    image?: string;
    subject?: string | string[];
    description?: string | string[];
    collection?: string | string[];
  };
  files?: ArchiveFile[];
};
type ArchiveDocument = {
  identifier: string;
  score?: number;
  collection?: string | string[];
};
const archiveFileSchema = z.object({
  name: z.string(),
  format: z.string().optional(),
  length: z.string().optional(),
  size: z.union([z.string(), z.number()]).optional(),
  title: z.string().optional(),
  artist: z.string().optional(),
  creator: z.string().optional(),
  album: z.string().optional(),
}).passthrough();
const archiveMetadataSchema = z.object({
  metadata: z.object({
    identifier: z.string().optional(),
    title: z.string().optional(),
    creator: z.union([z.string(), z.array(z.string())]).optional(),
    artist: z.union([z.string(), z.array(z.string())]).optional(),
    album: z.string().optional(),
    licenseurl: z.string().optional(),
    preferred_attribution: z.string().optional(),
    attribution: z.string().optional(),
    rights: z.string().optional(),
    image: z.string().optional(),
    subject: z.union([z.string(), z.array(z.string())]).optional(),
    description: z.union([z.string(), z.array(z.string())]).optional(),
    collection: z.union([z.string(), z.array(z.string())]).optional(),
  }).passthrough().optional(),
  files: z.array(archiveFileSchema).optional(),
}).passthrough();
const archiveSearchSchema = z.object({
  response: z.object({
    numFound: z.number().optional(),
    docs: z.array(z.object({
      identifier: z.string(),
      score: z.coerce.number().optional(),
      collection: z.union([z.string(), z.array(z.string())]).optional(),
    }).passthrough()).optional(),
  }).passthrough().optional(),
}).passthrough();
type LicensedTrack = {
  id: string;
  providerId: "internet-archive";
  providerName: "Internet Archive";
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  audioUrl: string;
  durationSeconds: number;
  sourceUrl: string;
  licenseUrl: string;
  attribution: string;
  playback: { status: "available"; providerId: "internet-archive"; licenseUrl: string };
  kind: "song" | "podcast";
  providerScore?: number;
};

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": "Echo-Music-Web/1.0 (licensed music search)" },
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12_000)]) : AbortSignal.timeout(12_000),
    });
    if (response.ok) return response.json() as Promise<unknown>;
    if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await new Promise(resolve => setTimeout(resolve, Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 1500)
        : 250));
      continue;
    }
    throw new Error(`Upstream returned ${response.status}`);
  }
  throw new Error("Upstream retry failed");
}

export function normalizeSearchText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();
}

function escapeLucenePhrase(value: string) {
  return value.replace(/[+\-&|!(){}\[\]^"~*?:\\/]/g, "\\$&");
}

export function buildArchiveQuery(query: string, category: SearchCategory) {
  const normalized = normalizeSearchText(query);
  const phrase = escapeLucenePhrase(normalized);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const fuzzyTerms = tokens
    .filter(token => [...token].length > 3)
    .map(token => `${escapeLucenePhrase(token)}~1`);
  const collection = category === "podcasts" ? "collection:podcasts" : "-collection:podcasts";
  const fields = category === "artists"
    ? ["title", "creator"]
    : category === "albums"
      ? ["album", "title"]
      : ["title", "creator", "album"];
  const phraseSearch = fields.map(field => `${field}:"${phrase}"`).join(" OR ");
  const fuzzySearch = fuzzyTerms.length
    ? ` OR (${fields.map(field => `${field}:(${fuzzyTerms.join(" AND ")})`).join(" OR ")})`
    : "";
  return `mediatype:audio AND ${collection} AND licenseurl:"${CC_BY_4}" AND (${phraseSearch}${fuzzySearch})`;
}

export function parseDuration(value?: string) {
  if (!value) return 0;
  const parts = value.split(":").map(Number);
  if (parts.some(part => !Number.isFinite(part) || part < 0)) return 0;
  return Math.round(parts.reduce((seconds, part) => seconds * 60 + part, 0));
}

function creatorName(creator?: string | string[]) {
  return Array.isArray(creator) ? creator.join(", ") : creator || "Unknown artist";
}

function firstValue(...values: Array<string | string[] | undefined>) {
  for (const value of values) {
    const text = Array.isArray(value) ? value.join(", ") : value;
    if (text?.trim()) return text.trim();
  }
  return undefined;
}

function displayFileTitle(file: ArchiveFile) {
  return file.name
    .replace(/\.(mp3|m4a|ogg|opus)$/i, "")
    .replace(/[+_]+/g, " ")
    .replace(/ train-\d+-of-\d+-\d+$/i, "")
    .trim();
}

function isPodcastRecord(metadata: NonNullable<ArchiveMetadata["metadata"]>, files: ArchiveFile[], collections: string[]) {
  const text = normalizeSearchText([
    metadata.title || "",
    metadata.creator ? creatorName(metadata.creator) : "",
    Array.isArray(metadata.description) ? metadata.description.join(" ") : metadata.description || "",
    ...collections,
    ...(Array.isArray(metadata.collection) ? metadata.collection : [metadata.collection || ""]),
    ...(Array.isArray(metadata.subject) ? metadata.subject : [metadata.subject || ""]),
    ...files.map(file => file.title || file.name),
  ].join(" "));
  return collections.some(value => /podcast/i.test(value))
    || /\b(?:podcast|podcasts|episode|episodes)\b/.test(text);
}

function editDistanceAtMostOne(left: string, right: string) {
  if (Math.abs([...left].length - [...right].length) > 1) return false;
  const a = [...left];
  const b = [...right];
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else {
      edits++;
      if (edits > 1) return false;
      if (a.length > b.length) i++;
      else if (b.length > a.length) j++;
      else {
        i++;
        j++;
      }
    }
  }
  if (i < a.length || j < b.length) edits++;
  return edits <= 1;
}

function tokenSimilarity(query: string, text: string) {
  const queryTokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  const textTokens = normalizeSearchText(text).split(/\s+/).filter(Boolean);
  if (!queryTokens.length || !textTokens.length) return 0;
  const usedCandidates = new Set<number>();
  let matches = 0;
  for (const token of queryTokens) {
    const candidateIndex = textTokens.findIndex((candidate, index) => !usedCandidates.has(index) && (
      candidate === token || (
        [...token].length >= 3
        && [...candidate].length >= 3
        && editDistanceAtMostOne(token, candidate)
      )
    ));
    if (candidateIndex >= 0) {
      usedCandidates.add(candidateIndex);
      matches++;
    }
  }
  return matches / queryTokens.length;
}

function scoreResult(query: string, result: { title: string; artist: string; album?: string; providerScore?: number }) {
  const normalizedQuery = normalizeSearchText(query);
  const title = normalizeSearchText(result.title);
  const artist = normalizeSearchText(result.artist);
  const album = normalizeSearchText(result.album || "");
  const combined = `${title} ${artist}`.trim();
  const coverage = Math.max(
    tokenSimilarity(query, result.title),
    tokenSimilarity(query, result.artist),
    tokenSimilarity(query, combined),
    tokenSimilarity(query, result.album || ""),
  );
  let score = 0;
  if (title === normalizedQuery) score = 1000;
  else if (artist === normalizedQuery) score = 900;
  else if (title.includes(normalizedQuery)) score = 800;
  else if (artist.includes(normalizedQuery)) score = 700;
  else if (coverage === 1 && combined.includes(normalizedQuery)) score = 600;
  else if (album && album.includes(normalizedQuery)) score = 400;
  else if (coverage === 1) score = 250;
  else if (coverage > 0) score = 150 * coverage;
  const providerScore = Number.isFinite(result.providerScore) ? Math.max(0, result.providerScore || 0) : 0;
  return score + Math.min(50, Math.log1p(providerScore) * 5);
}

export function rankSearchResults<T extends { title: string; artist: string; album?: string; providerScore?: number }>(query: string, results: T[]) {
  return results
    .map((result, index) => ({ result, index, score: scoreResult(query, result) }))
    .filter(entry => entry.score >= 150)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(entry => entry.result);
}

function mergeProviderResults(query: string, tracks: ProviderTrack[]) {
  const merged: ProviderTrack[] = [];
  for (const track of rankSearchResults(query, tracks)) {
    const duplicate = merged.findIndex(candidate =>
      normalizeSearchText(candidate.title) === normalizeSearchText(track.title)
      && normalizeSearchText(candidate.artist) === normalizeSearchText(track.artist)
      && (!candidate.album || !track.album || normalizeSearchText(candidate.album) === normalizeSearchText(track.album))
      && (candidate.durationSeconds === undefined
        || track.durationSeconds === undefined
        || Math.abs(candidate.durationSeconds - track.durationSeconds) <= 3),
    );
    if (duplicate < 0) {
      merged.push({
        ...track,
        sources: [{ providerId: track.providerId, providerName: track.providerName }],
      });
      continue;
    }

    const current = merged[duplicate];
    const sources = [...(current.sources || []), { providerId: track.providerId, providerName: track.providerName }]
      .filter((source, index, all) => all.findIndex(item => item.providerId === source.providerId) === index);
    const preferred = current.playback.status !== "available" && track.playback.status === "available" ? track : current;
    merged[duplicate] = {
      ...preferred,
      externalUrl: current.externalUrl ?? track.externalUrl,
      sources,
    };
  }
  return merged;
}

function encodeFilePath(value: string) {
  return value.split("/").map(encodeURIComponent).join("/");
}

async function findLicensedTracks(query: string, limit: number, offset: number, category: SearchCategory, signal?: AbortSignal) {
  const search = new URL("https://archive.org/advancedsearch.php");
  search.searchParams.set("q", buildArchiveQuery(query, category));
  for (const field of ["identifier", "score", "collection"]) search.searchParams.append("fl[]", field);
  search.searchParams.append("rows", String(SEARCH_ROWS));
  search.searchParams.append("start", String(offset));
  search.searchParams.append("output", "json");

  const catalog = archiveSearchSchema.parse(await getJson(search.toString(), signal));
  const documents = catalog.response?.docs ?? [];
  const records = await Promise.all(documents.map(async document => ({
    document,
    record: archiveMetadataSchema.parse(await getJson(
      `https://archive.org/metadata/${encodeURIComponent(document.identifier)}`,
      signal,
    )),
  })));

  const tracks: LicensedTrack[] = records.flatMap(({ document, record }) => {
    const metadata = record.metadata;
    if (!metadata?.identifier || metadata.licenseurl !== CC_BY_4) return [];
    const identifier = metadata.identifier;
    const collections = [
      ...(Array.isArray(document.collection) ? document.collection : [document.collection]),
      ...(Array.isArray(metadata.collection) ? metadata.collection : [metadata.collection]),
    ].filter((value): value is string => Boolean(value));
    const audioFiles = (record.files ?? [])
      .filter(file =>
        /\.(mp3|m4a|ogg|opus)$/i.test(file.name)
        && parseDuration(file.length) >= 60
        && Number(file.size || 0) > 100_000,
      )
      .sort((a, b) => Number(!/\.mp3$/i.test(a.name)) - Number(!/\.mp3$/i.test(b.name)));
    if (category === "podcasts" ? !isPodcastRecord(metadata, audioFiles, collections) : isPodcastRecord(metadata, audioFiles, collections)) {
      return [];
    }

    return audioFiles.flatMap(file => {
      const multiTrackRecord = audioFiles.length > 1;
      const title = firstValue(
        file.title,
        multiTrackRecord ? undefined : metadata.title,
        displayFileTitle(file),
      );
      if (!title) return [];
      const artist = firstValue(
        file.artist,
        file.creator,
        metadata.artist,
        !multiTrackRecord ? metadata.creator : undefined,
      ) || "Unknown artist";
      const album = firstValue(file.album, metadata.album);
      const attribution = metadata.preferred_attribution || metadata.attribution || metadata.rights
        || `“${title}” by ${artist}, licensed under CC BY 4.0`;
      const artworkPath = metadata.image;
      const artwork = artworkPath?.startsWith("http")
        ? artworkPath
        : artworkPath
          ? `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeFilePath(artworkPath)}`
          : undefined;
      return {
        id: `${identifier}/${file.name}`,
        providerId: "internet-archive" as const,
        providerName: "Internet Archive" as const,
        title,
        artist,
        album,
        audioUrl: `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeFilePath(file.name)}`,
        artwork,
        durationSeconds: parseDuration(file.length),
        sourceUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`,
        licenseUrl: CC_BY_4,
        attribution,
        playback: { status: "available", providerId: "internet-archive", licenseUrl: CC_BY_4 },
        kind: category === "podcasts" ? "podcast" as const : "song" as const,
        providerScore: document.score,
      };
    });
  });
  const rankedTracks = rankSearchResults(query, tracks);
  const numFound = catalog.response?.numFound ?? documents.length;
  return {
    results: rankedTracks.slice(0, limit),
    total: numFound,
    nextOffset: offset + SEARCH_ROWS < numFound ? offset + SEARCH_ROWS : null,
  };
}

export function buildEntityResults(category: "artists" | "albums", tracks: LicensedTrack[], limit: number, query: string) {
  const entities = new Map<string, LicensedTrack>();
  for (const track of tracks) {
    const name = category === "artists" ? track.artist : track.album;
    if (!name || name === "Unknown artist") continue;
    if (category === "artists" && normalizeSearchText(name) !== normalizeSearchText(query)) continue;
    const key = normalizeSearchText(name);
    if (!entities.has(key)) entities.set(key, track);
  }
  return [...entities.values()].map(track => {
    const name = category === "artists" ? track.artist : track.album!;
    return {
      id: `${category}:${normalizeSearchText(name)}`,
      providerId: track.providerId,
      providerName: track.providerName,
      title: name,
      artist: track.artist,
      album: category === "albums" ? name : undefined,
      artwork: track.artwork,
      sourceUrl: track.sourceUrl,
      playback: { status: "unavailable" as const, reason: "Select an authorized recording to play this artist or album." },
      kind: category === "artists" ? "artist" as const : "album" as const,
      providerScore: track.providerScore,
    };
  }).slice(0, limit);
}

app.get("/api/search", async (req, res) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Enter a search term and a supported result category" });
  const cancellation = new AbortController();
  req.on("aborted", () => cancellation.abort());
  res.on("close", () => {
    if (!res.writableEnded) cancellation.abort();
  });
  try {
    const { category, limit, offset, q } = parsed.data;
    const selectedProviders = parsed.data.providers?.split(",").filter(Boolean);
    const cacheKey = JSON.stringify([normalizeSearchText(q), category, limit, offset, selectedProviders?.sort()]);
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return res.json(cached.response);

    const providers = getProviderStatuses();
    const requestedCategory = category === "all" ? "songs" : category;
    const archiveSelected = !selectedProviders || selectedProviders.includes("internet-archive");
    const jamendoSelected = !selectedProviders || selectedProviders.includes("jamendo");
    const audiusSelected = !selectedProviders || selectedProviders.includes("audius");
    const youtubeSelected = !selectedProviders || selectedProviders.includes("youtube-music");
    const errors: SearchApiResponse["errors"] = [];
    let archive: Awaited<ReturnType<typeof findLicensedTracks>> | undefined;
    let jamendo: ProviderTrack[] = [];
    let audius: ProviderTrack[] = [];
    let youtube: ProviderTrack[] = [];

    const searches: Array<Promise<void>> = [];
    if (requestedCategory !== "playlists" && archiveSelected) {
      searches.push(findLicensedTracks(
        q,
        requestedCategory === "artists" || requestedCategory === "albums" ? SEARCH_ROWS : limit,
        offset,
        requestedCategory as SearchCategory,
        cancellation.signal,
      ).then(result => { archive = result; }).catch(error => {
        if (cancellation.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Internet Archive search failed.";
        console.error(JSON.stringify({ level: "error", providerId: "internet-archive", message }));
        errors.push({ providerId: "internet-archive", message });
      }));
    }
    if ((requestedCategory === "songs") && jamendoSelected && process.env.JAMENDO_CLIENT_ID?.trim()) {
      searches.push(searchJamendoTracks(q, limit, offset, cancellation.signal).then(result => { jamendo = result; }).catch(error => {
        if (cancellation.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Jamendo search failed.";
        console.error(JSON.stringify({ level: "error", providerId: "jamendo", message }));
        errors.push({ providerId: "jamendo", message });
      }));
    }
    if (requestedCategory === "songs" && audiusSelected) {
      searches.push(searchAudiusTracks(q, limit, offset, cancellation.signal).then(result => { audius = result; }).catch(error => {
        if (cancellation.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Audius search failed.";
        console.error(JSON.stringify({ level: "error", providerId: "audius", message }));
        errors.push({ providerId: "audius", message });
      }));
    }
    if (requestedCategory === "songs" && offset === 0 && youtubeSelected && process.env.YOUTUBE_API_KEY?.trim()) {
      searches.push(searchYouTubeTracks(q, limit, cancellation.signal).then(result => {
        youtube = result.tracks;
        lastSuccessfulProviderChecks.set("youtube-music", new Date().toISOString());
        if (result.warning) {
          console.warn(JSON.stringify({ level: "warning", providerId: "youtube-music", message: result.warning }));
          errors.push({ providerId: "youtube-music", message: result.warning });
        }
      }).catch(error => {
        if (cancellation.signal.aborted) return;
        const message = error instanceof Error ? error.message : "YouTube Data API search failed.";
        console.error(JSON.stringify({ level: "error", providerId: "youtube-music", message }));
        errors.push({ providerId: "youtube-music", message });
      }));
    }

    await Promise.all(searches);
    let archiveResults: ProviderTrack[] = archive?.results ?? [];
    if (archive && (requestedCategory === "artists" || requestedCategory === "albums")) {
      archiveResults = buildEntityResults(requestedCategory, archive.results, limit, q);
    }
    const results = mergeProviderResults(q, [...archiveResults, ...jamendo, ...audius, ...youtube]).slice(0, limit);
    const response: SearchApiResponse = {
      providers,
      errors,
      category,
      results,
      total: Math.max(archive?.total ?? 0, results.length),
      nextOffset: archive?.nextOffset ?? (jamendo.length === limit ? offset + limit : null),
    };
    if (errors.length && searches.length === errors.length && !results.length) {
      return res.status(502).json({
        error: `All configured search providers failed: ${errors.map(error => `${error.providerId}: ${error.message}`).join("; ")}`,
        providers,
        errors,
      });
    }
    for (const [key, value] of searchCache) {
      if (value.expiresAt <= Date.now()) searchCache.delete(key);
    }
    if (searchCache.size >= 300) searchCache.delete(searchCache.keys().next().value!);
    searchCache.set(cacheKey, { expiresAt: Date.now() + 30_000, response });
    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected search failure.";
    console.error(JSON.stringify({ level: "error", route: "/api/search", message }));
    return res.status(502).json({
      error: `Search failed: ${message}`,
    });
  }
});

app.get("/api/providers", (_req, res) => res.json({ providers: getProviderStatuses() }));

app.get("/api/providers/health", async (_req, res) => {
  const checkedAt = new Date().toISOString();
  const providers: ProviderHealth[] = await Promise.all(getProviderStatuses().map(async provider => {
    const lastSuccessfulCheck = lastSuccessfulProviderChecks.get(provider.id);
    if (!provider.available) {
      return { ...provider, status: "disabled", checkedAt, lastSuccessfulCheck };
    }
    if (provider.id === "youtube-music") {
      return { ...provider, status: "healthy", checkedAt, lastSuccessfulCheck };
    }
    try {
      if (provider.id === "internet-archive") {
        const url = new URL("https://archive.org/advancedsearch.php");
        url.searchParams.set("q", "mediatype:audio");
        url.searchParams.set("rows", "1");
        url.searchParams.set("output", "json");
        archiveSearchSchema.parse(await getJson(url.toString()));
      } else if (provider.id === "jamendo") {
        await searchJamendoTracks("Echo Music health check", 1, 0);
      } else if (provider.id === "audius") {
        await searchAudiusTracks("Echo Music health check", 1, 0);
      }
      lastSuccessfulProviderChecks.set(provider.id, checkedAt);
      return { ...provider, status: "healthy", checkedAt, lastSuccessfulCheck: checkedAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider health request failed.";
      console.error(JSON.stringify({ level: "error", providerId: provider.id, operation: "health", message }));
      return {
        ...provider,
        status: "unavailable",
        searchAvailable: false,
        checkedAt,
        lastSuccessfulCheck,
        error: message,
        reason: message,
      };
    }
  }));
  res.json({ checkedAt, providers });
});

app.get("/api/lyrics", async (req, res) => {
  const parsed = z.object({
    artist_name: z.string().trim().min(1).max(200),
    track_name: z.string().trim().min(1).max(200),
    album_name: z.string().trim().max(200).optional(),
    duration: z.coerce.number().int().min(1).max(3600).optional(),
  }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Artist and track are required" });
  try {
    const params = new URLSearchParams();
    params.set("artist_name", parsed.data.artist_name);
    params.set("track_name", parsed.data.track_name);
    if (parsed.data.album_name) params.set("album_name", parsed.data.album_name);
    if (parsed.data.duration) params.set("duration", String(parsed.data.duration));
    const response = await fetch(`https://lrclib.net/api/get?${params}`, {
      headers: { "User-Agent": "Echo-Music-Web/1.0" },
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status === 404) return res.json({ found: false });
    if (!response.ok) throw new Error(`Lyrics returned ${response.status}`);
    res.json({ found: true, ...(await response.json()) });
  } catch {
    res.status(502).json({ error: "Lyrics service is temporarily unavailable" });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const portValue = process.env.PORT?.trim() || "8787";
const port = Number(portValue);
if (process.env.NODE_ENV !== "test") {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid PORT value "${portValue}". Expected an integer from 1 to 65535.`);
  }
  const host = "0.0.0.0";
  const server = app.listen(port, host, () => {
    console.log(`Echo Music API listening at http://${host}:${port}`);
    console.log("Registered API routes: GET /api/health, GET /api/providers, GET /api/providers/health, GET /api/search, GET /api/lyrics");
  });
  server.on("error", error => {
    console.error(`Echo Music API failed to listen at ${host}:${port}:`, error);
    process.exitCode = 1;
  });
}

export { app };
