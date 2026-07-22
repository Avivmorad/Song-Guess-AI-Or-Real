# Backend

The production backend is Supabase Postgres, Auth, and Realtime. Versioned schema,
seed data, database tests, and generated types live under `supabase/`.

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
npm run db:stop
```

The Supabase CLI is pinned in `devDependencies`; do not install it globally with
npm. Run backend commands from this `server/` directory so the checked-in
`supabase/config.toml` is used.
