// Best times and statistics per difficulty, stored in the browser

import { LEVELS } from "./levels.js";
import { load, save, remove, loadJSON, saveJSON } from "./storage.js";

export function getBest(levelKey) {
  const value = load(`best-${levelKey}`);
  return value === null ? null : Number(value);
}

// Saves the time if it beats the current best. Returns true on a new record.
export function submitTime(levelKey, seconds) {
  const best = getBest(levelKey);
  if (best !== null && seconds >= best) return false;
  save(`best-${levelKey}`, seconds);
  return true;
}

// { played, won, streak, bestStreak }. Only finished games count.
export function getStats(levelKey) {
  const empty = { played: 0, won: 0, streak: 0, bestStreak: 0 };
  return { ...empty, ...loadJSON(`stats-${levelKey}`, {}) };
}

export function recordResult(levelKey, won) {
  const stats = getStats(levelKey);
  stats.played++;
  if (won) {
    stats.won++;
    stats.streak++;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
  } else {
    stats.streak = 0;
  }
  saveJSON(`stats-${levelKey}`, stats);
}

// Clears statistics and best times for every difficulty
export function resetAll() {
  for (const key of Object.keys(LEVELS)) {
    remove(`stats-${key}`);
    remove(`best-${key}`);
  }
}
