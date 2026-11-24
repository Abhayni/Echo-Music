import { describe, expect, it } from "vitest";
import { findYouTubeAudioMatch, youtubeAudioSearchQuery } from "./youtubeMatching";
import type { Track } from "./types";

const youtubeTrack: Track = {
  id: "youtube-music:video-123",
  videoId: "video-123",
  providerId: "youtube-music",
  providerName: "YouTube Music",
  title: "Tum Hi Ho",
  artist: "Arijit Singh",
  artwork: "https://i.ytimg.com/vi/video-123/hqdefault.jpg",
  durationSeconds: 262,
  playback: { status: "unavailable", reason: "Video metadata is not an audio stream." },
  kind: "song",
};

const audiusTrack: Track = {
  id: "audius:track-1",
  providerId: "audius",
  providerName: "Audius",
  title: "Tum Hi Ho",
  artist: "Arijit Singh",
  audioUrl: "https://api.audius.co/v1/tracks/track-1/stream?app_name=echo-music-web",
  playback: { status: "available", providerId: "audius" },
  kind: "song",
};

describe("YouTube authorized-audio matching", () => {
  it("preserves YouTube metadata separately from an exact, playable title and artist match", () => {
    expect(findYouTubeAudioMatch(youtubeTrack, [audiusTrack])).toMatchObject({
      id: audiusTrack.id,
      providerId: "audius",
      title: "Tum Hi Ho",
      artist: "Arijit Singh",
      matchedYouTube: {
        videoId: "video-123",
        title: "Tum Hi Ho",
        artist: "Arijit Singh",
        artwork: youtubeTrack.artwork,
        durationSeconds: 262,
      },
    });
  });

  it("does not match by title alone or accept unavailable audio", () => {
    expect(findYouTubeAudioMatch(youtubeTrack, [
      { ...audiusTrack, artist: "Different Artist" },
      { ...audiusTrack, playback: { status: "unavailable", reason: "No authorized audio." } },
    ])).toBeUndefined();
  });

  it("normalizes YouTube Topic-channel artist suffixes without changing retained metadata", () => {
    const topicTrack = { ...youtubeTrack, artist: "Arijit Singh - Topic" };
    const match = findYouTubeAudioMatch(topicTrack, [audiusTrack]);
    expect(youtubeAudioSearchQuery(topicTrack)).toBe("Tum Hi Ho");
    expect(match?.matchedYouTube?.artist).toBe("Arijit Singh - Topic");
    expect(match?.artist).toBe("Arijit Singh");
  });

  it("never treats YouTube metadata as an audio provider", () => {
    expect(findYouTubeAudioMatch(youtubeTrack, [{
      ...youtubeTrack,
      playback: { status: "embedded", providerId: "youtube-music", videoId: "video-123" },
    }])).toBeUndefined();
  });
});
