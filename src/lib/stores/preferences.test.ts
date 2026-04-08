import { describe, it, expect, beforeEach, vi } from 'vitest';
import { preferencesStore, type UserPreferences } from './preferences.svelte';

// Mock localStorage for test isolation
const storage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
  get length() { return storage.size; },
  key: (index: number) => [...storage.keys()][index] ?? null,
};

vi.stubGlobal('localStorage', mockLocalStorage);

describe('preferencesStore', () => {
  beforeEach(() => {
    preferencesStore.reset();
    storage.clear();
  });

  it('initializes with default values', () => {
    expect(preferencesStore.theme).toBe('system');
    expect(preferencesStore.fontSize).toBe(14);
    expect(preferencesStore.contextDockWidth).toBe(380);
    expect(preferencesStore.contextDockDefaultTab).toBe('clinical');
    expect(preferencesStore.voiceHotkey).toBeNull();
    expect(preferencesStore.voiceTarget).toBe('clause');
    expect(preferencesStore.clauseTypeSuggestion).toBe(true);
  });

  it('loads from API fetch function', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ theme: 'dark', fontSize: 16 });
    await preferencesStore.load(mockFetch);
    expect(preferencesStore.loaded).toBe(true);
    expect(preferencesStore.theme).toBe('dark');
    expect(preferencesStore.fontSize).toBe(16);
    expect(preferencesStore.contextDockWidth).toBe(380);
  });

  it('falls back to localStorage when API fails', async () => {
    storage.set('willet-preferences', JSON.stringify({ theme: 'light', fontSize: 18 }));
    const failingFetch = vi.fn().mockRejectedValue(new Error('API down'));
    await preferencesStore.load(failingFetch);
    expect(preferencesStore.loaded).toBe(true);
    expect(preferencesStore.theme).toBe('light');
    expect(preferencesStore.fontSize).toBe(18);
  });

  it('loads from localStorage when no API function provided', async () => {
    storage.set('willet-preferences', JSON.stringify({ voiceHotkey: 'F13' }));
    await preferencesStore.load();
    expect(preferencesStore.loaded).toBe(true);
    expect(preferencesStore.voiceHotkey).toBe('F13');
  });

  it('update() changes preferences and persists to localStorage', () => {
    preferencesStore.update({ fontSize: 20, theme: 'dark' });
    expect(preferencesStore.fontSize).toBe(20);
    expect(preferencesStore.theme).toBe('dark');

    const stored = JSON.parse(storage.get('willet-preferences')!);
    expect(stored.fontSize).toBe(20);
    expect(stored.theme).toBe('dark');
  });

  it('update() preserves unmodified preferences', () => {
    preferencesStore.update({ fontSize: 16 });
    preferencesStore.update({ theme: 'dark' });
    expect(preferencesStore.fontSize).toBe(16);
    expect(preferencesStore.theme).toBe('dark');
  });

  it('reset() clears preferences and localStorage', () => {
    preferencesStore.update({ theme: 'dark' });
    preferencesStore.reset();
    expect(preferencesStore.theme).toBe('system');
    expect(preferencesStore.loaded).toBe(false);
    expect(storage.has('willet-preferences')).toBe(false);
  });

  it('handles corrupt localStorage gracefully', async () => {
    storage.set('willet-preferences', 'not valid json');
    await preferencesStore.load();
    expect(preferencesStore.loaded).toBe(true);
    expect(preferencesStore.theme).toBe('system');
  });

  it('validates all preference fields have schema defaults', () => {
    const fields: (keyof UserPreferences)[] = [
      'theme', 'fontSize', 'contextDockWidth', 'contextDockDefaultTab',
      'voiceHotkey', 'voiceTarget', 'clauseTypeSuggestion',
    ];
    for (const field of fields) {
      expect(preferencesStore.preferences[field]).toBeDefined();
    }
  });
});
