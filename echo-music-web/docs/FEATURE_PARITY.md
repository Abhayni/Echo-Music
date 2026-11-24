# Feature Parity

| Original feature | Original source location | Web implementation | Status | Test |
|---|---|---|---|---|
| Home feed | `app/ui/screens/HomeScreen.kt`, `viewmodels/HomeViewModel.kt` | Server InnerTube home feed | Requires an authorised external service | `/api/home` |
| Search and suggestions | `OnlineSearchViewModel.kt`, `OnlineSearchSuggestionViewModel.kt` | Debounced server search UI | Requires an authorised external service | `/api/search`, `/api/search/suggestions` |
| Streaming playback | `playback/MusicService.kt`, `playback/PlayerConnection.kt` | Shared HTML5 Audio store and mini-player | Supported with a web equivalent | Play endpoint smoke test |
| Queue, seek, repeat, shuffle | `playback/`, `ui/player/Queue.kt` | Queue/seek/next/previous controls | Partially supported on web | Vitest/Playwright |
| Library and playlists | Room entities/DAOs | SQLite library API and React pages | Fully supported on web | API integration tests |
| Listening history | `Event.kt`, `SongPlayStatsEntity.kt` | SQLite history endpoint | Fully supported on web | API integration tests |
| Synchronized lyrics | `lyrics/`, LRCLIB/Kugou/BetterLyrics modules | LRCLIB timed/plain retrieval endpoint | Requires an authorised external service | `/api/lyrics/:id` |
| Music Flow | `app/musicflow/`, `ui/component/musicflow/` | Documentation implemented; vertical UI pending | Not currently implementable as parity without provider feed mapping | Pending |
| Downloads/offline | `ExoDownloadService.kt`, `DownloadUtil.kt` | PWA shell plus limitation-aware metadata; unrestricted media downloads not enabled | Browser or operating-system restricted | PWA smoke test |
| Equalizer | `playback/audio/`, `audio-dsp/`, `dsp-core/`, `usbaudio/` | Not yet mapped to Web Audio nodes | Browser or operating-system restricted | Pending |
| Echo Find | `recognition/`, `shazamkit/` | UI/provider absent | Requires an authorised external service | Pending |
| Echo Brain | `generate/`, `ai/` | Settings and listening-history data exist; original algorithm not yet fully ported | Not currently implementable without original model audit | Pending |
| Listen Together | `listentogether/`, original protocol | WebSocket rooms and relay | Supported with a web equivalent | WebSocket integration test |
| Spotify import | `spotifyimport/` | Not implemented without OAuth credentials | Requires an authorised external service | Pending |
| Discord Rich Presence | `discord/` | Browser alternative is documented only | Browser or operating-system restricted | Pending |
| Last.fm | `core/models/lastfm/` | Not implemented without credentials | Requires an authorised external service | Pending |
| AI lyrics/Music DNA | `app/ai/`, `SongDnaBottomSheet.kt` | Server-side AI integration remains to be configured | Requires an authorised external service | Pending |
| Data saver/density/reduced motion | DataStore and Compose settings | Persisted settings endpoint and reduced-motion control | Supported with a web equivalent | Settings API test |
| Cast | Play Services Cast | Native Cast not implemented | Browser or operating-system restricted | Pending |
| Ringtone setting | Android ringtone/trimmer code | Not exposed as a web control | Browser or operating-system restricted | N/A |
| USB DAC/codec telemetry | `usbaudio/`, Bluetooth utilities | Not claimable in browsers | Browser or operating-system restricted | N/A |
| Backup/restore | `BackupRestoreViewModel.kt` | SQLite export/import pending | Supported with a web equivalent | Pending |
| Local media scanning | `localmedia/` | File System or file input can provide a future equivalent | Browser or operating-system restricted | Pending |
