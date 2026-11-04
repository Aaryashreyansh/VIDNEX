# VIDNEX Android

Native Android companion for background downloads of direct media files.

## Current scope
- Uses Android DownloadManager, which owns the transfer and notification after the app is minimized or the screen turns off.
- Saves files under Downloads/VIDNEX.
- Supports direct HTTP(S) URLs ending in MP4, WebM, MOV or M4V.
- Does not extract media from YouTube/Instagram pages or bypass DRM, login, private-content, or platform restrictions.

## Build
Open the `android/` folder in Android Studio (JDK 17, Android SDK 36), allow Gradle sync, then Build > Build APK(s).

This initial native scaffold needs a local Android Studio build and device testing before it can be called release-ready.
