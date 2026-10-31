#!/usr/bin/env bash
# Build the standalone Courtside Android APK with the Android SDK command-line
# tools. This intentionally avoids Gradle so the APK can be built on a machine
# without an Android Studio installation.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_HOME="${ANDROID_HOME:-/tmp/android-build/sdk}"
BUILD_TOOLS="${BUILD_TOOLS:-$ANDROID_HOME/build-tools/35.0.0}"
PLATFORM="${PLATFORM:-$ANDROID_HOME/platforms/android-35/android.jar}"
JAVA_HOME="${JAVA_HOME:-/tmp/android-build/jdk-21.0.13+9}"
JAVAC="$JAVA_HOME/bin/javac"
KEYTOOL="$JAVA_HOME/bin/keytool"
BUILD="$ROOT/build/manual"
DIST="$ROOT/dist"
VERSION="1.1.3"

if [[ ! -x "$BUILD_TOOLS/aapt2" ]]; then
  echo "aapt2 not found under $BUILD_TOOLS" >&2
  exit 1
fi
if [[ ! -f "$PLATFORM" ]]; then
  echo "android.jar not found at $PLATFORM" >&2
  exit 1
fi

rm -rf "$BUILD"
mkdir -p "$BUILD/assets" "$BUILD/classes" "$BUILD/dex" "$BUILD/gen" "$DIST"

# Bundle the PWA assets exactly as they are served by server.mjs.
cp -R "$ROOT/../public/." "$BUILD/assets/public/"

echo "[1/6] Compiling resources"
"$BUILD_TOOLS/aapt2" compile --dir "$ROOT/app/src/main/res" -o "$BUILD/res.zip"

echo "[2/6] Linking APK resources and assets"
"$BUILD_TOOLS/aapt2" link \
  -o "$BUILD/unsigned.apk" \
  -I "$PLATFORM" \
  --manifest "$ROOT/app/src/main/AndroidManifest.xml" \
  -R "$BUILD/res.zip" \
  -A "$BUILD/assets" \
  --java "$BUILD/gen" \
  --auto-add-overlay \
  --min-sdk-version 26 \
  --target-sdk-version 35 \
  --version-code 4 \
  --version-name "$VERSION"

echo "[3/6] Compiling Java"
find "$ROOT/app/src/main/java" "$BUILD/gen" -name '*.java' > "$BUILD/sources.txt"
"$JAVAC" -source 17 -target 17 -classpath "$PLATFORM" -d "$BUILD/classes" @"$BUILD/sources.txt"

echo "[4/6] Dexing"
find "$BUILD/classes" -name '*.class' > "$BUILD/classes.txt"
"$BUILD_TOOLS/d8" --release --min-api 26 --lib "$PLATFORM" --output "$BUILD/dex" @"$BUILD/classes.txt"

echo "[5/6] Packaging"
cp "$BUILD/unsigned.apk" "$BUILD/with-dex.apk"
(cd "$BUILD/dex" && zip -q -u "$BUILD/with-dex.apk" classes.dex)
"$BUILD_TOOLS/zipalign" -f 4 "$BUILD/with-dex.apk" "$BUILD/aligned.apk"

echo "[6/6] Signing"
KEYSTORE="$ROOT/debug.keystore"
if [[ ! -f "$KEYSTORE" ]]; then
  "$KEYTOOL" -genkeypair \
    -keystore "$KEYSTORE" \
    -alias androiddebugkey \
    -storepass android \
    -keypass android \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -dname "CN=Courtside Debug,O=Courtside,C=CN" >/dev/null 2>&1
fi
OUT="$DIST/courtside-$VERSION.apk"
"$BUILD_TOOLS/apksigner" sign \
  --ks "$KEYSTORE" \
  --ks-key-alias androiddebugkey \
  --ks-pass pass:android \
  --key-pass pass:android \
  --out "$OUT" \
  "$BUILD/aligned.apk"
"$BUILD_TOOLS/apksigner" verify "$OUT"

echo "APK: $OUT"
ls -lh "$OUT"
