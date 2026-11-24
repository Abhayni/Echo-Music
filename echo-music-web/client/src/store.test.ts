import { describe, expect, it } from "vitest";
import type { Track } from "./types";

const isLiked = (liked: string[], id: string) => liked.includes(id);
const toggleLiked = (liked: string[], id: string) => liked.includes(id) ? liked.filter(value => value !== id) : [...liked, id];
const formatQueue = (queue: Track[], track: Track) => queue.some(item => item.id === track.id) ? queue : [...queue, track];

describe("library and queue state", () => {
  const track: Track = { id: "1", providerId: "local-file", providerName: "Local file", title: "Test", artist: "Artist", kind: "song" };

  it("adds and removes liked track IDs", () => {
    expect(toggleLiked([], track.id)).toEqual(["1"]);
    expect(toggleLiked(["1"], track.id)).toEqual([]);
  });

  it("does not report an unknown track as liked", () => {
    expect(isLiked(["2"], "1")).toBe(false);
  });

  it("does not add duplicate queue entries", () => {
    expect(formatQueue([track], track)).toHaveLength(1);
  });
});
