const LEVELS = {
  easy:   { rows: 9,  cols: 9,  mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard:   { rows: 16, cols: 30, mines: 99 },
};

const boardEl = document.getElementById("board");
const minesLeftEl = document.getElementById("mines-left");
const timerEl = document.getElementById("timer");
const bestEl = document.getElementById("best");
const resetBtn = document.getElementById("reset");
const levelButtons = document.querySelectorAll(".difficulty button");
const modeBtn = document.getElementById("mode");
const modeLabel = document.getElementById("mode-label");
const helpLeft = document.getElementById("help-left");
const helpRight = document.getElementById("help-right");

let levelKey = "medium";
let level = LEVELS[levelKey];
let cells = [];          // flat array of { mine, revealed, flagged, count, el }
let minesPlaced = false; // mines are placed after the first click
let gameOver = false;
let revealedCount = 0;
let flagsCount = 0;
let timer = null;
let startTime = 0;       // performance.now() when the timer started
let elapsed = 0;         // seconds, updated while playing and when the game ends
let flagMode = false;    // swapped clicks: primary click flags, secondary reveals
let gameEndedAt = 0;     // when the last game ended, to ignore stray clicks

// ---------- Utilities ----------

const index = (r, c) => r * level.cols + c;

function neighbors(r, c) {
  const result = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < level.rows && nc >= 0 && nc < level.cols) {
        result.push([nr, nc]);
      }
    }
  }
  return result;
}

// ---------- Setup ----------

function newGame() {
  stopTimer();
  cancelWave();
  clearRecordHighlight();
  elapsed = 0;
  timerEl.textContent = "0";
  gameOver = false;
  minesPlaced = false;
  revealedCount = 0;
  flagsCount = 0;
  resetBtn.textContent = "🙂";
  updateMinesLeft();
  updateBest();

  boardEl.innerHTML = "";
  layoutBoard();
  cells = [];

  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      const el = document.createElement("div");
      el.className = "cell";
      el.dataset.r = r;
      el.dataset.c = c;
      boardEl.appendChild(el);
      cells.push({ mine: false, revealed: false, flagged: false, count: 0, el });
    }
  }
}

// ---------- Responsive layout ----------

const MAX_CELL = 32;
const MIN_CELL = 20;
const PAGE_GUTTER = 16 * 2 + 8 * 2; // body padding + board-wrap padding

// Fit the board to the screen width. On narrow portrait screens, a board
// wider than tall is shown rotated 90° (rows become columns) so it fits
// better. Only the visual grid changes; game logic stays the same.
function layoutBoard() {
  const available = document.documentElement.clientWidth - PAGE_GUTTER;
  const portrait = window.innerHeight > window.innerWidth;
  const transpose =
    portrait && level.cols > level.rows && level.cols * MAX_CELL > available;

  const visualCols = transpose ? level.rows : level.cols;
  const size = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor(available / visualCols)));
  boardEl.style.setProperty("--cell-size", `${size}px`);

  if (transpose) {
    // Cells are in row-major DOM order; flowing them by column transposes the grid
    boardEl.style.gridAutoFlow = "column";
    boardEl.style.gridTemplateRows = `repeat(${level.cols}, ${size}px)`;
    boardEl.style.gridTemplateColumns = "";
    boardEl.style.gridAutoColumns = `${size}px`;
  } else {
    boardEl.style.gridAutoFlow = "row";
    boardEl.style.gridTemplateColumns = `repeat(${level.cols}, ${size}px)`;
    boardEl.style.gridTemplateRows = "";
    boardEl.style.gridAutoColumns = "";
  }
}

let resizeFrame = null;
window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(layoutBoard);
});

// Place mines, avoiding the first clicked cell and its neighbors
function placeMines(safeR, safeC) {
  const forbidden = new Set([index(safeR, safeC)]);
  neighbors(safeR, safeC).forEach(([r, c]) => forbidden.add(index(r, c)));

  const candidates = [];
  for (let i = 0; i < cells.length; i++) {
    if (!forbidden.has(i)) candidates.push(i);
  }

  // Partial Fisher-Yates
  for (let i = 0; i < level.mines; i++) {
    const j = i + Math.floor(Math.random() * (candidates.length - i));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    cells[candidates[i]].mine = true;
  }

  // Compute numbers
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      const cell = cells[index(r, c)];
      cell.count = neighbors(r, c).filter(([nr, nc]) => cells[index(nr, nc)].mine).length;
    }
  }

  minesPlaced = true;
  startTimer();
}

// ---------- Actions ----------

function reveal(r, c) {
  const start = cells[index(r, c)];
  if (start.revealed || start.flagged) return;

  if (start.mine) {
    lose(start);
    return;
  }

  // Iterative flood fill
  const stack = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop();
    const cell = cells[index(cr, cc)];
    if (cell.revealed || cell.flagged) continue;

    cell.revealed = true;
    revealedCount++;
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

function toggleFlag(r, c) {
  const cell = cells[index(r, c)];
  if (cell.revealed) return;
  cell.flagged = !cell.flagged;
  cell.el.textContent = cell.flagged ? "🚩" : "";
  flagsCount += cell.flagged ? 1 : -1;
  updateMinesLeft();
}

// Click on a number: if it has as many flags around as its number,
// reveal the remaining neighbors
function chord(r, c) {
  const cell = cells[index(r, c)];
  if (!cell.revealed || cell.count === 0) return;

  const around = neighbors(r, c);
  const flags = around.filter(([nr, nc]) => cells[index(nr, nc)].flagged).length;
  if (flags !== cell.count) return;

  for (const [nr, nc] of around) {
    if (gameOver) break;
    reveal(nr, nc);
  }
}

// ---------- Game over ----------

function checkWin(originIndex) {
  if (gameOver) return;
  if (revealedCount === level.rows * level.cols - level.mines) {
    gameOver = true;
    gameEndedAt = performance.now();
    stopTimer();
    flagsCount = level.mines;
    updateMinesLeft();
    resetBtn.textContent = "😎";
    recordResult(true);

    // Final time with tenths (truncated, like a stopwatch)
    const final = Math.floor(elapsed * 10) / 10;
    timerEl.textContent = final.toFixed(1);
    const best = getBest();
    if (best === null || final < best) {
      saveBest(final);
      updateBest();
      celebrateRecord();
    }

    // Flag the remaining mines as a green wave from the last opened cell
    const unflagged = cells.filter((cell) => cell.mine && !cell.flagged);
    unflagged.forEach((cell) => { cell.flagged = true; });
    playWave(originIndex, unflagged, (cell) => {
      cell.el.textContent = "🚩";
    }, () => pulseMines("win"));
  }
}

// New best time: the trophy pops and the final time takes the accent color
function celebrateRecord() {
  timerEl.parentElement.classList.add("record");
  bestEl.parentElement.classList.add("new-record");
}

function clearRecordHighlight() {
  timerEl.parentElement.classList.remove("record");
  bestEl.parentElement.classList.remove("new-record");
}

// Light pulse on every mine cell
function pulseMines(result) {
  cells.forEach((cell) => {
    cell.el.classList.remove("appear"); // let the pulse animation take over
    if (cell.mine) cell.el.classList.add("pulse", result);
  });
}

// ---------- End-of-game wave ----------

// Pending timeouts of the end-of-game wave, cancelled by a new game
let waveTimeouts = [];
const WAVE_DURATION = 600; // ms for the wave to reach the farthest cell
const WAVE_RING_MAX_DELAY = 45; // ms between rings on small boards

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Show `targets` in rings spreading from the cell at `originIndex`,
// calling `show` on each one, then `finish` once the wave is done.
// With reduced motion everything appears at once.
function playWave(originIndex, targets, show, finish) {
  if (prefersReducedMotion() || originIndex === undefined) {
    targets.forEach(show);
    finish();
    return;
  }

  const sr = Math.floor(originIndex / level.cols);
  const sc = originIndex % level.cols;
  const rings = new Map();
  for (const cell of targets) {
    const i = cells.indexOf(cell);
    const d = Math.round(Math.hypot(Math.floor(i / level.cols) - sr, (i % level.cols) - sc));
    if (!rings.has(d)) rings.set(d, []);
    rings.get(d).push(cell);
  }
  const maxRing = Math.max(0, ...rings.keys());
  const step = maxRing ? Math.min(WAVE_RING_MAX_DELAY, WAVE_DURATION / maxRing) : 0;
  for (const [d, ring] of rings) {
    waveTimeouts.push(setTimeout(() => {
      ring.forEach((cell) => {
        show(cell);
        cell.el.classList.add("appear");
      });
    }, d * step));
  }
  waveTimeouts.push(setTimeout(finish, maxRing * step + 200));
}

function cancelWave() {
  waveTimeouts.forEach(clearTimeout);
  waveTimeouts = [];
}

function showMine(cell) {
  cell.el.classList.add("revealed", "mine");
  cell.el.textContent = "💣";
}

function lose(explodedCell) {
  gameOver = true;
  gameEndedAt = performance.now();
  stopTimer();
  resetBtn.textContent = "😵";
  recordResult(false);

  showMine(explodedCell);
  explodedCell.el.classList.add("exploded");
  if (!prefersReducedMotion()) shakeBoard();

  // Reveal the other mines as a wave from the exploded one,
  // then mark the wrong flags
  const hidden = cells.filter((cell) => cell.mine && !cell.flagged && cell !== explodedCell);
  playWave(cells.indexOf(explodedCell), hidden, showMine, () => {
    cells.forEach((cell) => {
      if (!cell.mine && cell.flagged) {
        cell.el.classList.add("wrong-flag");
        cell.el.textContent = "❌";
      }
    });
    pulseMines("lose");
  });
}

function shakeBoard() {
  const wrap = boardEl.parentElement;
  wrap.classList.remove("shake");
  void wrap.offsetWidth; // restart the animation if it is still running
  wrap.classList.add("shake");
  wrap.addEventListener("animationend", () => wrap.classList.remove("shake"), { once: true });
}

// ---------- Timer and counter ----------

function startTimer() {
  stopTimer();
  startTime = performance.now();
  // Tick often so whole seconds change on time; show only whole seconds while playing
  timer = setInterval(() => {
    elapsed = (performance.now() - startTime) / 1000;
    timerEl.textContent = Math.floor(elapsed);
  }, 100);
}

function stopTimer() {
  if (timer !== null) elapsed = (performance.now() - startTime) / 1000;
  clearInterval(timer);
  timer = null;
}

// Best time per difficulty, stored in the browser
function getBest() {
  try {
    const v = localStorage.getItem(`best-${levelKey}`);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}

function saveBest(value) {
  try { localStorage.setItem(`best-${levelKey}`, value); } catch {}
}

function updateBest() {
  const best = getBest();
  bestEl.textContent = best === null ? "" : best.toFixed(1);
  bestEl.parentElement.hidden = best === null;
}

// ---------- Statistics ----------

// Per difficulty: { played, won, streak, bestStreak }. Only finished games count.
function getStats(key) {
  const empty = { played: 0, won: 0, streak: 0, bestStreak: 0 };
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(`stats-${key}`)) };
  } catch {
    return empty;
  }
}

function recordResult(won) {
  const stats = getStats(levelKey);
  stats.played++;
  if (won) {
    stats.won++;
    stats.streak++;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
  } else {
    stats.streak = 0;
  }
  try { localStorage.setItem(`stats-${levelKey}`, JSON.stringify(stats)); } catch {}
}

const statsDialog = document.getElementById("stats");
const statsBody = document.getElementById("stats-body");
const LEVEL_NAMES = { easy: "Easy", medium: "Medium", hard: "Hard" };

function renderStats() {
  statsBody.innerHTML = "";
  for (const key of Object.keys(LEVELS)) {
    const st = getStats(key);
    let best = null;
    try { best = localStorage.getItem(`best-${key}`); } catch {}
    const winRate = st.played ? `${Math.round((st.won / st.played) * 100)}%` : "–";
    const items = [
      ["Played", st.played],
      ["Won", st.won],
      ["Win rate", winRate],
      ["Streak", st.streak],
      ["Best streak", st.bestStreak],
      ["Best time", best === null ? "–" : Number(best).toFixed(1)],
    ];

    const card = document.createElement("section");
    card.className = "stats-card" + (key === levelKey ? " current" : "");
    const title = document.createElement("h3");
    title.textContent = LEVEL_NAMES[key];
    if (key === levelKey) {
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
    statsBody.appendChild(card);
  }
}

document.getElementById("stats-open").addEventListener("click", () => {
  renderStats();
  statsDialog.showModal();
});

// Play the slide-out animation, then actually close the dialog
function closeStats() {
  if (!statsDialog.open || statsDialog.classList.contains("closing")) return;
  statsDialog.classList.add("closing");
  const animations = statsDialog.getAnimations();
  const done = () => {
    statsDialog.classList.remove("closing");
    statsDialog.close();
  };
  // With reduced motion there is no animation: close right away
  if (animations.length === 0) done();
  else Promise.all(animations.map((a) => a.finished)).then(done, done);
}

document.getElementById("stats-close").addEventListener("click", closeStats);

// Esc: animate instead of closing instantly
statsDialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  closeStats();
});

// Click on the dimmed backdrop (outside the panel) closes it
statsDialog.addEventListener("click", (e) => {
  if (e.target === statsDialog) {
    const rect = statsDialog.getBoundingClientRect();
    const inside = e.clientX >= rect.left && e.clientX <= rect.right &&
                   e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inside) closeStats();
  }
});

document.getElementById("stats-reset").addEventListener("click", () => {
  if (!confirm("Reset all statistics and best times?")) return;
  for (const key of Object.keys(LEVELS)) {
    try {
      localStorage.removeItem(`stats-${key}`);
      localStorage.removeItem(`best-${key}`);
    } catch {}
  }
  renderStats();
  updateBest();
});

function updateMinesLeft() {
  minesLeftEl.textContent = level.mines - flagsCount;
}

// ---------- Events ----------

// Reveal a hidden cell, or open the neighbors of a revealed number
function revealAction(r, c) {
  const cell = cells[index(r, c)];
  if (cell.flagged) return;
  if (!minesPlaced) placeMines(r, c);
  if (cell.revealed) chord(r, c);
  else reveal(r, c);
}

// Flag a hidden cell; on a revealed number, open its neighbors
function flagAction(r, c) {
  const cell = cells[index(r, c)];
  if (cell.revealed) chord(r, c);
  else toggleFlag(r, c);
}

function cellFromEvent(e) {
  const el = e.target.closest(".cell");
  if (!el || gameOver) return null;
  return [Number(el.dataset.r), Number(el.dataset.c)];
}

// After a game ends, ignore clicks for a moment so a fast double click
// on the last cell doesn't instantly start a new game
const RESTART_CLICK_DELAY = 400;

// Left click / tap
boardEl.addEventListener("click", (e) => {
  // Game over: a click on the board starts a new game
  if (gameOver) {
    if (performance.now() - gameEndedAt >= RESTART_CLICK_DELAY) newGame();
    return;
  }
  const pos = cellFromEvent(e);
  if (!pos) return;
  if (flagMode) flagAction(...pos);
  else revealAction(...pos);
});

// Right click / long press
boardEl.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const pos = cellFromEvent(e);
  if (!pos) return;
  if (flagMode) revealAction(...pos);
  else toggleFlag(...pos);
});

// ---------- Swap clicks ----------

function setFlagMode(on) {
  flagMode = on;
  modeBtn.setAttribute("aria-checked", String(on));
  helpLeft.textContent = on ? "flag" : "reveal";
  helpRight.textContent = on ? "reveal" : "flag";
}

function toggleFlagMode() {
  setFlagMode(!flagMode);
  try { localStorage.setItem("flag-mode", flagMode ? "1" : "0"); } catch {}
}

modeBtn.addEventListener("click", toggleFlagMode);

// Clicking the label toggles the switch too
modeLabel.addEventListener("click", () => {
  toggleFlagMode();
  modeBtn.focus();
});

try { setFlagMode(localStorage.getItem("flag-mode") === "1"); } catch { setFlagMode(false); }

// Middle click: if the flags match the number, reveal the neighbors;
// otherwise, highlight hidden neighbors while the button is held
let highlighted = [];

function clearHighlight() {
  highlighted.forEach((el) => el.classList.remove("highlight"));
  highlighted = [];
}

function canChord(r, c) {
  const cell = cells[index(r, c)];
  if (!cell.revealed || cell.count === 0) return false;
  const flags = neighbors(r, c).filter(([nr, nc]) => cells[index(nr, nc)].flagged).length;
  return flags === cell.count;
}

let middleCell = null; // cell under the held middle button

function highlightAround(el) {
  clearHighlight();
  middleCell = el;
  if (!el || gameOver) return;
  const r = Number(el.dataset.r);
  const c = Number(el.dataset.c);
  for (const [nr, nc] of neighbors(r, c)) {
    const n = cells[index(nr, nc)];
    if (!n.revealed && !n.flagged) {
      n.el.classList.add("highlight");
      highlighted.push(n.el);
    }
  }
}

// On press: reveal if possible, otherwise highlight neighbors
boardEl.addEventListener("mousedown", (e) => {
  if (e.button !== 1) return;
  e.preventDefault(); // prevent browser autoscroll
  const el = e.target.closest(".cell");
  if (!el || gameOver) return;
  const r = Number(el.dataset.r);
  const c = Number(el.dataset.c);
  if (canChord(r, c)) chord(r, c);
  else highlightAround(el);
});

// While held, the highlight follows the cursor
boardEl.addEventListener("mousemove", (e) => {
  if (!(e.buttons & 4)) return; // 4 = middle button
  const el = e.target.closest(".cell");
  if (el === middleCell) return;
  if (el && canChord(Number(el.dataset.r), Number(el.dataset.c))) {
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

resetBtn.addEventListener("click", newGame);

// Keyboard shortcut: R or F2 starts a new game
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return; // keep Ctrl+R etc.
  if (e.target.closest(".select")) return; // theme list uses letters to jump
  if (statsDialog.open) return;
  if (e.key === "F2" || e.key.toLowerCase() === "r") {
    e.preventDefault();
    newGame();
  }
});

function setLevel(key) {
  if (!LEVELS[key]) key = "medium";
  levelKey = key;
  level = LEVELS[key];
  levelButtons.forEach((b) => b.classList.toggle("active", b.dataset.level === key));
}

levelButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    setLevel(btn.dataset.level);
    try { localStorage.setItem("level", levelKey); } catch {}
    newGame();
  });
});

// Restore the last chosen difficulty
let savedLevel = "medium";
try { savedLevel = localStorage.getItem("level") || "medium"; } catch {}
setLevel(savedLevel);

newGame();

// ---------- Color schemes (custom accessible select) ----------

const themeButton = document.getElementById("theme-button");
const themeValue = document.getElementById("theme-value");
const themeList = document.getElementById("theme-list");
const themeLabel = document.getElementById("theme-label");
const themeOptions = [...themeList.querySelectorAll('[role="option"]')];
let activeOption = 0; // highlighted option while the list is open

function applyTheme(name) {
  const option = themeOptions.find((o) => o.dataset.value === name) || themeOptions[0];
  const value = option.dataset.value;

  if (value === "default") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = value;

  themeOptions.forEach((o) => o.setAttribute("aria-selected", String(o === option)));
  themeValue.textContent = option.textContent;
  return value;
}

function selectTheme(index) {
  const value = applyTheme(themeOptions[index].dataset.value);
  try { localStorage.setItem("theme", value); } catch {}
}

function setActive(index) {
  activeOption = Math.max(0, Math.min(themeOptions.length - 1, index));
  themeOptions.forEach((o, i) => o.classList.toggle("active", i === activeOption));
  const option = themeOptions[activeOption];
  themeList.setAttribute("aria-activedescendant", option.id);
  option.scrollIntoView({ block: "nearest" });
}

function openList() {
  themeList.hidden = false;
  themeButton.setAttribute("aria-expanded", "true");
  const selected = themeOptions.findIndex((o) => o.getAttribute("aria-selected") === "true");
  setActive(selected === -1 ? 0 : selected);
  themeList.focus();
}

function closeList(returnFocus = true) {
  themeList.hidden = true;
  themeButton.setAttribute("aria-expanded", "false");
  themeList.removeAttribute("aria-activedescendant");
  if (returnFocus) themeButton.focus();
}

themeButton.addEventListener("click", () => {
  if (themeList.hidden) openList();
  else closeList();
});

themeButton.addEventListener("keydown", (e) => {
  if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
    e.preventDefault();
    openList();
  }
});

themeList.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "ArrowDown": e.preventDefault(); setActive(activeOption + 1); break;
    case "ArrowUp":   e.preventDefault(); setActive(activeOption - 1); break;
    case "Home":      e.preventDefault(); setActive(0); break;
    case "End":       e.preventDefault(); setActive(themeOptions.length - 1); break;
    case "Enter":
    case " ":
      e.preventDefault();
      selectTheme(activeOption);
      closeList();
      break;
    case "Escape":
      e.preventDefault();
      closeList();
      break;
    case "Tab":
      closeList(false);
      break;
    default: {
      // Jump by first letter
      if (e.key.length !== 1) return;
      const key = e.key.toLowerCase();
      const n = themeOptions.length;
      for (let i = 1; i <= n; i++) {
        const idx = (activeOption + i) % n;
        if (themeOptions[idx].textContent.trim().toLowerCase().startsWith(key)) {
          setActive(idx);
          break;
        }
      }
    }
  }
});

themeOptions.forEach((option, i) => {
  option.addEventListener("mousemove", () => {
    if (activeOption !== i) setActive(i);
  });
  option.addEventListener("click", () => {
    selectTheme(i);
    closeList();
  });
});

// Click outside or focus loss: close
document.addEventListener("mousedown", (e) => {
  if (!themeList.hidden && !e.target.closest(".select")) closeList(false);
});

themeList.addEventListener("focusout", (e) => {
  if (!themeList.hidden && !e.currentTarget.parentElement.contains(e.relatedTarget)) {
    closeList(false);
  }
});

// Click on the label: focus the button (like a <label> does)
themeLabel.addEventListener("click", () => themeButton.focus());

let savedTheme = "default";
try { savedTheme = localStorage.getItem("theme") || "default"; } catch {}
applyTheme(savedTheme);
