# Source Audit

Audited repository: EchoMusicApp/Echo-Music, Echo Music 1.4.8 Android source.

## Scope
- 742 Kotlin source files across app and feature modules.
- 19 multi-module Gradle features, including innertube, lyrics, playback, shazamkit, canvas, cloud, unison, DSP, USB audio, and recognition.
- Room database at version 48 with 48 generated schema snapshots.
- Original Compose navigation, screenshots, fonts, artwork, and raw assets.
- Android and web/licensing constraints recorded rather than bypassed.

## Reusable original concepts
- MVVM-style feature separation.
- Shared queue, player, and metadata concepts.
- Lyrics provider fallback and timed-lyrics synchronization concepts.
- Playlist, liked-song, listening-history, recognition-history, and track-stat entities.
- Music Flow ranking inputs and artist-spacing behavior.
- Listen Together protocol message and room state model.
- Equalizer/preset and audio-effect settings concepts.

## Original source hotspots
- UI/navigation: `app/src/main/kotlin/com/music/echo/ui/screens/NavigationBuilder.kt`
- Playback: `app/src/main/kotlin/com/music/echo/playback/MusicService.kt`
- Database: `core/src/main/kotlin/echo/music/iad1tya/db/MusicDatabase.kt`
- Lyrics: `lyrics/src/main/kotlin/echo/music/iad1tya/lyrics/LyricsHelper.kt`
- Music discovery: `innertube/src/main/kotlin/com/music/innertube/YouTube.kt`
- Recognition: `app/src/main/kotlin/com/music/echo/recognition/MusicRecognitionService.kt`
- Listen Together: `app/src/main/kotlin/com/music/echo/listentogether/Protocol.kt`
- Ranking: `app/src/main/kotlin/com/music/echo/musicflow/MusicFlowRanking.kt`
- Recommendation: `app/src/main/kotlin/com/music/echo/generate/RecommendationEngine.kt`
