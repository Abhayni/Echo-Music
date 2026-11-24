# Platform Limitations

- **Ringtone:** Browsers cannot set an OS ringtone. Echo exposes no fake ringtone control.
- **Bluetooth codec telemetry:** Browser APIs do not reliably expose LDAC, aptX, or LC3 codec data.
- **USB DAC:** Web Audio cannot guarantee Android-style exclusivity or bit-perfect bypass of OS resampling.
- **ShazamKit:** Native ShazamKit is unavailable. Recognition requires a separately configured authorized browser/provider implementation.
- **Native notifications/background:** Service Workers can show notifications in supported contexts, but cannot reproduce Android media-session/background restrictions consistently.
- **Device media scanning:** Browser file access is constrained by user permission and no device-wide scan exists.
- **Android Cast:** Browser Cast may use the Google Cast web SDK only with authorized configuration.
- **Downloads:** Service Workers and browser download APIs can cache permitted media. They cannot bypass provider permissions or guarantee unrestricted background downloads.
- **Crossfade:** Implementable only after authorized resolved audio streams share compatible CORS/audio handling.
- **Offline playback:** The PWA shell is offline-capable, but media remains unavailable unless the provider permits caching and storage.
