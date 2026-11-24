import { describe, expect, it } from "vitest";
import { getAudioProvider, getPlaybackProvider, resolveAudioSource } from "./playbackProviders";
import type { Track } from "./types";

const archiveTrack: Track = {
  id: "archive/track.mp3",
  providerId: "internet-archive",
  providerName: "Internet Archive",
  title: "Licensed track",
  artist: "Artist",
  audioUrl: "https://archive.org/download/archive/track.mp3",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  playback: {
    status: "available",
    providerId: "internet-archive",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  },
  kind: "song",
};

describe("authorized audio providers", () => {
  it("resolves only an HTTPS Internet Archive source with an explicit CC BY 4.0 license", async () => {
    await expect(resolveAudioSource(archiveTrack)).resolves.toEqual({
      providerId: "internet-archive",
      url: "https://archive.org/download/archive/track.mp3",
    });
    expect(getAudioProvider({
      ...archiveTrack,
      audioUrl: "https://youtube.com/watch?v=video",
    })).toBeUndefined();
    expect(getAudioProvider({
      ...archiveTrack,
      licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    })).toBeUndefined();
  });

  it("refuses metadata-only results even if they contain a URL", async () => {
    const metadataOnly: Track = {
      id: "spotify:metadata-only",
      providerId: "spotify",
      providerName: "Spotify",
      title: "Metadata only",
      artist: "Artist",
      playback: { status: "unavailable", reason: "Metadata does not authorize audio playback." },
      kind: "song",
    };

    expect(getAudioProvider(metadataOnly)).toBeUndefined();
    expect(getPlaybackProvider(metadataOnly)).toBeUndefined();
    await expect(resolveAudioSource(metadataOnly)).rejects.toThrow("Metadata does not authorize audio playback");
  });

  it("resolves only official Jamendo stream URLs", async () => {
    const jamendoTrack: Track = {
      id: "jamendo:track",
      providerId: "jamendo",
      providerName: "Jamendo",
      title: "Independent track",
      artist: "Artist",
      audioUrl: "https://prod-1.storage.jamendo.com/?trackid=123",
      playback: { status: "available", providerId: "jamendo" },
      kind: "song",
    };
    await expect(resolveAudioSource(jamendoTrack)).resolves.toMatchObject({
      providerId: "jamendo",
      url: "https://prod-1.storage.jamendo.com/?trackid=123",
    });
    expect(getAudioProvider({ ...jamendoTrack, audioUrl: "https://attacker.example/audio.mp3" })).toBeUndefined();
  });

  it("uses only the official Audius track-stream endpoint", async () => {
    const audiusTrack: Track = {
      id: "audius:track-id",
      providerId: "audius",
      providerName: "Audius",
      title: "Public track",
      artist: "Uploader",
      audioUrl: "https://api.audius.co/v1/tracks/track-id/stream?app_name=echo-music-web",
      playback: { status: "available", providerId: "audius" },
      kind: "song",
    };
    await expect(resolveAudioSource(audiusTrack)).resolves.toMatchObject({
      providerId: "audius",
      url: "https://api.audius.co/v1/tracks/track-id/stream?app_name=echo-music-web",
    });
    expect(getAudioProvider({
      ...audiusTrack,
      audioUrl: "https://validator.audius.co/content/audio.mp3",
    })).toBeUndefined();
    expect(getAudioProvider({
      ...audiusTrack,
      audioUrl: "https://api.audius.co/v1/tracks/track-id/stream",
    })).toBeUndefined();
  });

  it("uses a user's local file as an authorized playback source", async () => {
    const localTrack: Track = {
      id: "local:file-id",
      providerId: "local-file",
      providerName: "Local file",
      title: "Local track",
      artist: "Local audio",
      audioUrl: "blob:http://localhost/local-file-id",
      playback: { status: "available", providerId: "local-file" },
      kind: "song",
    };
    await expect(resolveAudioSource(localTrack)).resolves.toEqual({
      providerId: "local-file",
      url: "blob:http://localhost/local-file-id",
    });
  });

  it("never treats YouTube video metadata as an audio playback source", async () => {
    const youtubeTrack: Track = {
      id: "youtube-music:video-123",
      videoId: "video-123",
      providerId: "youtube-music",
      providerName: "YouTube Music",
      title: "Video result",
      artist: "Channel",
      playback: { status: "unavailable", reason: "YouTube provides metadata, not an audio stream." },
      kind: "song",
    };

    expect(getPlaybackProvider(youtubeTrack)).toBeUndefined();
    expect(getAudioProvider(youtubeTrack)).toBeUndefined();
    await expect(resolveAudioSource(youtubeTrack)).rejects.toThrow("YouTube provides metadata");
    expect(getPlaybackProvider({
      ...youtubeTrack,
      playback: { status: "embedded", providerId: "youtube-music", videoId: "video-123" },
    })).toBeUndefined();
  });

});
