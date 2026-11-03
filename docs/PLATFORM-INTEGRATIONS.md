# VIDNEX platform integration architecture

## Product scope

VIDNEX supports only:
- YouTube official embeds and documented YouTube Data API metadata.
- Instagram official embeds and documented Instagram APIs for content the signed-in user is authorized to access.
- Public direct MP4, WebM, MOV and M4V file URLs that the user owns or is authorized to download.

Do not add TikTok, Facebook, X, Vimeo, or other providers unless the product owner explicitly changes scope.

## Capability boundaries

| Source | Preview | Metadata | Download |
|---|---|---|---|
| YouTube | Official YouTube IFrame Player | YouTube Data API, optional server-side key | No general video-file download endpoint in the public API |
| Instagram | Official Instagram embed where permitted | Instagram Graph API / Instagram Login for authorized accounts and approved scopes | No general public-Reel download endpoint |
| Direct media URL | Native HTML video when supported | HTTP headers such as content type and length | Stream the original file when publicly reachable and authorized |

An embed URL or webpage URL is not a media file. Never show a download action for a YouTube/Instagram page, player URL, HLS manifest, private post, or media that the official API does not explicitly authorize.

## Backend design

- `GET /api/health`: service health.
- `GET /api/inspect?url=<encoded-url>`: validate a public URL, issue a HEAD request, and return content type, size and byte-range support for direct media only.
- `GET /api/download?url=<encoded-url>`: stream the original direct media file, forwarding browser Range requests and preserving upstream range headers.
- Future `GET /api/youtube/video?id=<video-id>`: optional metadata lookup using server-side `YOUTUBE_API_KEY`; metadata only, never a media stream.
- Instagram account access must use the documented OAuth flow and user-granted scopes. Tokens remain server-side and are never exposed in frontend code.

## Security requirements

- Accept only HTTP/HTTPS URLs.
- Reject localhost, private, link-local and reserved IP ranges.
- Revalidate redirect destinations.
- Limit file size and redirect count.
- Never accept arbitrary user-supplied headers.
- Keep provider secrets and OAuth tokens in Render environment variables or secure server-side storage, never in Git or browser JavaScript.
- Add rate limiting before exposing the download API publicly at scale.
- Do not bypass DRM, authentication, paywalls, private posts or platform restrictions.

## Implementation order

1. Verify the existing direct-file inspect and streaming endpoints with permitted MP4/WebM test files.
2. Add browser-friendly download status and clear error messages without buffering large files into browser memory.
3. Add optional YouTube Data API metadata with a server-side key.
4. Add Instagram account authorization only after the Meta developer app and approved permissions are configured.
5. Test mobile and desktop behavior, redirects, Range requests, invalid URLs and oversized files.

## Current state

The frontend recognizes YouTube, Instagram and direct media links. YouTube and Instagram use official embed players; direct media uses the existing streaming backend. Platform-specific OAuth and metadata routes are not yet configured. The direct media endpoint is implemented but must pass live end-to-end tests before being described as production-verified.
