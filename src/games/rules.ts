import { START_COINS } from "./bidtactoe";
import { COST, MAX_DEFENDS, MAX_ENERGY, MAX_HP, MAX_ROUNDS, START_ENERGY } from "./duel";

export interface Rules {
  title: string;
  tagline: string;
  goal: string;
  steps: string[];
  tips: string[];
}

/** How-to-play cards. Numbers come from the engines so the text never drifts from the code. */
export const RULES: Record<string, Rules> = {
  tictactoe: {
    title: "Tic Tac Toe",
    tagline: "The classic, on two phones.",
    goal: "Get 3 of your marks in a row — across, down or diagonal.",
    steps: [
      "The room creator is ✕ and goes first.",
      "Take turns tapping an empty square.",
      "If all 9 squares fill with no line, it's a draw.",
      "Rematch swaps who goes first.",
    ],
    tips: ["Take the center if it's free.", "Make two threats at once so your opponent can only block one."],
  },
  connect4: {
    title: "Connect Four",
    tagline: "Drop discs, stack them up.",
    goal: "Get 4 of your discs in a row — across, down or diagonal.",
    steps: [
      "Coral goes first, teal second.",
      "On your turn, tap anywhere in a column. Your disc falls to the lowest empty spot.",
      "A full column can't be played.",
      "If the whole board fills with no line, it's a draw.",
    ],
    tips: ["The middle column is part of the most possible lines.", "Watch diagonals — they're the easiest to miss."],
  },
  bidtactoe: {
    title: "Bid-Tac-Toe",
    tagline: "Tic tac toe where you buy every move.",
    goal: "Get 3 of your marks in a row. You win squares by outbidding your opponent.",
    steps: [
      `Both players start with ${START_COINS} coins.`,
      "Each round, both of you secretly tap a square and choose a bid, then tap Lock in.",
      "When both are locked, bids are revealed. The higher bid places its mark on the square they chose.",
      "The winner pays their bid to the other player — so losing a round makes you richer.",
      "Ties go to whoever holds ⚖. After a tie, ⚖ passes to the other player.",
    ],
    tips: [
      "Bidding 0 is allowed — sometimes it's smart to let a square go and save up.",
      "When your opponent is one square from winning, you must outbid them on that square.",
    ],
  },
  duel: {
    title: "Duel",
    tagline: "Pick your move at the same time. Then reveal.",
    goal: `Bring your opponent from ${MAX_HP} health to 0.`,
    steps: [
      `Both players start with ${MAX_HP} health and ${START_ENERGY} energy.`,
      "Each round, both of you secretly pick one move. Both are revealed together.",
      `⚔️ Attack — costs ${COST.attack} energy, deals 1 damage. Defend blocks it.`,
      `🛡️ Defend — free, blocks Attack. Max ${MAX_DEFENDS} rounds in a row.`,
      `⚡ Charge — free, +1 energy (up to ${MAX_ENERGY}).`,
      `💥 Blast — costs ${COST.blast} energy, deals 2 damage and can't be blocked.`,
      `Both at 0 health = draw. After ${MAX_ROUNDS} rounds, more health wins.`,
    ],
    tips: [
      "Charging leaves you open — charge when your opponent has no energy.",
      "If they've defended twice in a row, they can't defend this round.",
    ],
  },
};
