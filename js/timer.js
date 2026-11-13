// Like the classic game, the clock is a 3-digit counter that stops at 999
export const MAX_SECONDS = 999;

// Best time as shown in the panel: tenths, except a capped 999
export const formatBest = (best) =>
  best === MAX_SECONDS ? String(MAX_SECONDS) : best.toFixed(1);

// Stopwatch rendered into `el`: whole seconds while running,
// tenths only when the final time is shown.
export function createTimer(el) {
  let interval = null;
  let startTime = 0; // performance.now() when started
  let elapsed = 0;   // seconds

  function stop() {
    if (interval !== null) elapsed = (performance.now() - startTime) / 1000;
    clearInterval(interval);
    interval = null;
  }

  return {
    start() {
      stop();
      startTime = performance.now();
      // Tick often so whole seconds change on time
      interval = setInterval(() => {
        elapsed = (performance.now() - startTime) / 1000;
        el.textContent = Math.min(Math.floor(elapsed), MAX_SECONDS);
      }, 100);
    },

    stop,

    reset() {
      stop();
      elapsed = 0;
      el.textContent = "0";
    },

    // Shows the final time with tenths (truncated, like a stopwatch) and
    // returns { seconds, capped }. Past the limit the clock stays at 999.
    showFinal() {
      if (elapsed >= MAX_SECONDS + 1) {
        el.textContent = MAX_SECONDS;
        return { seconds: MAX_SECONDS, capped: true };
      }
      const seconds = Math.floor(elapsed * 10) / 10;
      el.textContent = seconds.toFixed(1);
      return { seconds, capped: false };
    },
  };
}
