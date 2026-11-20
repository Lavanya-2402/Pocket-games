/** How games are grouped and described on the home screen. */

export interface GameGroup {
  id: string;
  name: string;
  blurb: string;
  /** Fill colour of this shelf's tiles (a CSS variable from globals.css). */
  color: string;
}

export interface GameEntry {
  id: string; // engine id for playable games
  name: string;
  tagline: string;
  icon: string;
  group: string;
  /** Not built yet — listed under "Coming soon" in its group. */
  soon?: boolean;
}

export const GROUPS: GameGroup[] = [
  { id: "boards", name: "Boards", blurb: "Line them up, claim the board", color: "var(--g-boards)" },
  { id: "mind", name: "Mind games", blurb: "Secret picks, revealed together", color: "var(--g-mind)" },
  { id: "hunt", name: "Hide & hunt", blurb: "Find what the others are hiding", color: "var(--g-hunt)" },
  { id: "cards", name: "Cards", blurb: "Empty your hand first", color: "var(--g-cards)" },
  { id: "dice", name: "Dice", blurb: "Roll, risk it, race", color: "var(--g-dice)" },
];

export const CATALOG: GameEntry[] = [
  { id: "tictactoe", name: "Tic Tac Toe", tagline: "Three in a row", icon: "✕◯", group: "boards" },
  { id: "connect4", name: "Connect Four", tagline: "Drop discs, line up four", icon: "🔴", group: "boards" },
  { id: "dots", name: "Dots and Boxes", tagline: "Close a box, it's yours", icon: "🔳", group: "boards" },
  { id: "territory", name: "Territory", tagline: "Flip their pieces", icon: "🟢", group: "boards" },
  { id: "five", name: "Five in a Row", tagline: "Big-board tic tac toe", icon: "⚫", group: "boards" },
  { id: "gravity", name: "Gravity Flip", tagline: "Connect Four that rotates", icon: "🔄", group: "boards" },

  { id: "bidtactoe", name: "Bid-Tac-Toe", tagline: "Outbid them for each square", icon: "🪙", group: "mind" },
  { id: "duel", name: "Duel", tagline: "Attack, defend or charge", icon: "⚔️", group: "mind" },
  { id: "codebreaker", name: "Code Breaker", tagline: "Crack their secret code", icon: "🔐", group: "mind" },
  { id: "liarsdice", name: "Liar's Dice", tagline: "Bid, bluff, call it", icon: "🎲", group: "mind" },

  { id: "seabattle", name: "Sea Battle", tagline: "Hide your fleet, sink theirs", icon: "⚓", group: "hunt" },
  { id: "minefield", name: "Minefield Duel", tagline: "Find more mines", icon: "💣", group: "hunt" },
  { id: "memory", name: "Memory Match", tagline: "Flip and pair up", icon: "🧠", group: "hunt" },

  { id: "colorrush", name: "Color Rush", tagline: "Match colours, with house rules", icon: "🃏", group: "cards" },
  { id: "yacht", name: "Yacht Dice", tagline: "Five dice, twelve boxes to fill", icon: "🎲", group: "dice" },
  { id: "greedy", name: "Greedy Dice", tagline: "Roll again, or bank it?", icon: "🤑", group: "dice" },
  { id: "ludo", name: "Ludo", tagline: "Race your pieces home", icon: "🏠", group: "dice" },
  { id: "climb", name: "Climb & Slide", tagline: "Ropes up, slides down", icon: "🪜", group: "dice" },
];
