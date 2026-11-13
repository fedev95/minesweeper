// Entry point: wires the board's events to the timer, the top panel and
// the statistics, and starts the UI components.

import { state, on, setLevel, setNoGuess, isNoGuessGame, newGame, relayout } from "./board.js";
import { initBoardInput } from "./board-input.js";
import { createTimer } from "./timer.js";
import * as hud from "./hud.js";
import { getBest, submitTime, recordResult } from "./records.js";
import { initDifficulty } from "./difficulty.js";
import { initFlagMode } from "./flag-mode.js";
import { initSwitch } from "./switch.js";
import { initShortcuts } from "./shortcuts.js";
import { initStatsPanel, isStatsOpen } from "./stats-panel.js";
import { initThemeSelect } from "./theme-select.js";

const timer = createTimer(document.getElementById("timer"));
const showCurrentBest = () => hud.showBest(getBest(state.levelKey, isNoGuessGame()));

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
  const noGuess = isNoGuessGame();
  recordResult(state.levelKey, noGuess, true);
  // A time past the 999 s limit is saved as 999, but only when there is no
  // record yet: any existing record (999.x at worst) is already as good
  const { seconds, capped } = timer.showFinal();
  const counts = !capped || getBest(state.levelKey, noGuess) === null;
  if (counts && submitTime(state.levelKey, noGuess, seconds)) {
    hud.showBest(seconds);
    hud.celebrateRecord();
  }
});

on("lose", () => {
  timer.stop();
  hud.setFace("lost");
  recordResult(state.levelKey, isNoGuessGame(), false);
});

// ---------- UI ----------

initThemeSelect();
initFlagMode();
initSwitch({
  id: "no-guess",
  labelId: "no-guess-label",
  storageKey: "no-guess",
  defaultOn: true,
  onChange: (on) => {
    setNoGuess(on);
    // Before the first click the game follows the switch: show that mode's record
    if (!state.minesPlaced) showCurrentBest();
  },
});
initBoardInput();
hud.onReset(newGame);
initShortcuts({ onRestart: newGame, isBlocked: isStatsOpen });
initStatsPanel({
  getLevel: () => state.levelKey,
  getNoGuess: isNoGuessGame,
  onReset: showCurrentBest,
});

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
