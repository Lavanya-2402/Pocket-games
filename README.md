# Pocket Games

Two phones, one game. Create a room, share the 4-letter code, play.
100% free stack: **Vercel Hobby** + **Supabase Free** (no credit card).

## Games

| Group | Games |
|---|---|
| **Boards** | Tic Tac Toe · Connect Four · Dots and Boxes · Territory · Five in a Row · Gravity Flip |
| **Mind games** | Bid-Tac-Toe · Duel · Code Breaker · Liar's Dice |
| **Hide & hunt** | Sea Battle · Minefield Duel · Memory Match |
| **Cards** | Color Rush (with optional house rules) |

Every game has a **How to play** card in the app. Ten of them can also be played against the
**computer** (all except Bid-Tac-Toe, Duel, Sea Battle and Color Rush).

## In every room

- **Match options** when you create a room: play a friend or the computer (Easy / Hard), free play or
  **best of 3 / 5**, **private room** (friends only, no spectators), and house rules where a game has them.
- Score strip with win streak; turn timer; forfeit after about 60 s away; online dots.
- Chat, emoji reactions, sound (with mute), rematch, spectators, "same Wi-Fi" fast mode.
- When a game ends: **Watch the replay**, and **Add as a friend** for the person you just played.

## Accounts (optional)

Guests can play everything. An account adds:

- **Profile:** name, avatar and colour (guests too, but saved only on that phone).
- **Friends:** add by username, see who is online, invite a friend straight into your room.
- **Records:** won / lost / drawn, a leaderboard of you and your friends, recent games with replays.
- **Recently played with:** one tap to add as a friend or play again.
- **Settings:** light / dark theme, five colour skins, sound, install as an app, invite notifications.

Passwords are stored as one-way scrypt hashes, so nobody can read them, including the owner.

## One-time setup (~10 min)

### 1. Supabase (database + realtime)
1. Sign up at https://supabase.com → **New project** (Free plan; any region near you).
2. **SQL Editor → New query**, and run these three files in order (paste all → **Run**):
   1. [`supabase/schema.sql`](supabase/schema.sql) — rooms and moves
   2. [`supabase/migrations/002_accounts.sql`](supabase/migrations/002_accounts.sql) — accounts, friends, avatars
   3. [`supabase/migrations/003_results_and_push.sql`](supabase/migrations/003_results_and_push.sql) — records, replays, notifications
3. **Project Settings → API Keys** → copy the Project URL, the **Publishable** key and the **Secret** key.

Each script is safe to run again. The app keeps working if a later one hasn't been run yet; the
features it adds are simply switched off.

> Free projects pause after 7 days without use. Hit **Restore** in the dashboard — free, data kept.

### 2. Settings (environment variables)

Copy `.env.example` to `.env.local` and fill it in. Add the same values on Vercel under
**Project → Settings → Environment Variables**.

| Name | Needed? | What it is |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Supabase publishable (or legacy anon) key |
| `SUPABASE_SECRET_KEY` | yes | Supabase secret (or legacy service_role) key — keep private |
| `OWNER_USERNAMES` | optional | Usernames allowed to open the owner page, comma-separated |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | optional | Key pair for phone notifications. Make one with `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | optional | Contact for push services (`mailto:` or a site address). Defaults to the Vercel site address |

### 3. Run locally (optional)
```bash
npm install
npm run dev -- -H 0.0.0.0     # phones on the same Wi-Fi: open http://<PC-IP>:3000
```

### 4. Deploy to Vercel (play from anywhere, any network)
1. Push this folder to a GitHub repo.
2. https://vercel.com → sign in with GitHub → **Add New → Project** → import the repo.
3. Add the environment variables from step 2.
4. **Deploy**. Open the `*.vercel.app` URL on both phones.
5. **Settings → Functions → Function Region**: pick the region nearest your Supabase project.

On each phone: **Profile → Settings → Install as an app** for a home-screen icon and full-screen play.

## For the owner

Create your own account in the app, put its username in `OWNER_USERNAMES`, and redeploy.
**Profile → Account → Owner tools** (or `/owner`) then lets you:

- see every account and how many phones it is logged in on;
- **make a reset code** for someone who forgot their password. Tell them the code; they open
  **Profile → Account → Forgot password** and enter username + code + a new password. It works once;
- cancel a code, unlock an account after too many wrong passwords, log an account out everywhere, or delete it.

Without the owner page you can do the same in Supabase: Table Editor → `accounts` → type a code into
the `reset_code` cell.

## How it works

- **Server is the authority.** Phones `POST /api/rooms/:code/move`; the server validates with the game
  engine, saves with an optimistic lock on `version`, then pings the room over Supabase Realtime.
- **Hidden information** (bids, ships, cards, dice, mines, codes): `viewFor` filters each player's view
  on the server, so secrets never reach the other phone.
- **Room options, score and clock** live beside the game state (`src/games/runner.ts`), together with
  the seed and move log needed to replay the game.
- **Turn timer:** serverless has no background jobs, so phones call `/tick` when a deadline passes;
  the server checks the time itself and plays a safe automatic move.
- **Computer opponent:** engines with a `botMove` reply in the same request. Games where each move
  must be seen (Memory Match, Minefield Duel) are paced one move at a time.
- **Results** are filed when a game ends; records and leaderboards are counted from them. Replays are
  rebuilt on the phone from the seed and move log, and only people who were in the room may fetch one.
- **Presence, chat and reactions** go phone-to-phone over the room's Realtime channel (not stored).
- **Identity:** guests are a random id + secret kept on the phone; accounts use hashed session tokens.
- **Database** is locked with RLS; only the server (secret key) can touch it.

## Adding a game

1. `src/games/<game>.ts` implementing `GameEngine` from `src/games/types.ts`
   (`timeLimit` and `autoMove` are required; add `botMove` for a computer player, `rules` for house
   rules, and `hiddenInfo` + `viewFor` if anything is secret).
2. Register it in `src/games/index.ts`; add it to `src/games/catalog.ts` and `src/games/rules.ts`.
3. Add a board component in `src/app/r/[code]/` and register it in `boards.tsx`.

```bash
npm test     # 190+ tests, including a suite that plays every registered game to a finish,
             # against the computer, and replays it from its move log
```
