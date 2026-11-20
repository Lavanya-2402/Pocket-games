-- Win/loss records, leaderboards, replays, and phone notifications.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to run more than once. Until it is run, games still work; only these extras are off.

-- One row per finished game.
create table if not exists results (
  id           uuid primary key,
  room_code    text not null,
  game         text not null,
  p0           uuid not null,                 -- moved first
  p1           uuid not null,
  names        text[] not null default '{}',  -- display names at the time, same order
  winner       uuid,                          -- null = draw
  forfeit      boolean not null default false,
  vs_bot       boolean not null default false,
  moves        integer not null default 0,
  replay       jsonb,                         -- { seed, order, rules, log } to replay the game
  finished_at  timestamptz not null default now()
);
create index if not exists results_p0_idx on results(p0, finished_at desc);
create index if not exists results_p1_idx on results(p1, finished_at desc);

-- A phone that has allowed notifications for an account.
create table if not exists push_subscriptions (
  endpoint    text primary key,
  account_id  uuid not null references accounts(id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists push_account_idx on push_subscriptions(account_id);

alter table results            enable row level security;
alter table push_subscriptions enable row level security;
