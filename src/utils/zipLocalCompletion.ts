import AsyncStorage from '@react-native-async-storage/async-storage';

const storageKey = (puzzleDate: string) => `zip_completed_${puzzleDate}`;

export type LocalZipCompletion = {
  timeMs: number;
  completedAt: string;
};

export async function getLocalZipCompletion(
  puzzleDate: string,
): Promise<LocalZipCompletion | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(puzzleDate));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalZipCompletion;
    if (typeof parsed.timeMs !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setLocalZipCompletion(
  puzzleDate: string,
  timeMs: number,
): Promise<void> {
  const payload: LocalZipCompletion = {
    timeMs,
    completedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(storageKey(puzzleDate), JSON.stringify(payload));
}
