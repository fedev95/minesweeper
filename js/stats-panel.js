// Statistics sidebar (a modal <dialog> sliding in from the right)

import { LEVELS, LEVEL_NAMES } from "./levels.js";
import { getStats, getBest, resetAll } from "./records.js";
import { formatBest } from "./timer.js";

const dialog = document.getElementById("stats");
const body = document.getElementById("stats-body");
const tabs = [...document.querySelectorAll('.stats-modes [role="tab"]')];

let shownNoGuess = true; // mode whose statistics are on screen

export const isStatsOpen = () => dialog.open;

function renderCard(key, isCurrent) {
  const stats = getStats(key, shownNoGuess);
  const best = getBest(key, shownNoGuess);
  const winRate = stats.played ? `${Math.round((stats.won / stats.played) * 100)}%` : "–";
  const items = [
    ["Played", stats.played],
    ["Won", stats.won],
    ["Win rate", winRate],
    ["Streak", stats.streak],
    ["Best streak", stats.bestStreak],
    ["Best time", best === null ? "–" : formatBest(best)],
  ];

  const card = document.createElement("section");
  card.className = "stats-card" + (isCurrent ? " current" : "");

  const title = document.createElement("h3");
  title.textContent = LEVEL_NAMES[key];
  if (isCurrent) {
    const tag = document.createElement("small");
    tag.textContent = "Current";
    title.appendChild(tag);
  }

  const grid = document.createElement("dl");
  grid.className = "stats-grid";
  for (const [label, value] of items) {
    const item = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    item.append(dt, dd);
    grid.appendChild(item);
  }

  card.append(title, grid);
  return card;
}

function render(currentLevel) {
  tabs.forEach((tab) => {
    const selected = (tab.dataset.noGuess === "true") === shownNoGuess;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected) body.setAttribute("aria-labelledby", tab.id);
  });
  body.replaceChildren(
    ...Object.keys(LEVELS).map((key) => renderCard(key, key === currentLevel))
  );
}

// Play the slide-out animation, then actually close the dialog
function close() {
  if (!dialog.open || dialog.classList.contains("closing")) return;
  dialog.classList.add("closing");
  const animations = dialog.getAnimations();
  const done = () => {
    dialog.classList.remove("closing");
    dialog.close();
  };
  // With reduced motion there is no animation: close right away
  if (animations.length === 0) done();
  else Promise.all(animations.map((a) => a.finished)).then(done, done);
}

// `getLevel()` returns the current difficulty, highlighted in the panel.
// `getNoGuess()` returns the current mode, shown first when the panel opens.
// `onReset()` runs after the statistics are cleared.
export function initStatsPanel({ getLevel, getNoGuess, onReset }) {
  document.getElementById("stats-open").addEventListener("click", () => {
    shownNoGuess = getNoGuess();
    render(getLevel());
    dialog.showModal();
  });

  // Mode tabs: click, or arrow keys to move between them
  const showMode = (tab) => {
    shownNoGuess = tab.dataset.noGuess === "true";
    render(getLevel());
    tab.focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => showMode(tab));
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const step = e.key === "ArrowRight" ? 1 : -1;
      showMode(tabs[(i + step + tabs.length) % tabs.length]);
    });
  });

  document.getElementById("stats-close").addEventListener("click", close);

  // Esc: animate instead of closing instantly
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });

  // Click on the dimmed backdrop (outside the panel) closes it
  dialog.addEventListener("click", (e) => {
    if (e.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside = e.clientX >= rect.left && e.clientX <= rect.right &&
                   e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inside) close();
  });

  document.getElementById("stats-reset").addEventListener("click", () => {
    if (!confirm("Reset all statistics and best times?")) return;
    resetAll();
    render(getLevel());
    onReset();
  });
}
