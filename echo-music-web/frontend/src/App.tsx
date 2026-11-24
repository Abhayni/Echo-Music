import { useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Heart, Home, Library, Pause, Play, Search, Settings, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { api, type Track } from "./lib/api";
import { usePlayer } from "./lib/player";
import "./App.css";

function parseTracks(result: any): Track[] {
  const arrays = result?.sections?.flatMap((section: any) => section?.contents || []) || result?.contents || result?.items || [];
  return arrays.map((item: any) => ({
    id: item?.id || item?.videoId || item?.endpoint?.payload?.videoId,
    title: item?.title?.text || item?.title || "Unknown",
    artist: item?.author?.name || item?.artists?.[0]?.name || "Unknown artist",
    thumbnail: item?.thumbnail?.[0]?.url || item?.thumbnails?.[0]?.url || null,
  })).filter((track: Track) => track.id);
}

function IconButton({ label, children, onClick, active = false }: { label: string; children: React.ReactNode; onClick?: () => void; active?: boolean }) {
  return <button className={`icon-button ${active ? "active" : ""}`} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

function TrackGrid({ tracks }: { tracks: Track[] }) {
  const player = usePlayer();
  return <div className="track-grid">
    {tracks.map(track => <article className="track-card" key={track.id}>
      <button className="art-button" aria-label={`Play ${track.title}`} onClick={() => void player.play(track, tracks)}>
        {track.thumbnail ? <img src={track.thumbnail} alt="" /> : <div className="art-fallback" />}
        <span className="card-play"><Play size={18} fill="currentColor" /></span>
      </button>
      <strong>{track.title}</strong>
      <span>{track.artist}</span>
    </article>)}
  </div>;
}

function HomePage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["home"], queryFn: () => api<any>("/home") });
  const tracks = useMemo(() => parseTracks(data), [data]);
  return <section className="page">
    <header className="page-heading"><div><p className="eyebrow">Echo Music</p><h1>Good evening</h1></div></header>
    {isLoading && <div className="loading-grid">{Array.from({ length: 6 }).map((_, i) => <div className="shimmer" key={i} />)}</div>}
    {error && <div className="notice" role="alert">{(error as Error).message}</div>}
    {!isLoading && !error && (tracks.length ? <><h2>Made for you</h2><TrackGrid tracks={tracks} /></> : <div className="empty">No personalised feed is available from the provider.</div>)}
  </section>;
}

function SearchPage() {
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem("echo-search-history") || "[]"));
  const { data, isLoading, error } = useQuery({
    queryKey: ["search", query],
    queryFn: () => api<any>(`/search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length > 1,
  });
  useEffect(() => {
    if (!query.trim()) return;
    const timer = window.setTimeout(() => {
      setHistory((old: string[]) => {
        const next = [query.trim(), ...old.filter(value => value !== query.trim())].slice(0, 10);
        localStorage.setItem("echo-search-history", JSON.stringify(next));
        return next;
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [query]);
  const tracks = useMemo(() => parseTracks(data), [data]);
  return <section className="page">
    <header className="search-heading"><h1>Search</h1><label className="search-box"><Search size={20} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Songs, albums, artists..." /></label></header>
    {isLoading && <div className="loading-grid">{Array.from({ length: 5 }).map((_, i) => <div className="shimmer" key={i} />)}</div>}
    {error && <div className="notice" role="alert">{(error as Error).message}</div>}
    {!query && <><h2>Recent searches</h2>{history.length ? <div className="chips">{history.map((item: string) => <button key={item} onClick={() => setQuery(item)}>{item}</button>)}</div> : <div className="empty">No recent searches.</div>}</>}
    {query && !isLoading && <><h2>Results</h2>{tracks.length ? <TrackGrid tracks={tracks} /> : <div className="empty">No matching tracks found.</div>}</>}
  </section>;
}

function LibraryPage() {
  const [playlistName, setPlaylistName] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  useEffect(() => {
    Promise.all([api<any[]>("/library"), api<any[]>("/history")]).then(([library, recent]) => { setItems(library); setHistory(recent); }).catch(() => undefined);
  }, [refresh]);
  async function createPlaylist() {
    const name = playlistName.trim();
    if (!name) return;
    const id = `LP${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    await api(`/library/playlist/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name, isLocal: true }) });
    setPlaylistName("");
    setRefresh(value => value + 1);
  }
  const liked = items.filter(item => item.kind === "liked");
  const playlists = items.filter(item => item.kind === "playlist");
  return <section className="page"><header className="page-heading"><h1>Library</h1></header>
    <form className="playlist-form" onSubmit={event => { event.preventDefault(); void createPlaylist(); }}>
      <input value={playlistName} onChange={event => setPlaylistName(event.target.value)} placeholder="New playlist name" aria-label="New playlist name" />
      <button type="submit">Create playlist</button>
    </form>
    <h2>Liked songs</h2>{liked.length ? <TrackGrid tracks={liked.map(item => item.value)} /> : <div className="empty">Like a track to keep it here.</div>}
    <h2>Playlists</h2>{playlists.length ? <div className="chips">{playlists.map(item => <button key={item.id}>{item.value.name}</button>)}</div> : <div className="empty">No playlists yet.</div>}
    <h2>Recently played</h2>{history.length ? <TrackGrid tracks={history} /> : <div className="empty">Playback history will appear here.</div>}
  </section>;
}

function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  useEffect(() => { api<Record<string, any>>("/settings").then(setSettings).catch(() => undefined); }, []);
  async function update(key: string, value: unknown) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    await api("/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
  }
  return <section className="page"><h1>Settings</h1><div className="settings-list">
    <label><span><strong>Reduced motion</strong><small>Disable decorative transitions</small></span><input type="checkbox" checked={Boolean(settings.reducedMotion)} onChange={event => void update("reducedMotion", event.target.checked)} /></label>
    <label><span><strong>Data saver</strong><small>Prefer lower-quality artwork and streams</small></span><input type="checkbox" checked={Boolean(settings.dataSaver)} onChange={event => void update("dataSaver", event.target.checked)} /></label>
    <label><span><strong>Echo Brain</strong><small>Use listening context for queue recommendations</small></span><input type="checkbox" checked={settings.echoBrain !== false} onChange={event => void update("echoBrain", event.target.checked)} /></label>
  </div></section>;
}

function MiniPlayer() {
  const player = usePlayer();
  const [liked, setLiked] = useState(false);
  useEffect(() => setLiked(false), [player.track?.id]);
  async function toggleLike() {
    if (!player.track) return;
    if (liked) await api(`/library/liked/${player.track.id}`, { method: "DELETE" });
    else await api(`/library/liked/${player.track.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(player.track) });
    setLiked(value => !value);
  }
  if (!player.track) return null;
  return <aside className="mini-player">
    {player.track.thumbnail && <img src={player.track.thumbnail} alt="" />}
    <div className="mini-meta"><strong>{player.track.title}</strong><span>{player.track.artist}</span></div>
    <IconButton label={liked ? "Unlike" : "Like"} active={liked} onClick={() => void toggleLike()}><Heart size={18} fill={liked ? "currentColor" : "none"} /></IconButton>
    <IconButton label="Previous" onClick={player.previous}><SkipBack size={19} fill="currentColor" /></IconButton>
    <IconButton label={player.isPlaying ? "Pause" : "Play"} onClick={player.toggle}>{player.isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</IconButton>
    <IconButton label="Next" onClick={player.next}><SkipForward size={19} fill="currentColor" /></IconButton>
    <label className="volume"><Volume2 size={17} /><input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={player.volume} onChange={event => player.setVolume(Number(event.target.value))} /></label>
    <input className="seek" aria-label="Seek" type="range" min="0" max={Math.max(player.duration, 1)} step="1" value={player.currentTime} onChange={event => player.seek(Number(event.target.value))} />
    {player.error && <div className="player-error" role="alert">{player.error}</div>}
  </aside>;
}

export default function App() {
  const location = useLocation();
  const links = [
    { to: "/", label: "Home", icon: Home },
    { to: "/search", label: "Search", icon: Search },
    { to: "/library", label: "Library", icon: Library },
    { to: "/settings", label: "Settings", icon: Settings },
  ];
  return <div className="app-shell">
    <aside className="sidebar"><Link className="brand" to="/" aria-label="Echo Music home"><span>e</span><strong>Echo</strong></Link><nav>{links.map(({ to, label, icon: Icon }) => <Link className={location.pathname === to ? "active" : ""} to={to} key={to}><Icon size={20} /><span>{label}</span></Link>)}</nav></aside>
    <main><Routes><Route path="/" element={<HomePage />} /><Route path="/search" element={<SearchPage />} /><Route path="/library" element={<LibraryPage />} /><Route path="/settings" element={<SettingsPage />} /></Routes></main>
    <nav className="bottom-nav">{links.map(({ to, label, icon: Icon }) => <Link className={location.pathname === to ? "active" : ""} to={to} key={to}><Icon size={21} /><span>{label}</span></Link>)}</nav>
    <MiniPlayer />
  </div>;
}
