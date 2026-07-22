# Song Guess: AI Or Real

A responsive multiplayer browser game where players listen to synchronized demo music and guess whether each track was generated procedurally or composed by a human.

## Migrated project home

This repository is the permanent home of the project. The earlier temporary work in `AI-Song-Studio` and `AI_Lyric_Genarator` has been removed from those repositories.

## Features

- Six-character lobby codes and shareable invite URLs
- 2–12 players with nicknames
- PeerJS/WebRTC multiplayer
- Host-authoritative lobby, rounds, answer validation and scoring
- Ready states, synchronized countdown and timed rounds
- Correct-answer base score plus speed bonus
- Wrong-answer penalty and zero points for no answer
- Answer reveal and live leaderboard
- Same-room play again
- Reconnection using a locally stored player token
- Responsive desktop and mobile layout
- Six browser-synthesized demo tracks with no copyrighted recordings

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Tests

```bash
npm test
```

## Deployment

The project is a static site and includes `vercel.json`. Import this repository into Vercel or run `vercel --prod` from the repository root.

## Architecture note

This migrated baseline uses PeerJS signaling and host-authoritative state. The archived `archive/nextjs-supabase-starting-phase` branch preserves the separate Next.js/Supabase rebuild scaffold for future server-authoritative development.
