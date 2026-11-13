// Flag mode switch: when on, the primary click flags and the secondary reveals

import { initSwitch } from "./switch.js";

const helpLeft = document.getElementById("help-left");
const helpRight = document.getElementById("help-right");

let flagSwitch = null;

export const isFlagMode = () => flagSwitch?.isOn() ?? false;

export function initFlagMode() {
  flagSwitch = initSwitch({
    id: "mode",
    labelId: "mode-label",
    storageKey: "flag-mode",
    onChange: (on) => {
      helpLeft.textContent = on ? "flag" : "reveal";
      helpRight.textContent = on ? "reveal" : "flag";
    },
  });
}
