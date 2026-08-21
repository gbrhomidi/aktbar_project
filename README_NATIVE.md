# Android Release Migration

The repository contains an Android application under `app/`. The installed product UI is the original PWA interface, served from `app/src/main/assets/legacy` through a hardened WebView host. The HTML, CSS, JavaScript, images, sounds, and fonts remain the source of the screen design; Compose and the native data/service layers are not used to redraw or replace those screens.

The Android host provides lifecycle handling, state restoration, Android file choosing, Downloads export bridges, optional WebRTC media permissions, and safe local asset loading. It does not route the legacy application through localhost, NanoHTTPD, an internal REST server, or a WebView backend.

The only release command and deliverable are:

```bash
./gradlew --no-daemon clean assembleRelease
```

The resulting installable APK is `app/build/outputs/apk/release/app-release.apk`. Release is signed with the standard Android debug keystore solely to make this reproducible test release installable without requiring a private production signing secret. GitHub Actions runs the same `clean assembleRelease` command and uploads only that release APK.
