// Entry point: wires the board's events to the timer, the top panel and
// the statistics, and starts the UI components.

import { state, on, setLevel, newGame, relayout } from "./board.js";
import { initBoardInput } from "./board-input.js";
import { createTimer } from "./timer.js";
import * as hud from "./hud.js";
import { getBest, submitTime, recordResult } from "./records.js";
import { initDifficulty } from "./difficulty.js";
import { initFlagMode } from "./flag-mode.js";
import { initShortcuts } from "./shortcuts.js";
import { initStatsPanel, isStatsOpen } from "./stats-panel.js";
import { initThemeSelect } from "./theme-select.js";

const timer = createTimer(document.getElementById("timer"));
const showCurrentBest = () => hud.showBest(getBest(state.levelKey));

// ---------- Board events ----------

on("newgame", () => {
  timer.reset();
  hud.setFace("playing");
  hud.clearRecordHighlight();
  hud.setMinesLeft(state.level.mines);
  showCurrentBest();
});

on("start", () => timer.start());

on("flags", () => hud.setMinesLeft(state.level.mines - state.flagsCount));

on("win", () => {
  timer.stop();
  hud.setFace("won");
  recordResult(state.levelKey, true);
  const final = timer.showFinal();
  if (submitTime(state.levelKey, final)) {
    hud.showBest(final);
    hud.celebrateRecord();
  }
});

on("lose", () => {
  timer.stop();
  hud.setFace("lost");
  recordResult(state.levelKey, false);
});

// ---------- UI ----------

initThemeSelect();
initFlagMode();
initBoardInput();
hud.onReset(newGame);
initShortcuts({ onRestart: newGame, isBlocked: isStatsOpen });
initStatsPanel({ getLevel: () => state.levelKey, onReset: showCurrentBest });

let resizeFrame = null;
window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(relayout);
});

const startLevel = initDifficulty((key) => {
  setLevel(key);
  newGame();
});
setLevel(startLevel);
newGame();
