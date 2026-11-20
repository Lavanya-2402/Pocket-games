/** Avatars and colours players can pick. Shared by server (validation) and client (pickers). */

export const AVATARS = [
  "🦊", "🐼", "🐯", "🐸", "🐙", "🦉", "🐧", "🦁",
  "🐨", "🐵", "🦄", "🐲", "🐝", "🦋", "🐢", "🐬",
  "🦖", "🐰", "🐻", "🐱", "🐶", "🦜", "👾", "🤖",
] as const;

export const COLORS = {
  coral: "#e2553d",
  gold: "#d9a21b",
  lime: "#5f9f45",
  teal: "#1f8a84",
  sky: "#3d8fd9",
  violet: "#7b61d1",
  pink: "#d95a9c",
  slate: "#5b6472",
} as const;

export type ColorKey = keyof typeof COLORS;
export const COLOR_KEYS = Object.keys(COLORS) as ColorKey[];

export interface Profile {
  name: string;
  avatar: string;
  color: string;
}

export const cleanAvatar = (a: unknown): string =>
  typeof a === "string" && (AVATARS as readonly string[]).includes(a) ? a : AVATARS[0];

export const cleanColor = (c: unknown): ColorKey =>
  typeof c === "string" && c in COLORS ? (c as ColorKey) : "coral";

export const colorHex = (c: unknown) => COLORS[cleanColor(c)];

export const randomAvatar = () => AVATARS[Math.floor(Math.random() * AVATARS.length)];
export const randomColor = () => COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)];
