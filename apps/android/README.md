# Z83 — Android

Native Kotlin + Jetpack Compose. Not a WebView — this talks to the same
`services/api` REST endpoints as `apps/web` (see `docs/API.md`).

## Modules

- **`:shared`** — pure Kotlin/JVM, no Android dependency. Data classes
  mirroring `packages/types` (`Vacancy`, `Profile`, `MatchResult`,
  `Application`, …), `kotlinx.serialization`-annotated so they decode
  `services/api` responses directly.
- **`:app`** — the Android application module: Compose UI, navigation,
  and an OkHttp-based `ApiClient`.

## What's actually verified here

This sandbox has no Android SDK, and `dl.google.com` (Google's Maven
repository, needed for the Android Gradle Plugin, AndroidX, and Compose
artifacts) is blocked by the environment's network policy — confirmed with
a direct `curl`, not assumed. That means:

- **`:shared` builds and its tests pass for real** in this environment:
  `./gradlew :shared:test --configure-on-demand`. Run without
  `--configure-on-demand` and Gradle will also try to configure `:app`,
  which needs the Android plugin.
- **`:app` has not been compiled or run here.** Its Kotlin/Compose source
  is written the same way any Android engineer would write it, but it is
  unverified in this sandbox specifically because the plugin repository is
  unreachable, not because it was skipped for convenience. Build it on a
  machine with normal internet access and an Android SDK
  (`compileSdk = 35`, `minSdk = 26`):

  ```
  ./gradlew :app:assembleDebug
  ```

## Scope of this vertical slice

Per `docs/VERTICAL-SLICE.md`, Android is intentionally read-only for now:
sign in, browse published vacancies, open one and see the match breakdown
(matched / missing / unknown requirements, same advisory wording as the
web app — "appears to match," never "eligible"). Profile editing,
document upload, applying, and signing are web-first; porting those
screens is follow-up work once the API contract is stable, not part of
this slice.

## Why a separate `:shared` module instead of one Android app module

The whole point of sharing a data model with the web app is that the
shapes are defined once and reused, not redefined per platform. Putting
them in a plain Kotlin/JVM module (rather than directly in `:app`) means
they carry no Android dependency, which is also what let this module be
built and tested in an environment with no Android SDK at all.
