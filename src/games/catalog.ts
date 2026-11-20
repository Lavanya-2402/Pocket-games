/** How games are grouped and described on the home screen. */

export interface GameGroup {
  id: string;
  name: string;
  blurb: string;
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
  { id: "boards", name: "Boards", blurb: "Line them up, claim the board" },
  { id: "mind", name: "Mind games", blurb: "Secret picks, revealed together" },
  { id: "hunt", name: "Hide & hunt", blurb: "Find what your opponent is hiding" },
  { id: "cards", name: "Cards", blurb: "Empty your hand first" },
];

export const CATALOG: GameEntry[] = [
  { id: "tictactoe", name: "Tic Tac Toe", tagline: "Three in a row", icon: "✕◯", group: "boards" },
  { id: "connect4", name: "Connect Four", tagline: "Drop discs, line up four", icon: "🔴", group: "boards" },
  { id: "dots", name: "Dots and Boxes", tagline: "Close a box, it's yours", icon: "🔳", group: "boards" },
  { id: "territory", name: "Territory", tagline: "Flip their pieces", icon: "", group: "boards", soon: true },
  { id: "five", name: "Five in a Row", tagline: "Big-board tic tac toe", icon: "⚫", group: "boards" },
  { id: "gravity", name: "Gravity Flip", tagline: "Connect Four that rotates", icon: "", group: "boards", soon: true },

  { id: "bidtactoe", name: "Bid-Tac-Toe", tagline: "Outbid them for each square", icon: "🪙", group: "mind" },
  { id: "duel", name: "Duel", tagline: "Attack, defend or charge", icon: "⚔️", group: "mind" },
  { id: "codebreaker", name: "Code Breaker", tagline: "Crack their secret code", icon: "", group: "mind", soon: true },
  { id: "liarsdice", name: "Liar's Dice", tagline: "Bid, bluff, call it", icon: "", group: "mind", soon: true },

  { id: "seabattle", name: "Sea Battle", tagline: "Hide your fleet, sink theirs", icon: "⚓", group: "hunt" },
  { id: "minefield", name: "Minefield Duel", tagline: "Find more mines", icon: "", group: "hunt", soon: true },
  { id: "memory", name: "Memory Match", tagline: "Flip and pair up", icon: "", group: "hunt", soon: true },

  { id: "colorrush", name: "Color Rush", tagline: "Match colours, shed cards", icon: "🃏", group: "cards" },
  { id: "rushrules", name: "Color Rush house rules", tagline: "Stacking, Swap 7, Last card", icon: "", group: "cards", soon: true },
  { id: "gofish", name: "Go Fish", tagline: "Collect sets of four", icon: "", group: "cards", soon: true },
];
