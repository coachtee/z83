# Z83 — Android

Native Kotlin + Jetpack Compose. Not a WebView — this talks to the same
`services/api` REST endpoints as `apps/web` (see `docs/API.md`).

## Modules

- **`:shared`** — pure Kotlin/JVM, no Android dependency. Data classes and
  request bodies mirroring `packages/types` / `packages/validation`'s
  schemas (`Vacancy`, `Profile`, `MatchResult`, `Application`,
  `ProfileUpdateRequest`, …), `kotlinx.serialization`-annotated so they
  decode/encode against `services/api` directly.
- **`:app`** — the Android application module: Compose UI, navigation,
  and an OkHttp-based `ApiClient`.

## The applicant journey this covers

Login/register → Home → Profile (personal particulars, qualifications,
work experience, references, documents, all as sections of one screen —
mirroring `apps/web`'s profile page rather than splitting into a maze of
sub-screens) → Vacancies (with match %) → Vacancy detail ("why this
matches," matched/missing/unknown requirements) → Apply → review → sign
(drawn on a Compose canvas) → prepare + send email, or prepare a
print-ready package and mark hand-delivered → My Applications.

Every screen is a thin view over the same server-side logic the web app
uses — matching, validation, and snapshotting all happen in `services/api`,
never re-implemented here.

## Local dev networking

`ApiClient` defaults to `http://10.0.2.2:4000` (the Android emulator's
alias for the host machine running `services/api` in dev). Cleartext HTTP
is normally blocked on Android 9+; `res/xml/network_security_config.xml`
opens a narrow exception for `10.0.2.2` and `localhost` only — everything
else stays HTTPS-only. Point `ApiClient` at a real `https://` URL for
anything beyond local development; don't widen the cleartext exception to
do it.

## What's actually verified here

This sandbox has no Android SDK, and `dl.google.com` (Google's Maven
repository, needed for the Android Gradle Plugin, AndroidX, and Compose
artifacts) is confirmed blocked by the environment's network policy
(direct `curl` test, not assumed). That means:

- **`:shared` builds and its tests pass for real** in this environment:
  `./gradlew :shared:test --configure-on-demand`. Run without
  `--configure-on-demand` and Gradle will also try to configure `:app`,
  which needs the Android plugin.
- **`:app` has not been compiled, built, or run here.** Its Kotlin/Compose
  source is written the same way any Android engineer would write it —
  reviewed carefully by hand for the mistakes a compiler would normally
  catch — but it is genuinely unverified in this sandbox specifically.
  `app/build.gradle.kts` applies `org.jetbrains.kotlin.plugin.compose`
  version `2.1.0` alongside `org.jetbrains.kotlin.android` — required
  since Kotlin 2.0 decoupled the Compose compiler from the Kotlin Gradle
  plugin, and the version must match the Kotlin version exactly. This was
  reported failing on a real Windows build (`Starting in Kotlin 2.0, the
  Compose Compiler Gradle plugin is required when compose is enabled`)
  and fixed here, but re-running `:app:assembleDebug` in this sandbox
  still fails at the earlier, unrelated `com.android.application` plugin
  resolution step (the `dl.google.com` block above) before Gradle ever
  gets far enough to re-resolve the Compose compiler plugin — so this fix
  is unverified end-to-end here too, and should be confirmed by an actual
  build on a machine with SDK/network access next.
  because the plugin repository is unreachable, not skipped for
  convenience. **On a machine with normal internet access and an Android
  SDK** (`compileSdk = 35`, `minSdk = 26`, JDK 17+):

  ```
  ./gradlew :app:assembleDebug   # build the debug APK
  ./gradlew :app:testDebugUnitTest
  ./gradlew :app:lintDebug
  ```

  Then install on an emulator or device (`adb install app/build/outputs/apk/debug/app-debug.apk`,
  or `./gradlew :app:installDebug` with a device/emulator already running)
  and walk the applicant journey above by hand. If testing against
  `services/api` on the same machine from a physical device rather than an
  emulator, use `adb reverse tcp:4000 tcp:4000` and point `ApiClient` at
  `http://localhost:4000` instead of `10.0.2.2`.

## Why a separate `:shared` module instead of one Android app module

The whole point of sharing a data model with the web app is that the
shapes are defined once and reused, not redefined per platform. Putting
them in a plain Kotlin/JVM module (rather than directly in `:app`) means
they carry no Android dependency, which is also what let this module be
built and tested in an environment with no Android SDK at all.
