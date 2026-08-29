type Theme = "light" | "dark";

const STORAGE_KEY = "mari-theme";

function initial(): Theme {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.dataset.theme;
  return attr === "dark" ? "dark" : "light";
}

class ThemeStore {
  current = $state<Theme>(initial());

  toggle() {
    this.current = this.current === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, this.current);
    document.documentElement.dataset.theme = this.current;
  }
}

export const theme = new ThemeStore();
