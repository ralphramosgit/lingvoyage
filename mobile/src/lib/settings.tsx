import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, use, useCallback, useEffect, useState } from 'react';

export type Settings = {
  showPinyin: boolean;
  autoEnglish: boolean;
  autoPlay: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  showPinyin: true,
  autoEnglish: false,
  autoPlay: true,
};

const STORAGE_KEY = 'lingvoyage.settings.v1';

type SettingsContextValue = {
  settings: Settings;
  loaded: boolean;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const value = use(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>.');
  return value;
}

function parseStored(raw: string | null): Partial<Settings> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const result: Partial<Settings> = {};
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === 'boolean') result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

export function SettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => setSettings({ ...DEFAULT_SETTINGS, ...parseStored(raw) }))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  return <SettingsContext value={{ settings, loaded, updateSetting }}>{children}</SettingsContext>;
}
