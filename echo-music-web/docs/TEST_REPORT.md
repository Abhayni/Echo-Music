# Test Report

## Verified

- `npm run check`: client and server TypeScript checks passed.
- `npm test`: 17 client tests and 27 server tests passed.
- `npm run build`: client and server production builds passed.
- Playwright verified that an exact title-and-artist match enters the shared player, keeps YouTube metadata separate from the Audius playback source, supports play/pause, seek, queue next/previous, and does not embed or navigate to YouTube. The audio response in this integration test is a controlled WAV fixture, not a live provider recording.
- Playwright verified that an artist mismatch reports “Audio playback unavailable” and does not start playback.
- Real Audius playback, seeking, pause, and resume passed in Chromium using its official stream endpoint.
- Real Internet Archive playback advanced in the shared player on mobile. The longer desktop test that waits past 30 seconds encountered a Chromium target crash, so long-duration desktop playback/seeking was not verified in this run.
- Live YouTube Data API searches for Pal Pal, Aarzu, Kesariya, Tum Hi Ho, and Believer returned genuine result metadata including video IDs and durations. No exact normalized title-and-artist match was found in the enabled authorized audio providers for the top result of any of these searches. Jamendo returned an error during the Believer match search; Audius and Internet Archive searches completed.

## Limitations

- No real YouTube-to-authorized-audio playback could be demonstrated for the five requested titles because none produced an exact title-and-artist match. Echo reports the source unavailable rather than substituting a different recording.
- Jamendo's live playback has not been verified. A provider search error is surfaced rather than treated as a match.
- YouTube Data API metadata search is live; YouTube itself does not provide direct audio URLs, and its official IFrame Player API is not used as a substitute for shared-player audio.
- Spotify and SoundCloud remain disabled; no requests were made to them.

Mocked metadata and player tests are not live provider verification. See [`PROVIDER_INTEGRATION.md`](./PROVIDER_INTEGRATION.md) for provider-specific status and official documentation.
