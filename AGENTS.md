# Song Guess: AI Or Real contributor guide

## Boundaries

- Keep the Next.js application, browser code, and route handlers in `client/`.
- Keep database migrations, seeds, SQL tests, and backend operations in `server/`.
- Never expose service-role keys, database passwords, or admin credentials to browser code.
- Treat every browser timestamp, score, room role, and answer as untrusted.

## Required checks

Run commands only when they exist in the relevant `package.json`.

```text
cd client
npm run format:check
npm run lint
npm run check
npm run test
npm run build
npm run test:e2e
```

Validate SQL changes against a dedicated Supabase project and run both security and performance advisors.

## Product priority

Protect the complete multiplayer loop: create or join a room, ready up, configure, play synchronized rounds, submit one authoritative answer, reveal, rank, finish, and play again.
