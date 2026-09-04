plugins {
    kotlin("jvm") version "2.1.0"
    kotlin("plugin.serialization") version "2.1.0"
}

kotlin {
    // Sets the emitted bytecode version directly (matching :app's own
    // jvmTarget = "17") instead of jvmToolchain(), which forces Gradle
    // to locate or auto-provision a JDK of that *exact* version — with
    // no toolchain resolver configured, that fails on any machine that
    // doesn't happen to have that precise JDK installed. This compiles
    // fine with any JDK 17+ already running Gradle, same as :app.
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

// The kotlin("jvm") plugin auto-applies the java plugin, whose compileJava
// otherwise defaults to targeting whatever JDK runs Gradle — must match
// the Kotlin target above or Gradle refuses to compile.
java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
}
