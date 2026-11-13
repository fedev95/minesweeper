// Mine layout generation, optionally guaranteeing a board that can be
// solved with logic alone (no 50/50 guesses). No DOM here.

const MAX_ATTEMPTS = 5000;

// Neighbor indices of every cell of a rows × cols grid
function neighborLists(rows, cols) {
  const lists = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const list = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if ((dr || dc) && nr >= 0 && nr < rows && nc >= 0 && nc < cols) list.push(nr * cols + nc);
        }
      }
      lists.push(list);
    }
  }
  return lists;
}

// Random layout avoiding the forbidden cells (partial Fisher-Yates)
function randomLayout(total, mineCount, forbidden) {
  const candidates = [];
  for (let i = 0; i < total; i++) {
    if (!forbidden.has(i)) candidates.push(i);
  }
  const mines = new Array(total).fill(false);
  for (let i = 0; i < mineCount; i++) {
    const j = i + Math.floor(Math.random() * (candidates.length - i));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    mines[candidates[i]] = true;
  }
  return mines;
}

// Plays the board from `start` using only deductions a careful player can
// make. Returns true if every safe cell gets revealed that way.
export function isSolvableWithoutGuessing(mines, nbrs, mineCount, start) {
  const total = mines.length;
  const counts = nbrs.map((list) => list.filter((n) => mines[n]).length);
  const UNKNOWN = 0, OPEN = 1, MINE = 2;
  const state = new Uint8Array(total);
  let opened = 0;
  let flagged = 0;

  const open = (i) => {
    const stack = [i];
    while (stack.length) {
      const k = stack.pop();
      if (state[k] !== UNKNOWN) continue;
      state[k] = OPEN;
      opened++;
      if (counts[k] === 0) stack.push(...nbrs[k]);
    }
  };
  const flag = (i) => {
    if (state[i] === UNKNOWN) { state[i] = MINE; flagged++; }
  };

  open(start);

  while (opened < total - mineCount) {
    let progress = false;

    // Constraints: each open number with hidden neighbors
    const constraints = [];
    for (let i = 0; i < total; i++) {
      if (state[i] !== OPEN || counts[i] === 0) continue;
      const hidden = [];
      let known = 0;
      for (const n of nbrs[i]) {
        if (state[n] === UNKNOWN) hidden.push(n);
        else if (state[n] === MINE) known++;
      }
      if (hidden.length) constraints.push({ cells: hidden, mines: counts[i] - known });
    }

    // Basic rule: all hidden neighbors are mines, or all are safe
    for (const { cells, mines: m } of constraints) {
      if (m === 0) { cells.forEach(open); progress = true; }
      else if (m === cells.length) { cells.forEach(flag); progress = true; }
    }
    if (progress) continue;

    // Pair rule (1-2-1, 1-2, subsets...): compare overlapping numbers
    const byCell = new Map();
    constraints.forEach((con, ci) => {
      con.set = new Set(con.cells);
      for (const cell of con.cells) {
        if (!byCell.has(cell)) byCell.set(cell, []);
        byCell.get(cell).push(ci);
      }
    });
    for (let ai = 0; ai < constraints.length && !progress; ai++) {
      const a = constraints[ai];
      const partners = new Set();
      for (const cell of a.cells) byCell.get(cell).forEach((bi) => bi !== ai && partners.add(bi));
      for (const bi of partners) {
        const b = constraints[bi];
        const shared = a.cells.filter((x) => b.set.has(x)).length;
        const onlyA = a.cells.filter((x) => !b.set.has(x));
        const onlyB = b.cells.filter((x) => !a.set.has(x));
        // B's cells outside A must hold at least this many mines
        const minOnlyB = b.mines - Math.min(a.mines, shared);
        if (onlyB.length && minOnlyB === onlyB.length) { onlyB.forEach(flag); progress = true; }
        // A's cells outside B can hold at most this many mines
        const maxOnlyA = a.mines - Math.max(0, b.mines - onlyB.length);
        if (onlyA.length && maxOnlyA === 0) { onlyA.forEach(open); progress = true; }
        if (progress) break;
      }
    }
    if (progress) continue;

    // Global rule: the mine counter settles the remaining cells
    const unknown = [];
    for (let i = 0; i < total; i++) if (state[i] === UNKNOWN) unknown.push(i);
    if (flagged === mineCount) { unknown.forEach(open); continue; }
    if (unknown.length === mineCount - flagged) { unknown.forEach(flag); continue; }

    return false; // stuck: a guess would be needed
  }
  return true;
}

// Returns a boolean mine array for a rows × cols board. The start cell and
// its neighbors are always safe, so the first click opens an area. With
// `noGuess`, retries until the board is solvable from there with logic only
// (after MAX_ATTEMPTS it settles for the last layout, which never happened
// in testing).
export function generateMines({ rows, cols, mines }, start, { noGuess = false } = {}) {
  const nbrs = neighborLists(rows, cols);
  const forbidden = new Set([start, ...nbrs[start]]);
  let layout = randomLayout(rows * cols, mines, forbidden);
  if (!noGuess) return layout;

  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
    if (isSolvableWithoutGuessing(layout, nbrs, mines, start)) break;
    layout = randomLayout(rows * cols, mines, forbidden);
  }
  return layout;
}
