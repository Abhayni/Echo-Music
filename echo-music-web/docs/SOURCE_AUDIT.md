# Source Audit

Audited the Echo Music Android repository, including its app-level Compose UI, ViewModels, Room database, playback service, provider modules, and supporting Gradle modules.

## Architecture
- **App:** Kotlin, Jetpack Compose, Hilt, MVVM, Material 3 with Echo's Nothing-inspired glass visual system.
- **Core:** shared domain models, repositories, Room entities/DAOs, DataStore keys, and media metadata.
- **Playback:** Media3/ExoPlayer, queues, chunked streaming, sleep timer, downloads, equalizer, and beat analysis.
- **Networking:** InnerTube/YouTube Music, Ktor/OkHttp/Retrofit, with separate LRCLIB, Kugou, BetterLyrics, SimpMusic, YouLysPlus, and Paxsenix lyrics providers.
- **Features:** Music Flow, Listen Together, Echo Find, Echo Brain, local media, Spotify, Discord, Last.fm, Odesli, Jellyfin/Navidrome, cloud backup, AI, canvas, artist video, and podcast browsing.

## Reused web models
- Track IDs, title, artists, album, duration, thumbnail, liked/library flags, and explicit/video state.
- Playlist entity semantics, including local and editable playlists.
- Search history, listening events, recognition history, song play stats, and taste-profile concepts.
- Listen Together message types and room state.

## Web boundary
The web application uses `echo-music-web/frontend` for React UI and `echo-music-web/server` for secure provider integrations, SQLite persistence, and room relay. Android-only device APIs are not reimplemented as fake controls.
