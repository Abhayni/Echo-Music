# Echo Music Web

A separate responsive web migration of Echo Music.

## Run

```bash
npm install
npm run dev
```

The API normally runs on `4174` (`/health` and `/api/health`); if that port is in use, `npm run dev` selects the next available port. Vite runs on `5173` and proxies `/api` and `/ws` to the selected API port. Set `PORT` to request a specific API port.
The API is started once in development, without a file watcher restarting it on source changes.

## Build

```bash
npm run build
```

## Data

SQLite data is stored in `echo-music-web/data/echo.db` by default. Set `ECHO_DATA_DIR` to override the directory.
