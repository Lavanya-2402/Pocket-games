-- Accounts, friends, invites and player profiles.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to run more than once.

create table if not exists accounts (
  id             uuid primary key default gen_random_uuid(),
  username       text not null unique,          -- lowercase, 3–16 chars
  display_name   text not null,
  password_hash  text not null,                 -- scrypt hash; the password itself is never stored
  avatar         text not null default '🦊',
  color          text not null default 'coral',
  reset_code     text,                          -- see "Helping someone who forgot their password" below
  failed_logins  integer not null default 0,
  locked_until   timestamptz,
  created_at     timestamptz not null default now()
);

-- One row per phone that is logged in. Only a hash of the token is stored.
create table if not exists sessions (
  token_hash  text primary key,
  account_id  uuid not null references accounts(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists sessions_account_idx on sessions(account_id);

-- A friendship is one row: requester → target. 'pending' until the target accepts.
create table if not exists friends (
  account_id  uuid not null references accounts(id) on delete cascade,
  friend_id   uuid not null references accounts(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at  timestamptz not null default now(),
  primary key (account_id, friend_id),
  check (account_id <> friend_id)
);
create index if not exists friends_friend_idx on friends(friend_id);

-- "Come play with me" invitations to a room. Shown for 15 minutes.
create table if not exists invites (
  id          bigserial primary key,
  to_id       uuid not null references accounts(id) on delete cascade,
  from_id     uuid not null references accounts(id) on delete cascade,
  room_code   text not null references rooms(code) on delete cascade,
  game        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists invites_to_idx on invites(to_id, created_at desc);

-- Avatar and colour shown next to each player in a room.
alter table room_players add column if not exists avatar text;
alter table room_players add column if not exists color  text;

alter table accounts enable row level security;
alter table sessions enable row level security;
alter table friends  enable row level security;
alter table invites  enable row level security;

-- ---------------------------------------------------------------------------
-- Helping someone who forgot their password
--
-- Passwords are stored as one-way hashes, so nobody (including you) can read
-- them. To help a player:
--   1. Table Editor → accounts → find their username.
--   2. Type a short code into their `reset_code` cell (e.g. 4821) and save.
--   3. Tell them the code. In the app: Profile → Account → Forgot password →
--      username + code + a new password of their choice.
-- The code works once and is cleared automatically. Or run:
--   update accounts set reset_code = '4821' where username = 'sam';
-- ---------------------------------------------------------------------------
