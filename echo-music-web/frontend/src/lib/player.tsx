import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, type Track } from "./api";

type PlayerContextValue = {
  track: Track | null;
  queue: Track[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  error: string | null;
  play: (track: Track, queue?: Track[]) => Promise<void>;
  toggle: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  next: () => void;
  previous: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;
    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
    audio.addEventListener("durationchange", () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0));
    audio.addEventListener("play", () => setIsPlaying(true));
    audio.addEventListener("pause", () => setIsPlaying(false));
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      const index = queue.findIndex(item => item.id === track?.id);
      if (index >= 0 && queue[index + 1]) play(queue[index + 1], queue);
    });
    audio.addEventListener("error", () => setError("The provider stream could not be played."));
    return () => audio.pause();
  }, []);

  useEffect(() => {
    if ("mediaSession" in navigator) navigator.mediaSession.setActionHandler("play", () => void audioRef.current?.play());
    if ("mediaSession" in navigator) navigator.mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
  }, []);

  async function play(nextTrack: Track, nextQueue = queue) {
    setError(null);
    setTrack(nextTrack);
    setQueue(nextQueue);
    try {
      const stream = await api<{ url: string }>(`/stream/${encodeURIComponent(nextTrack.id)}`);
      if (!audioRef.current) throw new Error("Playback engine unavailable");
      audioRef.current.src = stream.url;
      await audioRef.current.play();
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: nextTrack.title, artist: nextTrack.artist, album: nextTrack.album || "" });
      }
      void api("/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nextTrack) }).catch(() => undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Playback failed");
      setIsPlaying(false);
    }
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio?.src) return;
    if (audio.paused) void audio.play().catch(() => setError("Playback could not start"));
    else audio.pause();
  }
  function seek(seconds: number) { if (audioRef.current) audioRef.current.currentTime = seconds; }
  function setVolume(volume: number) {
    setVolumeState(volume);
    if (audioRef.current) audioRef.current.volume = volume;
  }
  function next() {
    const index = queue.findIndex(item => item.id === track?.id);
    if (index >= 0 && queue[index + 1]) void play(queue[index + 1], queue);
  }
  function previous() {
    if (audioRef.current && audioRef.current.currentTime > 5) return seek(0);
    const index = queue.findIndex(item => item.id === track?.id);
    if (index > 0) void play(queue[index - 1], queue);
  }

  return <PlayerContext.Provider value={{ track, queue, isPlaying, currentTime, duration, volume, error, play, toggle, seek, setVolume, next, previous }}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const value = useContext(PlayerContext);
  if (!value) throw new Error("usePlayer must be used within PlayerProvider");
  return value;
}
