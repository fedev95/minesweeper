// Difficulty buttons. The last choice is remembered.

import { LEVELS, DEFAULT_LEVEL } from "./levels.js";
import { load, save } from "./storage.js";

const buttons = document.querySelectorAll(".difficulty button");

function markActive(key) {
  buttons.forEach((b) => b.classList.toggle("active", b.dataset.level === key));
}

// Calls `onChange(key)` when the user picks a difficulty.
// Returns the saved difficulty to start with.
export function initDifficulty(onChange) {
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.level;
      markActive(key);
      save("level", key);
      onChange(key);
    });
  });

  const saved = load("level", DEFAULT_LEVEL);
  const key = LEVELS[saved] ? saved : DEFAULT_LEVEL;
  markActive(key);
  return key;
}
