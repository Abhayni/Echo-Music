# Setup

Requirements: Node.js 20.19+ and npm.

```bash
cd echo-music-web
npm install
cp .env.example .env
npm run dev
```

- Web UI: http://localhost:5173
- API: http://localhost:8787

The `.env` file is optional for defaults. `PORT` configures the API and Vite `/api` proxy target together; `VITE_PORT` configures the web server. The root `npm run dev` starts both services.

## Audius

The app uses Audius' public track-search and official track-stream endpoints. Real search and browser playback (including seek, pause, and resume) were verified without credentials. If Audius issues an API key for your deployment or quota, set `AUDIUS_API_KEY` on the API server; the key is sent only in a server request header.

## Enable Jamendo search and playback

1. Register an application in the [Jamendo developer portal](https://devportal.jamendo.com/) and review the [Jamendo API terms](https://devportal.jamendo.com/api_terms_of_use).
2. Set `JAMENDO_CLIENT_ID` in `echo-music-web/.env` for local development, or as a secret/environment variable on the API server for deployment.
3. Restart the API. The client ID is sent only in server-to-server Jamendo requests; do not use a `VITE_` variable.

Jamendo's official track endpoint provides metadata, a stream URL, and license details. App registration, approval/eligibility, quotas, and permitted use depend on Jamendo's current terms and plan. This repository's example contains placeholders only. The app reports Jamendo as disabled and explains the missing credential until configured. No live Jamendo search or playback was verified in this run.

Internet Archive search is available without credentials. Echo only plays qualifying full-length files from items whose metadata explicitly declares CC BY 4.0. User-selected local audio remains available in the shared player.

## YouTube search and authorized audio matching

1. Enable the [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) for a Google Cloud project and create an API key.
2. Set `YOUTUBE_API_KEY` in `echo-music-web/.env` for local development, or as a secret/environment variable on the API server for deployment.
3. Restart the API. The key is used only by server requests to the official YouTube Data API v3 search and video metadata endpoints. Do not use a `VITE_` variable.

Search is restricted to YouTube's Music video category. Echo displays returned title, channel, thumbnail, duration, and video ID metadata. The official YouTube IFrame Player API can play visible video, but it does not provide audio-only playback through Echo's shared HTML audio player. Selecting a result searches enabled Audius, Jamendo, and Internet Archive sources and accepts only an exact normalized title-and-artist match that has an authorized audio stream. The shared Echo player then clearly identifies the matched provider and preserves the YouTube metadata separately. Without a verified match, Echo reports “Audio playback unavailable.” It never redirects to YouTube, extracts audio, hides a YouTube player, or simulates progress. Health checks do not make billable API calls; a real search verifies API access. Quota errors and invalid keys are surfaced as provider errors. YouTube's default search quota cost applies. See [search.list](https://developers.google.com/youtube/v3/docs/search/list) and [videos.list](https://developers.google.com/youtube/v3/docs/videos/list).

## Spotify and SoundCloud

Spotify and SoundCloud are unsupported in this multi-provider search/player because their current terms prohibit the requested integration of their content with other services. Written approval for this specific use was not provided. `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SOUNDCLOUD_CLIENT_ID`, and `SOUNDCLOUD_CLIENT_SECRET` are blank placeholders in `.env.example` and are not read by the app. Do not set these expecting to enable the providers; SoundCloud's application registration requirements are not bypassed.

Keep `.env.example` limited to blank placeholders; never put working API credentials in an example file or client-side `VITE_` variable. If credential-like values in an example file were real, revoke and rotate them with their providers. See [Provider integration report](./PROVIDER_INTEGRATION.md) for provider-specific status and limitations.
