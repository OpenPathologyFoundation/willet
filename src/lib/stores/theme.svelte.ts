// Theme store — mirrors Starling's theme system
// Light/dark mode with system preference detection and localStorage persistence

type Theme = 'system' | 'dark' | 'light';

class ThemeStore {
  mode = $state<Theme>('system');

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('willet_theme') as Theme | null;
      if (stored) {
        this.mode = stored;
      }
      this.apply();
    }
  }

  setMode(newMode: Theme) {
    this.mode = newMode;
    if (typeof window !== 'undefined') {
      localStorage.setItem('willet_theme', newMode);
      this.apply();
    }
  }

  get isDark(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      this.mode === 'dark' ||
      (this.mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  }

  private apply() {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    if (this.isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }

  init() {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => {
      if (this.mode === 'system') this.apply();
    });
    this.apply();
  }
}

export const themeStore = new ThemeStore();
