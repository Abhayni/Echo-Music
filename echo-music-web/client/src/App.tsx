import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Heart, House, Library, Search, Pause, Play, ListMusic, Mic2, Settings, X, Plus, Repeat, Shuffle, Trash2, Upload, SkipBack, SkipForward, ListPlus, ChevronUp, ChevronDown, Pencil, Volume2, VolumeX, LoaderCircle, Clock3, Compass, UserRound, Download, CheckCircle2, RefreshCw, TrendingUp, TrendingDown, Folder, Music2, Disc3, ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { getLyrics, getProviderHealth, searchMusic } from "./api";
import { saveLocalAudio } from "./localAudio";
import { getPlaybackProvider } from "./playbackProviders";
import { getProviderDisplayStatus } from "./providerStatus";
import { usePersistentState, usePlayer, type Playlist } from "./store";
import { findYouTubeAudioMatch, youtubeAudioSearchQuery } from "./youtubeMatching";
import type { LyricsResponse, ProviderHealth, ProviderId, ProviderStatus, SearchCategory, Track } from "./types";

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  return `${minutes}:${Math.floor(value % 60).toString().padStart(2, "0")}`;
}

function normalizeSearch(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();
}

function Artwork({ track, large = false }: { track: Track; large?: boolean }) {
  return track.artwork
    ? <img className={large ? "artwork artwork-large" : "artwork"} src={track.artwork} alt="" loading="lazy" decoding="async" />
    : <div className={large ? "artwork artwork-large artwork-fallback" : "artwork artwork-fallback"}><span>EM</span></div>;
}

function timedLyrics(text: string | undefined, position: number) {
  if (!text) return [];
  const parsed = text.split(/\r?\n/).flatMap(line => {
    const matches = [...line.matchAll(/\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    const content = line.replace(/\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g, "").trim();
    return matches.map(match => ({
      seconds: Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] || "0"}`),
      content,
    })).filter(entry => entry.content);
  });
  let activeIndex = -1;
  for (let index = parsed.length - 1; index >= 0; index--) {
    if (parsed[index].seconds <= position) {
      activeIndex = index;
      break;
    }
  }
  return parsed.map((line, index) => ({ ...line, active: index === activeIndex }));
}

function AppShell() {
  const player = usePlayer();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [category, setCategory] = useState<SearchCategory>("all");
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [providerHealth, setProviderHealth] = useState<ProviderHealth[]>([]);
  const [healthRefresh, setHealthRefresh] = useState(0);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<ProviderId[]>([]);
  const [playbackFilter, setPlaybackFilter] = useState<"all" | "full" | "preview" | "external" | "unavailable">("all");
  const [providerErrors, setProviderErrors] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = usePersistentState<string[]>("echo-search-history", []);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "error">("idle");
  const [searchError, setSearchError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [paginationError, setPaginationError] = useState("");
  const [liked, setLiked] = usePersistentState<string[]>("echo-liked", []);
  const [history, setHistory] = usePersistentState<Track[]>("echo-history", []);
  const [playlists, setPlaylists] = usePersistentState<Playlist[]>("echo-playlists", []);
  const [knownTracks, setKnownTracks] = usePersistentState<Record<string, Track>>("echo-tracks", {});
  const [queueOpen, setQueueOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [lyrics, setLyrics] = useState<LyricsResponse | null>(null);
  const [lyricsError, setLyricsError] = useState("");
  const [theme, setTheme] = usePersistentState<"dark" | "light">("echo-theme", "dark");
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [playlistTrack, setPlaylistTrack] = useState<Track | null>(null);
  const [libraryTab, setLibraryTab] = useState<"Playlists" | "Songs" | "Albums" | "Artists">("Playlists");
  const [librarySource, setLibrarySource] = useState<"in-app" | "spotify">("in-app");
  const [libraryShortcut, setLibraryShortcut] = useState<"liked" | "downloaded" | "exported" | "cached" | "top" | "bottom" | "local" | "taste" | "recent" | null>(null);
  const [libraryCollection, setLibraryCollection] = useState<{ type: "album" | "artist"; name: string } | null>(null);
  const [librarySort, setLibrarySort] = usePersistentState<"date-added" | "recently-played" | "alphabetical">("echo-library-sort", "date-added");
  const [librarySortAscending, setLibrarySortAscending] = usePersistentState("echo-library-sort-ascending", false);
  const [libraryNotice, setLibraryNotice] = useState("");
  const [matchingYouTubeId, setMatchingYouTubeId] = useState<string | null>(null);
  const youtubeMatchRequest = useRef(0);
  const navigate = useNavigate();
  const isLibraryRoute = location.pathname === "/library";

  useEffect(() => {
    const controller = new AbortController();
    setHealthLoading(true);
    setHealthError("");
    getProviderHealth(controller.signal).then(health => {
      setProviderHealth(health);
      setProviderStatuses(health);
    }).catch(error => {
      if (!controller.signal.aborted) {
        setHealthError(error instanceof Error ? error.message : "Could not load provider status.");
      }
    }).finally(() => {
      if (!controller.signal.aborted) setHealthLoading(false);
    });
    return () => controller.abort();
  }, [healthRefresh]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      setNextOffset(null);
      setSearchError("");
      setSearchState("idle");
      return;
    }
    setSearchState("loading");
    setResults([]);
    setNextOffset(null);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setSearchError("");
        setProviderErrors([]);
        setPaginationError("");
        if (category === "playlists") {
          const normalizedQuery = normalizeSearch(trimmedQuery);
          const found = playlists
            .filter(playlist => normalizeSearch(playlist.name).includes(normalizedQuery))
            .map((playlist): Track => ({
              id: `playlist:${playlist.id}`,
              providerId: "local-file",
              providerName: "Echo Music",
              title: playlist.name,
              artist: "Echo Music",
              album: `${playlist.trackIds.length} songs`,
              kind: "playlist",
            }));
          setResults(found);
          setNextOffset(null);
        } else {
          const found = await searchMusic(trimmedQuery, category, 0, controller.signal, selectedProviders);
          setResults(found.results);
          setNextOffset(found.nextOffset);
          setProviderErrors(found.errors.map(error => `${error.providerId}: ${error.message}`));
          const playableTracks = found.results.filter(track => getPlaybackProvider(track));
          setKnownTracks(current => ({ ...current, ...Object.fromEntries(playableTracks.map(track => [track.id, track])) }));
        }
        setSearchHistory(current => [trimmedQuery, ...current.filter(item => normalizeSearch(item) !== normalizeSearch(trimmedQuery))].slice(0, 12));
        setSearchState("idle");
      } catch (error) {
        if (controller.signal.aborted) return;
        setSearchError(error instanceof Error ? error.message : "Search failed");
        setSearchState("error");
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, category, retryCount, playlists, selectedProviders, setKnownTracks, setSearchHistory]);

  useEffect(() => {
    if (!player.track) { setLyrics(null); return; }
    setLyrics(null);
    setLyricsError("");
    getLyrics(player.track).then(setLyrics).catch(error => {
      setLyricsError(error instanceof Error ? error.message : "Lyrics are temporarily unavailable.");
      setLyrics({ found: false });
    });
  }, [player.track]);

  useEffect(() => {
    setKnownTracks(current => ({ ...current, ...Object.fromEntries(history.map(track => [track.id, track])) }));
  }, [history, setKnownTracks]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
      if (event.code === "Space") {
        event.preventDefault();
        void player.toggle();
      } else if (event.altKey && event.key === "ArrowRight") {
        void player.next();
      } else if (event.altKey && event.key === "ArrowLeft") {
        void player.previous();
      } else if (event.key === "ArrowRight") {
        player.seek(player.progress + 5);
      } else if (event.key === "ArrowLeft") {
        player.seek(Math.max(0, player.progress - 5));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [player.toggle, player.next, player.previous, player.seek, player.progress]);

  const playTrack = (track: Track, source: Track[] = [track]) => {
    if (!getPlaybackProvider(track)) {
      player.reportError(track.playback?.status === "unavailable"
        ? track.playback.reason
        : "This item has no authorized in-app playback source.");
      return;
    }
    const playableSource = source.filter(item => Boolean(getPlaybackProvider(item)));
    setHistory(current => [track, ...current.filter(item => item.id !== track.id)].slice(0, 40));
    setKnownTracks(current => ({ ...current, [track.id]: track }));
    void player.play(track, playableSource);
  };

  const findAuthorizedYouTubeAudio = async (track: Track, source: Track[], queueOnly = false) => {
    const request = ++youtubeMatchRequest.current;
    setMatchingYouTubeId(track.id);
    try {
      const providers: ProviderId[] = ["audius", "jamendo", "internet-archive"];
      const found = await searchMusic(youtubeAudioSearchQuery(track), "songs", 0, undefined, providers);
      if (request !== youtubeMatchRequest.current) return;
      const matchedTrack = findYouTubeAudioMatch(track, found.results);
      if (!matchedTrack) {
        const detail = found.errors.length
          ? "No exact match was verified; one or more authorized providers could not be searched."
          : "No exact title and artist match was found in the enabled authorized audio providers.";
        player.reportError(`Audio playback unavailable. ${detail}`);
        return;
      }

      if (queueOnly) {
        player.addToQueue(matchedTrack);
      } else {
        const sequence = [
          matchedTrack,
          ...source.filter(item => item.id !== track.id && getPlaybackProvider(item)),
        ];
        playTrack(matchedTrack, sequence);
      }
    } catch (error) {
      if (request === youtubeMatchRequest.current) {
        const detail = error instanceof Error ? error.message : "Authorized provider search failed.";
        player.reportError(`Audio playback unavailable. ${detail}`);
      }
    } finally {
      if (request === youtubeMatchRequest.current) setMatchingYouTubeId(null);
    }
  };

  const addToQueue = (track: Track) => player.addToQueue(track);

  const loadMore = async () => {
    if (nextOffset === null || loadingMore || category === "playlists") return;
    setLoadingMore(true);
    setPaginationError("");
    try {
      const found = await searchMusic(query.trim(), category, nextOffset, undefined, selectedProviders);
      setResults(current => {
        const existingIds = new Set(current.map(track => track.id));
        return [...current, ...found.results.filter(track => !existingIds.has(track.id))];
      });
      setNextOffset(found.nextOffset);
      const playableTracks = found.results.filter(track => getPlaybackProvider(track));
      setKnownTracks(current => ({ ...current, ...Object.fromEntries(playableTracks.map(track => [track.id, track])) }));
    } catch (error) {
      setPaginationError(error instanceof Error ? error.message : "Could not load more results");
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleLiked = (track: Track) => setLiked(current => current.includes(track.id) ? current.filter(id => id !== track.id) : [...current, track.id]);

  const createPlaylist = (track?: Track) => {
    const name = window.prompt("Playlist name");
    if (!name?.trim()) return;
    const playlist = { id: crypto.randomUUID(), name: name.trim(), createdAt: Date.now(), trackIds: track ? [track.id] : [] };
    setPlaylists(current => [...current, playlist]);
    setSelectedPlaylist(playlist.id);
    if (track) {
      setKnownTracks(current => ({ ...current, [track.id]: track }));
      setPlaylistTrack(null);
    }
  };

  const addTrackToPlaylist = (playlistId: string, track: Track) => {
    setKnownTracks(current => ({ ...current, [track.id]: track }));
    setPlaylists(current => current.map(playlist =>
      playlist.id === playlistId && !playlist.trackIds.includes(track.id)
        ? { ...playlist, trackIds: [...playlist.trackIds, track.id] }
        : playlist,
    ));
    setPlaylistTrack(null);
  };

  const addLocalFiles = async (files: File[]) => {
    try {
      const localTracks = await Promise.all(files.map(async file => {
        const id = `local:${crypto.randomUUID()}`;
        await saveLocalAudio(id, file);
        return {
          id,
          providerId: "local-file" as const,
          providerName: "Local file",
          title: file.name.replace(/\.[^.]+$/, ""),
          artist: "Local audio",
          audioUrl: URL.createObjectURL(file),
          playback: { status: "available" as const, providerId: "local-file" as const },
          kind: "song" as const,
        };
      }));
      if (localTracks.length) {
        setKnownTracks(current => ({ ...current, ...Object.fromEntries(localTracks.map(track => [track.id, track])) }));
        playTrack(localTracks[0], localTracks);
      }
    } catch (error) {
      player.reportError(error instanceof Error ? error.message : "Could not load the selected local audio.");
    }
  };

  const visibleHistory = useMemo(() => history.slice(0, 12), [history]);
  const libraryTracks = useMemo(() => {
    const merged = new Map<string, Track>();
    for (const track of Object.values(knownTracks)) merged.set(track.id, track);
    for (const track of history) merged.set(track.id, track);
    return [...merged.values()];
  }, [knownTracks, history]);
  const likedTracks = useMemo(() => libraryTracks.filter(track => liked.includes(track.id)), [libraryTracks, liked]);
  const localTracks = useMemo(() => libraryTracks.filter(track => track.providerId === "local-file"), [libraryTracks]);
  const albums = useMemo(() => {
    const groups = new Map<string, Track[]>();
    for (const track of libraryTracks) {
      if (!track.album?.trim()) continue;
      groups.set(track.album, [...(groups.get(track.album) ?? []), track]);
    }
    return [...groups].map(([name, tracks]) => ({ name, tracks }));
  }, [libraryTracks]);
  const artists = useMemo(() => {
    const groups = new Map<string, Track[]>();
    for (const track of libraryTracks) {
      if (!track.artist?.trim()) continue;
      groups.set(track.artist, [...(groups.get(track.artist) ?? []), track]);
    }
    return [...groups].map(([name, tracks]) => ({ name, tracks }));
  }, [libraryTracks]);
  const sortedPlaylists = useMemo(() => {
    const recentIndex = (playlist: Playlist) => {
      const index = history.findIndex(track => playlist.trackIds.includes(track.id));
      return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    };
    return playlists
      .map((playlist, index) => ({ playlist, index }))
      .sort((left, right) => {
        let result = 0;
        if (librarySort === "alphabetical") result = left.playlist.name.localeCompare(right.playlist.name);
        else if (librarySort === "recently-played") result = recentIndex(left.playlist) - recentIndex(right.playlist);
        else result = (left.playlist.createdAt ?? left.index) - (right.playlist.createdAt ?? right.index);
        if (result === 0) result = left.index - right.index;
        return librarySortAscending ? result : -result;
      })
      .map(({ playlist }) => playlist);
  }, [playlists, history, librarySort, librarySortAscending]);
  const spotifyStatus = providerStatuses.find(provider => provider.id === "spotify");
  const libraryShortcutItems = [
    { id: "liked" as const, label: "Liked", icon: <Heart/>, count: likedTracks.length },
    { id: "downloaded" as const, label: "Downloaded", icon: <CheckCircle2/> },
    { id: "exported" as const, label: "Exported", icon: <Download/> },
    { id: "cached" as const, label: "Cached", icon: <RefreshCw/> },
    { id: "top" as const, label: "My Top 50", icon: <TrendingUp/> },
    { id: "bottom" as const, label: "My Bottom 50", icon: <TrendingDown/> },
    { id: "local" as const, label: "Local", icon: <Folder/>, count: localTracks.length },
    { id: "taste" as const, label: "Taste Mix", icon: <ListMusic/>, count: history.length },
  ];
  const shortcutTitles = {
    liked: "Liked songs",
    downloaded: "Downloaded",
    exported: "Exported",
    cached: "Cached tracks",
    top: "My Top 50",
    bottom: "My Bottom 50",
    local: "Local music",
    taste: "Taste Mix",
    recent: "Recently played",
  } as const;
  const selectLibraryShortcut = (shortcut: NonNullable<typeof libraryShortcut>) => {
    setLibrarySource("in-app");
    setLibraryTab("Songs");
    setLibraryShortcut(shortcut);
    setLibraryCollection(null);
    setSelectedPlaylist(null);
  };
  const shortcutTracks = libraryShortcut === "liked"
    ? likedTracks
    : libraryShortcut === "local"
      ? localTracks
      : libraryShortcut === "taste"
        ? history.slice(0, 50)
        : libraryShortcut === "recent"
          ? history
          : [];
  const unavailableShortcutMessages: Partial<Record<NonNullable<typeof libraryShortcut>, string>> = {
    downloaded: "Downloads are not supported in Echo Music Web, so no tracks are listed here.",
    exported: "Track exporting is not supported in Echo Music Web, so no exported tracks are listed here.",
    cached: "A browsable cached-track library is not available in Echo Music Web.",
    top: "Echo Music Web does not collect play counts, so a Top 50 ranking is not available.",
    bottom: "Echo Music Web does not collect play counts, so a Bottom 50 ranking is not available.",
  };
  const visibleResults = useMemo(() => results.filter(track => {
    if (playbackFilter === "all") return true;
    const status = track.playback?.status ?? "unavailable";
    if (playbackFilter === "full") return status === "available";
    if (playbackFilter === "preview") return status === "preview";
    if (playbackFilter === "external") return status === "external";
    return status === "unavailable";
  }), [results, playbackFilter]);
  const providerResultCounts = useMemo(() => results.reduce<Partial<Record<ProviderId, number>>>((counts, track) => {
    const sourceIds = track.sources?.map(source => source.providerId) ?? [track.providerId];
    for (const providerId of sourceIds) counts[providerId] = (counts[providerId] ?? 0) + 1;
    return counts;
  }, {}), [results]);

  const TrackRow = ({ track, index, source }: { track: Track; index: number; source: Track[] }) => {
    const playbackProvider = getPlaybackProvider(track);
    const playable = Boolean(playbackProvider);
    const youtubeResult = track.providerId === "youtube-music" && Boolean(track.videoId);
    const matchingYoutube = matchingYouTubeId === track.id;
    const providerNames = track.sources?.map(provider => provider.providerName).join(", ") || track.providerName;
    const externalPlayback = track.playback?.status === "external" ? track.playback : undefined;
    const isPlaylist = track.kind === "playlist";
    const metadata = [
      track.artist,
      track.album,
      track.durationSeconds && track.durationSeconds > 0 ? formatTime(track.durationSeconds) : "Duration unavailable",
    ].filter(Boolean).join(" · ");
    const main = (
      <>
        <span className="track-index">{index + 1}</span>
        <Artwork track={track} />
        <span className="track-copy">
          <strong>{track.title}</strong>
          <small>{metadata}</small>
          <small className={playable ? track.playback?.status === "embedded" ? "playback-embedded" : "playback-available" : "playback-unavailable"} title={track.playback?.status === "unavailable" ? track.playback.reason : undefined}>
            {youtubeResult
              ? matchingYoutube
                ? "Searching authorized audio providers..."
                : `${providerNames} · Search metadata · Select to find authorized audio`
              : track.playback?.status === "embedded"
                ? `${providerNames} · Video metadata only`
              : playable
                ? `${providerNames} · Full track`
              : track.playback?.status === "preview"
                ? `${providerNames} · Preview only`
                : externalPlayback
                  ? `${providerNames} · External playback only`
                  : track.playback?.status === "unavailable"
                    ? `${providerNames} · Unavailable: ${track.playback.reason}`
                    : `${providerNames} · No authorized playback`}
          </small>
        </span>
      </>
    );
    return (
      <article className="track-row" data-testid="track-row">
        {playable
          ? <button className="track-main" onClick={() => playTrack(track, source)} aria-label={`Play ${track.title}`}>{main}</button>
          : youtubeResult
            ? <button className="track-main" disabled={matchingYoutube} onClick={() => void findAuthorizedYouTubeAudio(track, source)} aria-label={`Find authorized audio for ${track.title}`}>{main}</button>
          : externalPlayback
            ? <button className="track-main" onClick={() => window.open(externalPlayback.url, "_blank", "noopener,noreferrer")} aria-label={`Open ${track.title} on ${track.providerName}`}>{main}</button>
          : isPlaylist
            ? <button className="track-main" onClick={() => {
              const playlistId = track.id.replace(/^playlist:/, "");
              setSelectedPlaylist(playlistId);
              navigate("/library");
            }} aria-label={`Open playlist ${track.title}`}>{main}</button>
            : <button className="track-main unavailable-track" disabled title={track.playback?.status === "unavailable" ? track.playback.reason : "No authorized in-app playback source"} aria-label={`Unavailable for in-app playback: ${track.title}`}>{main}</button>}
        {(playable || youtubeResult) && <>
          <button className="icon-button" onClick={() => toggleLiked(track)} aria-label="Like track">
            <Heart size={18} fill={liked.includes(track.id) ? "currentColor" : "none"} />
          </button>
          <button className="icon-button" onClick={() => youtubeResult
            ? void findAuthorizedYouTubeAudio(track, source, true)
            : addToQueue(track)} aria-label={`Add ${track.title} to queue`}><Plus size={18} /></button>
          {playable && <button className="icon-button playlist-add" onClick={() => setPlaylistTrack(track)} aria-label="Add to playlist"><ListPlus size={18}/></button>}
        </>}
        {track.externalUrl && track.providerId !== "youtube-music" && <a
          className="external-provider-action"
          href={track.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${track.title} on YouTube Music`}
        >Open on YouTube Music</a>}
      </article>
    );
  };

  const createPlaylistTile = (
    <button className="playlist-card playlist-create-tile" onClick={() => createPlaylist()}>
      <span className="playlist-create-icon"><Plus size={24}/></span>
      <strong>Create Playlist</strong>
      <small>Start a new collection</small>
    </button>
  );

  const libraryView = (
    <main className="content library-content">
      <header className="library-page-header">
        <h1>Library</h1>
        <nav className="library-header-actions" aria-label="Library shortcuts">
          <button className="icon-button" aria-label="Recently played" title="Recently played" onClick={() => selectLibraryShortcut("recent")}><Clock3/></button>
          <button className="icon-button" aria-label="Discover music" title="Discover music" onClick={() => navigate("/search")}><Compass/></button>
          <button className="icon-button" aria-label="Profile and friends" title="Profile and friends" onClick={() => setLibraryNotice("Profiles and friends are not available in Echo Music Web.")}><UserRound/></button>
          <button className="icon-button library-settings-button" aria-label="Settings" title="Settings" onClick={() => navigate("/settings")}><Settings/></button>
        </nav>
      </header>

      <div className="library-tabs" role="tablist" aria-label="Library categories">
        {(["Playlists", "Songs", "Albums", "Artists"] as const).map(tab => (
          <button key={tab} role="tab" aria-selected={libraryTab === tab} className={libraryTab === tab ? "active" : ""} onClick={() => {
            setLibraryTab(tab);
            setLibraryShortcut(null);
            setLibraryCollection(null);
            setLibraryNotice("");
          }}>{tab}</button>
        ))}
      </div>

      <div className="library-source-switch" role="group" aria-label="Library source">
        <button className={librarySource === "in-app" ? "active" : ""} aria-pressed={librarySource === "in-app"} onClick={() => setLibrarySource("in-app")}><Music2 size={18}/><span>In App Library</span></button>
        <button className={librarySource === "spotify" ? "active" : ""} aria-pressed={librarySource === "spotify"} onClick={() => setLibrarySource("spotify")}><span className="spotify-mark" aria-hidden="true">◉</span><span>Spotify</span></button>
      </div>

      {libraryNotice && <div className="library-notice" role="status"><span>{libraryNotice}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setLibraryNotice("")}><X size={17}/></button></div>}

      {librarySource === "spotify" ? (
        <section className="library-unavailable" aria-live="polite">
          <span className="library-unavailable-icon"><Music2 size={25}/></span>
          <h2>Spotify library unavailable</h2>
          <p>{spotifyStatus?.reason || "Echo Music Web does not have an official Spotify library integration configured. No Spotify library data is shown."}</p>
          <button className="secondary-button" onClick={() => setLibrarySource("in-app")}>Return to In App Library</button>
        </section>
      ) : (
        <>
          {libraryTab === "Playlists" && !libraryShortcut && !libraryCollection && <section className="library-shortcuts" aria-label="Library shortcuts">
            {libraryShortcutItems.map(item => (
              <button key={item.id} className="library-shortcut" onClick={() => selectLibraryShortcut(item.id)} aria-label={`${item.label}${item.count === undefined ? "" : `, ${item.count}`}`}>
                <span className="library-shortcut-icon">{item.icon}</span>
                <span>{item.label}</span>
                {item.count !== undefined && <small>{item.count}</small>}
                <ChevronRight className="shortcut-chevron" size={16}/>
              </button>
            ))}
          </section>}

          {libraryTab === "Playlists" && !libraryShortcut && !libraryCollection && <section className="library-playlists-section" id="library-playlists">
            <header className="library-section-header">
              <div><h2>Playlists</h2><span>{playlists.length} {playlists.length === 1 ? "playlist" : "playlists"}</span></div>
              <div className="playlist-sort-controls">
                <label className="visually-hidden" htmlFor="playlist-sort">Sort playlists</label>
                <select id="playlist-sort" aria-label="Sort playlists" value={librarySort} onChange={event => setLibrarySort(event.target.value as typeof librarySort)}>
                  <option value="date-added">Date added</option>
                  <option value="recently-played">Recently played</option>
                  <option value="alphabetical">Alphabetical</option>
                </select>
                <button className="icon-button sort-direction" aria-label={`Sort ${librarySortAscending ? "descending" : "ascending"}`} title={`Sort ${librarySortAscending ? "descending" : "ascending"}`} onClick={() => setLibrarySortAscending(value => !value)}>
                  {librarySortAscending ? <ArrowUp size={18}/> : <ArrowDown size={18}/>}
                </button>
              </div>
            </header>
            <div className="playlist-grid library-playlist-grid">
              {sortedPlaylists.map(playlist => {
                const playlistTracks = playlist.trackIds.map(id => knownTracks[id]).filter((track): track is Track => Boolean(track));
                const artworkTracks = playlistTracks.filter(track => track.artwork).slice(0, 4);
                return (
                  <button key={playlist.id} className={`library-playlist-card ${selectedPlaylist === playlist.id ? "selected" : ""}`} onClick={() => setSelectedPlaylist(current => current === playlist.id ? null : playlist.id)} aria-label={`Open playlist ${playlist.name}, ${playlist.trackIds.length} songs`}>
                    <span className={`playlist-artwork ${artworkTracks.length > 1 ? "collage" : ""}`}>
                      {artworkTracks.length > 1
                        ? artworkTracks.map((track, index) => <img key={`${track.id}-${index}`} src={track.artwork} alt="" loading="lazy" decoding="async"/>)
                        : artworkTracks.length === 1
                          ? <img src={artworkTracks[0].artwork} alt="" loading="lazy" decoding="async"/>
                          : <span className="playlist-artwork-fallback"><ListMusic size={28}/></span>}
                    </span>
                    <span className="playlist-card-name">{playlist.name}</span>
                    <small>{playlist.trackIds.length} {playlist.trackIds.length === 1 ? "song" : "songs"}</small>
                  </button>
                );
              })}
              {createPlaylistTile}
            </div>
            {selectedPlaylist && playlists.some(playlist => playlist.id === selectedPlaylist) && (() => {
              const playlist = playlists.find(item => item.id === selectedPlaylist)!;
              const playlistSongs = playlist.trackIds.map(id => knownTracks[id]).filter((track): track is Track => Boolean(track));
              return <section className="playlist-detail library-playlist-detail">
                <div className="section-heading"><div><span className="eyebrow">YOUR COLLECTION</span><h3>{playlist.name}</h3></div><div className="playlist-tools">
                  <button className="icon-button" aria-label="Rename playlist" onClick={() => {
                    const name = window.prompt("Playlist name", playlist.name);
                    if (name?.trim()) setPlaylists(current => current.map(item => item.id === selectedPlaylist ? { ...item, name: name.trim() } : item));
                  }}><Pencil size={17}/></button>
                  <button className="icon-button" aria-label="Delete playlist" onClick={() => { setPlaylists(current => current.filter(item => item.id !== selectedPlaylist)); setSelectedPlaylist(null); }}><Trash2 size={18}/></button>
                  <button className="icon-button" aria-label="Close playlist" onClick={() => setSelectedPlaylist(null)}><X size={18}/></button>
                </div></div>
                {playlistSongs.length
                  ? playlistSongs.map((track, index) => <div className="playlist-track" key={track.id}>
                    <TrackRow track={track} index={index} source={playlistSongs}/>
                    <div className="playlist-order">
                      <button className="icon-button" aria-label={`Move ${track.title} up`} disabled={index === 0} onClick={() => setPlaylists(current => current.map(item => {
                        if (item.id !== selectedPlaylist || index === 0) return item;
                        const trackIds = [...item.trackIds]; [trackIds[index - 1], trackIds[index]] = [trackIds[index], trackIds[index - 1]];
                        return { ...item, trackIds };
                      }))}><ChevronUp size={16}/></button>
                      <button className="icon-button" aria-label={`Move ${track.title} down`} disabled={index === playlistSongs.length - 1} onClick={() => setPlaylists(current => current.map(item => {
                        if (item.id !== selectedPlaylist || index >= item.trackIds.length - 1) return item;
                        const trackIds = [...item.trackIds]; [trackIds[index], trackIds[index + 1]] = [trackIds[index + 1], trackIds[index]];
                        return { ...item, trackIds };
                      }))}><ChevronDown size={16}/></button>
                      <button className="icon-button" aria-label={`Remove ${track.title}`} onClick={() => setPlaylists(current => current.map(item => item.id === selectedPlaylist ? { ...item, trackIds: item.trackIds.filter(id => id !== track.id) } : item))}><X size={16}/></button>
                    </div>
                  </div>)
                  : <p className="muted">This playlist is empty. Add tracks from Search to build it.</p>}
              </section>;
            })()}
          </section>}

          {libraryTab === "Songs" && libraryShortcut && <section className="library-results" id="library-results">
            <div className="library-section-header"><div><h2>{shortcutTitles[libraryShortcut]}</h2><span>{shortcutTracks.length} {shortcutTracks.length === 1 ? "track" : "tracks"}</span></div></div>
            {unavailableShortcutMessages[libraryShortcut]
              ? <div className="library-unavailable"><span className="library-unavailable-icon"><Music2 size={24}/></span><h3>Not available in this app</h3><p>{unavailableShortcutMessages[libraryShortcut]}</p></div>
              : shortcutTracks.length
                ? <div className="track-list">{shortcutTracks.map((track, index) => <TrackRow key={track.id} track={track} index={index} source={shortcutTracks}/>)}</div>
                : <div className="library-empty"><Music2 size={25}/><h3>{libraryShortcut === "liked" ? "No liked songs yet" : libraryShortcut === "local" ? "No local music yet" : "Your listening mix is ready to grow"}</h3><p>{libraryShortcut === "liked" ? "Like tracks from Search and they’ll be saved here." : libraryShortcut === "local" ? "Choose audio files from Search to play and keep them in this library." : "Play tracks from Search to build a mix from your listening history."}</p><button className="secondary-button" onClick={() => navigate("/search")}>{libraryShortcut === "local" ? "Choose local music" : "Discover music"}</button></div>}
          </section>}

          {libraryTab === "Songs" && !libraryShortcut && <section className="library-results" id="library-results">
            <div className="library-section-header"><div><h2>Songs</h2><span>{likedTracks.length} liked songs</span></div></div>
            {likedTracks.length
              ? <div className="track-list">{likedTracks.map((track, index) => <TrackRow key={track.id} track={track} index={index} source={likedTracks}/>)}</div>
              : <div className="library-empty"><Heart size={25}/><h3>Your saved songs live here</h3><p>Like a track from Search and it’ll appear in your library.</p><button className="secondary-button" onClick={() => navigate("/search")}>Discover music</button></div>}
          </section>}

          {libraryTab === "Albums" && <section className="library-results" id="library-results">
            <div className="library-section-header"><div><h2>{libraryCollection?.type === "album" ? libraryCollection.name : "Albums"}</h2><span>{albums.length} {albums.length === 1 ? "album" : "albums"} from your library</span></div>{libraryCollection && <button className="text-button" onClick={() => setLibraryCollection(null)}>All albums <ChevronRight size={16}/></button>}</div>
            {libraryCollection?.type === "album"
              ? <div className="track-list">{(albums.find(album => album.name === libraryCollection.name)?.tracks ?? []).map((track, index, source) => <TrackRow key={track.id} track={track} index={index} source={source}/>)}</div>
              : albums.length
                ? <div className="library-entity-grid">{albums.map(album => (
                  <button className="library-entity-card" key={album.name} onClick={() => setLibraryCollection({ type: "album", name: album.name })}>
                    {album.tracks[0].artwork ? <img src={album.tracks[0].artwork} alt="" loading="lazy" decoding="async"/> : <span className="playlist-artwork-fallback"><Disc3 size={28}/></span>}
                    <strong>{album.name}</strong><small>{album.tracks[0].artist} · {album.tracks.length} {album.tracks.length === 1 ? "track" : "tracks"}</small>
                  </button>
                ))}</div>
                : <div className="library-empty"><Disc3 size={25}/><h3>No albums in your library yet</h3><p>Albums appear here when they’re included in tracks you’ve saved or played.</p></div>}
          </section>}

          {libraryTab === "Artists" && <section className="library-results" id="library-results">
            <div className="library-section-header"><div><h2>{libraryCollection?.type === "artist" ? libraryCollection.name : "Artists"}</h2><span>{artists.length} {artists.length === 1 ? "artist" : "artists"} from your library</span></div>{libraryCollection && <button className="text-button" onClick={() => setLibraryCollection(null)}>All artists <ChevronRight size={16}/></button>}</div>
            {libraryCollection?.type === "artist"
              ? <div className="track-list">{(artists.find(artist => artist.name === libraryCollection.name)?.tracks ?? []).map((track, index, source) => <TrackRow key={track.id} track={track} index={index} source={source}/>)}</div>
              : artists.length
                ? <div className="library-entity-grid library-artist-grid">{artists.map(artist => (
                  <button className="library-entity-card" key={artist.name} onClick={() => setLibraryCollection({ type: "artist", name: artist.name })}>
                    {artist.tracks[0].artwork ? <img src={artist.tracks[0].artwork} alt="" loading="lazy" decoding="async"/> : <span className="playlist-artwork-fallback"><UserRound size={28}/></span>}
                    <strong>{artist.name}</strong><small>{artist.tracks.length} {artist.tracks.length === 1 ? "track" : "tracks"}</small>
                  </button>
                ))}</div>
                : <div className="library-empty"><UserRound size={25}/><h3>No artists in your library yet</h3><p>Artists appear here as tracks enter your library.</p></div>}
          </section>}
        </>
      )}
    </main>
  );

  const page = (title: string, content: React.ReactNode) => (
    <main className="content"><header className="page-header"><h1>{title}</h1></header>{content}</main>
  );

  return (
    <div className="app-shell" data-theme={theme}>
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("/")} aria-label="Echo Music home"><span className="brand-mark">e</span><span>Echo</span></button>
        <nav aria-label="Primary">
          <NavLink to="/" end><House size={20}/>Home</NavLink>
          <NavLink to="/search"><Search size={20}/>Search</NavLink>
          <NavLink to="/library"><Library size={20}/>Library</NavLink>
          <NavLink to="/flow"><ListMusic size={20}/>Now Playing</NavLink>
        </nav>
        <button className="sidebar-settings" onClick={() => navigate("/settings")}><Settings size={20}/>Settings</button>
      </aside>

      <section className="main-column">
        <Routes>
          <Route path="/" element={page("Good evening", <>
            <div className="section-heading"><h2>Recently played</h2></div>
            {visibleHistory.length ? <div className="track-list">{visibleHistory.map((track, index) => <TrackRow key={track.id} track={track} index={index} source={visibleHistory}/>)}</div> :
              <div className="empty-state"><Search size={28}/><h3>Start discovering</h3><p>Search for a song to begin listening.</p><button onClick={() => navigate("/search")} className="primary-button">Search music</button></div>}
          </>)}/>
          <Route path="/search" element={page("Search", <>
            <div className="search-box"><Search size={20}/><input autoFocus value={query} onChange={event => setQuery(event.target.value)} onFocus={() => setSearchFocused(true)} onBlur={() => window.setTimeout(() => setSearchFocused(false), 100)} placeholder="Search songs, artists, albums, and podcasts..." aria-label="Search music"/></div>
            {searchFocused && searchHistory.length > 0 && <div className="search-suggestions" aria-label="Search history">
              <div className="suggestion-heading"><span>Recent searches</span><button onMouseDown={event => event.preventDefault()} onClick={() => setSearchHistory([])}>Clear history</button></div>
              {searchHistory
                .filter(item => !query.trim() || normalizeSearch(item).includes(normalizeSearch(query)))
                .slice(0, 6)
                .map(item => <button key={item} className="suggestion-item" onMouseDown={event => event.preventDefault()} onClick={() => setQuery(item)}><Search size={15}/>{item}</button>)}
            </div>}
            <div className="search-categories" role="tablist" aria-label="Search category">
              {(["all", "songs", "artists", "albums", "playlists", "podcasts"] as SearchCategory[]).map(item =>
                <button key={item} role="tab" aria-selected={category === item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>
                  {item === "all" ? "All Results" : item[0].toUpperCase() + item.slice(1)}
                </button>,
              )}
            </div>
            <div className="provider-filters" aria-label="Filter by provider">
              <span>Sources</span>
              <button className={selectedProviders.length === 0 ? "active" : ""} onClick={() => setSelectedProviders([])}>All</button>
              {providerStatuses.map(provider => (
                <button
                  key={provider.id}
                  className={selectedProviders.includes(provider.id) ? "active" : ""}
                  disabled={!provider.available}
                  title={provider.reason || `${provider.name}: ${provider.capabilities.join(", ")}`}
                  onClick={() => setSelectedProviders(current => current.includes(provider.id)
                    ? current.filter(id => id !== provider.id)
                    : [...current, provider.id])}
                >{provider.name} ({providerResultCounts[provider.id] ?? 0})</button>
              ))}
            </div>
            {providerStatuses.filter(provider => !provider.available && provider.credentialRequirement.startsWith("Required:")).map(provider => (
              <p className="provider-credential-notice" key={provider.id}>
                {provider.name} search is disabled. {provider.credentialRequirement}
              </p>
            ))}
            <div className="playback-filters" aria-label="Filter by playback availability">
              <label htmlFor="playback-filter">Playback</label>
              <select id="playback-filter" value={playbackFilter} onChange={event => setPlaybackFilter(event.target.value as typeof playbackFilter)}>
                <option value="all">Any availability</option>
                <option value="full">Playable</option>
                <option value="preview">Preview available</option>
                <option value="external">External playback only</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
            <details className="provider-status">
              <summary>Provider health and playback support</summary>
              <div className="provider-health-tools">
                <span>{healthLoading ? "Checking providers..." : `${providerHealth.length} providers checked`}</span>
                <button className="secondary-button" disabled={healthLoading} onClick={() => setHealthRefresh(value => value + 1)}>
                  {healthLoading ? "Checking..." : "Check again"}
                </button>
              </div>
              {healthError && <p role="alert">{healthError}</p>}
              {providerHealth.map(provider => (
                <section className="provider-health-row" key={provider.id}>
                  <h3>{provider.name}</h3>
                  <p><strong>Status:</strong> {getProviderDisplayStatus(provider)} · <strong>Connection check:</strong> {provider.id === "youtube-music" ? "Not probed (quota-safe)" : provider.status}</p>
                  <p><strong>Search:</strong> {provider.status === "healthy" && provider.searchAvailable ? "Available" : "Unavailable"} · <strong>Playback:</strong> {provider.id === "youtube-music" ? "No audio stream; Echo searches authorized audio providers for exact title and artist matches" : provider.playbackAvailable ? "Official audio playback supported (per-track availability varies)" : "Unavailable"}</p>
                  <p><strong>Search results in this page:</strong> {providerResultCounts[provider.id] ?? 0}</p>
                  <p><strong>Last successful check:</strong> {provider.lastSuccessfulCheck ? new Date(provider.lastSuccessfulCheck).toLocaleString() : "No successful check yet"}</p>
                  <p><strong>Credentials:</strong> {provider.credentialRequirement}</p>
                  {(provider.error || provider.reason) && <p><strong>Details:</strong> {provider.error || provider.reason}</p>}
                  {provider.capabilities.length > 0 && <p><strong>Capabilities:</strong> {provider.capabilities.join(", ")}</p>}
                </section>
              ))}
            </details>
            <label className="local-file-button"><Upload size={17}/>Play audio from this device<input type="file" accept="audio/*" multiple onChange={event => {
              const files = Array.from(event.target.files || []);
              void addLocalFiles(files);
              event.target.value = "";
            }}/></label>
            {searchState === "loading" && <div className="loading">Searching...</div>}
            {searchState === "error" && <div className="error-state" role="alert"><p>{searchError}</p><button onClick={() => setRetryCount(value => value + 1)}>Retry</button></div>}
            {!query && <div className="empty-state"><Mic2 size={28}/><h3>Find something to play</h3><p>Search configured YouTube metadata, Audius, Internet Archive recordings, and Jamendo tracks, or play audio from this device.</p></div>}
            {query && searchState === "idle" && results.length === 0 && <div className="empty-state"><p>{providerErrors.length
              ? `No ${category === "all" ? "results" : category} were returned for “${query}”. Check the provider errors below or try another search.`
              : `No ${category === "all" ? "results" : category} found for “${query}”. Try another search or check back later.`}</p></div>}
            {providerErrors.length > 0 && <div className="provider-warning" role="status">{providerErrors.join(" · ")}</div>}
            {query && results.length > 0 && visibleResults.length === 0 && <div className="empty-state"><p>No results match the selected playback filter.</p></div>}
            <div className="track-list">{visibleResults.map((track, index) => <TrackRow key={track.id} track={track} index={index} source={visibleResults}/>)}</div>
            {paginationError && <div className="error-state" role="alert"><p>{paginationError}</p><button onClick={() => void loadMore()}>Retry</button></div>}
            {nextOffset !== null && searchState === "idle" && <button className="secondary-button load-more" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Loading..." : "Load more"}</button>}
          </>)}/>
          <Route path="/library" element={libraryView}/>
          <Route path="/flow" element={page("Now Playing", player.track ? <div className="flow"><Artwork track={player.track} large/><div><p>{player.track.artist} · {player.track.providerName}</p><h2>{player.track.title}</h2>{player.track.matchedYouTube && <p>Matched YouTube metadata: {player.track.matchedYouTube.title} · {player.track.matchedYouTube.artist}</p>}</div><button className="flow-play" onClick={() => void player.toggle()} aria-label={player.playing ? "Pause" : "Play"}>{player.playing ? <Pause/> : <Play/>}</button></div> : <div className="empty-state"><ListMusic/><h3>No track selected</h3><p>Choose a track before opening Now Playing.</p></div>)}/>
          <Route path="/settings" element={page("Settings", <div className="settings">
            <label><span>Theme</span><select value={theme} onChange={event => setTheme(event.target.value as "dark" | "light")}><option value="dark">Dark</option><option value="light">Light</option></select></label>
            <label><span>Volume</span><input type="range" min="0" max="1" step="0.05" value={player.volume} onChange={event => player.setVolume(Number(event.target.value))}/></label>
            <button onClick={player.toggleMute}>{player.muted ? "Unmute" : "Mute"}</button>
            <button onClick={player.cycleRepeat}>Repeat: {player.repeatMode}</button>
            <button onClick={() => player.setShuffle(value => !value)}>Shuffle: {player.shuffle ? "On" : "Off"}</button>
            <button onClick={() => { localStorage.clear(); window.location.reload(); }}>Clear Echo local data</button>
          </div>)}/>
        </Routes>
      </section>

      {player.track && <div className={`mini-player ${isLibraryRoute ? "library-mini-player" : ""}`} data-testid="mini-player">
        <div className="mini-track">
          <button className="mini-track-main" onClick={() => setLyricsOpen(true)}>
            <Artwork track={player.track}/>
            <span><strong>{player.track.title}</strong><small>{player.track.artist}</small>{player.track.matchedYouTube && <><small>Playback source: {player.track.providerName}</small><small>Matched from YouTube Music: {player.track.matchedYouTube.title} · {player.track.matchedYouTube.artist}</small></>}</span>
          </button>
          {player.track.attribution && <div className="mini-track-credit">
            <span title={player.track.attribution}>{player.track.attribution}</span>
            {player.track.sourceUrl && <a href={player.track.sourceUrl} target="_blank" rel="noreferrer">Source</a>}
            {player.track.licenseUrl && <a href={player.track.licenseUrl} target="_blank" rel="noreferrer">License</a>}
          </div>}
        </div>
        <div className="transport">
          <button className="icon-button" aria-label="Previous" onClick={() => void player.previous()}><SkipBack/></button>
          <button className="play-button" onClick={() => void player.toggle()} aria-label={player.loading ? "Loading playback" : player.playing ? "Pause" : "Play"} disabled={player.loading}>{player.loading ? <LoaderCircle className="spin"/> : player.playing ? <Pause/> : <Play/>}</button>
          <button className="icon-button" aria-label="Next" onClick={() => void player.next()}><SkipForward/></button>
        </div>
        <input className="progress" aria-label="Seek" type="range" min="0" max={player.duration} value={Math.min(player.progress, player.duration)} disabled={!player.duration} onChange={event => player.seek(Number(event.target.value))}/>
        <span className="time">{formatTime(player.progress)} / {formatTime(player.duration)}</span>
        <div className="player-actions">
          <button className={`icon-button ${player.shuffle ? "active" : ""}`} onClick={() => player.setShuffle(value => !value)} aria-label="Toggle shuffle"><Shuffle size={17}/></button>
          <button className={`icon-button ${player.repeatMode !== "off" ? "active" : ""}`} onClick={player.cycleRepeat} aria-label={`Repeat ${player.repeatMode}`}><Repeat size={17}/></button>
          <button className="icon-button" onClick={() => setQueueOpen(true)} aria-label="Open queue"><ListMusic/></button>
          <button className="icon-button" onClick={player.toggleMute} aria-label={player.muted ? "Unmute" : "Mute"}>{player.muted ? <VolumeX size={17}/> : <Volume2 size={17}/>}</button>
          <input className="volume-control" aria-label="Volume" type="range" min="0" max="1" step="0.05" value={player.volume} onChange={event => player.setVolume(Number(event.target.value))}/>
        </div>
      </div>}

      {player.error && <div className="player-error" role="alert"><span>{player.error}</span>{player.track && <button className="secondary-button" onClick={() => void player.retry()}>Retry</button>}</div>}
      {playlistTrack && <div className="panel-backdrop" onClick={() => setPlaylistTrack(null)}><aside className="queue-panel" onClick={event => event.stopPropagation()}>
        <header><h2>Add to playlist</h2><button className="icon-button" onClick={() => setPlaylistTrack(null)} aria-label="Close playlists"><X/></button></header>
        {playlists.map(playlist => <button className="queue-row playlist-choice" key={playlist.id} onClick={() => addTrackToPlaylist(playlist.id, playlistTrack)}><span>{playlist.name}</span><small>{playlist.trackIds.length} songs</small></button>)}
        <button className="secondary-button" onClick={() => { createPlaylist(playlistTrack ?? undefined); }}>Create playlist</button>
      </aside></div>}

      {lyricsOpen && player.track && <div className="panel-backdrop" onClick={() => setLyricsOpen(false)}><aside className="lyrics-panel" onClick={event => event.stopPropagation()}><header><h2>Lyrics</h2><button className="icon-button" onClick={() => setLyricsOpen(false)} aria-label="Close lyrics"><X/></button></header>{lyricsError ? <p role="alert">{lyricsError}</p> : lyrics?.syncedLyrics ? <div className="synced-lyrics">{timedLyrics(lyrics.syncedLyrics, player.progress).map((line, index) => <p className={line.active ? "lyric-active" : ""} key={`${line.seconds}-${index}`}>{line.content}</p>)}</div> : <p>{lyrics?.plainLyrics ?? (lyrics ? "No lyrics are available for this track." : "Loading lyrics...")}</p>}</aside></div>}
      {queueOpen && <div className="panel-backdrop" onClick={() => setQueueOpen(false)}><aside className="queue-panel" onClick={event => event.stopPropagation()}><header><h2>Queue</h2><button className="icon-button" onClick={() => setQueueOpen(false)} aria-label="Close queue"><X/></button></header>{player.queue.length ? player.queue.map((track, index) => <div className={`queue-row ${index === player.currentIndex ? "current" : ""}`} key={`${track.id}-${index}`}><button onClick={() => playTrack(track, player.queue)}><span>{track.title}</span><small>{track.artist}</small></button>{index !== player.currentIndex && <button className="icon-button" aria-label={`Remove ${track.title}`} onClick={() => player.removeFromQueue(index)}><X size={16}/></button>}</div>) : <p className="muted">Queue is empty.</p>}<button className="secondary-button" onClick={player.clearQueue}>Clear upcoming</button></aside></div>}
      {isLibraryRoute ? <>
        <nav className="mobile-nav library-mobile-nav" aria-label="Mobile navigation">
          <NavLink to="/" end><House/><span>Home</span></NavLink>
          <button className="library-voice-button" onClick={() => setLibraryNotice("Voice search is not available in Echo Music Web. Use Search to find music.")} aria-label="Voice search"><Mic2/><span>Voice</span></button>
          <NavLink to="/library" aria-current="page"><Library/><span>Library</span></NavLink>
        </nav>
        <button className="library-search-button" onClick={() => navigate("/search")} aria-label="Search"><Search/></button>
      </> : <nav className="mobile-nav" aria-label="Mobile navigation"><NavLink to="/" end><House/><span>Home</span></NavLink><NavLink to="/search"><Search/><span>Search</span></NavLink><NavLink to="/library"><Library/><span>Library</span></NavLink><NavLink to="/settings"><Settings/><span>Settings</span></NavLink></nav>}
    </div>
  );
}

export function App() {
  return <BrowserRouter><AppShell/></BrowserRouter>;
}
