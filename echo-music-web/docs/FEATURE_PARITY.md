# Feature Parity

| Original feature | Original source location | Web implementation | Status | Test |
|---|---|---|---|---|
| Home/recently played | `ui/screens/HomeScreen.kt`, `HistoryScreen.kt` | React home, persistent recent history | Supported with web equivalent | Browser |
| Global search | `ui/screens/search/` | Parallel search across YouTube Data API v3, Audius, Internet Archive CC BY 4.0, and configured Jamendo; provider and playback filters; provider health dashboard | YouTube metadata only; matching authorized audio plays in the shared player when an exact title and artist match is verified; Jamendo live access remains unverified | API + browser |
| Music search | `innertube/pages/SearchPage.kt` | Ranked, deduplicated metadata from YouTube Data API v3, Audius, licensed Archive records, and Jamendo's official track endpoint | YouTube metadata is not playable audio; only verified authorized provider matches are substituted and identified | API + browser tests |
| Suggestions and search history | `OnlineSearchSuggestionViewModel.kt`, `SearchHistory` | Debounced recent-query suggestions and clearable local history | Supported with web equivalent | Browser |
| Commercial catalog/trending/charts/genres/moods/new releases | `innertube/pages/`, `ChartsScreen.kt`, `MoodAndGenresScreen.kt` | No authorized matching catalog feed; not fabricated | Requires another authorized catalog service | Pending |
| Recommendations/related songs/Echo Brain | `generate/RecommendationEngine.kt`, `musicflow/MusicFlowRanking.kt` | Original algorithms audited; live catalog expansion/Last.fm signals absent | Requires authorized catalog and/or Last.fm access | Pending |
| Podcasts | `innertube/pages/PodcastPage.kt`, `ui/screens/podcast/` | Separate category restricted to explicitly licensed Internet Archive podcast records | Supported with a limited web catalog | API + browser |
| Album/artist pages and discovery | `ui/screens/AlbumScreen.kt`, `ArtistScreen.kt` | Category results derive from licensed provider metadata; entity detail pages remain incomplete | Partially implemented; provider metadata and catalog coverage limit results | Browser |
| Playback, seek, volume, mute | `playback/MusicService.kt` | Shared audio-only HTMLAudioElement for eligible Audius/Archive/Jamendo streams and local files | Audius and Archive playback tested; Jamendo playback remains unverified | Unit + live browser |
| Queue | `playback/queues/` | Persistent authorized-track queue, add/remove/clear, next/previous | Supported with web equivalent | Browser + unit |
| Repeat/shuffle | Playback settings | Repeat off/all/one and shuffle state/control | Supported with web equivalent | Unit + browser |
| Media Session | Android Media3 | Browser Media Session metadata/play/pause/seek/next/previous | Supported with a web equivalent where browser supports it | Type-check + browser |
| Persistent playback restoration | `PersistPlayerState`, Media3 session | Current track, queue, playhead and settings persist for audio sources | Supported with browser autoplay limitation | Local-file reload browser test |
| Background playback | Android foreground service | Browser tab/media playback; OS suspension varies | Browser/OS restricted | Manual |
| Keyboard controls | Original player settings | Space toggles; arrows seek; Alt+arrows skip | Supported with web equivalent | Browser |
| Library and playlists | Room entities/DAOs | Persistent liked tracks, create/rename/delete, add/remove, reorder | Supported with web equivalent | Playlist browser test |
| Lyrics providers/fallback | `lyrics/` providers, `LyricsProviderRegistry` | LRCLIB only | Requires external lyrics services; provider selection/fallback missing | API integration |
| Lyrics synchronization | Compose lyrics components | Active line follows actual audio position and seeks | Supported with web equivalent when timed lyrics exist | Browser/manual |
| Word sync/translation/offset/animation controls | `LyricsV2`, translation helpers/settings | Not implemented | Requires source data/services | Pending |
| Music Flow | `ui/component/musicflow/`, `musicflow/` | Full-screen track view sharing the player | Supported with web equivalent | Browser |
| Theme/volume/playback preferences | DataStore/settings screens | Persistent dark/light theme, volume, repeat, shuffle | Partially implemented | Type-check + browser |
| Appearance/content/data-saver/audio-quality settings | Original settings screens/preferences | Not implemented | Not currently implemented | Pending |
| User local audio | `localmedia/` | User-picked audio files stored in IndexedDB and restored through the shared player | Supported with web equivalent | Browser playback/reload test |
| Downloads/offline | `ExoDownloadService.kt` | Not implemented; CC BY source downloads are not managed or cached | Browser restricted | Pending |
| Equalizer/DSP | `audio-dsp/`, `dsp-core/`, `EqScreen.kt` | Web Audio architecture pending | Supported with web equivalent where audio sources permit | Pending |
| Echo Find | `recognition/`, `shazamkit/` | Not implemented | Requires authorized recognition service and microphone support | Pending |
| Echo Brain | `generate/`, `musicflow/` | Original score/ranking not ported; no provider endpoint | Requires authorized external catalog data | Pending |
| Listen Together | `listentogether/` | Protocol documented but server rooms absent | Requires backend/protocol service | Pending |
| Spotify import/playback | `spotifyimport/`, `spotify/` | Not integrated into the multi-provider web app | Spotify's developer policy conflicts with combining Spotify content and other services' streams | Deliberately unavailable |
| Discord presence | `discord/` | Not implemented | Requires authorized integration | Pending |
| Odesli sharing | Integrations | Not implemented | Requires an external service | Pending |
| Last.fm/scrobbling | `utils/lastfm/`, `ScrobbleManager.kt` | Not implemented | Requires API credentials | Pending |
| Google Drive backup/restore | GMS integration | Not implemented | Requires OAuth and browser service | Pending |
| Cast | Android Cast | No browser Cast session implementation | Browser restricted | Pending |
| AI translation | `lyrics/LyricsTranslationHelper.kt` | Not implemented | Requires server-side AI API key/provider | Pending |
| Music DNA | README feature, Genius/Wikipedia helpers | Not implemented | Requires external services | Pending |
| Canvas/artist videos | `canvas/`, `applecanvas/`, `artistvideo/` | Not implemented | Requires provider endpoints and playback rights | Pending |
| Backup/export/data deletion | `BackupAndRestore.kt`, privacy settings | local clear-data action only; export/import missing | Partially implemented | Pending |
| Authentication/accounts/extensions | `AccountScreen.kt`, `ExtensionManager.kt` | Not implemented | Requires secure service/OAuth configuration | Pending |
| Ringtone | `RingtoneHelper.kt` | Not reproducible | Browser/OS restricted | Pending |
| Bluetooth codec | USB/Bluetooth modules | Not reproducible | Browser/OS restricted | Pending |
| USB DAC bit-perfect | `usbaudio/` | Not reproducible | Browser/OS restricted | Pending |
| Native notifications/widgets | Android app/widget modules | Browser notifications pending permissions | Browser restricted | Pending |
| PWA/offline shell | Android APK | No service worker/offline app shell | Supported by browsers in principle; not implemented | Pending |
