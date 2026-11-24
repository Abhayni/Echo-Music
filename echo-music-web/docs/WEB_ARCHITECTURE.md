# Web Architecture

The browser app is an independent npm workspace at `echo-music-web/`.

## Frontend

- React, TypeScript, Vite, and React Router.
- One shared `HTMLAudioElement` player and queue serve search, Now Playing, local files, and the mini-player.
- Results show provider attribution, metadata, playback state, and unavailability reasons. Search supports provider filters and full-track/preview/external/unavailable playback filters.
- The player handles seek, volume/mute, shuffle/repeat, queue, persistence, keyboard controls, lyrics, and browser Media Session where supported.
- The interface is responsive and includes local search history, result loading/error/empty states, provider status details, library, playlists, and local audio playback.
- YouTube title, channel, thumbnail, duration, and video ID come from official Data API v3 search. Selecting a result searches enabled authorized audio providers; only an exact normalized title-and-artist match that passes the audio-provider resolver enters the shared HTML audio player. Original YouTube metadata remains separate from the actual playback track. The official IFrame Player API cannot provide audio-only playback through this engine and is not used.

## Backend

- Node.js Express API with Zod validation for provider search responses.
- `/api/search` validates query, category, provider filters, and pagination; independent provider failures are returned without discarding successful provider results.
- Search results are ranked using normalized Unicode text, exact title/artist matches, token similarity, and typo tolerance. Internet Archive results require explicit CC BY 4.0 metadata and qualifying full media.
- Audius uses its public official track-search API and only its documented track-stream endpoint; tracks with explicit stream restrictions are excluded. Search and audio controls were live-tested.
- Jamendo uses its official read API and server-side `JAMENDO_CLIENT_ID`; the direct stream URL is accepted only from Jamendo's HTTPS host. A client ID and live test are still required.
- Internet Archive searches and metadata are accessed server-side with request timeout, one retry for rate-limits/server errors, and a short in-memory search cache. New browser searches cancel the prior request.
- Search requests are limited per client IP. `/api/providers` exposes configured/unavailable state and capability reasons; `/api/providers/health` separately probes enabled providers and reports connection, credential, playback, and last-success information.
- Spotify and SoundCloud are deliberately unavailable because their terms conflict with mixed-source playback. YouTube Data API v3 search is enabled only with a server-side key and is metadata-only. See the [provider integration report](./PROVIDER_INTEGRATION.md).

## Playback authorization

- HTML audio is used only for local files and direct source URLs authorized by an enabled provider adapter.
- Audius playback is restricted to HTTPS requests to its official `/v1/tracks/{id}/stream` endpoint. Jamendo URLs must be HTTPS and hosted by Jamendo. Internet Archive URLs must be HTTPS and associated with an explicit CC BY 4.0 item license.
- Spotify and YouTube metadata are never treated as audio URLs. There is no YouTube audio extraction, unofficial scraping, YouTube player embedding, or simulated progress; failed exact matches are reported as unavailable.
- A provider result without an authorized in-app playback source is disabled and displays its actual reason.
- Browser autoplay, background playback, and Media Session support remain subject to browser/OS permissions and behavior.
