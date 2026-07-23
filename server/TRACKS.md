# Track workflow

Production games use two sources only:

- `real`: downloadable Creative Commons tracks returned by the Jamendo API.
- `ai`: owned Suno MP3 exports imported by the project administrator.

The six versioned WAV files under `client/public/audio/` remain neutral local and
test fixtures. The production `dynamic` pack never selects them.

## Import an owned Suno export

Set the project URL and service-role key in the shell or an ignored `.env.local`.
The service-role key is an administrator secret and must never use a
`NEXT_PUBLIC_` name.

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

Install server dependencies, then import either a local MP3 or a direct HTTPS
download URL:

```sh
npm ci
node scripts/import-suno-track.mjs --file=./exports/song.mp3 --title="Song title" --artist="Artist" --duration=180 --source-url=https://suno.com/song/SONG_ID
```

```sh
node scripts/import-suno-track.mjs --download-url=https://files.example/song.mp3 --title="Song title" --artist="Artist" --duration=180 --source-url=https://suno.com/playlist/PLAYLIST_ID
```

The command accepts MP3 files up to 50 MiB, strips ID3 metadata, validates every
HTTPS redirect, uploads the audio under an opaque path in the private
`track-audio` bucket, and registers it as an enabled `dynamic` Suno track. A
Suno song or playlist page is required for reveal attribution. Duplicate audio
is reused instead of registered twice. Random Explore scraping and
YouTube/Spotify downloads are not supported.

## Runtime preparation

Each round is claimed through a 45-second database lease. Jamendo preparation
accepts only candidates whose API response contains
`audiodownload_allowed=true`, a non-empty download URL, a source page, and a
Creative Commons license URL. Preparation makes at most three attempts within
30 seconds before exposing a host-retryable error.

Players receive a ten-minute signed Storage URL only after room membership is
validated. The browser downloads the complete file and acknowledges readiness;
the server starts the four-second countdown only after every connected player
has acknowledged it.
