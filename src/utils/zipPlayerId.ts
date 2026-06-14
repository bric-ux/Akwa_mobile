import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'zip_anonymous_player_id';

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export async function getOrCreateZipAnonymousId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    const created = generateUuid();
    await AsyncStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return generateUuid();
  }
}
