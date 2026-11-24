import { restoreLocalAudio } from "./localAudio";
import type { AudioProviderId, Track } from "./types";

const CC_BY_4 = "https://creativecommons.org/licenses/by/4.0/";

export type ResolvedAudioSource = {
  providerId: AudioProviderId;
  url: string;
};

type AudioProvider = {
  id: AudioProviderId;
  canPlay(track: Track): boolean;
  resolve(track: Track): Promise<string>;
};

const internetArchiveProvider: AudioProvider = {
  id: "internet-archive",
  canPlay: track => {
    if (track.playback?.status !== "available" || track.playback.providerId !== "internet-archive") return false;
    if (track.licenseUrl !== CC_BY_4 || track.playback.licenseUrl !== CC_BY_4 || !track.audioUrl) return false;
    try {
      const url = new URL(track.audioUrl);
      return url.protocol === "https:"
        && (url.hostname === "archive.org" || url.hostname.endsWith(".archive.org"));
    } catch {
      return false;
    }
  },
  resolve: async track => {
    if (!track.audioUrl) throw new Error("The authorized provider did not supply an audio URL.");
    return track.audioUrl;
  },
};

const localFileProvider: AudioProvider = {
  id: "local-file",
  canPlay: track => track.playback?.status === "available" && track.playback.providerId === "local-file",
  resolve: async track => {
    if (track.audioUrl?.startsWith("blob:")) return track.audioUrl;
    return restoreLocalAudio(track.id);
  },
};

const jamendoProvider: AudioProvider = {
  id: "jamendo",
  canPlay: track => {
    if (track.playback?.status !== "available" || track.playback.providerId !== "jamendo" || !track.audioUrl) return false;
    try {
      const url = new URL(track.audioUrl);
      return url.protocol === "https:" && (url.hostname === "jamendo.com" || url.hostname.endsWith(".jamendo.com"));
    } catch {
      return false;
    }
  },
  resolve: async track => {
    if (!track.audioUrl) throw new Error("Jamendo did not supply an authorized stream URL.");
    return track.audioUrl;
  },
};

const audiusProvider: AudioProvider = {
  id: "audius",
  canPlay: track => {
    if (track.playback?.status !== "available" || track.playback.providerId !== "audius" || !track.audioUrl) return false;
    try {
      const url = new URL(track.audioUrl);
      return url.protocol === "https:"
        && url.hostname === "api.audius.co"
        && /^\/v1\/tracks\/[^/]+\/stream$/.test(url.pathname)
        && url.searchParams.get("app_name") === "echo-music-web";
    } catch {
      return false;
    }
  },
  resolve: async track => {
    if (!track.audioUrl) throw new Error("Audius did not supply its official track stream endpoint.");
    return track.audioUrl;
  },
};

const providers: AudioProvider[] = [internetArchiveProvider, jamendoProvider, audiusProvider, localFileProvider];

export function getAudioProvider(track: Track) {
  const availability = track.playback;
  if (availability?.status !== "available") return undefined;
  return providers.find(provider => provider.id === availability.providerId && provider.canPlay(track));
}

export function getPlaybackProvider(track: Track) {
  if (track.playback?.status !== "available") return undefined;
  return getAudioProvider(track)?.id;
}

export async function resolveAudioSource(track: Track): Promise<ResolvedAudioSource> {
  if (track.playback?.status !== "available") {
    throw new Error(track.playback?.status === "unavailable"
      ? track.playback.reason
      : "This result has no authorized in-app playback source.");
  }
  const provider = getAudioProvider(track);
  if (!provider) throw new Error("No authorized playback provider is available for this track.");
  return { providerId: provider.id, url: await provider.resolve(track) };
}
