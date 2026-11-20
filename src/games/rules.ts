import { START_COINS } from "./bidtactoe";
import { HAND_SIZE } from "./colorrush";
import { COST, MAX_DEFENDS, MAX_ENERGY, MAX_HP, MAX_ROUNDS, START_ENERGY } from "./duel";
import { LEN as CODE_LEN, MAX_GUESSES } from "./codebreaker";
import { N as DOTS_N } from "./dots";
import { DICE } from "./liarsdice";
import { PAIRS } from "./memory";
import { MINES, TARGET as MINE_TARGET } from "./minefield";
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
  territory: {
    title: "Territory",
    tagline: "Place a piece, flip the neighbours.",
    goal: "Own more squares than your opponent when the board is full.",
    steps: [
      "Each player starts with two pieces in the middle.",
      "On your turn, place a piece on any empty square.",
      "Every opponent piece touching it — including diagonally — flips to your colour.",
      "Empty squares show how many pieces you would flip there.",
      "When the board is full, the player with more squares wins.",
    ],
    tips: [
      "A big flip can be flipped straight back — look at what your move leaves open.",
      "Corners and edges touch fewer squares, so pieces there are harder to flip.",
    ],
  },
  gravity: {
    title: "Gravity Flip",
    tagline: "Connect Four that can turn on its side.",
    goal: "Get 4 of your discs in a row — across, down or diagonal.",
    steps: [
      "Take turns dropping a disc into a column; it falls to the lowest empty spot.",
      "Once per game, instead of dropping, you may flip the board a quarter turn.",
      "After a flip every disc falls to the new bottom, which can make or break lines.",
      "If a flip gives both players four in a row at once, it's a draw.",
    ],
    tips: [
      "Before you flip, picture each row as a column — that is what it becomes.",
      "Holding your flip is a threat in itself; your opponent has to plan around it.",
    ],
  },
  codebreaker: {
    title: "Code Breaker",
    tagline: "Hide a code. Crack theirs first.",
    goal: "Work out your opponent's secret code before they work out yours.",
    steps: [
      `Both players secretly choose a code of ${CODE_LEN} different digits.`,
      "Take turns guessing the other player's code.",
      "● means a digit is right and in the right place.",
      "○ means a digit is in the code, but in a different place.",
      "Both players always get the same number of guesses — crack it in the same round and it's a draw.",
      `Nobody cracks it in ${MAX_GUESSES} guesses? Also a draw.`,
    ],
    tips: [
      "Start with guesses that share no digits, to find out which digits are in the code.",
      "You can see your opponent's guesses too — watch how close they are getting.",
    ],
  },
  memory: {
    title: "Memory Match",
    tagline: "Flip two. Remember everything.",
    goal: "Collect more pairs than your opponent.",
    steps: [
      `${PAIRS * 2} cards lie face down, hiding ${PAIRS} pairs.`,
      "On your turn, flip two cards.",
      "If they match, the pair is yours and you go again.",
      "If they don't, both stay face up until the next player starts, then turn back over.",
      "When every pair is taken, most pairs wins.",
    ],
    tips: [
      "Watch your opponent's flips as closely as your own.",
      "Not sure? Flip a card nobody has seen yet first — you might already know its partner.",
    ],
  },
  minefield: {
    title: "Minefield Duel",
    tagline: "One minefield, two hunters.",
    goal: `Find ${MINE_TARGET} of the ${MINES} hidden mines before your opponent does.`,
    steps: [
      "Both players share the same grid. Take turns opening one square.",
      "Found a mine? It's yours — and you open another square straight away.",
      "A safe square shows how many mines touch it (including diagonally), and your turn ends.",
      "A square with no mines nearby opens its neighbours automatically.",
    ],
    tips: [
      "If a number equals the unopened squares around it, every one of them is a mine.",
      "Opening a safe square gives your opponent clues too — sometimes a risky guess is better.",
    ],
  },
  liarsdice: {
    title: "Liar's Dice",
    tagline: "Bid. Bluff. Call it.",
    goal: "Make your opponent lose all their dice.",
    steps: [
      `Each player starts with ${DICE} dice. Every round you both roll in secret.`,
      "Take turns bidding how many dice of one face there are across BOTH hands, like \"three 4s\".",
      "Each bid must be higher: more dice of any face, or the same number of a higher face.",
      "Instead of bidding you can call \"Liar!\". All dice are shown and counted.",
      "If the bid was true, the caller loses a die. If it was a bluff, the bidder does.",
      "Whoever lost the die starts the next round. Run out of dice and you lose.",
    ],
    tips: [
      "With ten dice in play, about one in six shows any given face — bid from what you hold.",
      "A confident raise on a face you don't have can scare off a call. Sometimes.",
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
      "House rules (Stacking, Swap 7 / Spin 0, Jump-in, Draw till match, Last-card call, Rush mode) can be switched on when you create the room.",
    ],
    tips: [
      "Save Rainbows for when you have no match — they can't be blocked.",
      "When your opponent is down to their last card, hit them with +2 or +4.",
    ],
  },
};
