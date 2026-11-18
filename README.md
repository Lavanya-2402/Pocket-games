# Pocket Games

Two phones, one game. Create a room, share the 4-letter code, play.
100% free stack: **Vercel Hobby** + **Supabase Free** (no credit card).

Games: Tic Tac Toe (more coming).

## One-time setup (~10 min)

### 1. Supabase (database + realtime)
1. Sign up at https://supabase.com → **New project** (Free plan; any region near you).
2. **SQL Editor → New query** → paste all of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. **Project Settings → API Keys** → copy:
   - Project URL
   - **Publishable** key (`sb_publishable_…`, or legacy `anon`)
   - **Secret** key (`sb_secret_…`, or legacy `service_role`) — keep private

> Free projects pause after 7 days without use. Hit **Restore** in the dashboard — free, data kept.

### 2. Run locally (optional)
```bash
cp .env.example .env.local   # fill in the 3 values
npm install
npm run dev -- -H 0.0.0.0     # phones on the same Wi-Fi: open http://<PC-IP>:3000
```

### 3. Deploy to Vercel (play from anywhere, any network)
1. Push this folder to a GitHub repo.
2. https://vercel.com → sign in with GitHub → **Add New → Project** → import the repo.
3. **Environment Variables**: add the same 3 from `.env.example`.
4. **Deploy**. Open the `*.vercel.app` URL on both phones.

Tip: on each phone, browser menu → **Add to Home Screen** for an app-like icon.

## How to play
Phone A: enter name → **Tic Tac Toe** → **Share** (or read out the code).
Phone B: open the link, or enter the code → **Join**.
Third+ people who join just spectate. **Rematch** swaps who goes first.

## How it works
- **Server is the authority.** Phones `POST /api/rooms/:code/move`; the server validates with the game engine, saves with an optimistic lock on `version`, logs to `moves`, then pings the room over Supabase Realtime. Each phone refetches *its own* view (so hidden-info games can hide cards later).
- Polling every 5 s is a fallback if realtime drops.
- Identity is anonymous: a random id + secret in each phone's `localStorage`.
- Database is locked with RLS; only the server (secret key) can touch it.

## Adding a game
1. `src/games/<game>.ts` implementing `GameEngine` from `src/games/types.ts`.
2. Register it in `src/games/index.ts`.
3. Add a board component and a button on the home page.

```bash
npm test     # engine unit tests
```
