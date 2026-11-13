// Keyboard shortcut: R or F2 starts a new game.
// `isBlocked()` can disable it, e.g. while a dialog is open.
export function initShortcuts({ onRestart, isBlocked = () => false }) {
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return; // keep Ctrl+R etc.
    if (e.target.closest(".select")) return; // theme list uses letters to jump
    if (isBlocked()) return;
    if (e.key === "F2" || e.key.toLowerCase() === "r") {
      e.preventDefault();
      onRestart();
    }
  });
}
