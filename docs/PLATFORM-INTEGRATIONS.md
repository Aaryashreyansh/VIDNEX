# VIDNEX platform integration architecture

## Current implementation boundary

VIDNEX supports direct public MP4/WebM/MOV/M4V URLs through its own streaming endpoint. The UI recognizes several platform URLs and uses their official player/embed surfaces where available. An embed is playback, not a downloadable media file.

## Adapter architecture

Each provider adapter must expose:
- `detect(url)`: identify a supported URL and normalize its canonical ID.
- `preview(url)`: return an official embed/player URL or an outbound link.
- `metadata(authContext, id)`: call only the provider's documented API and only for data the user authorized.
- `download(authContext, id)`: return a file URL only when the provider API explicitly grants one for that account/content.

The UI must never treat a player URL, page URL, HLS manifest, or embed URL as a direct file download.

## Provider matrix

| Provider | Public preview | Authorized API scope | File download |
|---|---|---|---|
| Direct MP4/WebM | Native HTML video | Not required | Yes, when URL is public and user has rights |
| YouTube | Official IFrame Player | Data API for metadata; OAuth for account features | No general video-file download endpoint |
| Instagram | Official embed | Professional-account Graph API / Instagram Login scopes | No general public-Reel download endpoint |
| TikTok | Official player/embed | Display API with creator authorization and approved scopes | Display API is for profile/video display, not general file downloads |
| Facebook | Official video plugin | Meta Graph API with approved permissions | Only if a documented authorized file URL is returned |
| X | Official post embed / outbound post | X API with the relevant access tier and scopes | Only if the API response and account rights permit it |
| Vimeo | Official player | Vimeo API token with appropriate scopes | Yes, when API returns file/download links for authorized account content |

## Required secrets (server-side only)

- `YOUTUBE_API_KEY` (metadata only; never use it to fetch media streams)
- `META_APP_ID`, `META_APP_SECRET`, OAuth callback configuration, and user-granted tokens for Instagram/Facebook
- `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, OAuth callback configuration, and creator-granted tokens
- `X_CLIENT_ID`, `X_CLIENT_SECRET`, OAuth callback configuration, and approved API access
- `VIMEO_CLIENT_ID`, `VIMEO_CLIENT_SECRET`, and user-granted token with the `video_files` scope

Never commit secrets or tokens to Git. Configure them as Render environment variables after provider developer-app approval.

## Implementation phases

1. Direct-file reliability: validate content type, support byte ranges, stream safely, reject private-network targets, and test with a permitted sample file.
2. Provider recognition and official previews: YouTube, Instagram, TikTok, Facebook, Vimeo; X outbound/official embed.
3. OAuth account linking with state/PKCE, encrypted server-side token storage, least-privilege scopes, token refresh, and disconnect/revoke.
4. Provider-specific metadata and file capability adapters. Show a download button only when a provider explicitly returns an authorized downloadable file.
5. Security, privacy, rate limiting, abuse controls, provider policy review, and integration tests.

## Current state

The frontend currently recognizes Instagram, YouTube, TikTok, Facebook, Vimeo and X URLs. It provides official embed/player previews for providers with supported embed URLs and a safe outbound notice for X. OAuth, provider API calls, token storage, and platform-specific file downloads are not yet implemented. The direct-file backend is separate and remains the only implemented download path.
