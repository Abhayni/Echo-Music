# Web Architecture

## Runtime
- React 19, TypeScript, Vite, React Router, TanStack Query, Lucide icons, and Framer Motion.
- Express + TypeScript API server.
- SQLite via Better SQLite for local/self-hosted state.
- `youtubei.js` for server-side YouTube Music access.
- LRCLIB for authorized synchronized/plain lyrics.
- WebSocket relay for Listen Together.

## Frontend
The frontend owns one shared HTML5 Audio instance via `PlayerProvider`. Mini-player, track cards, queue actions, and future player surfaces must use this provider rather than creating audio elements independently.

## Backend
Secrets remain server-side. Provider requests and third-party credentials are never compiled into frontend JavaScript. Provider responses are mapped at the API boundary.

## Persistence
SQLite stores library items, playlists, settings, and listening history. Browser localStorage retains search history. Cached provider media should not be assumed to be legal or available offline.
