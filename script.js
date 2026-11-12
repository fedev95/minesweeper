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
let seconds = 0;
let flagMode = false;    // swapped clicks: primary click flags, secondary reveals

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
  seconds = 0;
  timerEl.textContent = "0";
  gameOver = false;
  minesPlaced = false;
  revealedCount = 0;
  flagsCount = 0;
  resetBtn.textContent = "🙂";
  updateMinesLeft();
  updateBest();

  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = `repeat(${level.cols}, 30px)`;
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

  checkWin();
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

function checkWin() {
  if (gameOver) return;
  if (revealedCount === level.rows * level.cols - level.mines) {
    gameOver = true;
    stopTimer();
    // Flag all mines
    cells.forEach((cell) => {
      if (cell.mine && !cell.flagged) {
        cell.flagged = true;
        cell.el.textContent = "🚩";
      }
    });
    pulseMines("win");
    flagsCount = level.mines;
    updateMinesLeft();
    resetBtn.textContent = "😎";
    const best = getBest();
    if (best === null || seconds < best) {
      saveBest(seconds);
      updateBest();
    }
  }
}

// Brief light pulse on every mine cell
function pulseMines(result) {
  cells.forEach((cell) => {
    if (cell.mine) cell.el.classList.add("pulse", result);
  });
}

function lose(explodedCell) {
  gameOver = true;
  stopTimer();
  cells.forEach((cell) => {
    if (cell.mine && !cell.flagged) {
      cell.el.classList.add("revealed", "mine");
      cell.el.textContent = "💣";
    } else if (!cell.mine && cell.flagged) {
      cell.el.classList.add("wrong-flag");
      cell.el.textContent = "❌";
    }
  });
  explodedCell.el.classList.add("exploded");
  pulseMines("lose");
  resetBtn.textContent = "😵";
}

// ---------- Timer and counter ----------

function startTimer() {
  stopTimer();
  timer = setInterval(() => {
    seconds++;
    timerEl.textContent = seconds;
  }, 1000);
}

function stopTimer() {
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
  bestEl.textContent = best ?? "";
  bestEl.parentElement.hidden = best === null;
}

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

// Left click / tap
boardEl.addEventListener("click", (e) => {
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

levelButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    levelButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    levelKey = btn.dataset.level;
    level = LEVELS[levelKey];
    newGame();
  });
});

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
