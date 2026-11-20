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
import { TARGET as GREEDY_TARGET } from "./greedy";
import { LAST as CLIMB_LAST } from "./climb";
import { ROLLS as YACHT_ROLLS } from "./yacht";
import { TURNS as TILE_TURNS } from "./tilematch";
import { HAND as DOMINO_HAND } from "./dominoes";
import { STONES } from "./mancala";
import { ROWS as STICK_ROWS } from "./matchsticks";

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
    goal: "Own the most boxes when the grid is full. For 2 to 4 players.",
    steps: [
      "Take turns drawing one line between two neighbouring dots. Tap the gap between them.",
      "Draw the fourth side of a box and it becomes yours.",
      "Closing a box earns you another turn straight away — you can chain several in a row.",
      `The game ends when all ${DOTS_N * DOTS_N} boxes are taken. Most boxes wins.`,
    ],
    tips: [
      "Avoid drawing the third side of a box — the next player will close it.",
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
    goal: "Collect the most pairs. For 2 to 4 players.",
    steps: [
      `${PAIRS * 2} cards lie face down, hiding ${PAIRS} pairs.`,
      "On your turn, flip two cards.",
      "If they match, the pair is yours and you go again.",
      "If they don't, both stay face up until the next player starts, then turn back over.",
      "When every pair is taken, most pairs wins.",
    ],
    tips: [
      "Watch everyone else's flips as closely as your own.",
      "Not sure? Flip a card nobody has seen yet first — you might already know its partner.",
    ],
  },
  minefield: {
    title: "Minefield Duel",
    tagline: "One minefield, rival hunters.",
    goal: `Find the most of the ${MINES} hidden mines. With two players, the first to ${MINE_TARGET} wins.`,
    steps: [
      "Everyone shares the same grid. Take turns opening one square.",
      "Found a mine? It's yours — and you open another square straight away.",
      "A safe square shows how many mines touch it (including diagonally), and your turn ends.",
      "A square with no mines nearby opens its neighbours automatically.",
    ],
    tips: [
      "If a number equals the unopened squares around it, every one of them is a mine.",
      "Opening a safe square gives everyone else clues too — sometimes a risky guess is better.",
    ],
  },
  liarsdice: {
    title: "Liar's Dice",
    tagline: "Bid. Bluff. Call it.",
    goal: "Be the last player with dice. For 2 to 4 players.",
    steps: [
      `Each player starts with ${DICE} dice. Every round everyone rolls in secret.`,
      "Take turns bidding how many dice of one face there are across ALL hands, like \"three 4s\".",
      "Each bid must be higher: more dice of any face, or the same number of a higher face.",
      "Instead of bidding you can call \"Liar!\" on the player before you. All dice are shown and counted.",
      "If the bid was true, the caller loses a die. If it was a bluff, the bidder does.",
      "Whoever lost the die starts the next round. Run out of dice and you're out; the last player left wins.",
    ],
    tips: [
      "About one die in six shows any given face — count the dice in play and bid from what you hold.",
      "A confident raise on a face you don't have can scare off a call. Sometimes.",
    ],
  },
  colorrush: {
    title: "Color Rush",
    tagline: "Match colors. Empty your hand first.",
    goal: "Be the first player to play all your cards. For 2 to 4 players.",
    steps: [
      `Each player gets ${HAND_SIZE} cards. One card starts face up in the middle.`,
      "On your turn, play a card that matches the top card's color, or its number or symbol.",
      "⊘ Block — the next player loses their turn.",
      "+2 — the next player draws 2 cards and loses their turn.",
      "✦ Rainbow — play it on anything and choose the next color.",
      "+4 Rainbow — choose the color; the next player draws 4 and loses their turn.",
      "Can't play (or don't want to)? Tap the deck to draw one. If it matches you may play it, otherwise pass.",
      "House rules (Stacking, Swap 7 / Spin 0, Jump-in, Draw till match, Last-card call, Rush mode) can be switched on when you create the room.",
    ],
    tips: [
      "Save Rainbows for when you have no match — they can't be blocked.",
      "When the next player is down to their last card, hit them with +2 or +4.",
    ],
  },
  yacht: {
    title: "Yacht Dice",
    tagline: "Five dice, three rolls, twelve boxes.",
    goal: "Finish with the highest total on your card. For 2 to 4 players.",
    steps: [
      `On your turn, roll all five dice. You may roll up to ${YACHT_ROLLS} times.`,
      "Between rolls, tap the dice you want to keep; the rest are rolled again.",
      "Then tap one empty box on your card to write the score there. Every box is used exactly once.",
      "Ones to Sixes: add up the dice showing that number.",
      "Full house (three alike and two alike) and Choice: add up all five dice. Four alike: add up those four.",
      "Low run (1-2-3-4-5) and High run (2-3-4-5-6) score 30. Yacht — all five the same — scores 50.",
      "If your dice don't fit the box you pick, it scores 0. The game ends when every card is full.",
    ],
    tips: [
      "Nothing useful? Put a zero in Ones or Yacht rather than waste a big box.",
      "Tap a name above the card to look at someone else's card.",
    ],
  },
  greedy: {
    title: "Greedy Dice",
    tagline: "Roll again, or bank it?",
    goal: `Be the first to bank ${GREEDY_TARGET} points. For 2 to 4 players.`,
    steps: [
      "On your turn, roll two dice. Their total goes into the pot.",
      "Roll again to grow the pot, as often as you dare.",
      "Tap Bank to add the pot to your score and end your turn.",
      "Roll a 1 on either die and the pot is lost — your turn ends with nothing.",
      "Roll two 1s and you lose everything you had banked as well.",
    ],
    tips: [
      "Roughly one roll in three has a 1 in it. A pot of about 20 is usually worth banking.",
      "Far behind? Then it is worth taking bigger risks.",
    ],
  },
  ludo: {
    title: "Ludo",
    tagline: "Race your pieces home.",
    goal: "Be the first to bring all your pieces round the board and home. For 2 to 4 players.",
    steps: [
      "Tap Roll. You need a 6 to bring a piece out of your yard onto your start square.",
      "Pieces move clockwise by the number rolled. If more than one can move, tap the piece you want.",
      "Land on another player's piece and it goes back to their yard — and you roll again.",
      "Pieces on a start square or a ★ square are safe and can't be sent back.",
      "A 6 earns another roll, and so does bringing a piece home. Three 6s in a row lose the turn.",
      "After a full lap a piece turns up its own coloured column. It needs the exact number to reach home.",
      "Quick game (chosen when you create the room) uses two pieces each instead of four.",
    ],
    tips: [
      "Get pieces out early — one piece on its own is easy to hunt down.",
      "Stopping on a ★ is often better than running ahead into danger.",
    ],
  },
  climb: {
    title: "Climb & Slide",
    tagline: "Ropes up, slides down.",
    goal: `Be the first to reach square ${CLIMB_LAST}. For 2 to 4 players.`,
    steps: [
      "Tap Roll and your piece moves that many squares.",
      "Land on a ▲ square and you climb the rope to the higher square shown.",
      "Land on a ▼ square and you slide down to the lower square shown.",
      "Roll a 6 and you roll again.",
      "You don't need an exact roll to finish.",
    ],
    tips: ["It is all luck — perfect for playing with younger children.", "The slide on 62 is the cruel one."],
  },
  tilematch: {
    title: "Tile Match",
    tagline: "Swap tiles, line up three.",
    goal: `Score the most points in ${TILE_TURNS} turns each. For 2 to 4 players, all on the same board.`,
    steps: [
      "On your turn, tap a tile, then tap a tile next to it. They swap places.",
      "The swap must line up three or more of the same tile, across or down.",
      "Lined-up tiles clear and score 1 point each. The tiles above fall and new ones drop in.",
      "If the falling tiles make new lines, those clear too — and score double, then triple, and so on.",
      "If no swap is possible anywhere, the board is dealt again.",
    ],
    tips: [
      "Swaps near the bottom move more tiles, so they start more chains.",
      "Look at what your swap leaves for the next player, not just what it scores.",
    ],
  },
  dominoes: {
    title: "Dominoes",
    tagline: "Match the ends of the line.",
    goal: "Be the first to play all your tiles. For 2 to 4 players.",
    steps: [
      `Everyone starts with ${DOMINO_HAND} tiles. The rest form the pile.`,
      "On your turn, play a tile with a number that matches either end of the line on the table.",
      "If a tile fits both ends, you choose which.",
      "No tile fits? Draw from the pile until one does. If the pile is empty, you pass.",
      "Play your last tile and you win.",
      "If nobody can move, the player whose remaining tiles add up to the fewest pips wins.",
    ],
    tips: [
      "Play your heavy tiles early, in case the game gets stuck.",
      "Doubles fit in fewer places — don't hold on to them.",
    ],
  },
  mancala: {
    title: "Mancala",
    tagline: "Sow stones, fill your store.",
    goal: "Collect more stones in your store than your opponent.",
    steps: [
      `Each pit starts with ${STONES} stones. Your six pits are the bottom row; your store is on the right.`,
      "Tap one of your pits. Its stones are dropped one by one into the next pits, anticlockwise, including your store but never your opponent's.",
      "If your last stone lands in your store, you go again.",
      "If your last stone lands in an empty pit on your side, you capture it and everything in the pit opposite.",
      "When one side has no stones left, the other player keeps what is still on their side. Most stones wins.",
    ],
    tips: [
      "Count before you tap: a pit with exactly enough stones to reach your store gives you another turn.",
      "An empty pit on your side is a trap waiting to be sprung.",
    ],
  },
  matchsticks: {
    title: "Matchsticks",
    tagline: "Don't take the last one.",
    goal: "Leave your opponent to take the very last stick.",
    steps: [
      `There are ${STICK_ROWS.length} rows, of ${STICK_ROWS.join(", ")} sticks.`,
      "On your turn, take as many sticks as you like — but all from one row.",
      "Tap a stick to take it and every stick to its right, then confirm.",
      "Whoever has to take the last stick loses.",
    ],
    tips: [
      "Leaving two equal rows is usually strong: whatever they do in one, you copy in the other.",
      "Near the end, try to leave an odd number of single sticks.",
    ],
  },
};
