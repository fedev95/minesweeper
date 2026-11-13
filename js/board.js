// Game state and rules: mines, reveal, flags, chords, win and loss.
// The board renders its own cells; everything else (timer, panel,
// statistics) listens to the events emitted here.

import { LEVELS, DEFAULT_LEVEL } from "./levels.js";
import { layoutBoard } from "./layout.js";
import { playWave, cancelWave, shake, prefersReducedMotion } from "./effects.js";
import { generateMines } from "./solver.js";

const boardEl = document.getElementById("board");

export const state = {
  levelKey: DEFAULT_LEVEL,
  level: LEVELS[DEFAULT_LEVEL],
  cells: [],          // flat array of { mine, revealed, flagged, count, el }
  minesPlaced: false, // mines are placed after the first click
  over: false,
  endedAt: 0,         // performance.now() when the last game ended
  revealedCount: 0,
  flagsCount: 0,
  noGuess: true,      // switch: boards solvable without guessing
  gameNoGuess: true,  // mode of the current game, fixed on its first click
};

// ---------- Events ----------
// "newgame", "start" (first reveal), "flags" (flag count changed), "win", "lose"

const listeners = {};

export function on(event, handler) {
  (listeners[event] ??= []).push(handler);
}

function emit(event) {
  listeners[event]?.forEach((handler) => handler());
}

// ---------- Grid helpers ----------

export const index = (r, c) => r * state.level.cols + c;

export const cellAt = (r, c) => state.cells[index(r, c)];

export function neighbors(r, c) {
  const { rows, cols } = state.level;
  const result = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) result.push([nr, nc]);
    }
  }
  return result;
}

// ---------- Setup ----------

export function setNoGuess(on) {
  state.noGuess = on;
}

// Mode of the game being played: fixed once the mines are placed,
// before that it follows the switch
export const isNoGuessGame = () => (state.minesPlaced ? state.gameNoGuess : state.noGuess);

export function setLevel(key) {
  state.levelKey = LEVELS[key] ? key : DEFAULT_LEVEL;
  state.level = LEVELS[state.levelKey];
}

export function newGame() {
  cancelWave();
  Object.assign(state, {
    cells: [],
    minesPlaced: false,
    over: false,
    revealedCount: 0,
    flagsCount: 0,
  });

  boardEl.innerHTML = "";
  relayout();

  const { rows, cols } = state.level;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const el = document.createElement("div");
      el.className = "cell";
      el.dataset.r = r;
      el.dataset.c = c;
      boardEl.appendChild(el);
      state.cells.push({ mine: false, revealed: false, flagged: false, count: 0, el });
    }
  }
  emit("newgame");
}

export function relayout() {
  layoutBoard(boardEl, state.level);
}

// Place mines on the first click: that cell and its neighbors stay safe
function placeMines(safeR, safeC) {
  const { cells, level } = state;
  state.gameNoGuess = state.noGuess;
  const mines = generateMines(level, index(safeR, safeC), { noGuess: state.gameNoGuess });
  mines.forEach((isMine, i) => { cells[i].mine = isMine; });

  // Compute numbers
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      cellAt(r, c).count = neighbors(r, c).filter(([nr, nc]) => cellAt(nr, nc).mine).length;
    }
  }

  state.minesPlaced = true;
  emit("start");
}

// ---------- Actions ----------

// Reveal a hidden cell, or open the neighbors of a revealed number
export function revealAction(r, c) {
  const cell = cellAt(r, c);
  if (cell.flagged) return;
  if (!state.minesPlaced) placeMines(r, c);
  if (cell.revealed) chord(r, c);
  else reveal(r, c);
}

// Flag a hidden cell; on a revealed number, open its neighbors
export function flagAction(r, c) {
  if (cellAt(r, c).revealed) chord(r, c);
  else toggleFlag(r, c);
}

function reveal(r, c) {
  const start = cellAt(r, c);
  if (start.revealed || start.flagged) return;

  if (start.mine) {
    lose(start);
    return;
  }

  // Iterative flood fill
  const stack = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop();
    const cell = cellAt(cr, cc);
    if (cell.revealed || cell.flagged) continue;

    cell.revealed = true;
    state.revealedCount++;
    cell.el.classList.add("revealed");
    if (cell.count > 0) {
      cell.el.textContent = cell.count;
      cell.el.classList.add(`n${cell.count}`);
    } else {
      neighbors(cr, cc).forEach((n) => stack.push(n));
    }
  }

  checkWin(index(r, c));
}

export function toggleFlag(r, c) {
  const cell = cellAt(r, c);
  if (cell.revealed) return;
  cell.flagged = !cell.flagged;
  cell.el.textContent = cell.flagged ? "🚩" : "";
  state.flagsCount += cell.flagged ? 1 : -1;
  emit("flags");
}

// A revealed number with as many flags around as its value
export function canChord(r, c) {
  const cell = cellAt(r, c);
  if (!cell.revealed || cell.count === 0) return false;
  const flags = neighbors(r, c).filter(([nr, nc]) => cellAt(nr, nc).flagged).length;
  return flags === cell.count;
}

// Reveal the remaining neighbors of a number whose flags are all placed
export function chord(r, c) {
  if (!canChord(r, c)) return;
  for (const [nr, nc] of neighbors(r, c)) {
    if (state.over) break;
    reveal(nr, nc);
  }
}

// ---------- Game over ----------

function endGame() {
  state.over = true;
  state.endedAt = performance.now();
}

function checkWin(originIndex) {
  const { level, cells } = state;
  if (state.over || state.revealedCount !== level.rows * level.cols - level.mines) return;

  endGame();
  state.flagsCount = level.mines;
  emit("flags");
  emit("win");

  // Flag the remaining mines as a green wave from the last opened cell
  const unflagged = cells.filter((cell) => cell.mine && !cell.flagged);
  unflagged.forEach((cell) => { cell.flagged = true; });
  playWave({ cells, cols: level.cols }, originIndex, unflagged, (cell) => {
    cell.el.textContent = "🚩";
  }, () => pulseMines("win"));
}

function showMine(cell) {
  cell.el.classList.add("revealed", "mine");
  cell.el.textContent = "💣";
}

function lose(explodedCell) {
  const { cells, level } = state;
  endGame();
  emit("lose");

  showMine(explodedCell);
  explodedCell.el.classList.add("exploded");
  if (!prefersReducedMotion()) shake(boardEl.parentElement);

  // Reveal the other mines as a wave from the exploded one,
  // then mark the wrong flags
  const hidden = cells.filter((cell) => cell.mine && !cell.flagged && cell !== explodedCell);
  playWave({ cells, cols: level.cols }, cells.indexOf(explodedCell), hidden, showMine, () => {
    cells.forEach((cell) => {
      if (!cell.mine && cell.flagged) {
        cell.el.classList.add("wrong-flag");
        cell.el.textContent = "❌";
      }
    });
    pulseMines("lose");
  });
}

// Light pulse on every mine cell
function pulseMines(result) {
  state.cells.forEach((cell) => {
    cell.el.classList.remove("appear"); // let the pulse animation take over
    if (cell.mine) cell.el.classList.add("pulse", result);
  });
}
