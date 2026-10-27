import * as SecureStore from "expo-secure-store";

export const SESSION_TOKEN_KEY = "pos.mobile.session_token";

let memoryToken: string | null = null;

/**
 * Reads the persisted token. The in-memory copy keeps a non-remembered
 * session usable for the lifetime of the app process.
 */
export async function getStoredToken(): Promise<string | null> {
  try {
    const stored = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (stored) {
      memoryToken = stored;
      return stored;
    }
  } catch {
    // Secure storage is unavailable (e.g. web preview); use memory only.
  }
  return memoryToken;
}

export async function storeToken(token: string, remember: boolean): Promise<void> {
  memoryToken = token;
  try {
    if (remember) {
      await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    }
  } catch {
    // Keep the session in memory when the keychain cannot be written.
  }
}

export async function clearStoredToken(): Promise<void> {
  memoryToken = null;
  try {
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  } catch {
    // Nothing persisted to clear.
  }
}
