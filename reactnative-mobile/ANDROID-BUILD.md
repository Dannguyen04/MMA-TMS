# Android local build

From `reactnative-mobile`, connect an Android phone with USB debugging enabled and run:

```powershell
npm run android -- --device
```

To build the ARM64 debug APK without installing it:

```powershell
cd android
.\gradlew.bat app:assembleDebug -x lint -x test --configure-on-demand --build-cache -PreactNativeDevServerPort=8081 -PreactNativeArchitectures=arm64-v8a
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`. This development build needs Metro (`npm start`) to load the app's JavaScript.

## Login / Nest API from the phone

Metro already reverse-tunnels port **8081**. Nest on **3001** does not, unless you add it.

`EXPO_PUBLIC_API_URL` often points at `http://localhost:3001`. On a **physical** Android phone, `127.0.0.1` / `localhost` is the **phone**, not the PC. In `__DEV__` the app rewrites that loopback host to the Expo/Metro bundler LAN IP (same Wi‑Fi as the PC) and keeps Nest’s port (default **3001**). Android emulators use `10.0.2.2:3001`. iOS Simulator may keep `localhost`. An explicit non-loopback `EXPO_PUBLIC_API_URL` always wins. Production URLs are not rewritten.

`app.json` already sets `usesCleartextTraffic: true` so `http://192.168.x.x:3001` is allowed in debug. Do not change Nest auth or invent a different login path.

Phone and PC must share a network; Nest must listen on `0.0.0.0:3001`; Windows Firewall must allow inbound TCP 3001. Reload JS after this change (`r` in Metro); a native rebuild is only required if `usesCleartextTraffic` was missing from the installed APK.

### USB fallback (`adb reverse`)

If LAN rewrite cannot see the PC (guest Wi‑Fi, AP isolation), tunnel Nest through USB:

With USB debugging on and Nest listening on the PC (`PORT` 3001):

```powershell
adb reverse tcp:3001 tcp:3001
adb reverse --list
```

From this folder: `npm run adb:api`. `npm run android` / `npm run run:android` also set this reverse; plain `npx expo run:android` does not. `start_all.bat` tries it when Nest is up and a device is connected. With Metro over USB the phone has no LAN bundler IP, so the app keeps `localhost:3001` and relies on this reverse.

Redo reverse after unplugging USB. Then retry login — Metro does not need a restart.

### Emulator without reverse

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:3001
```

Restart Metro after changing `.env`.

### Wi-Fi device (no USB)

Use the PC LAN IPv4, for example `EXPO_PUBLIC_API_URL=http://192.168.1.10:3001`. Nest listens on `0.0.0.0:3001`. Phone and PC must share a network; Windows Firewall must allow inbound TCP 3001.

## Windows CMake paths

The nested checkout path caused Ninja failures: `manifest 'build.ninja' still dirty after 100 tries` in screens/worklets, and `Filename longer than 260 characters` in app codegen.

`scripts/windows-cmake.gradle` gives every Android module a short CMake staging path in `<Gradle user home>/cxx/<checkout-and-module-hash>` and sets `CMAKE_OBJECT_PATH_MAX=240`. The default Gradle user home is `%USERPROFILE%\.gradle`; keep it short if overriding `GRADLE_USER_HOME`. The cache key separates checkouts and modules. The configuration only applies on Windows.

`plugins/with-windows-cmake.js`, registered in `app.json`, reapplies the Gradle hook during Expo prebuild because `android/` is generated and ignored by Git. No root project configuration or dependency changes are needed.

When switching staging locations in an existing build, Android Gradle Plugin can report a one-time lock on `metadata_generation_command.txt`. Let the build finish and rerun the command. Do not delete the entire global Gradle cache.

References: [Android CMake staging configuration](https://developer.android.com/reference/tools/gradle-api/8.0/com/android/build/api/dsl/Cmake), [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/).

## Validation (2026-09-15)

- ARM64 debug assembly: `BUILD SUCCESSFUL in 1m 15s` (359 tasks).
- APK installed successfully via `adb install -r` on connected Samsung SM-S928B.
- Config plugin insertion order and idempotence checked with Node assertions.
- No files outside `reactnative-mobile` changed. App screens and JavaScript runtime were not tested; Metro was not running during installation.
