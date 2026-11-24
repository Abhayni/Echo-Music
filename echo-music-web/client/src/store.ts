import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { getPlaybackProvider, resolveAudioSource } from "./playbackProviders";
import type { Track } from "./types";

const read = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value, function (property, item: unknown) {
  if (
    property === "audioUrl"
    && this.playback
    && typeof this.playback === "object"
    && "providerId" in this.playback
    && this.playback.providerId === "local-file"
  ) return undefined;
  return item;
}));

export function usePersistentState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => read(key, fallback));
  useEffect(() => write(key, value), [key, value]);
  return [value, setValue] as const;
}

export type Playlist = { id: string; name: string; trackIds: string[]; createdAt?: number };

export const audio = new Audio();
audio.preload = "metadata";

function mediaSession() {
  return "mediaSession" in navigator ? navigator.mediaSession : undefined;
}

function setMediaPosition(duration: number, position: number, playbackRate = audio.playbackRate) {
  const session = mediaSession();
  if (!session?.setPositionState || !Number.isFinite(duration) || duration <= 0) return;
  try {
    session.setPositionState({ duration, position: Math.min(position, duration), playbackRate });
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "NotSupportedError")) {
      console.error("Media Session position update failed:", error);
    }
  }
}

function findNextIndex(queue: Track[], currentIndex: number, repeatMode: "off" | "all" | "one", shuffle: boolean) {
  if (!queue.length) return null;
  if (queue.length === 1) return repeatMode === "all" ? 0 : null;
  if (shuffle) {
    const choices = queue.map((_, index) => index).filter(index => index !== currentIndex);
    return choices[Math.floor(Math.random() * choices.length)] ?? null;
  }
  if (currentIndex + 1 < queue.length) return currentIndex + 1;
  return repeatMode === "all" ? 0 : null;
}

export function usePlayer() {
  const [track, setTrack] = usePersistentState<Track | null>("echo-current-track", null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(() => read("echo-playback-position", 0));
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = usePersistentState("echo-volume", 0.8);
  const [muted, setMuted] = usePersistentState("echo-muted", false);
  const [error, setError] = useState("");
  const [queue, setQueue] = usePersistentState<Track[]>("echo-queue", []);
  const [currentIndex, setCurrentIndex] = usePersistentState("echo-current-index", -1);
  const [repeatMode, setRepeatMode] = usePersistentState<"off" | "all" | "one">("echo-repeat", "off");
  const [shuffle, setShuffle] = usePersistentState("echo-shuffle", false);
  const requestId = useRef(0);
  const restored = useRef(false);
  const trackRef = useRef(track);
  trackRef.current = track;
  const startTrackRef = useRef<(track: Track, index: number, sequence: Track[], startAt?: number) => Promise<void>>(async () => undefined);
  const queueRef = useRef(queue);
  const currentIndexRef = useRef(currentIndex);
  const repeatModeRef = useRef(repeatMode);
  const shuffleRef = useRef(shuffle);
  queueRef.current = queue;
  currentIndexRef.current = currentIndex;
  repeatModeRef.current = repeatMode;
  shuffleRef.current = shuffle;

  const startTrack = async (next: Track, index: number, sequence: Track[], startAt = 0) => {
    const request = ++requestId.current;
    restored.current = true;
    setError("");
    setLoading(true);
    setTrack(next);
    trackRef.current = next;
    setProgress(startAt);
    setDuration(0);
    setCurrentIndex(index);
    setQueue(sequence);
    audio.pause();
    audio.removeAttribute("src");
    if (next.playback?.status === "embedded") {
      const reason = "Audio playback unavailable. YouTube metadata cannot provide audio for Echo's shared player.";
      const unavailableTrack = { ...next, playback: { status: "unavailable" as const, reason } };
      setTrack(unavailableTrack);
      trackRef.current = unavailableTrack;
      setLoading(false);
      setError(reason);
      return;
    }
    try {
      const source = await resolveAudioSource(next);
      if (request !== requestId.current) return;
      if (source.providerId === "local-file") {
        const resolvedTrack = { ...next, audioUrl: source.url };
        setTrack(resolvedTrack);
        setQueue(sequence.map(item => item.id === resolvedTrack.id ? resolvedTrack : item));
      }
      audio.src = source.url;
      if (startAt > 0) {
        const seekOnMetadata = () => {
          if (Number.isFinite(audio.duration)) audio.currentTime = Math.min(startAt, audio.duration);
        };
        audio.addEventListener("loadedmetadata", seekOnMetadata, { once: true });
      }
      audio.load();
      await audio.play();
      if (request === requestId.current) setError("");
    } catch (playbackError) {
      if (request !== requestId.current) return;
      setLoading(false);
      setPlaying(false);
      setError(playbackError instanceof Error
        ? playbackError.message
        : "Playback could not start. The source may be unavailable or browser playback permission may be blocked.");
    }
  };
  startTrackRef.current = startTrack;

  const play = async (next: Track, sequence: Track[] = [next]) => {
    const index = Math.max(0, sequence.findIndex(item => item.id === next.id));
    await startTrack(next, index, sequence);
  };

  const next = async () => {
    const index = findNextIndex(queue, currentIndex, repeatMode, shuffle);
    if (index !== null) await startTrack(queue[index], index, queue);
  };

  const previous = async () => {
    const position = audio.currentTime;
    if (position > 3) {
      seek(0);
      return;
    }
    const index = currentIndex > 0
      ? currentIndex - 1
      : repeatMode === "all" && queue.length
        ? queue.length - 1
        : null;
    if (index !== null) await startTrack(queue[index], index, queue);
  };

  const toggle = async () => {
    if (!audio.paused && audio.src) {
      audio.pause();
      return;
    }
    if (audio.src) {
      setLoading(true);
      try {
        await audio.play();
        setError("");
      } catch {
        setLoading(false);
        setError("Playback could not start. Check the source or retry.");
      }
      return;
    }
    if (track) await startTrack(track, Math.max(0, currentIndex), queue.length ? queue : [track], progress);
  };

  const retry = async () => {
    if (track) {
      await startTrack(track, Math.max(0, currentIndex), queue.length ? queue : [track], progress);
    }
  };

  const stop = () => {
    setTrack(null);
    trackRef.current = null;
    setQueue([]);
    setCurrentIndex(-1);
    setProgress(0);
    setDuration(0);
    setPlaying(false);
    setLoading(false);
    setError("");
  };

  const seek = (seconds: number) => {
    if (Number.isFinite(seconds) && Number.isFinite(audio.duration) && seconds >= 0 && seconds <= audio.duration) {
      audio.currentTime = seconds;
      setProgress(seconds);
      setMediaPosition(audio.duration, seconds);
    }
  };

  const addToQueue = (item: Track) => {
    if (!getPlaybackProvider(item)) {
      setError(item.playback?.status === "unavailable"
        ? item.playback.reason
        : "This item has no authorized in-app playback source.");
      return;
    }
    setQueue(current => current.some(entry => entry.id === item.id) ? current : [...current, item]);
  };

  const removeFromQueue = (index: number) => {
    if (index === currentIndex) return;
    setQueue(current => current.filter((_, itemIndex) => itemIndex !== index));
    if (index < currentIndex) setCurrentIndex(currentIndex - 1);
  };

  const clearQueue = () => {
    setQueue(track ? [track] : []);
    setCurrentIndex(track ? 0 : -1);
  };

  const cycleRepeat = () => setRepeatMode(mode => mode === "off" ? "all" : mode === "all" ? "one" : "off");

  const setAudioVolume = (value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setVolume(clamped);
    if (clamped > 0 && muted) setMuted(false);
    audio.volume = clamped;
    if (clamped > 0) audio.muted = false;
  };

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    audio.muted = nextMuted;
  };

  const reportError = (message: string) => setError(message);

  useEffect(() => {
    const onTime = () => {
      const position = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      setProgress(position);
      setMediaPosition(audio.duration, position);
    };
    const onMetadata = () => {
      const actualDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDuration(actualDuration);
      setMediaPosition(actualDuration, audio.currentTime);
    };
    const onPlay = () => {
      setPlaying(true);
      setLoading(false);
      setError("");
      const session = mediaSession();
      if (session) session.playbackState = "playing";
    };
    const onPause = () => {
      setPlaying(false);
      const session = mediaSession();
      if (session) session.playbackState = "paused";
      try {
        localStorage.setItem("echo-playback-position", String(audio.currentTime));
      } catch (storageError) {
        console.error("Could not save playback position:", storageError);
      }
    };
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    const onError = () => {
      if (!audio.error) return;
      setPlaying(false);
      setLoading(false);
      setError(`Audio could not be loaded (media error ${audio.error.code}). Check your connection or retry.`);
    };
    const onEnded = () => {
      if (repeatModeRef.current === "one") {
        audio.currentTime = 0;
        void audio.play().catch(error => {
          setPlaying(false);
          setError(error instanceof Error ? `Could not restart this track: ${error.message}` : "Could not restart this track.");
        });
        return;
      }
      const index = findNextIndex(queueRef.current, currentIndexRef.current, repeatModeRef.current, shuffleRef.current);
      if (index !== null) void startTrackRef.current(queueRef.current[index], index, queueRef.current);
      else setPlaying(false);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMetadata);
    audio.addEventListener("durationchange", onMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("error", onError);
    audio.addEventListener("ended", onEnded);
    audio.volume = volume;
    audio.muted = muted;
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMetadata);
      audio.removeEventListener("durationchange", onMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    if (!track || restored.current) return;
    restored.current = true;
    if (track.playback?.status === "embedded") {
      const reason = "Audio playback unavailable. YouTube metadata cannot provide audio for Echo's shared player.";
      const unavailableTrack = { ...track, playback: { status: "unavailable" as const, reason } };
      setTrack(unavailableTrack);
      trackRef.current = unavailableTrack;
      setLoading(false);
      setError(reason);
      return;
    }
    const request = ++requestId.current;
    setLoading(true);
    void resolveAudioSource(track).then(source => {
      if (request !== requestId.current) return;
      const queueIndex = queue.findIndex(item => item.id === track.id);
      const restoredTrack = source.providerId === "local-file" ? { ...track, audioUrl: source.url } : track;
      setTrack(restoredTrack);
      if (queueIndex < 0) {
        setQueue([restoredTrack]);
        setCurrentIndex(0);
      } else {
        setQueue(queue.map(item => item.id === restoredTrack.id ? restoredTrack : item));
        setCurrentIndex(queueIndex);
      }
      const restoreMetadata = () => {
        if (request !== requestId.current) return;
        const actualDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
        setDuration(actualDuration);
        const savedPosition = read<number>("echo-playback-position", 0);
        const position = actualDuration > 0 ? Math.min(savedPosition, actualDuration) : 0;
        if (position > 0) audio.currentTime = position;
        setProgress(position);
        setLoading(false);
      };
      audio.addEventListener("loadedmetadata", restoreMetadata, { once: true });
      audio.src = source.url;
      audio.load();
    }).catch(restoreError => {
      if (request === requestId.current) {
        setLoading(false);
        setError(restoreError instanceof Error ? `Could not restore playback: ${restoreError.message}` : "Could not restore playback.");
      }
    });
  }, []);

  useEffect(() => {
    const savePosition = () => {
      try {
        localStorage.setItem("echo-playback-position", String(audio.currentTime));
      } catch (storageError) {
        console.error("Could not save playback position:", storageError);
      }
    };
    const timer = window.setInterval(savePosition, 2000);
    window.addEventListener("pagehide", savePosition);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", savePosition);
    };
  }, []);

  useEffect(() => {
    const session = mediaSession();
    if (!session || !track) return;
    session.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: track.artwork ? [{ src: track.artwork, sizes: "512x512", type: "image/jpeg" }] : [],
    });
    session.playbackState = playing ? "playing" : "paused";
    const actions: MediaSessionAction[] = ["play", "pause", "previoustrack", "nexttrack", "seekto"];
    const handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
      play: () => void toggle(),
      pause: () => audio.pause(),
      previoustrack: () => void previous(),
      nexttrack: () => void next(),
      seekto: details => {
        if (details.seekTime !== undefined) seek(details.seekTime);
      },
    };
    for (const action of actions) {
      try {
        session.setActionHandler(action, handlers[action] ?? null);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "NotSupportedError")) {
          console.error(`Media Session action ${action} could not be registered:`, error);
        }
      }
    }
  }, [track, queue, currentIndex, repeatMode, shuffle, playing]);

  return {
    track, playing, loading, progress, duration, volume, muted, error, queue, currentIndex, repeatMode, shuffle,
    setRepeatMode, setShuffle, addToQueue, removeFromQueue, clearQueue, cycleRepeat,
    play, toggle, next, previous, seek, retry, reportError, toggleMute, setVolume: setAudioVolume, stop,
  };
}
