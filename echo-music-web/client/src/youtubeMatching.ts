import { getPlaybackProvider } from "./playbackProviders";
import type { Track } from "./types";

const authorizedAudioProviders = new Set(["audius", "jamendo", "internet-archive"]);

function normalizeMetadata(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();
}

function matchingArtist(value: string) {
  return normalizeMetadata(value.replace(/\s*-\s*topic$/i, ""));
}

export function youtubeAudioSearchQuery(track: Track) {
  return track.title.trim().slice(0, 100);
}

export function findYouTubeAudioMatch(youtubeTrack: Track, candidates: Track[]): Track | undefined {
  if (youtubeTrack.providerId !== "youtube-music" || !youtubeTrack.videoId) return undefined;
  const title = normalizeMetadata(youtubeTrack.title);
  const artist = matchingArtist(youtubeTrack.artist);
  if (!title || !artist || artist === "unknown channel" || artist === "unknown artist") return undefined;

  const match = candidates.find(candidate =>
    candidate.kind === "song"
    && candidate.title
    && candidate.artist
    && normalizeMetadata(candidate.title) === title
    && normalizeMetadata(candidate.artist) === artist
    && authorizedAudioProviders.has(candidate.providerId)
    && getPlaybackProvider(candidate),
  );
  if (!match) return undefined;

  return {
    ...match,
    matchedYouTube: {
      videoId: youtubeTrack.videoId,
      title: youtubeTrack.title,
      artist: youtubeTrack.artist,
      artwork: youtubeTrack.artwork,
      durationSeconds: youtubeTrack.durationSeconds,
    },
  };
}
