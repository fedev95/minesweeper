const MAX_CELL = 32;
const MIN_CELL = 20;
const PAGE_GUTTER = 16 * 2 + 8 * 2; // body padding + board-wrap padding

// Fit the board to the screen width. On narrow portrait screens, a board
// wider than tall is shown rotated 90° (rows become columns) so it fits
// better. Only the visual grid changes; game logic stays the same.
export function layoutBoard(boardEl, level) {
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
