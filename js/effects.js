// End-of-game animations

const WAVE_DURATION = 600;      // ms for the wave to reach the farthest cell
const WAVE_RING_MAX_DELAY = 45; // ms between rings on small boards

// Pending timeouts of the current wave, cancelled by a new game
let waveTimeouts = [];

export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Show `targets` in rings spreading from the cell at `originIndex` of a
// grid with `cols` columns, calling `show` on each one, then `finish`
// once the wave is done. With reduced motion everything appears at once.
export function playWave({ cells, cols }, originIndex, targets, show, finish) {
  if (prefersReducedMotion() || originIndex === undefined) {
    targets.forEach(show);
    finish();
    return;
  }

  const sr = Math.floor(originIndex / cols);
  const sc = originIndex % cols;
  const rings = new Map();
  for (const cell of targets) {
    const i = cells.indexOf(cell);
    const d = Math.round(Math.hypot(Math.floor(i / cols) - sr, (i % cols) - sc));
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

export function cancelWave() {
  waveTimeouts.forEach(clearTimeout);
  waveTimeouts = [];
}

export function shake(el) {
  el.classList.remove("shake");
  void el.offsetWidth; // restart the animation if it is still running
  el.classList.add("shake");
  el.addEventListener("animationend", () => el.classList.remove("shake"), { once: true });
}
