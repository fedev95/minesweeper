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
        el.textContent = Math.floor(elapsed);
      }, 100);
    },

    stop,

    reset() {
      stop();
      elapsed = 0;
      el.textContent = "0";
    },

    // Shows the final time with tenths (truncated, like a stopwatch) and returns it
    showFinal() {
      const final = Math.floor(elapsed * 10) / 10;
      el.textContent = final.toFixed(1);
      return final;
    },
  };
}
