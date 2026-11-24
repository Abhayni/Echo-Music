export type Track = {
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
  durationSeconds?: number;
  sourceUrl?: string;
  externalUrl?: string;
  licenseUrl?: string;
  attribution?: string;
  playback?: PlaybackAvailability;
  matchedYouTube?: {
    videoId: string;
    title: string;
    artist: string;
    artwork?: string;
    durationSeconds?: number;
  };
  kind: "song" | "album" | "artist" | "playlist" | "podcast";
};

export type ProviderId = "youtube-music" | "soundcloud" | "spotify" | "jamendo" | "audius" | "internet-archive" | "local-file";
export type AudioProviderId = "internet-archive" | "local-file" | "jamendo" | "audius";

export type PlaybackAvailability =
  | { status: "available"; providerId: AudioProviderId; licenseUrl?: string }
  | { status: "embedded"; providerId: "youtube-music"; videoId: string }
  | { status: "preview"; providerId: AudioProviderId; reason: string }
  | { status: "external"; providerId: ProviderId; reason: string; url: string }
  | { status: "unavailable"; reason: string };

export type SearchCategory = "all" | "songs" | "artists" | "albums" | "playlists" | "podcasts";

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

export type SearchResponse = {
  providers: ProviderStatus[];
  errors: Array<{ providerId: ProviderId; message: string }>;
  category: SearchCategory;
  results: Track[];
  total: number;
  nextOffset: number | null;
};

export type LyricsResponse = {
  found: boolean;
  syncedLyrics?: string;
  plainLyrics?: string;
};
