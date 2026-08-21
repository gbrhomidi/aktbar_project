# Android Native Migration

The repository now contains a buildable Android application under `app/`. The native path uses Kotlin, Jetpack Compose, Navigation Compose, ViewModels, feature repositories, and a single `DatabaseHelper.kt` SQLite boundary. The original PWA remains under `app/src/main/assets/legacy` and is opened only by the explicit legacy WebView destination.

The native application never routes data access through localhost, NanoHTTPD, an internal REST server, or a WebView backend. `BackupWorker` creates periodic JSON backups from SQLite, while `SMSService` is an explicit Android service that requires the platform SMS permission.

Build locally with `./gradlew assembleDebug` and `./gradlew assembleRelease`. GitHub Actions runs both builds for `main`, the refactor branch family, and pull requests.
