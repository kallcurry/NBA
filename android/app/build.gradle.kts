plugins {
    id("com.android.application")
}

android {
    namespace = "com.courtside.nba"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.courtside.nba"
        minSdk = 26
        targetSdk = 35
        versionCode = 5
        versionName = "1.1.4"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets {
        getByName("main").assets.srcDirs(
            "src/main/assets",
            layout.buildDirectory.dir("generated/webAssets").get().asFile
        )
    }
}

val syncWebAssets by tasks.registering(Copy::class) {
    from(rootProject.file("../public"))
    into(layout.buildDirectory.dir("generated/webAssets/public"))
}

tasks.named("preBuild").configure {
    dependsOn(syncWebAssets)
}
