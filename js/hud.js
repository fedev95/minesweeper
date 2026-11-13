// Top panel: mines counter, reset face and best time

const minesLeftEl = document.getElementById("mines-left");
const resetBtn = document.getElementById("reset");
const timeEl = document.getElementById("timer").parentElement;
const bestEl = document.getElementById("best");
const bestWrap = bestEl.parentElement;

const FACES = { playing: "🙂", won: "😎", lost: "😵" };

export function onReset(handler) {
  resetBtn.addEventListener("click", handler);
}

export function setFace(state) {
  resetBtn.textContent = FACES[state];
}

export function setMinesLeft(count) {
  minesLeftEl.textContent = count;
}

export function showBest(best) {
  bestEl.textContent = best === null ? "" : best.toFixed(1);
  bestWrap.hidden = best === null;
}

// New best time: the trophy pops and the final time takes the accent color
export function celebrateRecord() {
  timeEl.classList.add("record");
  bestWrap.classList.add("new-record");
}

export function clearRecordHighlight() {
  timeEl.classList.remove("record");
  bestWrap.classList.remove("new-record");
}
