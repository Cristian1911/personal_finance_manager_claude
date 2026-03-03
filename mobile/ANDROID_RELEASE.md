# Android Release Build

Use this when you need a Play Console upload artifact from the local Android project.

## Output

The Play Console artifact is the Android App Bundle:

`mobile/android/app/build/outputs/bundle/release/app-release.aab`

## Option 1: EAS production build

When Expo network access is available, the existing production profile already targets Android release builds:

```bash
cd mobile
eas build --platform android --profile production-android
```

## Option 1b: GitHub Actions Play Store bundle

There is also a dedicated manual workflow for producing the Play Console artifact:

- Workflow: `Build Mobile Play Store AAB`
- Output: downloadable `.aab` artifact attached to the workflow run

This workflow uses the same `production-android` EAS profile and keeps versioning in EAS remote state:

- `expo.version` comes from `mobile/app.json`
- Android `versionCode` is auto-incremented by EAS because `mobile/eas.json` is configured with:
  - `"appVersionSource": "remote"`
  - `"autoIncrement": true` on production builds

This is preferable to maintaining a GitHub Actions variable with the previous version, because the source of truth stays aligned with the actual native build service.

## Option 2: Local signed AAB build

1. Put your upload keystore somewhere local, for example:

`mobile/android/app/venti5-upload.jks`

2. Create `mobile/android/keystore.properties` with either an absolute path or a path relative to `mobile/android`:

```properties
storeFile=app/venti5-upload.jks
storePassword=replace-me
keyAlias=upload
keyPassword=replace-me
```

3. Build the release bundle:

```bash
cd mobile
pnpm build:aab:local
```

You can also provide the same values through environment variables instead of `keystore.properties`:

- `ANDROID_UPLOAD_STORE_FILE`
- `ANDROID_UPLOAD_STORE_PASSWORD`
- `ANDROID_UPLOAD_KEY_ALIAS`
- `ANDROID_UPLOAD_KEY_PASSWORD`

## Important

If release signing is not configured, Gradle will still produce a release bundle signed with the debug keystore. That output is only useful for smoke testing and should not be uploaded to Play Console.
