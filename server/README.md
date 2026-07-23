# Backend

The production backend is Supabase Postgres, Auth, Realtime, and private Storage.
Versioned schema, seed data, and database tests live under `supabase/`. Trusted
track import operations live under `scripts/`.

## Local setup

Install a Docker-compatible container runtime, then run:

```sh
npm install
npm run db:start
```

Useful commands:

```sh
npm run db:status
npm run db:reset
npm run db:lint
npm run db:test
npm run db:stop
```

The Supabase CLI is pinned in `devDependencies`; do not install it globally with
npm. Run backend commands from this `server/` directory so the checked-in
`supabase/config.toml` is used.

See `TRACKS.md` for the owned-Suno import command and runtime preparation rules.
