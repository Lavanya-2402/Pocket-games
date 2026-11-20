import { START_COINS } from "./bidtactoe";
import { HAND_SIZE } from "./colorrush";
import { COST, MAX_DEFENDS, MAX_ENERGY, MAX_HP, MAX_ROUNDS, START_ENERGY } from "./duel";
import { N as DOTS_N } from "./dots";
import { NEED, SIZE as FIVE_SIZE } from "./five";
import { FLEET, SHIP_NAMES, SIZE } from "./seabattle";

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
  seabattle: {
    title: "Sea Battle",
    tagline: "Hide your fleet. Hunt theirs.",
    goal: "Sink every ship in your opponent's fleet before they sink yours.",
    steps: [
      `Each player has a ${SIZE}×${SIZE} grid and a fleet of ${FLEET.length} ships: ${FLEET.map((l) => `${SHIP_NAMES[l]} (${l})`).join(", ")}.`,
      "First, both players place their ships in secret. Tap a ship to select it, tap it again to rotate, tap water to move it — or Shuffle. Then tap Ready.",
      "Then take turns firing: tap a square in enemy waters.",
      "✕ means hit, a dot means miss. When every square of a ship is hit, it sinks and is revealed.",
      "Ships can't overlap, but they can touch.",
    ],
    tips: [
      "After a hit, fire at the squares next to it to find which way the ship runs.",
      "Spread your first shots out in a checkerboard pattern — every ship covers at least 2 squares.",
    ],
  },
  dots: {
    title: "Dots and Boxes",
    tagline: "Draw lines. Close boxes. Keep going.",
    goal: "Own more boxes than your opponent when the grid is full.",
    steps: [
      "Take turns drawing one line between two neighbouring dots. Tap the gap between them.",
      "Draw the fourth side of a box and it becomes yours.",
      "Closing a box earns you another turn straight away — you can chain several in a row.",
      `The game ends when all ${DOTS_N * DOTS_N} boxes are taken. Most boxes wins.`,
    ],
    tips: [
      "Avoid drawing the third side of a box — your opponent will close it.",
      "Late in the game, giving away two boxes can set you up to take a long chain.",
    ],
  },
  five: {
    title: "Five in a Row",
    tagline: "Tic tac toe on a big board.",
    goal: `Line up ${NEED} of your stones — across, down or diagonal.`,
    steps: [
      "Coral goes first, teal second.",
      `Take turns placing one stone on any empty spot of the ${FIVE_SIZE}×${FIVE_SIZE} board.`,
      "Stones never move and are never captured.",
      "If the board fills up with no line of five, it's a draw.",
    ],
    tips: [
      "Four in a row with both ends open can't be stopped — block at three.",
      "Build two lines at once so your opponent can only block one.",
    ],
  },
  colorrush: {
    title: "Color Rush",
    tagline: "Match colors. Empty your hand first.",
    goal: "Be the first player to play all your cards.",
    steps: [
      `Each player gets ${HAND_SIZE} cards. One card starts face up in the middle.`,
      "On your turn, play a card that matches the top card's color, or its number or symbol.",
      "⊘ Block — your opponent loses their turn, so you go again.",
      "+2 — your opponent draws 2 cards and loses their turn.",
      "✦ Rainbow — play it on anything and choose the next color.",
      "+4 Rainbow — choose the color; your opponent draws 4 and loses their turn.",
      "Can't play (or don't want to)? Tap the deck to draw one. If it matches you may play it, otherwise pass.",
    ],
    tips: [
      "Save Rainbows for when you have no match — they can't be blocked.",
      "When your opponent is down to their last card, hit them with +2 or +4.",
    ],
  },
};
