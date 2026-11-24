import type { ProviderHealth, ProviderId, SearchCategory, SearchResponse, Track } from "./types";

const API = import.meta.env.VITE_API_URL || "";

export async function searchMusic(q: string, category: SearchCategory, offset = 0, signal?: AbortSignal, providers?: ProviderId[]) {
  const params = new URLSearchParams({ q, category, limit: "24", offset: String(offset) });
  if (providers?.length) params.set("providers", providers.join(","));
  const response = await fetch(`${API}/api/search?${params}`, { signal });
  if (!response.ok) {
    const body = await response.text();
    let message: string | undefined;
    try {
      const error: unknown = JSON.parse(body);
      if (typeof error === "object" && error !== null && "error" in error && typeof error.error === "string") {
        message = error.error;
      }
    } catch {
      message = undefined;
    }
    throw new Error(message || `Search failed (HTTP ${response.status})`);
  }
  return response.json() as Promise<SearchResponse>;
}

export async function getProviderHealth(signal?: AbortSignal) {
  const response = await fetch(`${API}/api/providers/health`, { signal });
  if (!response.ok) throw new Error(`Provider health failed (HTTP ${response.status})`);
  const data = await response.json() as { providers: ProviderHealth[] };
  return data.providers;
}

export async function getLyrics(track: Track) {
  const params = new URLSearchParams({ artist_name: track.artist, track_name: track.title });
  if (track.album) params.set("album_name", track.album);
  if (track.durationSeconds) params.set("duration", String(track.durationSeconds));
  const response = await fetch(`${API}/api/lyrics?${params}`);
  if (!response.ok) throw new Error((await response.json()).error || "Lyrics failed");
  return response.json();
}
