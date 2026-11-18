# Pocket Games

Two phones, one game. Create a room, share the 4-letter code, play.
100% free stack: **Vercel Hobby** + **Supabase Free** (no credit card).

**Games:** Tic Tac Toe · Connect Four · Bid-Tac-Toe · Duel · Sea Battle · Color Rush
(each has a How to play card in the app).

**In every room:** turn timer, disconnect handling (≈60 s grace, then forfeit),
online dots, chat, emoji reactions, sound (with mute), rematch, spectators.

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
Phone A: enter name → pick a game → **Share** (or read out the code).
Phone B: open the link, or enter the code → **Join**.
Third+ people who join just spectate. **Rematch** swaps who goes first.

## How it works
- **Server is the authority.** Phones `POST /api/rooms/:code/move`; the server validates with the game engine, saves with an optimistic lock on `version`, logs to `moves`, then pings the room over Supabase Realtime. Each phone refetches *its own* view (so hidden-info games can hide cards later).
- **Hidden info** (Bid-Tac-Toe, Duel, Sea Battle, Color Rush): `viewFor` filters each player's view on the server, so secret bids, ships and hands never reach the other phone.
- **Turn timer** (`src/games/runner.ts`): each turn gets a deadline stored with the game state. Serverless has no background jobs, so phones call `POST /api/rooms/:code/tick` when it passes; the server checks the time and plays a safe automatic move. Missed turns adding up to ~60 s = forfeit.
- **Presence, chat, reactions** go phone-to-phone over the room's Realtime channel (not stored).
- Polling every 5 s is a fallback if realtime drops.
- Identity is anonymous: a random id + secret in each phone's `localStorage`.
- Database is locked with RLS; only the server (secret key) can touch it.

## Adding a game
1. `src/games/<game>.ts` implementing `GameEngine` from `src/games/types.ts` (including `timeLimit` and `autoMove`; set `hiddenInfo` and `viewFor` if anything is secret).
2. Register it in `src/games/index.ts` and add its rules to `src/games/rules.ts`.
3. Add a board component in `src/app/r/[code]/`, render it in `room.tsx`, and add a button on the home page.

```bash
npm test     # engine unit tests
```
