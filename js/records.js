// Best times and statistics per difficulty and mode, stored in the browser.
// Classic games (with guessing) keep the original keys, so data saved
// before the no-guessing mode existed counts as classic.

import { LEVELS } from "./levels.js";
import { load, save, remove, loadJSON, saveJSON } from "./storage.js";

const suffix = (noGuess) => (noGuess ? "-noguess" : "");
const bestKey = (levelKey, noGuess) => `best-${levelKey}${suffix(noGuess)}`;
const statsKey = (levelKey, noGuess) => `stats-${levelKey}${suffix(noGuess)}`;

export function getBest(levelKey, noGuess) {
  const value = load(bestKey(levelKey, noGuess));
  return value === null ? null : Number(value);
}

// Saves the time if it beats the current best. Returns true on a new record.
export function submitTime(levelKey, noGuess, seconds) {
  const best = getBest(levelKey, noGuess);
  if (best !== null && seconds >= best) return false;
  save(bestKey(levelKey, noGuess), seconds);
  return true;
}

// { played, won, streak, bestStreak }. Only finished games count.
export function getStats(levelKey, noGuess) {
  const empty = { played: 0, won: 0, streak: 0, bestStreak: 0 };
  return { ...empty, ...loadJSON(statsKey(levelKey, noGuess), {}) };
}

export function recordResult(levelKey, noGuess, won) {
  const stats = getStats(levelKey, noGuess);
  stats.played++;
  if (won) {
    stats.won++;
    stats.streak++;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
  } else {
    stats.streak = 0;
  }
  saveJSON(statsKey(levelKey, noGuess), stats);
}

// Clears statistics and best times for every difficulty and mode
export function resetAll() {
  for (const key of Object.keys(LEVELS)) {
    for (const noGuess of [false, true]) {
      remove(statsKey(key, noGuess));
      remove(bestKey(key, noGuess));
    }
  }
}
