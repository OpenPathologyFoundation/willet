// Preferences Store — user settings with localStorage fallback
// SDS 04-00 §4.3, SRS-190 through SRS-193

export interface UserPreferences {
  theme: 'light' | 'system' | 'dark';
  fontSize: number;                        // px, 12–20
  contextDockWidth: number;               // px, 280–500
  contextDockDefaultTab: 'clinical' | 'images' | 'synoptic' | null;
  voiceHotkey: string | null;             // KeyboardEvent.code value, e.g. 'F13'
  voiceTarget: 'clause' | 'prompt';       // default routing when no focus context
  clauseTypeSuggestion: boolean;          // enable/disable clause type suggestions (SRS-232)
}

const DEFAULTS: UserPreferences = {
  theme: 'system',
  fontSize: 14,
  contextDockWidth: 380,
  contextDockDefaultTab: 'clinical',
  voiceHotkey: null,
  voiceTarget: 'clause',
  clauseTypeSuggestion: true,
};

const STORAGE_KEY = 'willet-preferences';

class PreferencesStore {
  preferences = $state<UserPreferences>({ ...DEFAULTS });
  loaded = $state(false);

  // Derived convenience accessors
  get theme() { return this.preferences.theme; }
  get fontSize() { return this.preferences.fontSize; }
  get contextDockWidth() { return this.preferences.contextDockWidth; }
  get contextDockDefaultTab() { return this.preferences.contextDockDefaultTab; }
  get voiceHotkey() { return this.preferences.voiceHotkey; }
  get voiceTarget() { return this.preferences.voiceTarget; }
  get clauseTypeSuggestion() { return this.preferences.clauseTypeSuggestion; }

  /**
   * Load preferences from API (with localStorage fallback).
   * In standalone mode (MSW), always uses localStorage.
   */
  async load(apiFetch?: () => Promise<Partial<UserPreferences>>): Promise<void> {
    // Try API first
    if (apiFetch) {
      try {
        const remote = await apiFetch();
        this.preferences = { ...DEFAULTS, ...remote };
        this.loaded = true;
        this.saveToLocalStorage();
        return;
      } catch {
        // Fall through to localStorage
      }
    }

    // localStorage fallback
    this.loadFromLocalStorage();
    this.loaded = true;
  }

  /**
   * Update one or more preferences. Saves to localStorage immediately,
   * API persistence is handled by the caller (debounced).
   */
  update(partial: Partial<UserPreferences>): void {
    this.preferences = { ...this.preferences, ...partial };
    this.saveToLocalStorage();
  }

  private loadFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.preferences = { ...DEFAULTS, ...parsed };
      }
    } catch {
      // Corrupt data — use defaults
    }
  }

  private saveToLocalStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences));
    } catch {
      // localStorage full or unavailable
    }
  }

  reset(): void {
    this.preferences = { ...DEFAULTS };
    this.loaded = false;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
  }
}

export const preferencesStore = new PreferencesStore();
