// Intentionally empty: plugin versions are declared directly in each
// module's own build.gradle.kts (see shared/build.gradle.kts and
// app/build.gradle.kts) rather than the usual root plugins{} block. That
// keeps `./gradlew :shared:test` from ever needing to resolve the Android
// Gradle Plugin — useful in any environment (like this one) where
// dl.google.com isn't reachable but the pure-Kotlin :shared module should
// still build and test on its own.
