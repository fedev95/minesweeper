// Flag mode switch: when on, the primary click flags and the secondary reveals

import { load, save } from "./storage.js";

const modeBtn = document.getElementById("mode");
const modeLabel = document.getElementById("mode-label");
const helpLeft = document.getElementById("help-left");
const helpRight = document.getElementById("help-right");

let flagMode = false;

export const isFlagMode = () => flagMode;

function setFlagMode(on) {
  flagMode = on;
  modeBtn.setAttribute("aria-checked", String(on));
  helpLeft.textContent = on ? "flag" : "reveal";
  helpRight.textContent = on ? "reveal" : "flag";
}

function toggleFlagMode() {
  setFlagMode(!flagMode);
  save("flag-mode", flagMode ? "1" : "0");
}

export function initFlagMode() {
  modeBtn.addEventListener("click", toggleFlagMode);

  // Clicking the label toggles the switch too
  modeLabel.addEventListener("click", () => {
    toggleFlagMode();
    modeBtn.focus();
  });

  setFlagMode(load("flag-mode") === "1");
}
