# Echo Music Web

A separate, browser-oriented implementation of Echo Music concepts. It does not modify or replace the Android source. One shared HTML audio player handles officially streamed Audius tracks, qualifying licensed Internet Archive recordings, Jamendo's official stream URLs when an API client ID is configured, and user-selected local files. YouTube Data API v3 provides metadata only; selecting a YouTube result searches authorized audio providers for an exact title-and-artist match.

Search aggregates enabled providers in parallel, ranks and deduplicates normalized metadata, supports provider and playback-availability filters, and surfaces provider failures independently. YouTube's official IFrame Player API can play visible video but cannot supply audio-only playback through Echo's shared HTML audio engine. A verified audio match plays with the matched provider's metadata and source attribution; absent a match, Echo reports “Audio playback unavailable.” No YouTube redirects, stream extraction, hidden players, or simulated progress are used.

Spotify and SoundCloud remain unsupported: their current official terms prohibit the requested combination of their content with other services in this multi-provider player, and no written approval was provided. Their credentials are ignored. YouTube search requires `YOUTUBE_API_KEY` on the API server; the key is never sent to the browser. See [`docs/PROVIDER_INTEGRATION.md`](./docs/PROVIDER_INTEGRATION.md) for provider health and per-provider verification details.

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Set `JAMENDO_CLIENT_ID` in the API server's `.env` to enable Jamendo requests. Audius public search/playback is enabled without an API key; optionally set `AUDIUS_API_KEY` on the server. Never expose provider credentials through Vite variables. Spotify and SoundCloud variables are reserved placeholders and do not enable API access.

## Validation

```bash
npm run check
npm test
npm run build
```
