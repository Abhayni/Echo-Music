# Implementation Plan and Current State

## Implemented
1. Separate `echo-music-web` React/Vite application.
2. Express/SQLite API server.
3. Server-side YouTube Music home/search/suggestions/stream resolution.
4. Shared HTML5 Audio and Media Session playback store.
5. Search, home, library, settings, playlist creation, and listening history pages.
6. Persistent local library/settings/history.
7. Listen Together WebSocket relay with room creation, join, and state relay.
8. PWA manifest/service-worker shell.
9. Responsive desktop/mobile navigation and persistent mini-player.

## Remaining work
The repository-level migration is large. The next implementation gates are:
1. Strong normalized provider mappers instead of raw InnerTube parser objects.
2. Timed lyrics rendering and word-level provider support.
3. Album, artist, playlist, podcast, chart, mood, and release detail routes.
4. Full Music Flow gesture/page UI with shared player integration.
5. Download queue using Cache Storage/IndexedDB for explicitly permitted content.
6. Web Audio equalizer and persistent presets.
7. Authorized Echo Find provider and secure microphone flow.
8. Echo Brain port from `LocalTasteEngine`, `RecommendationEngine`, and bounded play stats.
9. OAuth integrations, AI provider proxy, and backup/restore.
10. Playwright, Vitest, accessibility, and API integration suites.

## Verification
- Frontend production build passes.
- API health endpoint passes.
- Live InnerTube search returns actual provider data.
- Playwright browser verification is blocked by missing OS browser libraries in the current environment; Chromium dependencies must be installed in a host with package installation permissions.
