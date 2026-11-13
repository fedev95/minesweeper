// Color scheme picker: a custom, accessible select (listbox pattern).
// The choice is remembered.

import { load, save } from "./storage.js";

const themeButton = document.getElementById("theme-button");
const themeValue = document.getElementById("theme-value");
const themeList = document.getElementById("theme-list");
const themeLabel = document.getElementById("theme-label");
const themeOptions = [...themeList.querySelectorAll('[role="option"]')];
let activeOption = 0; // highlighted option while the list is open

function applyTheme(name) {
  const option = themeOptions.find((o) => o.dataset.value === name) || themeOptions[0];
  const value = option.dataset.value;

  if (value === "default") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = value;

  themeOptions.forEach((o) => o.setAttribute("aria-selected", String(o === option)));
  themeValue.textContent = option.textContent;
  return value;
}

function selectTheme(index) {
  save("theme", applyTheme(themeOptions[index].dataset.value));
}

function setActive(index) {
  activeOption = Math.max(0, Math.min(themeOptions.length - 1, index));
  themeOptions.forEach((o, i) => o.classList.toggle("active", i === activeOption));
  const option = themeOptions[activeOption];
  themeList.setAttribute("aria-activedescendant", option.id);
  option.scrollIntoView({ block: "nearest" });
}

function openList() {
  themeList.hidden = false;
  themeButton.setAttribute("aria-expanded", "true");
  const selected = themeOptions.findIndex((o) => o.getAttribute("aria-selected") === "true");
  setActive(selected === -1 ? 0 : selected);
  themeList.focus();
}

function closeList(returnFocus = true) {
  themeList.hidden = true;
  themeButton.setAttribute("aria-expanded", "false");
  themeList.removeAttribute("aria-activedescendant");
  if (returnFocus) themeButton.focus();
}

export function initThemeSelect() {
  themeButton.addEventListener("click", () => {
    if (themeList.hidden) openList();
    else closeList();
  });

  themeButton.addEventListener("keydown", (e) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  });

  themeList.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setActive(activeOption + 1); break;
      case "ArrowUp":   e.preventDefault(); setActive(activeOption - 1); break;
      case "Home":      e.preventDefault(); setActive(0); break;
      case "End":       e.preventDefault(); setActive(themeOptions.length - 1); break;
      case "Enter":
      case " ":
        e.preventDefault();
        selectTheme(activeOption);
        closeList();
        break;
      case "Escape":
        e.preventDefault();
        closeList();
        break;
      case "Tab":
        closeList(false);
        break;
      default: {
        // Jump by first letter
        if (e.key.length !== 1) return;
        const key = e.key.toLowerCase();
        const n = themeOptions.length;
        for (let i = 1; i <= n; i++) {
          const idx = (activeOption + i) % n;
          if (themeOptions[idx].textContent.trim().toLowerCase().startsWith(key)) {
            setActive(idx);
            break;
          }
        }
      }
    }
  });

  themeOptions.forEach((option, i) => {
    option.addEventListener("mousemove", () => {
      if (activeOption !== i) setActive(i);
    });
    option.addEventListener("click", () => {
      selectTheme(i);
      closeList();
    });
  });

  // Click outside or focus loss: close
  document.addEventListener("mousedown", (e) => {
    if (!themeList.hidden && !e.target.closest(".select")) closeList(false);
  });

  themeList.addEventListener("focusout", (e) => {
    if (!themeList.hidden && !e.currentTarget.parentElement.contains(e.relatedTarget)) {
      closeList(false);
    }
  });

  // Click on the label: focus the button (like a <label> does)
  themeLabel.addEventListener("click", () => themeButton.focus());

  applyTheme(load("theme", "default"));
}
