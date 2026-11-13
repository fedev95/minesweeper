// On/off switch (role="switch") whose state is remembered.
// Clicking its label toggles it too. `onChange(on)` also runs once on init.

import { load, save } from "./storage.js";

export function initSwitch({ id, labelId, storageKey, defaultOn = false, onChange = () => {} }) {
  const button = document.getElementById(id);
  const label = document.getElementById(labelId);
  let on = false;

  const set = (value) => {
    on = value;
    button.setAttribute("aria-checked", String(on));
    onChange(on);
  };

  const toggle = () => {
    set(!on);
    save(storageKey, on ? "1" : "0");
  };

  button.addEventListener("click", toggle);
  label.addEventListener("click", () => {
    toggle();
    button.focus();
  });

  const saved = load(storageKey);
  set(saved === null ? defaultOn : saved === "1");

  return { isOn: () => on };
}
