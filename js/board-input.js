// Mouse and touch input on the board

import {
  state, cellAt, neighbors, newGame,
  revealAction, flagAction, toggleFlag, chord, canChord,
} from "./board.js";
import { isFlagMode } from "./flag-mode.js";

const boardEl = document.getElementById("board");

// After a game ends, ignore clicks for a moment so a fast double click
// on the last cell doesn't instantly start a new game
const RESTART_CLICK_DELAY = 400;

const position = (el) => [Number(el.dataset.r), Number(el.dataset.c)];

function cellFromEvent(e) {
  const el = e.target.closest(".cell");
  if (!el || state.over) return null;
  return position(el);
}

// ---------- Middle click highlight ----------
// If the flags match the number, reveal the neighbors;
// otherwise, highlight hidden neighbors while the button is held

let highlighted = [];
let middleCell = null; // cell under the held middle button

function clearHighlight() {
  highlighted.forEach((el) => el.classList.remove("highlight"));
  highlighted = [];
}

function highlightAround(el) {
  clearHighlight();
  middleCell = el;
  if (!el || state.over) return;
  for (const [nr, nc] of neighbors(...position(el))) {
    const n = cellAt(nr, nc);
    if (!n.revealed && !n.flagged) {
      n.el.classList.add("highlight");
      highlighted.push(n.el);
    }
  }
}

export function initBoardInput() {
  // Left click / tap
  boardEl.addEventListener("click", (e) => {
    // Game over: a click on the board starts a new game
    if (state.over) {
      if (performance.now() - state.endedAt >= RESTART_CLICK_DELAY) newGame();
      return;
    }
    const pos = cellFromEvent(e);
    if (!pos) return;
    if (isFlagMode()) flagAction(...pos);
    else revealAction(...pos);
  });

  // Right click / long press
  boardEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const pos = cellFromEvent(e);
    if (!pos) return;
    if (isFlagMode()) revealAction(...pos);
    else toggleFlag(...pos);
  });

  // Middle press: reveal if possible, otherwise highlight neighbors
  boardEl.addEventListener("mousedown", (e) => {
    if (e.button !== 1) return;
    e.preventDefault(); // prevent browser autoscroll
    const el = e.target.closest(".cell");
    if (!el || state.over) return;
    if (canChord(...position(el))) chord(...position(el));
    else highlightAround(el);
  });

  // While held, the highlight follows the cursor
  boardEl.addEventListener("mousemove", (e) => {
    if (!(e.buttons & 4)) return; // 4 = middle button
    const el = e.target.closest(".cell");
    if (el === middleCell) return;
    if (el && canChord(...position(el))) {
      clearHighlight();
      middleCell = el;
    } else {
      highlightAround(el);
    }
  });

  // On release (anywhere), clear the highlight
  document.addEventListener("mouseup", (e) => {
    if (e.button !== 1) return;
    clearHighlight();
    middleCell = null;
  });

  // Prevent middle click from pasting text or opening things (Linux)
  boardEl.addEventListener("auxclick", (e) => {
    if (e.button === 1) e.preventDefault();
  });
}
