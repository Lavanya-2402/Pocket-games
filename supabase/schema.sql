-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Only the server (secret/service_role key) touches these tables.
-- RLS is on with no policies, so the public anon key cannot read or write them.

create table if not exists rooms (
  code        text primary key,
  game        text not null,
  state       jsonb,                 -- null until two players have joined
  version     integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists room_players (
  room_code   text not null references rooms(code) on delete cascade,
  player_id   uuid not null,
  secret      text not null,
  name        text not null,
  seat        smallint,              -- 0 or 1 = player, null = spectator
  joined_at   timestamptz not null default now(),
  primary key (room_code, player_id),
  unique (room_code, seat)
);

create table if not exists moves (
  id          bigserial primary key,
  room_code   text not null references rooms(code) on delete cascade,
  player_id   uuid not null,
  move        jsonb not null,
  version     integer not null,      -- room version this move produced
  created_at  timestamptz not null default now()
);

create index if not exists moves_room_idx on moves(room_code, id);

alter table rooms        enable row level security;
alter table room_players enable row level security;
alter table moves        enable row level security;
