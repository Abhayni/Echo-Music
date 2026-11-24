import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import Innertube from "youtubei.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const dataDir = path.resolve(process.env.ECHO_DATA_DIR || path.join(process.cwd(), "data"));
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "echo.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS library (id TEXT PRIMARY KEY, kind TEXT NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS history (id TEXT PRIMARY KEY, track TEXT NOT NULL, played_at INTEGER NOT NULL);
`);

let yt: Awaited<ReturnType<typeof Innertube.create>>;
async function youtube() {
  yt ||= await Innertube.create({ lang: "en", location: "US", retrieve_player: false });
  return yt;
}

const trackShape = (item: any) => ({
  id: item?.id || item?.videoId || item?.endpoint?.payload?.videoId,
  title: item?.title?.text || item?.title || item?.name || "Unknown title",
  artist: item?.author?.name || item?.artists?.[0]?.name || item?.artist?.name || "Unknown artist",
  album: item?.album?.name || null,
  thumbnail: item?.thumbnail?.[0]?.url || item?.thumbnails?.[0]?.url || null,
  duration: item?.duration?.seconds || item?.duration?.text ? Number(item?.duration?.seconds || 0) : null,
});

const health = (_req: express.Request, res: express.Response) =>
  res.json({ status: "ok", service: "echo-api" });
app.get("/health", health);
app.get("/api/health", health);

app.get("/api/home", async (_req, res) => {
  try {
    const feed = await (await youtube()).music.getHomeFeed();
    res.json(feed);
  } catch (error: any) {
    res.status(502).json({ error: "Could not load the YouTube Music home feed", detail: error?.message });
  }
});

app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ songs: [], albums: [], artists: [], playlists: [], podcasts: [] });
  try {
    const result = await (await youtube()).music.search(q);
    res.json(result);
  } catch (error: any) {
    res.status(502).json({ error: "Search provider unavailable", detail: error?.message });
  }
});

app.get("/api/search/suggestions", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json([]);
  try {
    const sections = await (await youtube()).music.getSearchSuggestions(q);
    const values = sections.flatMap((section: any) => section?.suggestions?.map((x: any) => x?.text || x) || []);
    res.json([...new Set(values)]);
  } catch (error: any) {
    res.status(502).json({ error: "Suggestion provider unavailable", detail: error?.message });
  }
});

app.get("/api/track/:id", async (req, res) => {
  try {
    const info = await (await youtube()).music.getInfo(req.params.id);
    res.json(info);
  } catch (error: any) {
    res.status(502).json({ error: "Could not resolve track", detail: error?.message });
  }
});

app.get("/api/stream/:id", async (req, res) => {
  try {
    const info = await (await youtube()).getBasicInfo(req.params.id);
    const formats = info.streaming_data?.adaptive_formats || [];
    const audio = formats
      .filter((format: any) => format.has_audio && !format.has_video)
      .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    if (!audio?.decipher) return res.status(404).json({ error: "No authorised web audio stream available" });
    await audio.decipher();
    res.json({ url: audio.url, mimeType: audio.mime_type, bitrate: audio.bitrate });
  } catch (error: any) {
    res.status(502).json({ error: "Could not resolve stream", detail: error?.message });
  }
});

app.get("/api/lyrics/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const track = await (await youtube()).music.getInfo(id);
    const title = track.basic_info?.title || "";
    const artist = track.basic_info?.author || "";
    if (title) {
      const lrclib = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`);
      if (lrclib.ok) {
        const data: any = await lrclib.json();
        res.json({ lines: data.syncedLyrics ? data.syncedLyrics : [], plain: data.plainLyrics || null, provider: "LRCLIB" });
        return;
      }
    }
    res.json({ lines: [], plain: null, provider: "none", unavailable: true });
  } catch (error: any) {
    res.status(502).json({ error: "Lyrics unavailable", detail: error?.message });
  }
});

app.get("/api/library", (req, res) => {
  const kind = req.query.kind ? String(req.query.kind) : null;
  const rows = kind
    ? db.prepare("SELECT id, kind, value, updated_at FROM library WHERE kind = ? ORDER BY updated_at DESC").all(kind)
    : db.prepare("SELECT id, kind, value, updated_at FROM library ORDER BY updated_at DESC").all();
  res.json(rows.map((row: any) => ({ ...row, value: JSON.parse(row.value) })));
});

app.put("/api/library/:kind/:id", (req, res) => {
  db.prepare("INSERT OR REPLACE INTO library (id, kind, value, updated_at) VALUES (?, ?, ?, ?)").run(req.params.id, req.params.kind, JSON.stringify(req.body), Date.now());
  res.json({ ok: true });
});

app.delete("/api/library/:kind/:id", (req, res) => {
  db.prepare("DELETE FROM library WHERE id = ? AND kind = ?").run(req.params.id, req.params.kind);
  res.json({ ok: true });
});

app.get("/api/settings", (_req, res) => {
  const rows = db.prepare("SELECT key, value FROM settings").all() as Array<{ key: string; value: string }>;
  res.json(Object.fromEntries(rows.map(row => [row.key, JSON.parse(row.value)])));
});

app.put("/api/settings", (req, res) => {
  const put = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  const save = db.transaction((values: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(values)) put.run(key, JSON.stringify(value));
  });
  save(req.body);
  res.json({ ok: true });
});

app.post("/api/history", (req, res) => {
  const track = req.body;
  db.prepare("INSERT OR REPLACE INTO history (id, track, played_at) VALUES (?, ?, ?)").run(track.id, JSON.stringify(track), Date.now());
  res.json({ ok: true });
});

app.get("/api/history", (_req, res) => {
  const rows = db.prepare("SELECT track, played_at FROM history ORDER BY played_at DESC LIMIT 100").all() as Array<{ track: string; played_at: number }>;
  res.json(rows.map(row => ({ ...JSON.parse(row.track), played_at: row.played_at })));
});

const port = Number(process.env.PORT || 4174);
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws/listen-together" });
wss.on("error", error => {
  console.error("Echo WebSocket server error", error);
});
const rooms = new Map<string, any>();
wss.on("connection", socket => {
  (socket as any).roomCode = null;
  socket.on("message", raw => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === "create_room") {
        const code = Math.random().toString(36).slice(2, 8).toUpperCase();
        const room = { code, users: new Set([socket]), state: { isPlaying: false, position: 0, queue: [], currentTrack: null } };
        rooms.set(code, room);
        (socket as any).roomCode = code;
        socket.send(JSON.stringify({ type: "room_created", payload: { roomCode: code } }));
      } else if (message.type === "join_room") {
        const room = rooms.get(String(message.payload?.roomCode || "").toUpperCase());
        if (!room) return socket.send(JSON.stringify({ type: "error", payload: { code: "room_not_found", message: "Room not found" } }));
        room.users.add(socket);
        (socket as any).roomCode = room.code;
        socket.send(JSON.stringify({ type: "sync_state", payload: room.state }));
      } else if (message.type === "leave_room") {
        const room = rooms.get((socket as any).roomCode);
        room?.users.delete(socket);
      } else {
        const room = rooms.get((socket as any).roomCode);
        if (!room) return;
        if (["sync_playback", "sync_queue", "playback_action"].includes(message.type)) {
          if (message.payload?.state) room.state = { ...room.state, ...message.payload.state };
          for (const peer of room.users) {
            if (peer !== socket) peer.send(JSON.stringify(message));
          }
        }
      }
    } catch {
      socket.send(JSON.stringify({ type: "error", payload: { code: "invalid_message", message: "Invalid message" } }));
    }
  });
  socket.on("close", () => {
    const room = rooms.get((socket as any).roomCode);
    room?.users.delete(socket);
  });
});

server.once("error", error => {
  console.error(`Echo API failed to listen on port ${port}`, error);
  process.exitCode = 1;
});
server.listen(port, "0.0.0.0", () => console.log(`Echo API listening on http://0.0.0.0:${port}`));
